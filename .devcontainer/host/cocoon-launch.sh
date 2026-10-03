#!/bin/bash
# The host-side launcher. Install ONCE, by hand, outside any repo:
#
#   curl -fsSL https://raw.githubusercontent.com/theCocoonStudio/cocoon-ai/main/.devcontainer/host/cocoon-launch.sh -o ~/bin/cocoon && chmod 755 ~/bin/cocoon
#
# then start sessions with `cocoon claude` or `cocoon gemini`; `cocoon --dry` downloads
# and checks without starting anything. The host keeps no clone of the repo and the
# login user has no git: there is nothing of the agent's on the host to execute.
#
# Why this file exists: run.sh builds the image from .devcontainer/ and runs on the
# host as your user. When the host built from a working tree the agent writes, a
# restart executed unreviewed scripts twice (2026-09-03 and 2026-10-02; see
# cocoon-ai-records SECURITY-EVENTS.md). This launcher downloads main from GitHub as
# a tarball over HTTPS, which the ruleset guards with a required review, unpacks
# only .devcontainer/, and runs THAT run.sh, which builds from its own directory. The
# agent's workspace is a container volume the host never reads.
#
# Nothing here is configurable from the environment, on purpose: a change to what runs
# goes through a PR, not through a variable the host happens to have set (Izzy,
# 2026-10-02). The installed copy is what runs; the copy on main is its reviewed
# source. When the two differ the launcher says so, and you decide whether to reinstall.
set -euo pipefail

# --- Everything this script knows, in one place ---------------------------------------------
SLUG=theCocoonStudio/cocoon-ai        # the repo whose main is run
REF=main                              # the only ref ever run
API="https://api.github.com/repos/$SLUG"
# Tools, and what each is for. run.sh adds openssl (the App JWT) and podman; it checks its own.
TOOLS=(
  curl   # the commit lookup and the tarball download
  tar    # listing and unpacking the tarball
  jq     # the commit sha out of the API's JSON
)
# A run.sh from before the launcher bind-mounted the host's clone; refuse it rather than
# mount a temp dir as the workspace. The marker is the mount it must NOT contain.
OLD_RUN_MARKER='"$PWD":/workspace'

for tool in "${TOOLS[@]}"; do
  command -v "$tool" >/dev/null || { echo "launcher: '$tool' is required" >&2; exit 1; }
done

DRY=0
if [ "${1:-}" = "--dry" ]; then DRY=1; shift; fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# The commit the ref points at, for the record, and the tarball of that commit. Public
# repo: no credential needed; the download follows GitHub's redirect to codeload.
sha=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API/commits/$REF" | jq -r .sha)
curl -fsSL "$API/tarball/$sha" -o "$tmp/src.tgz"
top=$(tar -tzf "$tmp/src.tgz" | awk -F/ 'NR == 1 { print $1 }')   # <owner>-<repo>-<sha7>; awk reads to the end, so pipefail stays quiet
case "$sha" in "${top##*-}"*) ;; *) echo "launcher: archive $top does not match commit $sha" >&2; exit 1 ;; esac
tar -xzf "$tmp/src.tgz" -C "$tmp" "$top/.devcontainer"
dc="$tmp/$top/.devcontainer"

if grep -qF "$OLD_RUN_MARKER" "$dc/run.sh"; then
  echo "launcher: $REF's run.sh predates the launcher (it mounts the host's clone); merge the launcher PR first" >&2; exit 1
fi
if ! cmp -s "$dc/host/cocoon-launch.sh" "$(readlink -f "$0")"; then
  echo "launcher: NOTE this installed launcher differs from $REF's copy; reinstall it after reviewing the diff" >&2
fi

echo "launcher: $SLUG@$REF is $sha; running its .devcontainer from $dc"
if [ "$DRY" = 1 ]; then ls "$dc"; exit 0; fi

exec bash "$dc/run.sh" "$@"
