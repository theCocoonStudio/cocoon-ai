#!/usr/bin/env node
// The lockfile reader: what a dependency change brings in, judged before it merges.
//
//   node scripts/lockfile-check.mjs <base package-lock.json> <head package-lock.json>
//
// Lists every package the head lockfile adds or changes against the base, asks the
// registry about each, and refuses on the signals that mean "not this one, not yet":
//
//   REFUSE  an install script (preinstall, install, postinstall): the sandbox refuses
//           them at install time already; a package that needs one is a reviewed exception
//   REFUSE  a version younger than MIN_AGE_DAYS: a hijacked release is usually caught
//           within days, so the newest version is the riskiest one
//   REFUSE  a different publisher than the previous version: the classic takeover signal
//   REFUSE  a tarball that does not come from the npm registry
//   WARN    no provenance attestation on the version; many honest packages lack one
//   WARN    the version is deprecated
//
// An exception is a line in .github/dependency-allow.json, `"name@version": "why"`,
// which turns a refusal into a listed exception; the file is code-owned, so the
// exception is reviewed. Output is markdown for the PR comment; exit 1 on any refusal.
// Node only, no dependencies, so the check cannot be compromised by what it checks.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MIN_AGE_DAYS = 7
const REGISTRY = 'https://registry.npmjs.org/'
const ALLOW_FILE = '.github/dependency-allow.json'

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

/** "node_modules/a/node_modules/@s/b" → "@s/b" */
const nameOf = (path) =>
  path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length)

/** Packages whose version differs between the two lockfiles, keyed by path. */
function changes() {
  const out = []
  for (const [path, entry] of Object.entries(head.packages ?? {})) {
    if (path === '' || entry.link) continue
    const before = base.packages?.[path]
    if (
      before?.version === entry.version &&
      before?.resolved === entry.resolved
    )
      continue
    out.push({
      path,
      name: nameOf(path),
      from: before?.version ?? null,
      to: entry.version,
      resolved: entry.resolved ?? '',
    })
  }
  return out
}

async function metadata(name) {
  const res = await fetch(REGISTRY + name.replace('/', '%2f'), {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`registry ${res.status} for ${name}`)
  return res.json()
}

function judge(change, meta) {
  const v = meta.versions?.[change.to]
  const refusals = []
  const warnings = []
  if (!v) {
    refusals.push(`version ${change.to} is not on the registry`)
    return { refusals, warnings }
  }
  const scripts = Object.keys(v.scripts ?? {}).filter((s) =>
    ['preinstall', 'install', 'postinstall'].includes(s),
  )
  if (scripts.length) refusals.push(`install scripts: ${scripts.join(', ')}`)
  const published = meta.time?.[change.to]
  if (published) {
    const ageDays = (Date.now() - Date.parse(published)) / 86_400_000
    if (ageDays < MIN_AGE_DAYS)
      refusals.push(
        `published ${ageDays.toFixed(1)} days ago, under ${MIN_AGE_DAYS}`,
      )
  } else {
    warnings.push('no publish time on the registry')
  }
  const publisher = (ver) => {
    const u = meta.versions?.[ver]?._npmUser
    if (!u) return null
    return u.trustedPublisher
      ? `trusted publisher ${u.trustedPublisher.id}`
      : u.name
  }
  const was = change.from ? publisher(change.from) : null
  const now = publisher(change.to)
  if (was && now && was !== now)
    refusals.push(`publisher changed: ${was} → ${now}`)
  if (change.resolved && !change.resolved.startsWith(REGISTRY))
    refusals.push(`tarball not from the registry: ${change.resolved}`)
  if (!v.dist?.attestations) warnings.push('no provenance attestation')
  if (v.deprecated) warnings.push(`deprecated: ${v.deprecated}`)
  return { refusals, warnings, publisher: now }
}

const list = changes()
const rows = []
let refused = 0
for (const change of list) {
  let result
  try {
    result = judge(change, await metadata(change.name))
  } catch (e) {
    result = {
      refusals: [`registry lookup failed: ${e.message}`],
      warnings: [],
    }
  }
  const key = `${change.name}@${change.to}`
  const allowed = allow[key]
  let verdict
  if (result.refusals.length && allowed) verdict = `exception: ${allowed}`
  else if (result.refusals.length) {
    verdict = 'REFUSED'
    refused += 1
  } else verdict = 'ok'
  rows.push({ change, result, verdict })
}

const esc = (s) => String(s).replace(/\|/g, '\\|')
const lines = [
  `### Lockfile check: ${list.length} package${list.length === 1 ? '' : 's'} added or changed, ${refused} refused`,
  '',
]
if (list.length) {
  lines.push('| package | from → to | verdict | why |', '|---|---|---|---|')
  for (const { change, result, verdict } of rows) {
    const why =
      [...result.refusals, ...result.warnings.map((w) => `warn: ${w}`)].join(
        '; ',
      ) || (result.publisher ? `publisher ${result.publisher}` : '')
    lines.push(
      `| ${esc(change.name)} | ${change.from ?? 'new'} → ${change.to} | ${verdict} | ${esc(why)} |`,
    )
  }
} else {
  lines.push('No dependency changed.')
}
lines.push(
  '',
  `_Rules: install scripts, age under ${MIN_AGE_DAYS} days, publisher change, tarball off the registry refuse; missing provenance and deprecation warn; exceptions live in \`${ALLOW_FILE}\`._`,
)
console.log(lines.join('\n'))
process.exit(refused ? 1 : 0)
