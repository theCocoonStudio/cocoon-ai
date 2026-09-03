#!/bin/bash
# Runs as `node` on every container start.
set -euo pipefail

sudo /usr/local/bin/init-firewall.sh

# 1. Verify credentials exist
if [ -z "$CLAUDE_APP_ID" ]; then
    echo "ERROR: CLAUDE_APP_ID environment variable is not set." >&2
    exit 1
fi

if [ ! -f "/etc/github/bot.pem" ]; then
    echo "ERROR: Private key file missing at /etc/github/bot.pem" >&2
    exit 1
fi

# 2. Authenticate gh CLI against public github.com using the App credentials
gh auth login \
  --with-token < /etc/github/bot.pem \
  --app-id "$CLAUDE_APP_ID"

# 3. Extract the short-lived installation access token
CLAUDE_TOKEN=$(gh auth token)

# 4. Configure Git to transparently use this token for all github.com actions
git config --global url."https://x-access-token:${CLAUDE_TOKEN}@://github.com".insteadOf "https://://github.com"

# 5. Set up clean bot attribution in Git logs
git config --global user.name "claude-sandbox-bot[bot]"
git config --global user.email "${CLAUDE_APP_ID}+claude-sandbox-bot[bot]@://github.com"

echo "GitHub authentication successful! Claude is ready."

# node_modules lives in a named volume, not the bind-mounted repo: installed once, persists across runs.
if [ -f package-lock.json ] && [ ! -f node_modules/.package-lock.json ]; then
  echo "npm ci (first run in this volume)..."
  npm ci --no-audit --no-fund
fi

exec "$@"
