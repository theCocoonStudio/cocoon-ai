import { describe, it, expect } from 'vitest'
import { judge } from './verify-repo.mjs'

// The sandbox's ruleset as GitHub's API returned it on 2026-10-16, trimmed to the fields read.
const ruleset = {
  name: 'Classic Branch Protection',
  enforcement: 'active',
  bypass_actors: [],
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  rules: [
    { type: 'deletion' },
    { type: 'non_fast_forward' },
    { type: 'required_linear_history' },
    {
      type: 'pull_request',
      parameters: {
        allowed_merge_methods: ['rebase'],
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: true,
        require_last_push_approval: true,
        required_approving_review_count: 1,
        required_review_thread_resolution: true,
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: [
          { context: 'check', integration_id: 15368 },
          { context: 'policy', integration_id: 15368 },
        ],
      },
    },
  ],
}
const repo = {
  full_name: 'theCocoonStudio/cocoon-agent-sandbox',
  visibility: 'public',
  default_branch: 'main',
  allow_rebase_merge: true,
  allow_merge_commit: false,
  allow_squash_merge: false,
  delete_branch_on_merge: true,
}
const files = {
  CODEOWNERS: '# the owner reviews every file\n*  @theCocoonStudio\n',
  '.github/workflows/check.yml': true,
  '.github/workflows/reviewer-policy.yml': true,
  '.github/workflows/dependency-check.yml': true,
  'package-lock.json': false,
  LICENSE: true,
  'README.md': true,
}
const good = () => ({
  repo: structuredClone(repo),
  rulesets: [structuredClone(ruleset)],
  installations: { 'cocoon-claude': true, 'cocoon-gemini': true },
  files: { ...files },
})
const fails = (facts) =>
  judge(facts)
    .lines.filter((l) => l.status === 'FAIL')
    .map((l) => l.text)

describe('verify-repo judges a repository against docs/new-repository.md', () => {
  it('the sandbox as it stands passes every line', () => {
    const { ok, lines } = judge(good())
    expect(fails(good())).toEqual([])
    expect(ok).toBe(true)
    expect(
      lines.some((l) =>
        l.text.includes('policy (GitHub Actions), the job form'),
      ),
    ).toBe(true)
  })
  it('a merge method other than rebase, or branches kept on merge, fails by name', () => {
    const f = good()
    f.repo.allow_squash_merge = true
    f.repo.delete_branch_on_merge = false
    expect(fails(f)).toEqual([
      'squash merging off: allow_squash_merge is true',
      'head branches deleted on merge: delete_branch_on_merge is false',
    ])
  })
  it('an App whose installation lacks the repository fails; an unknown one is skipped, not passed', () => {
    const f = good()
    f.installations = { 'cocoon-claude': true, 'cocoon-gemini': false }
    expect(fails(f)).toEqual([
      "the cocoon-gemini App's installation does not cover the repository (step 2 of docs/new-repository.md)",
    ])
    const g = good()
    g.installations = { 'cocoon-claude': true }
    g.installationsNote =
      'an installation token lists its own App only (cocoon-claude)'
    const skip = judge(g).lines.find((l) => l.status === 'skip')
    expect(skip.text).toMatch(/cocoon-gemini: not checkable/)
    expect(judge(g).ok).toBe(true)
  })
  it('the ruleset: a bypass actor, a missing rule, a wrong parameter, a check from the wrong source, each its own FAIL line', () => {
    const f = good()
    const s = f.rulesets[0]
    s.bypass_actors = [{ actor_id: 1 }]
    s.rules = s.rules.filter((r) => r.type !== 'required_linear_history')
    s.rules.find(
      (r) => r.type === 'pull_request',
    ).parameters.dismiss_stale_reviews_on_push = false
    s.rules.find(
      (r) => r.type === 'required_status_checks',
    ).parameters.required_status_checks[1].integration_id = 42
    expect(fails(f)).toEqual([
      'bypass actors: 1; none is expected',
      'linear history required: no "required_linear_history" rule',
      'stale approvals dismissed on push: dismiss_stale_reviews_on_push is false',
      'required check "reviewer-policy" (or "policy") (integration 42, not GitHub Actions)',
    ])
  })
  it('no active ruleset on the default branch is one FAIL, and an inactive one does not count', () => {
    const f = good()
    f.rulesets[0].enforcement = 'disabled'
    expect(fails(f)).toEqual([
      '0 active ruleset(s) target the default branch; one is expected (step 5)',
    ])
  })
  it('the files: CODEOWNERS must own .github/; a lockfile needs the dependency-check workflow; a required dependency-check needs its workflow', () => {
    const f = good()
    f.files.CODEOWNERS = '/docs/ @theCocoonStudio\n'
    expect(fails(f)).toContain(
      'CODEOWNERS does not own .github/: a pull request could rewrite the policy that judges it',
    )
    const g = good()
    g.files['package-lock.json'] = true
    g.files['.github/workflows/dependency-check.yml'] = false
    expect(fails(g)).toContain(
      'a lockfile without the dependency-check workflow',
    )
    const h = good()
    h.files['.github/workflows/dependency-check.yml'] = false
    h.rulesets[0].rules
      .find((r) => r.type === 'required_status_checks')
      .parameters.required_status_checks.push({
        context: 'dependency-check',
        integration_id: 15368,
      })
    expect(fails(h)).toContain(
      'dependency-check is a required check but the workflow file is absent: every pull request stays blocked',
    )
    const m = good()
    m.files['package-lock.json'] = true // a lockfile needs the check required, not only the file
    expect(fails(m)).toEqual([
      'a lockfile, but dependency-check is not a required check',
    ])
    const n = good()
    delete n.rulesets[0].bypass_actors // the API omits an empty list
    expect(fails(n)).toEqual([])
    const k = good()
    k.files.CODEOWNERS = undefined
    k.files['.github/CODEOWNERS'] =
      '/.github/ @theCocoonStudio\n/.claude/ @theCocoonStudio\n'
    expect(fails(k)).toEqual([])
  })
  it("an answer without the repository's shape is a FAIL naming the endpoint, not a crash", () => {
    const { ok, lines } = judge({
      repo: { message: 'Not Found' },
      repoError: 'HTTP 404',
    })
    expect(ok).toBe(false)
    expect(lines[0].text).toMatch(
      /repos\/<repo>: the answer carries no default_branch \(HTTP 404\)/,
    )
  })
})
