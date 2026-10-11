#!/bin/bash
# Runs as `node` on every container start.
set -euo pipefail

# run.sh puts the chosen configs first, as `--config <name>` pairs the host user asked for
# (`cocoon claude -- --research`); they are stripped here and handed to the firewall, which
# reads the matching hosts lists. Nothing is read from the environment.
CONFIGS=()
while [ "${1:-}" = --config ]; do
  CONFIGS+=("$2")
  shift 2
done

# The agent is the container's command (claude, gemini); the firewall allows only that
# agent's model host. A plain shell gets Claude's hosts.
AGENT=claude
[ "${1:-}" = gemini ] && AGENT=gemini
echo "configs: base, $AGENT${CONFIGS[*]:+, ${CONFIGS[*]}}"
sudo /usr/local/bin/init-firewall.sh "$AGENT" "${CONFIGS[@]}"

# The GitHub App token is a file the host writes and re-mints every fifty minutes (run.sh):
# /run/cocoon/token, mounted read-only, nothing in this container's environment and nothing on
# its disk. The gh wrapper (/usr/local/bin/gh) and git's credential helper
# (/usr/local/bin/cocoon-git-credential), both in the image, read the file at each call, so a
# session outlives the token's hour. GH_TOKEN in the environment (a VS Code start through
# devcontainer.json, or a fine-grained PAT) still works, without the refresh. The App's private
# key is never mounted here.
TOKEN_FILE=/run/cocoon/token
git config --global credential.helper '!/usr/local/bin/cocoon-git-credential'  # in place of `gh auth setup-git`, which would hand git a token read once
if [ -s "$TOKEN_FILE" ]; then
  echo "gh: GitHub App installation token from $TOKEN_FILE, re-minted by the host every fifty minutes (this one expires $(cat /run/cocoon/expires_at 2>/dev/null || echo '?')); repos: $(gh api installation/repositories -q '[.repositories[].full_name] | join(", ")' 2>/dev/null || echo '?')"
elif [ -n "${GH_TOKEN:-}" ]; then
  case "$GH_TOKEN" in
    ghs_*) echo "gh: GitHub App installation token from the environment, no refresh (expires within an hour); repos: $(gh api installation/repositories -q '[.repositories[].full_name] | join(", ")' 2>/dev/null || echo '?')" ;;
    *) echo "gh: authenticated as $(gh api user -q .login 2>/dev/null || echo '?')" ;;
  esac
else
  echo "gh: no token ($TOKEN_FILE absent, GH_TOKEN unset); git push / gh pr will not work this session"
fi

# The Gemini agent authenticates to its API with GEMINI_API_KEY, passed in by run.sh the
# same way as GH_TOKEN: environment only, never on disk here.
if [ "$AGENT" = gemini ]; then
  if [ -n "${GEMINI_API_KEY:-}" ]; then
    echo "gemini: GEMINI_API_KEY set for this session (env only)"
  else
    echo "gemini: no GEMINI_API_KEY set; the CLI cannot reach the model"
  fi
fi

# The workspace is a named volume, not a bind mount of anything on the host: the repo is
# cloned into it on the first start and kept across runs and image rebuilds. Branches and
# commits here reach the host only through GitHub, behind the ruleset's review.
if [ ! -d /workspace/.git ]; then
  echo "cloning cocoon-ai into the workspace volume (first start)..."
  git clone -q https://github.com/theCocoonStudio/cocoon-ai.git /workspace
fi
cd /workspace

# Dependencies: npm ci whenever the lockfile differs from the one last installed, which
# also wipes node_modules, so a package pulled in by an old lockfile does not outlive it.
# Lifecycle scripts are refused by the image's npm config (ignore-scripts); the lockfile
# has no package that needs one (checked 2026-10-02, all 335 tests green without).
if [ -f package-lock.json ]; then
  want=$(sha256sum package-lock.json | cut -d' ' -f1)
  have=$(cat node_modules/.cocoon-lockfile-sha 2>/dev/null || true)
  if [ "$want" != "$have" ]; then
    echo "npm ci (lockfile changed or first start)..."
    npm ci --no-audit --no-fund
    echo "$want" > node_modules/.cocoon-lockfile-sha
  fi
fi

# cocoon-ai-records (exports, the logs), cocoon-ml and cocoon-relations are cloned beside
# the workspace on the first start that has a token (the file or the variable); a repo that does not exist yet, or
# that the App is not installed on, fails its clone and is retried next start. /home/node is not a volume: a fresh container
# re-clones, and local branches not pushed are lost (the records convention says so).
for repo in cocoon-ai-records cocoon-ml cocoon-relations; do
  dir=/home/node/$repo
  if { [ -s "$TOKEN_FILE" ] || [ -n "${GH_TOKEN:-}" ]; } && [ ! -d "$dir/.git" ]; then
    echo "cloning $repo (first start in this container)..."
    gh repo clone "theCocoonStudio/$repo" "$dir" -- -q || echo "clone of $repo failed; will retry next start"
  fi
done

exec "$@"
