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
import os
import re
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = Path('/root/apps/github-daily')
PAGE_DIR = BASE / 'ciyuancat-stars-page'
CACHE_PATH = PAGE_DIR / 'desc_cache.json'
README_PATHS = [
    BASE / 'tmp/star-audit/readmes.json',
    BASE / 'github-star-auto/data/readmes.json',
]
DESC_OVERRIDE_PATH = PAGE_DIR / 'desc_overrides.json'
HERMES_BIN = os.getenv('HERMES_BIN', '/root/hermes-agent/venv/bin/hermes')
DAILY_LLM_MODEL = os.getenv('GITHUB_STARS_LLM_MODEL', 'gpt-5.4')

SUMMARY_WORKERS = int(os.getenv('GITHUB_STARS_SUMMARY_WORKERS', '2'))
FORCE_DESC_REFRESH = os.getenv('GITHUB_STARS_FORCE_DESC_REFRESH', '0').lower() in ('1', 'true', 'yes')

RESET_DESC_CACHE = os.getenv('GITHUB_STARS_RESET_DESC_CACHE', '0').lower() in ('1', 'true', 'yes')


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


def gh_token():
    hosts = Path('/root/.config/gh/hosts.yml')
    if hosts.exists():
        text = hosts.read_text()
        m = re.search(r'oauth_token:\s*(\S+)', text)
        if m:
            return m.group(1)
    return os.getenv('GH_TOKEN', '')


def run(cmd):
    env = os.environ.copy()
    token = gh_token()
    if token and not env.get('GH_TOKEN'):
        env['GH_TOKEN'] = token
    p = subprocess.run(cmd, text=True, capture_output=True, env=env)
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


def fetch_jina_markdown(url: str, max_chars: int = 1800) -> str:
    if not url:
        return ''
    target = url.strip()
    if not (target.startswith('http://') or target.startswith('https://')):
        return ''
    jina_url = f"https://r.jina.ai/http://{target[len('http://'):] if target.startswith('http://') else target[len('https://'):]}"
    req = Request(jina_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urlopen(req, timeout=25) as resp:
            body = resp.read().decode('utf-8', 'ignore')
            return clean_markdown(body)[:max_chars]
    except (HTTPError, URLError, TimeoutError, Exception):
        return ''


def build_repo_source_context(repo: str, raw_desc: str, readme: str) -> str:
    parts = []
    if readme:
        parts.append(clean_markdown(readme)[:1800])
    github_url = f"https://github.com/{repo}"
    jina_md = fetch_jina_markdown(github_url, max_chars=1800)
    if jina_md and jina_md not in parts:
        parts.append(jina_md)
    if raw_desc:
        parts.append(clean_markdown(raw_desc)[:300])
    return normalize_space('\n\n'.join([p for p in parts if p]))[:1800]


def sanitize_llm_desc(text: str) -> str:
    text = normalize_space(text)
    text = re.sub(r'\bsession_id\s*[:：]\s*\S+', '', text, flags=re.I)
    text = re.sub(r'\btrace_id\s*[:：]\s*\S+', '', text, flags=re.I)
    text = re.sub(r'^[\-—:：;；,.，。]+', '', text).strip(' "“”')
    text = re.sub(r'(?:\s*[（(]?(?:仅输出|输出|result|answer|最终答案|final answer).*)$', '', text, flags=re.I)
    text = normalize_space(text)
    return trim_zh(text or '暂无公开描述', 80)


def is_good_zh_desc(text: str) -> bool:
    text = sanitize_llm_desc(text)
    if not text or text == '暂无公开描述':
        return False
    if 'session_id' in text.lower() or 'trace_id' in text.lower():
        return False
    if len(text) < 8 or len(text) > 80:
        return False
    return has_cjk(text)


def llm_summary_to_zh(repo: str, raw_desc: str, readme: str) -> str:
    source = build_repo_source_context(repo, raw_desc, readme)
    if not source:
        return '暂无公开描述'
    prompt = (
        '你在读一个 GitHub 仓库的 README 与页面 markdown 内容。'
        '请只输出 18-32 字中文一句话描述。要求：'
        '1）必须写清核心对象与关键能力；'
        '2）尽量带具体名词，不要空泛分类；'
        '3）不要输出 markdown、引号、编号、解释；'
        '4）若原始内容是中文可直接凝练，不要直译腔；'
        '5）绝对不要输出 session_id、trace_id 或任何调试信息。\n'
        f'仓库：{repo}\n'
        f'内容：{source}'
    )
    result = subprocess.run(
        [HERMES_BIN, 'chat', '-q', prompt, '-Q', '-m', DAILY_LLM_MODEL],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or 'llm summary failed')
    cleaned = sanitize_llm_desc(result.stdout or '')
    if not is_good_zh_desc(cleaned):
        raise RuntimeError(f'bad llm desc: {cleaned}')
    return cleaned


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
    cache = {} if RESET_DESC_CACHE else load_json(CACHE_PATH, {})
    desc_overrides = load_json(DESC_OVERRIDE_PATH, {})
    readmes = {}
    for p in README_PATHS:
        readmes.update(load_json(p, {}))
    stars = fetch_current_stars()

    work = []
    skipped = 0
    for row in stars:
        repo = row['nameWithOwner']
        raw_desc = normalize_space(row.get('description') or '')
        topics = [n['topic']['name'] for n in (((row.get('repositoryTopics') or {}).get('nodes')) or [])]
        cached = cache.get(repo) or {}
        cached_desc = sanitize_llm_desc(cached.get('zh_desc') or '')
        if cached_desc and is_good_zh_desc(cached_desc) and not FORCE_DESC_REFRESH:
            skipped += 1
            continue
        work.append({
            'repo': repo,
            'raw_desc': raw_desc,
            'readme': readmes.get(repo, ''),
            'topics': topics,
        })

    print({'total': len(stars), 'need_enrich': len(work), 'skipped_cache': skipped})

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
        try:
            zh_desc = llm_summary_to_zh(repo, raw_desc, readme)
        except Exception:
            fallback_src = build_repo_source_context(repo, raw_desc, readme) or raw_desc or readme
            zh_desc = prefer_cjk_segment(fallback_src) or (translate_to_zh(fallback_src) if fallback_src else '暂无公开描述')
        zh_desc = sanitize_llm_desc(zh_desc)
        auto_tags = infer_tags(repo, raw_desc, readme, item['topics'])
        return repo, {'zh_desc': zh_desc, 'auto_tags': auto_tags}

    done = 0
    with ThreadPoolExecutor(max_workers=SUMMARY_WORKERS) as ex:
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
