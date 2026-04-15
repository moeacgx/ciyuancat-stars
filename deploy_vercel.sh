#!/usr/bin/env bash
set -euo pipefail

DIR="/root/apps/github-daily/ciyuancat-stars-page"
TOKENS_FILE="/root/openclaw-info/TOKENS.md"
GH_HOSTS="/root/.config/gh/hosts.yml"

if [[ ! -f "$TOKENS_FILE" ]]; then
  echo "missing tokens file: $TOKENS_FILE" >&2
  exit 1
fi

TEAM_ID=$(awk -F': ' '/^- team-main:/ {print $2}' "$TOKENS_FILE")
TOKEN=$(awk -F': ' '/^- personal-api-token:/ {print $2}' "$TOKENS_FILE")
GH_TOKEN="${GH_TOKEN:-}"
if [[ -z "$GH_TOKEN" ]]; then
  GH_TOKEN="$(gh auth token 2>/dev/null || true)"
fi
if [[ -z "$GH_TOKEN" && -f "$GH_HOSTS" ]]; then
  GH_TOKEN="$(python3 - <<'PY'
from pathlib import Path
import re
p = Path('/root/.config/gh/hosts.yml')
text = p.read_text(encoding='utf-8') if p.exists() else ''
m = re.search(r'^\s*oauth_token:\s*(\S+)\s*$', text, re.M)
print(m.group(1) if m else '')
PY
)"
fi

if [[ -z "${TEAM_ID:-}" || -z "${TOKEN:-}" ]]; then
  echo "missing Vercel team id or token in $TOKENS_FILE" >&2
  exit 1
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "missing GH_TOKEN and could not read one from $GH_HOSTS" >&2
  exit 1
fi

cd "$DIR"
export GH_TOKEN
python3 build_page.py >/dev/null
npx vercel@latest --prod --yes --token "$TOKEN" --scope "$TEAM_ID"
