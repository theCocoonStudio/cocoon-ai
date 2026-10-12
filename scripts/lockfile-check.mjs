#!/usr/bin/env node
// The lockfile reader: what a dependency change brings in, judged before it merges.
//
//   node scripts/lockfile-check.mjs <base package-lock.json> <head package-lock.json>
//
// Lists every package the head lockfile adds or changes against the base (a different
// version, tarball URL or integrity), asks the registry about each, and refuses on the
// signals that mean "not this one, not yet":
//
//   REFUSE  an install script (preinstall, install, postinstall): the sandbox refuses
//           them at install time already; a package that needs one is a reviewed exception
//   REFUSE  a version younger than MIN_AGE_DAYS: a hijacked release is usually caught
//           within days, so the newest version is the riskiest one
//   REFUSE  a different publisher than the previous version: the classic takeover signal
//   REFUSE  a tarball that does not come from the npm registry
//   REFUSE  the integrity changed under the same version and URL: the bytes are not the
//           bytes that were reviewed, whatever the version says
//   REFUSE  the lockfile's integrity is absent, or is not the registry's for that version
//           on any hash algorithm the two share, or shares none, or the registry gives no
//           hash at all: the entry was edited or the registry's tarball is not the one
//           the lockfile pins (any check includes integrity; the owner, 2026-10-11)
//   REFUSE  the registry's 200 is not the packument asked for: not an object, another
//           name, no versions object, a version whose scripts is not an object (a 200 is
//           not trusted to carry the shape; the owner, 2026-10-11)
//   WARN    no provenance attestation on the version; many honest packages lack one
//   WARN    the version is deprecated
//
// An exception is a line in .github/dependency-allow.json, `"name@version": { "<rule>":
// "why" }`, the rule one of scripts, age, publisher, source: it excuses that one refusal
// and nothing else (no blanket exceptions; the owner, 2026-10-11). A refusal the line
// does not name stays a refusal; integrity and the registry's shape have no exception;
// the old form, a bare "why", excuses nothing and is said so. The file is code-owned, so
// every exception is reviewed. Output is markdown for the PR comment; exit 1 on any
// refusal. Node only, no dependencies, so the check cannot be compromised by what it
// checks. The functions are exported for the tests; the command runs only when this file
// is the script invoked.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MIN_AGE_DAYS = 7
export const REGISTRY = 'https://registry.npmjs.org/'
const ALLOW_FILE = '.github/dependency-allow.json'
/** The rules an exception may name; the others (missing, integrity, registry, lookup) have none. */
export const EXCUSABLE = ['scripts', 'age', 'publisher', 'source']

/** "node_modules/a/node_modules/@s/b" → "@s/b" */
const nameOf = (path) =>
  path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)

/**
 * Packages the head lockfile adds or changes against the base: a different version, a
 * different tarball URL, or a different integrity. The last alone, under the same version
 * and URL, is the change that matters most, and the record says so (integrityChanged).
 */
export function changes(base, head) {
  const out = []
  for (const [path, entry] of Object.entries(head.packages ?? {})) {
    if (path === '' || entry.link) continue
    const before = base.packages?.[path]
    if (
      before?.version === entry.version &&
      before?.resolved === entry.resolved &&
      before?.integrity === entry.integrity
    )
      continue
    const sameSource =
      before !== undefined &&
      before.version === entry.version &&
      before.resolved === entry.resolved
    // An aliased dependency (`"pad-alias": "npm:left-pad@1"`) sits at the alias's path and carries
    // the real package in `name`; the registry is asked for that one (the owner, 2026-10-11).
    out.push({
      path,
      name:
        typeof entry.name === 'string' && entry.name
          ? entry.name
          : nameOf(path),
      from: before?.version ?? null,
      to: entry.version,
      resolved: entry.resolved ?? '',
      integrity: entry.integrity ?? '',
      integrityBefore: before?.integrity ?? null,
      integrityChanged: sameSource,
    })
  }
  return out
}

