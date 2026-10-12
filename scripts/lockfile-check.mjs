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
//           on any hash algorithm the two share, or shares none: the entry was edited or
//           the registry's tarball is not the one the lockfile pins (any check includes
//           integrity; the owner, 2026-10-11)
//   WARN    no provenance attestation on the version; many honest packages lack one
//   WARN    the version is deprecated
//   WARN    the registry publishes no integrity and no shasum for the version
//
// An exception is a line in .github/dependency-allow.json, `"name@version": "why"`,
// which turns a refusal into a listed exception; the file is code-owned, so the
// exception is reviewed. Output is markdown for the PR comment; exit 1 on any refusal.
// Node only, no dependencies, so the check cannot be compromised by what it checks.
// The functions are exported for the tests; the command runs only when this file is the
// script invoked.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const MIN_AGE_DAYS = 7
export const REGISTRY = 'https://registry.npmjs.org/'
const ALLOW_FILE = '.github/dependency-allow.json'

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
    out.push({
      path,
      name: nameOf(path),
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

/**
 * The lockfile's integrity against the registry's for the version: dist.integrity, and
 * dist.shasum as sha1 where the registry gives only that. Every algorithm both sides carry
 * must agree, and they must share at least one; nothing on the registry's side is a warning,
 * nothing on the lockfile's side a refusal.
 */
export function integrityVerdict(lockIntegrity, dist) {
  const lock = sri(lockIntegrity)
  const reg = sri(dist?.integrity)
  if (dist?.shasum && !reg.sha1)
    reg.sha1 = Buffer.from(dist.shasum, 'hex').toString('base64')
  if (!Object.keys(lock).length)
    return { refusal: 'no integrity in the lockfile entry' }
  if (!Object.keys(reg).length)
    return {
      warning: 'the registry publishes no integrity for this version',
    }
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

export function judge(change, meta) {
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
  if (change.integrityChanged)
    refusals.push(
      `integrity changed under the same version and URL: ${change.integrityBefore ?? 'none'} → ${change.integrity || 'none'}`,
    )
  const integrity = integrityVerdict(change.integrity, v.dist)
  if (integrity.refusal) refusals.push(integrity.refusal)
  if (integrity.warning) warnings.push(integrity.warning)
  if (!v.dist?.attestations) warnings.push('no provenance attestation')
  if (v.deprecated) warnings.push(`deprecated: ${v.deprecated}`)
  return { refusals, warnings, publisher: now }
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
    `_Rules: install scripts, age under ${MIN_AGE_DAYS} days, publisher change, tarball off the registry, integrity changed under the same version or not the registry's refuse; missing provenance and deprecation warn; exceptions live in \`${ALLOW_FILE}\`._`,
  )
  console.log(lines.join('\n'))
  process.exit(refused ? 1 : 0)
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) await main()
