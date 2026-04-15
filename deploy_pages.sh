#!/usr/bin/env bash
set -euo pipefail

REPO="moeacgx/ciyuancat-stars"
DIR="/root/apps/github-daily/ciyuancat-stars-page"
GH_HOSTS="/root/.config/gh/hosts.yml"
GIT_USER_NAME="${GITHUB_PAGES_GIT_USER_NAME:-github-daily}"
GIT_USER_EMAIL="${GITHUB_PAGES_GIT_USER_EMAIL:-github-daily@local}"

if [[ -z "${GH_TOKEN:-}" ]]; then
  if ! gh auth token >/dev/null 2>&1; then
    GH_TOKEN="$(python3 - <<'PY'
from pathlib import Path
import re
p = Path('/root/.config/gh/hosts.yml')
text = p.read_text(encoding='utf-8') if p.exists() else ''
m = re.search(r'^\s*oauth_token:\s*(\S+)\s*$', text, re.M)
print(m.group(1) if m else '')
PY
)"
    if [[ -n "$GH_TOKEN" ]]; then
      export GH_TOKEN
    fi
  fi
fi

cd "$DIR"

if [ ! -d .git ]; then
  git init
  git checkout -B main
fi

git config user.name "$GIT_USER_NAME"
git config user.email "$GIT_USER_EMAIL"

git checkout -B main

git add .
if ! git diff --cached --quiet; then
  git commit -m "chore: update star showcase"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  if gh repo view "$REPO" >/dev/null 2>&1; then
    git remote add origin "https://github.com/$REPO.git"
  else
    gh repo create "$REPO" --public --source . --remote origin --push
  fi
fi

if [[ -n "${GH_TOKEN:-}" ]]; then
  git -c http.extraheader="AUTHORIZATION: bearer $GH_TOKEN" push -u origin main
else
  git push -u origin main
fi

if gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/$REPO/pages" -F source[branch]=main -F source[path]=/
else
  gh api -X POST "repos/$REPO/pages" -F source[branch]=main -F source[path]=/
fi

REPO_URL=$(gh repo view "$REPO" --json url --jq '.url')
PAGES_URL=$(gh api "repos/$REPO/pages" --jq '.html_url' 2>/dev/null || true)
printf 'repo=%s\npages=%s\n' "$REPO_URL" "$PAGES_URL"
