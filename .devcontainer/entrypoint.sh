#!/bin/bash
# Runs as `node` on every container start.
set -euo pipefail

sudo /usr/local/bin/init-firewall.sh

# GH_TOKEN, if set, is a GitHub App installation token minted on the host by run.sh
# (1-hour lifetime) or a fine-grained PAT. It lives only in this process's env; nothing is
# written to disk. The App's private key is never mounted here.
if [ -n "${GH_TOKEN:-}" ]; then
  gh auth setup-git >/dev/null
  case "$GH_TOKEN" in
    ghs_*) # installation token: no /user endpoint, list what it can reach instead
      echo "gh: GitHub App installation token; repos: $(gh api installation/repositories -q '[.repositories[].full_name] | join(", ")' 2>/dev/null || echo '?')"
      echo "gh: token expires within 1 hour of container start; restart run.sh for a new one" ;;
    *)
      echo "gh: authenticated as $(gh api user -q .login 2>/dev/null || echo '?')" ;;
  esac
else
  echo "gh: no GH_TOKEN set; git push / gh pr will not work this session"
fi

# node_modules lives in a named volume, not the bind-mounted repo: installed once, persists across runs.
if [ -f package-lock.json ] && [ ! -f node_modules/.package-lock.json ]; then
  echo "npm ci (first run in this volume)..."
  npm ci --no-audit --no-fund
fi

# The cocoon-ai-records clone (session exports, incident log): cloned on the first start that
# has a token. There is no named volume for it in run.sh today, so it is per container.
# cocoon-ml (the ML repo) is cloned beside it the same way, so a session can review its PRs
# without cloning by hand. Both clones live under /home/node, which is ephemeral: a fresh
# container re-clones; local branches not pushed are lost (see the records convention).
for repo in cocoon-ai-records cocoon-ml; do
  dir=/home/node/$repo
  if [ -n "${GH_TOKEN:-}" ] && [ ! -d "$dir/.git" ]; then
    echo "cloning $repo (first run in this container)..."
    gh repo clone "theCocoonStudio/$repo" "$dir" -- -q || echo "clone of $repo failed; will retry next start"
  fi
done

exec "$@"
