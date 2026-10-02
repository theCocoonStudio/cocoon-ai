#!/bin/bash
# The host-side launcher. Install ONCE, by hand, outside any repo:
#
#   install -m 755 cocoon-launch.sh ~/bin/cocoon
#
# then start sessions with `cocoon claude` or `cocoon gemini`. The host keeps no
# clone of the repo and the login user has no git: there is nothing of the agent's
# on the host to execute.
#
# Why this file exists: run.sh builds the image from .devcontainer/ and runs on the
# host as your user. When the host built from a working tree the agent writes, a
# restart executed unreviewed scripts twice (2026-09-03 and 2026-10-02; see
# cocoon-ai-records SECURITY-EVENTS.md). This launcher downloads main from GitHub as
# a tarball over HTTPS, which the ruleset guards with a required review, unpacks
# only .devcontainer/, and runs THAT run.sh with THAT build context. The agent's
# workspace is a container volume the host never reads.
#
# The installed copy is what runs; the copy on main is its reviewed source. When
# the two differ the launcher says so, and you decide whether to reinstall.
#
# Needs: curl, tar, jq (and run.sh's openssl for the App token).
set -euo pipefail

SLUG="${COCOON_REPO_SLUG:-theCocoonStudio/cocoon-ai}"
REF="${COCOON_REF:-main}"
API="https://api.github.com/repos/$SLUG"

for tool in curl tar jq; do
  command -v "$tool" >/dev/null || { echo "launcher: '$tool' is required" >&2; exit 1; }
done

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# The commit the ref points at, for the record, and the tarball of it. Public
# repo: no credential needed; the download follows GitHub's redirect to codeload.
sha=$(curl -fsSL -H "Accept: application/vnd.github+json" "$API/commits/$REF" | jq -r .sha)
curl -fsSL "$API/tarball/$sha" -o "$tmp/src.tgz"
top=$(tar -tzf "$tmp/src.tgz" | awk -F/ 'NR == 1 { print $1 }')   # <owner>-<repo>-<sha7>; awk reads to the end, so pipefail stays quiet
case "$sha" in "${top##*-}"*) ;; *) echo "launcher: archive $top does not match commit $sha" >&2; exit 1 ;; esac
tar -xzf "$tmp/src.tgz" -C "$tmp" "$top/.devcontainer"
dc="$tmp/$top/.devcontainer"

# A run.sh from before the launcher expected a repo on the host and a bind mount;
# refuse it rather than mount a temp dir as the workspace.
grep -q 'COCOON_DEVCONTAINER' "$dc/run.sh" || {
  echo "launcher: $REF's run.sh predates the launcher; merge the launcher PR first" >&2; exit 1; }

if ! cmp -s "$dc/host/cocoon-launch.sh" "$(readlink -f "$0")"; then
  echo "launcher: NOTE this installed launcher differs from $REF's copy; reinstall it after reviewing the diff" >&2
fi

echo "launcher: $SLUG@$REF is $sha; running its .devcontainer from $dc"
[ "${COCOON_DRY:-0}" = "1" ] && { ls "$dc"; exit 0; }   # a dry run: download and checks only

COCOON_DEVCONTAINER="$dc" exec bash "$dc/run.sh" "$@"
