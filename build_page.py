#!/usr/bin/env python3
import json
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace-team-a/data/ciyuancat-stars-page')
CACHE = Path('/root/.openclaw/workspace-team-a/skills/github-star-auto/data/classification_cache.json')
SEED = Path('/root/.openclaw/workspace-team-a/tmp/star-audit/stars_final_classified.json')
DESC_CACHE = ROOT / 'desc_cache.json'


def run(cmd):
    p = subprocess.run(cmd, text=True, capture_output=True)
    if p.returncode != 0:
        raise SystemExit(p.stderr or p.stdout)
    return p.stdout


def fetch_current_stars():
    query = '''query($endCursor: String) {
      viewer {
        login
        starredRepositories(first: 100, after: $endCursor, orderBy: {field: STARRED_AT, direction: DESC}) {
          edges {
            starredAt
            node {
              id
              nameWithOwner
              description
              url
              stargazerCount
              primaryLanguage { name }
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


def load_cache():
    cache = {}
    if SEED.exists():
        for row in json.loads(SEED.read_text()):
            cache[row['repo']] = {
                'category': row['category'],
                'reason': row.get('reason', ''),
            }
    if CACHE.exists():
        cache.update(json.loads(CACHE.read_text()))
    return cache


def load_desc_cache():
    if DESC_CACHE.exists():
        return json.loads(DESC_CACHE.read_text())
    return {}


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    stars = fetch_current_stars()
    cache = load_cache()
    desc_cache = load_desc_cache()

    items = []
    categories = {}
    for row in stars:
        repo = row['nameWithOwner']
        cached = cache.get(repo, {})
        desc_cached = desc_cache.get(repo, {})
        category = cached.get('category', '未分类')
        raw_desc = (row.get('description') or '').strip()
        one_liner = desc_cached.get('zh_desc') or raw_desc or '暂无公开描述'
        topics = [n['topic']['name'] for n in (((row.get('repositoryTopics') or {}).get('nodes')) or [])]
        if len(topics) < 2 and desc_cached.get('auto_tags'):
            topics = list(dict.fromkeys(topics + desc_cached.get('auto_tags', [])))[:8]
        item = {
            'repo': repo,
            'url': row['url'],
            'description': one_liner,
            'category': category,
            'topics': topics,
            'language': ((row.get('primaryLanguage') or {}).get('name') or ''),
            'stars': row.get('stargazerCount') or 0,
            'starredAt': row.get('starredAt') or '',
        }
        items.append(item)
        categories[category] = categories.get(category, 0) + 1

    items.sort(key=lambda x: (x['category'], -(x['stars'] or 0), x['repo'].lower()))

    generated_at = datetime.now().isoformat(timespec='seconds')
    previous = None
    data_json = ROOT / 'data.json'
    if data_json.exists():
        try:
            previous = json.loads(data_json.read_text())
        except Exception:
            previous = None

    if previous and previous.get('items') == items and previous.get('categories') == categories and previous.get('total') == len(items):
        generated_at = previous.get('generatedAt', generated_at)

    payload = {
        'title': '次元猫的 GitHub Star 收藏',
        'generatedAt': generated_at,
        'total': len(items),
        'categories': categories,
        'items': items,
    }
    payload_text = json.dumps(payload, ensure_ascii=False, indent=2)
    public_dir = ROOT / 'public'
    public_dir.mkdir(parents=True, exist_ok=True)
    (ROOT / 'data.json').write_text(payload_text)
    (ROOT / 'data.js').write_text('window.__STAR_PAGE_DATA__ = ' + payload_text + ';\n')
    (public_dir / 'data.json').write_text(payload_text)
    print(f'wrote {ROOT / "data.json"} with {len(items)} items')
    print(f'wrote {ROOT / "data.js"} with {len(items)} items')
    print(f'wrote {public_dir / "data.json"} with {len(items)} items')


if __name__ == '__main__':
    main()
