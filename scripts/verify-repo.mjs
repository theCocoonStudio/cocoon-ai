#!/usr/bin/env node
// Verifies a repository's setup against docs/new-repository.md, through `gh api` (so it runs
// inside the sandbox through the gateway as the role's App, and on the owner's machine as them).
//
//   npm run verify:repo -- theCocoonStudio/<repo>
//
// One line per fact, `pass`, `FAIL` or `skip` (not checkable with this token), the fact beside it;
// exit 1 when anything fails. What it reads (2026-10-16, the six repositories as they stand):
//
//   the repository: rebase the only merge method, branches deleted on merge, the visibility named
//   the Apps: the repository in the installation this token belongs to (an App token), or in each
//             App's installation on the account (the owner's token, which can list installations)
//   the ruleset on the default branch: active, no bypass actors; deletions and force pushes
//             blocked, linear history; a pull request with one approval, stale approvals dismissed,
//             code owners, last-push approval, conversation resolution, rebase only; required checks
//             up to date, `check` and `reviewer-policy` (or `policy`, the sandbox's form), each from
//             GitHub Actions, `dependency-check` where that workflow exists
//   the files on the default branch: CODEOWNERS with `.github/` owned, the check and reviewer-policy
//             workflows, the dependency-check workflow when there is a lockfile, a LICENSE, a README
//
// Every API answer is checked for the shape the fact needs before it is read (a 200 is not trusted
// to carry the fields; the owner, 2026-10-11); a missing field is a FAIL line naming the endpoint.
import { execFileSync } from 'node:child_process'

const ACTIONS = 15368 // GitHub Actions' app id: the integration a required check must come from
const APPS = ['cocoon-claude', 'cocoon-gemini']