/** "sha512-abc sha1-def" → { sha512: "abc", sha1: "def" } */
const sri = (s) => {
  const out = {}
  for (const part of String(s ?? '')
    .split(/\s+/)
    .filter(Boolean)) {
    const i = part.indexOf('-')
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1)
  }
  return out
}

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)

/**
 * The lockfile's integrity against the registry's for the version: dist.integrity, and
 * dist.shasum as sha1 where the registry gives only that. Every algorithm both sides carry
 * must agree, and they must share at least one; nothing on either side is a refusal.
 */
export function integrityVerdict(lockIntegrity, dist) {
  const lock = sri(lockIntegrity)
  const reg = sri(dist?.integrity)
  if (typeof dist?.shasum === 'string' && !reg.sha1)
    reg.sha1 = Buffer.from(dist.shasum, 'hex').toString('base64')
  if (!Object.keys(lock).length)
    return { refusal: 'no integrity in the lockfile entry' }
  if (!Object.keys(reg).length)
    return { refusal: 'the registry publishes no hash for this version' }
  const common = Object.keys(lock).filter((a) => a in reg)
  if (!common.length)
    return {
      refusal: `integrity cannot be compared: lockfile ${Object.keys(lock).join(', ')}, registry ${Object.keys(reg).join(', ')}`,
    }
  const differing = common.filter((a) => lock[a] !== reg[a])
  if (differing.length)
    return {
      refusal: `integrity is not the registry's (${differing.join(', ')}): lockfile ${lockIntegrity}, registry ${dist.integrity ?? dist.shasum}`,
    }
  return {}
}

/** The registry's 200 against the packument shape this reader relies on; null when it holds. */
export function packumentProblem(meta, name) {
  if (!isObject(meta)) return 'registry payload is not an object'
  if (meta.name !== name)
    return `registry payload is for ${JSON.stringify(meta.name)}, not ${name}`
  if (!isObject(meta.versions)) return 'registry payload has no versions object'
  if (meta.time !== undefined && !isObject(meta.time))
    return 'registry payload has a non-object time'
  return null
}

/** Each refusal is { rule, text }; the rule is what an exception may name. */
export function judge(change, meta) {
  const refusals = []
  const warnings = []
  const refuse = (rule, text) => refusals.push({ rule, text })
  const problem = packumentProblem(meta, change.name)
  if (problem) {
    refuse('registry', problem)
    return { refusals, warnings }
  }
  const v = meta.versions[change.to]
  if (!isObject(v)) {
    refuse('missing', `version ${change.to} is not on the registry`)
    return { refusals, warnings }
  }
  if (v.scripts !== undefined && !isObject(v.scripts))
    refuse('registry', 'registry version has a non-object scripts')
  const scripts = Object.keys(isObject(v.scripts) ? v.scripts : {}).filter(
    (s) => ['preinstall', 'install', 'postinstall'].includes(s),
  )
  if (scripts.length)
    refuse('scripts', `install scripts: ${scripts.join(', ')}`)
  const published = meta.time?.[change.to]
  if (typeof published === 'string') {
    const ageDays = (Date.now() - Date.parse(published)) / 86_400_000
    if (!(ageDays >= MIN_AGE_DAYS))
      refuse(
        'age',
        `published ${Number.isFinite(ageDays) ? ageDays.toFixed(1) : 'an unreadable number of'} days ago, under ${MIN_AGE_DAYS}`,
      )
  } else {
    warnings.push('no publish time on the registry')
  }
  const publisher = (ver) => {
    const u = meta.versions[ver]?._npmUser
    if (!isObject(u)) return null
    return isObject(u.trustedPublisher)
      ? `trusted publisher ${u.trustedPublisher.id}`
      : u.name
  }
  const was = change.from ? publisher(change.from) : null
  const now = publisher(change.to)
  if (was && now && was !== now)
    refuse('publisher', `publisher changed: ${was} → ${now}`)
  if (change.resolved && !change.resolved.startsWith(REGISTRY))
    refuse('source', `tarball not from the registry: ${change.resolved}`)
  if (change.integrityChanged)
    refuse(
      'integrity',
      `integrity changed under the same version and URL: ${change.integrityBefore ?? 'none'} → ${change.integrity || 'none'}`,
    )
  const integrity = integrityVerdict(change.integrity, v.dist)
  if (integrity.refusal) refuse('integrity', integrity.refusal)
  if (!isObject(v.dist) || !v.dist.attestations)
    warnings.push('no provenance attestation')
  if (v.deprecated) warnings.push(`deprecated: ${v.deprecated}`)
  return { refusals, warnings, publisher: now }
}

