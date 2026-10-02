#!/bin/bash
# The host-side launcher. Install ONCE, by hand, outside the repo:
#
#   install -m 755 .devcontainer/host/cocoon-launch.sh ~/bin/cocoon
#
# then start sessions with `cocoon claude` or `cocoon gemini`, never with the
# run.sh in the working tree.
#
# Why this file exists: run.sh builds the image from .devcontainer/ and runs on the
# host as your user, and the agent writes the working tree. Twice (2026-09-03 and
# 2026-10-02, see cocoon-ai-records SECURITY-EVENTS.md) a restart executed the
# agent's unreviewed .devcontainer/ because the tree was checked out on its branch.
# This launcher never executes the tree. It fetches origin/main, which the ruleset
# guards with a required review, exports main's .devcontainer/ to a temp dir, and
# runs THAT run.sh with THAT build context. The working tree is mounted as data.
#
# The installed copy is what runs; this file in the repo is its reviewed source.
# When the two differ the launcher says so, and you decide whether to reinstall.
set -euo pipefail

REPO="${COCOON_REPO:-$(cd "$(dirname "$(readlink -f "$0")")/../.." 2>/dev/null && pwd || echo "$HOME/cocoon-ai")}"
[ -d "$REPO/.git" ] || { echo "launcher: no repo at $REPO (set COCOON_REPO)" >&2; exit 1; }
cd "$REPO"

git fetch -q origin main
ref="${COCOON_REF:-origin/main}"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git archive "$ref" .devcontainer | tar -x -C "$tmp"

# A run.sh from before the launcher cds to its own parent, which here is the temp
# dir, and would mount that as the workspace. Refuse anything that does not take
# COCOON_REPO; that line landed with the launcher itself.
grep -q 'COCOON_REPO' "$tmp/.devcontainer/run.sh" || {
  echo "launcher: $ref's run.sh predates the launcher (no COCOON_REPO); merge the launcher PR first" >&2; exit 1; }

# Drift is shown, never run: a pending change in the tree waits for its PR.
if ! git diff --quiet "$ref" -- .devcontainer; then
  echo "launcher: NOTE .devcontainer/ in the working tree differs from $ref; running $ref's, not the tree's" >&2
fi
if ! cmp -s "$tmp/.devcontainer/host/cocoon-launch.sh" "$(readlink -f "$0")"; then
  echo "launcher: NOTE this installed launcher differs from $ref's copy; reinstall it after reviewing the diff" >&2
fi

echo "launcher: running $ref ($(git rev-parse --short "$ref")) .devcontainer from $tmp"
[ "${COCOON_DRY:-0}" = "1" ] && { ls "$tmp/.devcontainer"; exit 0; }   # a dry run: export and checks only
COCOON_REPO="$REPO" COCOON_DEVCONTAINER="$tmp/.devcontainer" exec bash "$tmp/.devcontainer/run.sh" "$@"
