#!/usr/bin/env python3
"""
安全版页面增强：
- 英文 description 自动翻成中文
- 缺失 description 时基于 README 提炼一句中文描述
- topics 太少时基于 README/description 自动补标签
- 不调用 openclaw agent，不向当前聊天冒泡内部 prompt
"""
import html
import json
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE = Path('/root/apps/github-daily')
PAGE_DIR = BASE / 'ciyuancat-stars-page'
CACHE_PATH = PAGE_DIR / 'desc_cache.json'
README_PATHS = [
    BASE / 'tmp/star-audit/readmes.json',
    BASE / 'github-star-auto/data/readmes.json',
]
DESC_OVERRIDE_PATH = PAGE_DIR / 'desc_overrides.json'

KEYWORD_TAGS = [
    (r'cloudflare|workers|wrangler|cloudflared|pages\b|d1\b|r2\b', ['cloudflare', 'workers']),
    (r'telegram|tg\b|mtproto', ['telegram', 'telegram-bot']),
    (r'discord', ['discord', 'discord-bot']),
    (r'wechat|weixin|微信', ['wechat']),
    (r'bitwarden', ['bitwarden', 'password-manager']),
    (r'openclaw', ['openclaw']),
    (r'codex', ['codex']),
    (r'claude code|claude', ['claude-code']),
    (r'model context protocol|\bmcp\b', ['mcp']),
    (r'agent swarm|multi-agent|multi agent|agentic|\bagent\b|\bagents\b', ['ai-agent']),
    (r'plugin|plugins', ['plugin']),
    (r'browser automation|desktop automation|clicks|typing|screenshots|puppeteer|playwright|rpa', ['automation', 'browser-automation']),
    (r'scrap|scrapling|crawler|crawl|scraper|web scraping', ['scraping', 'crawler']),
    (r'docker', ['docker']),
    (r'webdav', ['webdav']),
    (r'onedrive', ['onedrive']),
    (r'seo|geo strategies|gsc\b|google ranks', ['seo']),
    (r'api gateway|openai-compatible|openai compatible|proxy|中转|网关|2api|oneapi|new-api', ['api-gateway']),
    (r'workflow', ['workflow-automation']),
    (r'cli', ['cli']),
    (r'rag', ['rag']),
    (r'rust', ['rust']),
    (r'golang|\bgolang\b|\bgo\b', ['golang']),
    (r'python', ['python']),
    (r'typescript', ['typescript']),
    (r'javascript', ['javascript']),
    (r'tauri', ['tauri']),
    (r'ssh|sftp', ['ssh']),
    (r'terminal', ['terminal']),
    (r'version control|checkpoint|rollback', ['version-control']),
    (r'canvas|notes|knowledge workspace', ['knowledge-management']),
    (r'presentation cards|bento grid', ['ui-cards']),
]


def load_json(path, default):
    p = Path(path)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return default
    return default


def save_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2))


def run(cmd):
    p = subprocess.run(cmd, text=True, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or p.stdout.strip() or 'command failed')
    return p.stdout


def fetch_current_stars():
    query = '''query($endCursor: String) {
      viewer {
        starredRepositories(first: 100, after: $endCursor, orderBy: {field: STARRED_AT, direction: DESC}) {
          edges {
            starredAt
            node {
              nameWithOwner
              description
              repositoryTopics(first: 20) { nodes { topic { name } } }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }'''
    out = run(['gh', 'api', 'graphql', '--paginate', '-f', f'query={query}', '--jq', '.data.viewer.starredRepositories.edges[]'])
    rows = []
    for line in out.splitlines():
        if not line.strip():
            continue
        edge = json.loads(line)
        node = edge['node']
        node['starredAt'] = edge.get('starredAt')
        rows.append(node)
    return rows


def has_cjk(text: str) -> bool:
    return bool(re.search(r'[\u4e00-\u9fff]', text or ''))


def normalize_space(text: str) -> str:
    text = html.unescape((text or '').replace('\r', '\n'))
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def clean_markdown(text: str) -> str:
    text = html.unescape(text or '')
    text = re.sub(r'```[\s\S]*?```', ' ', text)
    text = re.sub(r'`[^`]*`', ' ', text)
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'[#>*_~\-|]+', ' ', text)
    text = re.sub(r'\b(stars|forks|issues|license|mit|apache-2.0)\b', ' ', text, flags=re.I)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def pick_summary_source(repo: str, raw_desc: str, readme: str) -> str:
    if raw_desc:
        return normalize_space(raw_desc)[:220]
    text = clean_markdown(readme)
    if not text:
        return ''
    candidates = re.split(r'(?<=[.!?。！？])\s+|\n+', text)
    bad = re.compile(
        r'^(english|中文|table of contents|toc|installation|install|usage|license|mit|apache|contributing|roadmap|todo|changelog|features?|screenshots?)\b',
        re.I,
    )
    repo_words = set(re.findall(r'[a-z0-9]+', repo.lower()))
    for c in candidates:
        c = normalize_space(c)
        if len(c) < 24:
            continue
        if bad.search(c):
            continue
        if re.search(r'^(🇬🇧|🇨🇳|⚡|✨|🚀|🧑|🎯|🕷️|⭐|▶)', c):
            continue
        if re.search(r'^(if you like|sponsor|donate|buy me a coffee|support)', c, re.I):
            continue
        if re.search(r'&(nbsp|amp|lt|gt);', c, re.I):
            continue
        words = set(re.findall(r'[a-z0-9]+', c.lower()))
        if words and len(words - repo_words) <= 1 and len(c) < 100:
            continue
        return c[:260]
    return text[:260]


