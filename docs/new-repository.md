# A new repository in the organization

Written 2026-10-16 from what the six repositories do today, every setting read from GitHub's API that day, in the order the steps are done, and followed in full the same day for `cocoon-copula`: after its first pull request merged and its ruleset was set, `npm run verify:repo -- theCocoonStudio/cocoon-copula` printed no FAIL line (14:3x). Each step names who does it: the owner, in GitHub's interface or on the box; or the agent, in the repository's first pull request. The example is `cocoon-copula`, created that day; the owner follows this page to set it up, and what the page lacks is what the page gets next.

The order is the point. Each layer refuses something the next one assumes: the App installation decides which repositories the agents can reach at all; the sandbox configuration decides which ones a container sees; the ruleset decides what reaches `main`; the reviewer policy decides who may approve whom. Nothing is per repository in the gateway: its rules are path patterns over any owner and repository, and its token reaches exactly what the App installation covers.

## 1. The repository (owner, GitHub)

Create it under [`theCocoonStudio`](https://github.com/theCocoonStudio): public unless it holds the record (`cocoon-ai-records` is the one private repository); a one-line description; MIT (the sandbox carries it; this repository and the gateway carry no license file yet); GitHub's default README is enough, the first pull request replaces it.

Then Settings, General, Pull Requests: allow rebase merging only, merge commits and squash merging off; "Automatically delete head branches" on. These are repository settings, not ruleset rules, and every repository here has them (read 2026-10-16: `allow_merge_commit` false, `allow_squash_merge` false, `allow_rebase_merge` true, `delete_branch_on_merge` true). Rebase is the one merge method because each commit lands on `main` as itself, so every commit has to stand alone with its message saying what and why.

## 2. The Apps (owner, GitHub)

The owner's Settings, Applications, Installed GitHub Apps: `cocoon-claude`, Configure, Repository access, add the repository; the same for `cocoon-gemini`. Until this is done the gateway's token for a role lists the repository nowhere: the agent cannot read it if private and cannot write it at all.

Permissions are per App, not per repository: Contents and Pull requests read and write, Issues read and write, Metadata read; `cocoon-claude` also Workflows read and write, granted 2026-09-14 so the CI workflow files could be pushed from the sandbox. The page for them is the owner's Settings, Developer settings, GitHub Apps, the App, Permissions & events, Repository permissions; a changed permission is then accepted once on the installation (Settings, Applications, Installed GitHub Apps, the App, Configure, where a banner asks). Without Workflows on the App that pushes, GitHub refuses the whole push of a branch that touches `.github/workflows/`, in these words: `refusing to allow a GitHub App to create or update workflow `.github/workflows/check.yml`without`workflows` permission` (the first push of cocoon-copula's first pull request, 2026-10-16, after the permission had been revoked on the advice of a guide that is not this one; restored, the same push went through). Whether `cocoon-gemini` holds Workflows is read on the same page; without it the gemini role cannot push a workflow file and step 4 is the claude role's or the owner's. The gateway's cached token carries the App's permissions as they were when it was minted, so a restored permission, like a new repository, reaches a container within the hour.

The gateway mints each role's installation token and caches it until five minutes before its hour ends (`src/credentials.js`), and a token's repository list is fixed when it is minted, so the new repository appears inside a container within the hour, not at once. Verify from inside:

```
gh api installation/repositories --jq '[.repositories[].full_name] | join(", ")'
```

## 3. The sandbox (owner, the box)

The repository enters the agents' containers through the sandbox configuration on the box, `~/.config/cocoon/sandbox.json`, never through anything in a repository. Two forms:

- **A companion clone:** add `"theCocoonStudio/<repo>"` to the `clones` array. Every container clones it beside the workspace at each start, by git through the gateway (`/home/node/<repo>`); nothing in it survives the container, so every change is pushed. One chain on the box, the file written whole and the dry run reading it back:

```
new=$(jq '.clones += ["theCocoonStudio/cocoon-copula"]' ~/.config/cocoon/sandbox.json) && printf '%s\n' "$new" > ~/.config/cocoon/sandbox.json && cocoon --dry
```

- **The workspace:** `"workspace": { "repo": "theCocoonStudio/<repo>" }` makes it the workspace volume's repository, cloned once into the named volume and kept across starts. The key is an object with `repo`, not a string; `check-config.sh` refuses the string with `workspace must be an object`.

The next `cocoon claude` or `cocoon gemini` start carries the change. Nothing changes in the gateway and nothing in the firewall: in the gateway shape the wall is one address, and the research hosts are the gateway's own subdomains, so a repository needs no hosts list. A workspace volume is cloned once: `git pull` in it before branching, or every pull request from that container starts behind `main` (cocoon-ai #80 opened 66 commits behind from a volume cloned on 2026-10-05).

## 4. The first pull request (the agent, reviewed by the owner)

The repository's own files, in one pull request, one commit per conceptual task, each message saying what and why:

