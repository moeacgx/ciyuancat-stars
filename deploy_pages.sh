#!/usr/bin/env bash
set -euo pipefail

REPO="moeacgx/ciyuancat-stars"
DIR="/root/.openclaw/workspace-team-a/data/ciyuancat-stars-page"
cd "$DIR"

if [ ! -d .git ]; then
  git init
  git checkout -B main
fi

git config user.name "OpenClaw"
git config user.email "openclaw@users.noreply.github.com"

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

git push -u origin main

# Enable or update GitHub Pages from main branch root.
if gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/$REPO/pages" -F source[branch]=main -F source[path]=/
else
  gh api -X POST "repos/$REPO/pages" -F source[branch]=main -F source[path]=/
fi

# Best effort: print repo + pages url
REPO_URL=$(gh repo view "$REPO" --json url --jq '.url')
PAGES_URL=$(gh api "repos/$REPO/pages" --jq '.html_url' 2>/dev/null || true)
printf 'repo=%s\npages=%s\n' "$REPO_URL" "$PAGES_URL"