export function judge(facts) {
  const lines = []
  const pass = (text) => lines.push({ status: 'pass', text })
  const fail = (text) => lines.push({ status: 'FAIL', text })
  const skip = (text) => lines.push({ status: 'skip', text })
  const is = (v, type) =>
    type === 'array' ? Array.isArray(v) : typeof v === type

  // 1. the repository
  const r = facts.repo
  if (!r || typeof r !== 'object' || !is(r.default_branch, 'string')) {
    fail(
      `repos/<repo>: the answer carries no default_branch (${facts.repoError || 'unexpected shape'})`,
    )
    return { ok: false, lines }
  }
  pass(
    `repository ${r.full_name} is ${r.visibility}${r.visibility === 'private' ? ' (the record is the one private repository)' : ''}; default branch ${r.default_branch}`,
  )
  for (const [key, want, text] of [
    ['allow_rebase_merge', true, 'rebase merging allowed'],
    ['allow_merge_commit', false, 'merge commits off'],
    ['allow_squash_merge', false, 'squash merging off'],
    ['delete_branch_on_merge', true, 'head branches deleted on merge'],
  ]) {
    if (!is(r[key], 'boolean'))
      fail(`repos/<repo>: ${key} is not a boolean in the answer`)
    else if (r[key] === want) pass(text)
    else fail(`${text}: ${key} is ${r[key]}`)
  }

  // 2. the Apps
  for (const app of APPS) {
    const v = facts.installations?.[app]
    if (v === true) pass(`the ${app} App's installation covers the repository`)
    else if (v === false)
      fail(
        `the ${app} App's installation does not cover the repository (step 2 of docs/new-repository.md)`,
      )
    else
      skip(
        `${app}: not checkable with this token (${facts.installationsNote || 'no installation listing available'})`,
      )
  }

  // 3. the ruleset
  const sets = Array.isArray(facts.rulesets) ? facts.rulesets : []
  const onMain = sets.filter(
    (s) =>
      s &&
      s.enforcement === 'active' &&
      Array.isArray(s.conditions?.ref_name?.include) &&
      s.conditions.ref_name.include.some(
        (x) =>
          x === '~DEFAULT_BRANCH' || x === `refs/heads/${r.default_branch}`,
      ),
  )
  if (onMain.length !== 1)
    fail(
      `${onMain.length} active ruleset(s) target the default branch; one is expected (step 5)`,
    )
  else {
    const s = onMain[0]
    pass(`ruleset "${s.name}" active on the default branch`)
    const actors = s.bypass_actors ?? [] // the API omits the list when it is empty
    if (Array.isArray(actors) && actors.length === 0) pass('no bypass actors')
    else
      fail(
        `bypass actors: ${Array.isArray(actors) ? actors.length : 'not an array'}; none is expected`,
      )
    const rules = Array.isArray(s.rules) ? s.rules : []
    const rule = (type) => rules.find((x) => x && x.type === type)
    for (const [type, text] of [
      ['deletion', 'deletions restricted'],
      ['non_fast_forward', 'force pushes blocked'],
      ['required_linear_history', 'linear history required'],
    ]) {
      if (rule(type)) pass(text)
      else fail(`${text}: no "${type}" rule`)
    }
    const pr = rule('pull_request')
    if (!pr || typeof pr.parameters !== 'object') fail('no pull_request rule')
    else {
      const p = pr.parameters
      for (const [key, want, text] of [
        ['required_approving_review_count', 1, 'one approving review required'],
        [
          'dismiss_stale_reviews_on_push',
          true,
          'stale approvals dismissed on push',
        ],
        ['require_code_owner_review', true, 'code owner review required'],
        [
          'require_last_push_approval',
          true,
          'approval of the most recent push required',
        ],
        [
          'required_review_thread_resolution',
          true,
          'conversation resolution required',
        ],
      ]) {
        if (p[key] === want) pass(text)
        else fail(`${text}: ${key} is ${JSON.stringify(p[key])}`)
      }
      const methods = Array.isArray(p.allowed_merge_methods)
        ? p.allowed_merge_methods
        : []
      if (methods.length === 1 && methods[0] === 'rebase')
        pass('rebase the only merge method in the ruleset')
      else
        fail(
          `allowed merge methods ${JSON.stringify(methods)}; ["rebase"] is expected`,
        )
    }
    const sc = rule('required_status_checks')
    if (!sc || typeof sc.parameters !== 'object')
      fail('no required_status_checks rule')
    else {
      const p = sc.parameters
      if (p.strict_required_status_checks_policy === true)
        pass('branches must be up to date before merging')
      else
        fail(
          `strict_required_status_checks_policy is ${JSON.stringify(p.strict_required_status_checks_policy)}; true is expected`,
        )
      const checks = Array.isArray(p.required_status_checks)
        ? p.required_status_checks
        : []
      const named = (ctx) => checks.find((c) => c && c.context === ctx)
      const fromActions = (c) =>
        c.integration_id === ACTIONS
          ? ''
          : ` (integration ${c.integration_id}, not GitHub Actions)`
      const check = named('check')
      if (check && !fromActions(check))
        pass('required check: check (GitHub Actions)')
      else
        fail(
          `required check "check"${check ? fromActions(check) : ' is missing'}`,
        )
      const policy = named('reviewer-policy') || named('policy')
      if (policy && !fromActions(policy))
        pass(
          `required check: ${policy.context} (GitHub Actions)${policy.context === 'policy' ? ', the job form of sandbox #13' : ''}`,
        )
      else
        fail(
          `required check "reviewer-policy" (or "policy")${policy ? fromActions(policy) : ' is missing'}`,
        )
      // dependency-check is the pull-request form where there is a lockfile (this repository, the gateway) and
      // must then be required; the sandbox's form is a weekly check of its pinned CLIs and is not a PR check.
      const dep = named('dependency-check')
      const workflow = facts.files?.['.github/workflows/dependency-check.yml']
      if (facts.files?.['package-lock.json']) {
        if (dep && !fromActions(dep))
          pass(
            'required check: dependency-check (GitHub Actions), the lockfile form',
          )
        else
          fail(
            `a lockfile, but dependency-check is not a required check${dep ? fromActions(dep) : ''}`,
          )
      } else if (dep && !workflow)
        fail(
          'dependency-check is a required check but the workflow file is absent: every pull request stays blocked',
        )
      else if (dep) pass('required check: dependency-check (GitHub Actions)')
      else if (workflow)
        pass(
          'a dependency-check workflow without a lockfile: the scheduled form, not a pull-request check',
        )
    }
  }

  // 4. the files
  const f = facts.files || {}
  const codeowners = f.CODEOWNERS ?? f['.github/CODEOWNERS']
  if (typeof codeowners !== 'string')
    fail('no CODEOWNERS file at the root or under .github/ (step 4)')
  else {
    const owned = codeowners
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split(/\s+/))
    const github = owned.find(
      ([pattern]) =>
        pattern === '*' ||
        pattern === '/.github/' ||
        pattern === '.github/' ||
        pattern === '/.github' ||
        pattern === '.github',
    )
    if (github && github.slice(1).some((o) => o.startsWith('@')))
      pass(`CODEOWNERS owns .github/ (${github.join(' ')})`)
    else
      fail(
        'CODEOWNERS does not own .github/: a pull request could rewrite the policy that judges it',
      )
  }
  for (const [path, text] of [
    ['.github/workflows/check.yml', 'the check workflow'],
    ['.github/workflows/reviewer-policy.yml', 'the reviewer-policy workflow'],
    ['README.md', 'a README'],
  ]) {
    if (f[path]) pass(`${text} is present`)
    else fail(`${text} is missing (${path})`)
  }
  if (f['package-lock.json'] && !f['.github/workflows/dependency-check.yml'])
    fail('a lockfile without the dependency-check workflow')
  if (f.LICENSE) pass('a LICENSE is present')
  else
    skip(
      'no LICENSE file (the sandbox carries MIT; this repository and the gateway carry none yet)',
    )

  return { ok: lines.every((l) => l.status !== 'FAIL'), lines }
}