def trim_zh(text: str, limit: int = 80) -> str:
    text = normalize_space(text).rstrip('。；，、 ')
    if len(text) <= limit:
        return text
    cut = text[:limit]
    pos = max(cut.rfind(p) for p in '。；，、！？"》')
    if pos >= 15:
        cut = cut[:pos]
    return cut.rstrip('。；，、 ')


def clean_desc_noise(text: str) -> str:
    text = normalize_space(text)
    text = re.sub(r'^(:[a-z0-9_+\-]+:)\s*', '', text, flags=re.I)
    text = re.sub(r'^[⭐✨🚀🎯🧑🕷️▶⚡🔥💡📌🎉]+\s*', '', text)
    text = re.sub(r'\s*[|｜]+\s*$', '', text)
    return normalize_space(text)


def prefer_cjk_segment(text: str) -> str:
    text = clean_desc_noise(text)
    if not has_cjk(text):
        return ''
    parts = re.split(r'\s(?:-|—|\|)\s', text)
    for part in reversed(parts):
        part = normalize_space(part)
        if has_cjk(part) and len(part) >= 8:
            return trim_zh(part, 80)
    first_cjk = re.search(r'[\u4e00-\u9fff]', text)
    if not first_cjk:
        return ''
    idx = first_cjk.start()
    if idx > 0:
        prefix = re.search(r'[A-Za-z0-9+#./_-]{1,4}$', text[:idx])
        if prefix:
            text = prefix.group(0) + text[idx:]
        else:
            text = text[idx:]
    text = re.sub(r'（[^）]{0,40}(我已经看到了，撤回也没用了|English|中文)[^）]*）', '', text, flags=re.I)
    return trim_zh(text, 80)


def translate_to_zh(text: str) -> str:
    text = clean_desc_noise(text)
    if not text:
        return '暂无公开描述'
    if has_cjk(text):
        preferred = prefer_cjk_segment(text)
        if preferred:
            return preferred
        return trim_zh(text, 80)
    url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' + quote(text[:800])
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=20) as resp:
        body = resp.read().decode('utf-8', 'ignore')
    data = json.loads(body)
    translated = ''.join(part[0] for part in data[0] if part and part[0])
    translated = normalize_space(translated)
    return trim_zh(translated, 80)


def infer_tags(repo: str, raw_desc: str, readme: str, existing_topics):
    tags = []
    existing_topics = existing_topics or []
    tags.extend(existing_topics[:5])
    blob = f"{repo}\n{raw_desc}\n{readme[:1500]}".lower()
    for pat, vals in KEYWORD_TAGS:
        if re.search(pat, blob, re.I):
            for v in vals:
                if v not in tags:
                    tags.append(v)
    for tok in re.findall(r'[a-z0-9]+', repo.lower().split('/')[-1]):
        if len(tok) >= 4 and tok not in {'github', 'repo', 'tool', 'utils', 'skills', 'skill', 'awesome'}:
            if tok not in tags:
                tags.append(tok)
        if len(tags) >= 5:
            break
    return tags[:5]


def main():
    PAGE_DIR.mkdir(parents=True, exist_ok=True)
    cache = load_json(CACHE_PATH, {})
    desc_overrides = load_json(DESC_OVERRIDE_PATH, {})
    readmes = {}
    for p in README_PATHS:
        readmes.update(load_json(p, {}))
    stars = fetch_current_stars()

    work = []
    for row in stars:
        repo = row['nameWithOwner']
        raw_desc = normalize_space(row.get('description') or '')
        topics = [n['topic']['name'] for n in (((row.get('repositoryTopics') or {}).get('nodes')) or [])]
        work.append({
            'repo': repo,
            'raw_desc': raw_desc,
            'readme': readmes.get(repo, ''),
            'topics': topics,
        })

    print({'total': len(work), 'need_enrich': len(work)})

    def process(item):
        repo = item['repo']
        raw_desc = item['raw_desc']
        readme = item['readme']
        if repo in desc_overrides:
            ov = desc_overrides[repo]
            auto_tags = ov.get('auto_tags') or infer_tags(repo, raw_desc, readme, item['topics'])
            return repo, {
                'zh_desc': trim_zh(ov.get('zh_desc') or '暂无公开描述', 80),
                'auto_tags': auto_tags[:5],
            }
        src = pick_summary_source(repo, raw_desc, readme)
        try:
            zh_desc = translate_to_zh(src) if src else '暂无公开描述'
        except Exception:
            zh_desc = prefer_cjk_segment(src) or (trim_zh(src or '暂无公开描述', 80) if has_cjk(src) else '暂无公开描述')
        auto_tags = infer_tags(repo, raw_desc, readme, item['topics'])
        return repo, {'zh_desc': zh_desc, 'auto_tags': auto_tags}

    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(process, item) for item in work]
        for fut in as_completed(futs):
            repo, result = fut.result()
            cache.setdefault(repo, {}).update(result)
            done += 1
            if done % 25 == 0 or done == len(futs):
                save_json(CACHE_PATH, cache)
                print({'done': done, 'total': len(futs)})
                time.sleep(0.1)

    save_json(CACHE_PATH, cache)
    print({'cache_entries': len(cache)})


if __name__ == '__main__':
    main()
