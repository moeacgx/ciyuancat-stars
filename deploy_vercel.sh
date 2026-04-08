#!/usr/bin/env bash
set -euo pipefail

DIR="/root/.openclaw/workspace-team-a/data/ciyuancat-stars-page"
TOKENS_FILE="/root/openclaw-info/TOKENS.md"

if [[ ! -f "$TOKENS_FILE" ]]; then
  echo "missing tokens file: $TOKENS_FILE" >&2
  exit 1
fi

TEAM_ID=$(awk -F': ' '/^- team-main:/ {print $2}' "$TOKENS_FILE")
TOKEN=$(awk -F': ' '/^- personal-api-token:/ {print $2}' "$TOKENS_FILE")

if [[ -z "${TEAM_ID:-}" || -z "${TOKEN:-}" ]]; then
  echo "missing Vercel team id or token in $TOKENS_FILE" >&2
  exit 1
fi

cd "$DIR"
python3 build_page.py >/dev/null
npx vercel@latest --prod --yes --token "$TOKEN" --scope "$TEAM_ID"