function gh(args, { raw = false } = {}) {
  try {
    const out = execFileSync(
      'gh',
      [
        'api',
        ...args,
        ...(raw ? ['-H', 'Accept: application/vnd.github.raw'] : []),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return { ok: true, body: raw ? out : JSON.parse(out) }
  } catch (err) {
    return {
      ok: false,
      error: String(err.stderr || err.message)
        .trim()
        .split('\n')[0],
    }
  }
}

export function gather(repo) {
  const facts = { files: {}, installations: {} }
  const r = gh([`repos/${repo}`])
  if (!r.ok) {
    facts.repoError = r.error
    return facts
  }
  facts.repo = r.body
  const branch = r.body.default_branch
  const list = gh([`repos/${repo}/rulesets`])
  facts.rulesets =
    list.ok && Array.isArray(list.body)
      ? list.body.map((s) => {
          const full = gh([`repos/${repo}/rulesets/${s.id}`])
          return full.ok ? full.body : s
        })
      : []
  // An App token lists its own installation's repositories; the owner's token lists the account's installations.
  const mine = gh(['installation/repositories?per_page=100'])
  if (mine.ok && Array.isArray(mine.body?.repositories)) {
    const names = mine.body.repositories.map((x) => x.full_name)
    const slug = process.env.GH_APP_SLUG || 'cocoon-claude' // the sandbox's claude role; the gemini role sets GH_APP_SLUG=cocoon-gemini
    facts.installations[slug] = names.includes(repo)
    facts.installationsNote = `an installation token lists its own App only (${slug})`
  } else {
    const owner = repo.split('/')[0]
    const inst = gh([`orgs/${owner}/installations?per_page=100`])
    const installations =
      inst.ok && Array.isArray(inst.body?.installations)
        ? inst.body.installations
        : null
    if (installations) {
      for (const app of APPS) {
        const i = installations.find((x) => x && x.app_slug === app)
        if (!i) {
          facts.installations[app] = false
          continue
        }
        const repos = gh([
          `user/installations/${i.id}/repositories?per_page=100`,
        ])
        facts.installations[app] =
          repos.ok && Array.isArray(repos.body?.repositories)
            ? repos.body.repositories.some((x) => x.full_name === repo)
            : null
      }
    } else facts.installationsNote = inst.error || mine.error
  }
  for (const path of ['CODEOWNERS', '.github/CODEOWNERS']) {
    const f = gh([`repos/${repo}/contents/${path}?ref=${branch}`], {
      raw: true,
    })
    if (f.ok) facts.files[path] = f.body
  }
  for (const path of [
    '.github/workflows/check.yml',
    '.github/workflows/reviewer-policy.yml',
    '.github/workflows/dependency-check.yml',
    'package-lock.json',
    'LICENSE',
    'README.md',
  ]) {
    facts.files[path] = gh([
      `repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`,
    ]).ok
  }
  return facts
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].split('/').pop())
) {
  const repo = process.argv[2]
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    console.error('usage: npm run verify:repo -- <owner>/<repo>')
    process.exit(2)
  }
  const { ok, lines } = judge(gather(repo))
  for (const l of lines) console.log(`${l.status.padEnd(4)}  ${l.text}`)
  console.log(
    ok
      ? `verify-repo: ${repo} matches docs/new-repository.md`
      : `verify-repo: ${repo} does not match docs/new-repository.md (see FAIL lines)`,
  )
  process.exit(ok ? 0 : 1)
}
