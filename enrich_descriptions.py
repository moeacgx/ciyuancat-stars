#!/usr/bin/env python3
"""
安全版页面增强：
- 英文 description 自动翻成中文
- 缺失 description 时基于 README 提炼一句中文描述
- topics 太少时基于 README/description 自动补标签
- 不调用 openclaw agent，不向当前聊天冒泡内部 prompt
"""
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE = Path('/root/.openclaw/workspace-team-a')
PAGE_DIR = BASE / 'data/ciyuancat-stars-page'
CACHE_PATH = PAGE_DIR / 'desc_cache.json'
README_PATHS = [
    BASE / 'tmp/star-audit/readmes.json',
    BASE / 'skills/github-star-auto/data/readmes.json',
]

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
    (r'golang|\bgo\b', ['golang']),
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


def has_cjk(text: str) -> bool:
    return bool(re.search(r'[\u4e00-\u9fff]', text or ''))


def normalize_space(text: str) -> str:
    text = (text or '').replace('\r', '\n')
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def clean_markdown(text: str) -> str:
    text = text or ''
    text = re.sub(r'```[\s\S]*?```', ' ', text)
    text = re.sub(r'`[^`]*`', ' ', text)
    text = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'[#>*_~\-|]+', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def pick_summary_source(repo: str, raw_desc: str, readme: str) -> str:
    if raw_desc:
        return raw_desc.strip()
    text = clean_markdown(readme)
    if not text:
        return ''
    # split into candidate sentences
    candidates = re.split(r'(?<=[.!?。！？])\s+|\n+', text)
    bad = re.compile(r'^(installation|install|usage|license|mit|apache|contributing|roadmap|todo|changelog|features?)\b', re.I)
    repo_words = set(re.findall(r'[a-z0-9]+', repo.lower()))
    for c in candidates:
        c = normalize_space(c)
        if len(c) < 20:
            continue
        if bad.search(c):
            continue
        # skip lines that are basically the repo name repeated
        words = set(re.findall(r'[a-z0-9]+', c.lower()))
        if words and len(words - repo_words) <= 1 and len(c) < 80:
            continue
        return c[:260]
    return text[:260]


def trim_zh(text: str, limit: int = 28) -> str:
    text = normalize_space(text)
    if len(text) <= limit:
        return text.rstrip('。；，、 ')
    cut = text[:limit]
    pos = max(cut.rfind(p) for p in '。；，、！？”》')
    if pos >= 10:
        cut = cut[:pos]
    return cut.rstrip('。；，、 ') + '…'


def translate_to_zh(text: str) -> str:
    text = normalize_space(text)
    if not text:
        return '暂无公开描述'
    if has_cjk(text):
        return trim_zh(text, 30)
    url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' + quote(text[:800])
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(req, timeout=20) as resp:
        body = resp.read().decode('utf-8', 'ignore')
    data = json.loads(body)
    translated = ''.join(part[0] for part in data[0] if part and part[0])
    translated = re.sub(r'\s+', '', translated)
    translated = translated.replace('GitHub', 'GitHub ')
    return trim_zh(translated, 28)


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
    # fallback from repo name tokens
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
    readmes = {}
    for p in README_PATHS:
        readmes.update(load_json(p, {}))

    stars_data = load_json(PAGE_DIR / 'data.json', {})
    items = stars_data.get('items') or []
    if not items:
        raise SystemExit('data/ciyuancat-stars-page/data.json not found or empty; run build_page.py first')

    work = []
    for item in items:
        repo = item['repo']
        entry = cache.get(repo, {})
        raw_desc = (item.get('description') or '').strip()
        # if current page description is already a cached zh_desc from previous run, keep source empty and rely on cache
        source_desc = '' if has_cjk(raw_desc) else raw_desc
        existing_topics = item.get('topics') or []
        if entry.get('zh_desc') and (len(existing_topics) >= 2 or entry.get('auto_tags')):
            continue
        work.append({
            'repo': repo,
            'raw_desc': source_desc,
            'readme': readmes.get(repo, ''),
            'topics': existing_topics,
        })

    print({'total': len(items), 'need_enrich': len(work)})

    def process(item):
        repo = item['repo']
        raw_desc = item['raw_desc']
        readme = item['readme']
        zh_desc = cache.get(repo, {}).get('zh_desc')
        if not zh_desc:
            src = pick_summary_source(repo, raw_desc, readme)
            try:
                zh_desc = translate_to_zh(src) if src else '暂无公开描述'
            except Exception:
                zh_desc = trim_zh(src or '暂无公开描述', 28) if has_cjk(src) else '暂无公开描述'
        auto_tags = cache.get(repo, {}).get('auto_tags')
        if not auto_tags or len(auto_tags) < 2:
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
