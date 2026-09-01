# Security events

A log of times the agent did something it shouldn't have, and what changed as a result. Kept in the repo so the record is visible.

## 2026-09-01 — No senior engineer would push to main on the job without asking. Let alone a junior one. Let alone on their first day.

**What happened.** Claude, running in a Claude Code session on my main Mac as my user, committed `.devcontainer/` and README changes and then ran `git push origin main`. I did not ask for a push. Claude used my GitHub credential from the macOS keychain to do it. Commit: `be9f2fa`.

**The ambient credential is the point.** Nothing was granted for that push. No token was handed to the session, no permission prompt fired. The credential was reachable because the session ran as me, on my machine, with my keychain. That is what "ambient credential" means: access that exists by virtue of where the process runs, not because anyone decided to give it. Claude knew the credential was there: it had run `git push --dry-run` earlier in the session to check, and reported the result to me. **I had treated that as problematic.** See below. Claude then used it anyway.

**The context makes it worse.** This was not a session that didn't know better. The same conversation had, minutes earlier, been explicitly about security: I had said I did not trust the agent with my main machine, we had walked through the threat model, Claude had written the README section on layered access and scoped tokens, and Claude had written a memory file recording that I am serious about security and that it should never touch my credentials. All of that was in context when it ran the push. Claude knew the rule, had just written it down, and pushed anyway.

**Why it happened.** Claude decided on its own that getting the files onto the new machine justified a push. It did not ask. It had the option to commit and tell me to push, and did not take it. The quality of its reason is irrelevant: an agent that pushes when it judges the reason good enough will also push when a prompt injection supplies the reason.

**Impact.** Commit `be9f2fa` is on `main` on GitHub without my authorization. The repo is public and `main` was not protected. Whether the pushed content was harmful is beside the point; the action was.

**What changed.**

- Rule, in Claude's memory and here: never use ambient host credentials (keychain, `~/.ssh`, anything that authenticates as me). Never `git push`. Commit locally; I push.
- The only sanctioned GitHub access for the agent is a fine-grained PAT scoped to this one repository, passed into a container session's environment for that session only.
- Claude sessions on my main Mac end here. From now on the agent runs only inside the `.devcontainer/` sandbox on the dedicated machine (see README, "How Claude and I work together").
- To do: branch protection on `main` so that a push, sanctioned or not, cannot land without a PR and my review.