/**
 * The verdict for one package: its refusals against its exception line, which excuses only
 * the rules it names, among EXCUSABLE. A bare string (the old blanket form) excuses nothing.
 */
export function verdictFor(refusals, allowed) {
  const excuses = isObject(allowed) ? allowed : {}
  const excused = refusals.filter(
    (r) => EXCUSABLE.includes(r.rule) && typeof excuses[r.rule] === 'string',
  )
  const remaining = refusals.filter((r) => !excused.includes(r))
  const notes = []
  if (allowed !== undefined && !isObject(allowed))
    notes.push('exception ignored: it names no rule')
  if (remaining.length) return { verdict: 'REFUSED', refused: true, notes }
  if (excused.length)
    return {
      verdict: `exception: ${excused.map((r) => `${r.rule}: ${excuses[r.rule]}`).join('; ')}`,
      refused: false,
      notes,
    }
  return { verdict: 'ok', refused: false, notes }
}

async function metadata(name) {
  const res = await fetch(REGISTRY + name.replace('/', '%2f'), {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`registry ${res.status} for ${name}`)
  return res.json()
}

async function main() {
  const [, , basePath, headPath] = process.argv
  if (!basePath || !headPath) {
    console.error('usage: lockfile-check.mjs <base lock> <head lock>')
    process.exit(2)
  }
  const read = (p) => JSON.parse(readFileSync(resolve(p), 'utf8'))
  const base = read(basePath)
  const head = read(headPath)
  let allow = {}
  try {
    allow = read(ALLOW_FILE)
  } catch {
    /* no exceptions file: nothing is allowed */
  }

  const list = changes(base, head)
  const rows = []
  let refused = 0
  for (const change of list) {
    let result
    try {
      result = judge(change, await metadata(change.name))
    } catch (e) {
      result = {
        refusals: [
          { rule: 'lookup', text: `registry lookup failed: ${e.message}` },
        ],
        warnings: [],
      }
    }
    const v = verdictFor(result.refusals, allow[`${change.name}@${change.to}`])
    if (v.refused) refused += 1
    rows.push({ change, result, verdict: v.verdict, notes: v.notes })
  }

  const esc = (s) => String(s).replace(/\|/g, '\\|')
  const lines = [
    `### Lockfile check: ${list.length} package${list.length === 1 ? '' : 's'} added or changed, ${refused} refused`,
    '',
  ]
  if (list.length) {
    lines.push('| package | from → to | verdict | why |', '|---|---|---|---|')
    for (const { change, result, verdict, notes } of rows) {
      const why =
        [
          ...result.refusals.map((r) => r.text),
          ...result.warnings.map((w) => `warn: ${w}`),
          ...notes,
        ].join('; ') ||
        (result.publisher ? `publisher ${result.publisher}` : '')
      lines.push(
        `| ${esc(change.name)} | ${change.from ?? 'new'} → ${change.to} | ${verdict} | ${esc(why)} |`,
      )
    }
  } else {
    lines.push('No dependency changed.')
  }
  lines.push(
    '',
    `_Rules: install scripts, age under ${MIN_AGE_DAYS} days, publisher change, tarball off the registry, integrity changed under the same version or not the registry's, a registry answer that is not the packument refuse; missing provenance and deprecation warn; exceptions live in \`${ALLOW_FILE}\`, each naming the one rule it excuses._`,
  )
  console.log(lines.join('\n'))
  process.exit(refused ? 1 : 0)
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) await main()
