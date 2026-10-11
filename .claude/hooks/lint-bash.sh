#!/bin/bash
# PreToolUse hook on the Bash tool: every command the agent is about to run goes through
# ShellCheck first. A warning or an error blocks the call and the findings go back to the
# agent, before anything runs and before the owner sees a refusal. Why: on 2026-10-11 the
# auto-mode guardrail refused a `rm -rf "$T/bin"` in a test the agent wrote, and the reason
# reached the owner, not the agent (Izzy: "a better UX would just be to let you know before
# letting me know"). ShellCheck's SC2115 is that class; this runs every class it knows on
# every command. Severity: warning and error block; style and info pass, since a one-off
# command quotes loosely on purpose. Without shellcheck in the image the hook allows and
# says nothing here; the session-start hook names the gap instead. The sandbox's image
# carries Debian's shellcheck (cocoon-agent-sandbox).
set -uo pipefail
TOOLS=(
  jq          # the command out of the hook's JSON input
  shellcheck  # the linter; absent means every command runs unlinted, named at session start
)
command -v jq >/dev/null || exit 0
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$cmd" ] || exit 0
command -v shellcheck >/dev/null || exit 0
if findings=$(printf '%s\n' "$cmd" | shellcheck --shell=bash --severity=warning --format=gcc - 2>&1); then
  exit 0
fi
printf 'lint-bash: ShellCheck refuses this command at warning or above; fix it and run again (line:column: message [code]):\n%s\n' "$findings" >&2
exit 2