- `LICENSE` (MIT) and `README.md`: what the repository is for, and a "What checks what" section as every repository here carries, naming each workflow and what it decides.
- `CODEOWNERS` at the root. The sandbox and the gateway have `* @theCocoonStudio`: every file is the owner's to review. This repository and `cocoon-relations` own `.github/` and their configuration directories only. The owner chooses the scope; `.github/` must be in it, so that a pull request cannot rewrite the policy that judges it.
- `.github/workflows/check.yml`: the repository's own check as one job named `check`, on pull requests and on `main`. Copy the sandbox's and replace its two `run` lines with the repository's lint and tests (shell through ShellCheck with `.shellcheckrc` and `tests/lint.sh`, copied from the sandbox, wherever there is a shell script; this repository's is `npm run check:ci`). A second job may exist, as the sandbox's `image`, but only `check` is required.
- `.github/workflows/reviewer-policy.yml`: copied from the gateway's `main` as it is today. It reads the pull request's reviews through the API and posts the commit status `reviewer-policy` (success only when an approval from an account allowed for the author exists), so it needs `statuses: write`. The table is inside it: the owner's pull requests need `cocoon-claude[bot]`; `cocoon-claude[bot]`'s need the owner; `cocoon-gemini[bot]`'s need the owner or `cocoon-claude[bot]`; anyone else's need the owner. cocoon-agent-sandbox #13 changes the file so the job's exit code is the verdict and the required check becomes the job, `policy`, instead of the posted status; when that form is adopted in a repository the order is the workflow first, then the ruleset's context, never the reverse, since a ruleset switched first leaves the table unenforced until the merge (the sandbox, 2026-10-14).
- `.github/workflows/dependency-check.yml` where the repository has a lockfile: this repository's and the gateway's form runs on every pull request (GitHub's dependency review, the registry's signatures and provenance, and `scripts/lockfile-check.mjs`: install scripts, release age, publisher, source, integrity); the sandbox's form checks its pinned CLIs weekly against the advisory database.
- Pushing anything under `.github/workflows/` needs the App's Workflows permission (step 2); without it GitHub refuses the push and the owner commits those files.

## 5. The ruleset on `main` (owner, GitHub)

Settings, Rules, Rulesets, New branch ruleset. Every repository here has one, named "Classic Branch Protection", read 2026-10-16:

- Enforcement **Active**; target the default branch; **no bypass actors**.
- **Restrict deletions**; **Block force pushes**; **Require linear history**.
- **Require a pull request before merging**: 1 required approval; dismiss stale pull request approvals when new commits are pushed; require review from Code Owners; require approval of the most recent reviewable push; require conversation resolution before merging; allowed merge methods: rebase only.
- **Require status checks to pass**: require branches to be up to date before merging; the checks `check` and `policy` (the job of `reviewer-policy.yml`; its posted `reviewer-policy` status was retired on 2026-10-18, cocoon-agent-sandbox #13, since a status is forgeable by any workflow with `statuses: write`), and `dependency-check` where that workflow exists, each with source GitHub Actions. A repository still on the status form switches in this order: the ruleset's required check changed from `reviewer-policy` to `policy` first (the job has reported on the switching pull request's head, so the picker lists it), then the workflow change merged. The reverse does not work: on the switching pull request the old `reviewer-policy` status is posted once by main's copy of the workflow at open time, "failure" until an approval exists, and nothing updates it afterwards, since the review event runs the branch's copy, which posts no status; a ruleset still requiring it keeps the pull request blocked after approval (cocoon-ai #86, 2026-10-19).

The pull request rules can go in at creation. The required checks go in once the first pull request's workflows have run, because a required check that has never reported blocks every pull request, and GitHub's picker lists only the checks it has seen (a name can be typed in too). The first pull request is approved by the owner and merged by rebase; its workflows have then run on `main` and the checks can be made required.

## 6. Verify (both)

One command reads every fact this page states, through `gh api`, and prints a line per fact with `pass`, `FAIL` or `skip` (not checkable with the token in hand: an App's token sees its own installation only; the owner's sees both Apps'), exit 1 on any FAIL:

```
npm run verify:repo -- theCocoonStudio/<repo>
```

It is `scripts/verify-repo.mjs` in this repository; run it from a clone of cocoon-ai, inside a container or on the owner's machine. By hand, from a container, after the restart that carries the sandbox change:

```
gh api installation/repositories --jq '[.repositories[].full_name] | join(", ")' && cd /home/node/<repo> && git log --oneline -1 && gh pr list --repo theCocoonStudio/<repo> --state all --limit 3
```

From the API, the ruleset and the settings as this page states them:

```
gh api repos/theCocoonStudio/<repo>/rulesets --jq '.[] | "\(.name) \(.enforcement) bypass=\(.bypass_actors | length)"' && gh api repos/theCocoonStudio/<repo> --jq '"rebase=\(.allow_rebase_merge) merge=\(.allow_merge_commit) squash=\(.allow_squash_merge) delete_on_merge=\(.delete_branch_on_merge)"'
```

And the one that matters: a pull request by an agent cannot be merged by that agent before the owner's approval and green checks; the ruleset, not a habit, refuses it.
