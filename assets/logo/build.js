#!/usr/bin/env node
/**
 * Regenerate every derived cocoon logo file.
 *
 *   node assets/logo/build.js [outdir]
 *
 * Everything that centres or spaces the mark anchors on the front triangle.
 * The four plain icon SVGs carry no centring and must not move: they are what
 * the icon set's regression compares against, and the build refuses if they
 * change.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as M from './mark.js'
import * as W from './wordmark.js'
import {
  FONT,
  STEM,
  WORD_WDTH,
  WORD_WGHT,
  XH,
  lockup,
  wordmark,
} from './lockup.js'

const here = dirname(fileURLToPath(import.meta.url))

export const SQUARE_PAD = 60
export const SIZES = [0.9, 1.0, 1.1]
/** Tiers are named by clear air, in stems; the gap that delivers it is derived. */
export const AIR_TIERS = [1, 2, 3]
export const CUTS = { vapour: { cut: 'vapour' }, dense: { cut: 'dense' } }

/** Stems from the black triangle's right edge to the faintest tip, at the largest icon size. */
export function trailWorst(sizes = SIZES) {
  const fb = M.frontBounds()
  const ab = M.build().bounds
  const trail = ab[0] + ab[2] - (fb[0] + fb[2])
  return (trail * ((Math.max(...sizes) * XH) / fb[3])) / STEM
}

/** Front-edge gap for a tier: air + the worst trail, rounded up to the quarter stem. */
export function gapFor(air, sizes = SIZES) {
  return Math.ceil((air + trailWorst(sizes)) * 4) / 4
}

/** Every tier must deliver its stated clear air at every icon size. Exact arithmetic, no tolerance. */
export function checkLockups(sizes = SIZES, tiers = AIR_TIERS) {
  const fb = M.frontBounds()
  const ab = M.build().bounds
  const trail = ab[0] + ab[2] - (fb[0] + fb[2])
  const worst = {}
  for (const air of tiers) {
    const gap = gapFor(air, sizes)
    for (const size of sizes) {
      const k = (size * XH) / fb[3]
      const got = gap - (trail * k) / STEM
      if (got < air)
        throw new Error(
          `lockup air FAILED: air${air}x at icon ${size.toFixed(2)}x delivers ${got.toFixed(4)} stems, floor ${air}. gapFor(${air}) = ${gap}.`,
        )
      worst[air] = Math.min(worst[air] ?? Infinity, got)
    }
  }
  return worst
}

export const SPEC = join(here, 'cocoon-logo-spec.md')

/** The spec's tier table must agree with gapFor(). Scoped to the one table whose second column is the gap. */
export function checkSpec(path = SPEC) {
  const text = readFileSync(path, 'utf8')
  const head = text.indexOf('| tier | front-edge gap |')
  if (head < 0)
    throw new Error(`${path}: gap table not found. Has its format changed?`)
  const end = text.indexOf('\n\n', head)
  const block = text.slice(head, end < 0 ? undefined : end)
  const rows = [...block.matchAll(/\|\s*\*\*air(\d+)x\*\*\s*\|\s*([\d.]+)/g)]
  if (rows.length !== AIR_TIERS.length)
    throw new Error(
      `${path}: gap table has ${rows.length} tiers, build has ${AIR_TIERS.length}`,
    )
  const bad = []
  const stated = {}
  for (const [, tier, gap] of rows) {
    const want = gapFor(Number(tier))
    stated[tier] = Number(gap)
    if (Math.abs(Number(gap) - want) > 1e-9)
      bad.push(`air${tier}x: spec says ${gap}, gapFor gives ${want}`)
  }
  if (bad.length)
    throw new Error(`${path} disagrees with the generator: ${bad.join('; ')}`)
  return stated
}

/** Every derived file: name -> text. */
export function render() {
  const files = {}
  for (const [cut, kw] of Object.entries(CUTS))
    for (const reverse of [false, true]) {
      const { pieces, bounds } = M.build({ reverse, ...kw })
      files[`cocoon-icon-${cut}${reverse ? '-reversed' : ''}.svg`] = M.svg(
        pieces,
        bounds,
      )
    }
  for (const [cut, kw] of Object.entries(CUTS)) {
    const { pieces, bounds } = M.build(kw)
    const [fx, fy, fw, fh] = M.frontBounds(kw)
    files[`cocoon-icon-${cut}-square.svg`] = M.svg(pieces, bounds, {
      pad: SQUARE_PAD,
      square: true,
      anchor: [fx + fw / 2, fy + fh / 2],
    })
  }
  files['cocoon-favicon.svg'] = M.favicon(M.FAVI_LIGHT, CUTS.dense)
  files['cocoon-favicon-reversed.svg'] = M.favicon(M.FAVI_DARK, {
    reverse: true,
    ...CUTS.dense,
  })
  files['cocoon-wordmark.svg'] = W.svg(wordmark().pieces)
  for (const size of SIZES)
    for (const air of AIR_TIERS) {
      const gapStems = gapFor(air)
      for (const [cut, kw] of Object.entries(CUTS))
        for (const reverse of [false, true])
          files[
            `lockups/cocoon-lockup-icon${size.toFixed(2)}-air${air}x-${cut}${reverse ? '-reversed' : ''}.svg`
          ] = lockup({ size, gapStems, reverse, iconKw: kw }).svg
    }
  return files
}

export function build(out = here) {
  const files = render()
  for (const name of [
    'cocoon-icon-vapour.svg',
    'cocoon-icon-vapour-reversed.svg',
    'cocoon-icon-dense.svg',
    'cocoon-icon-dense-reversed.svg',
  ]) {
    const p = join(out, name)
    if (existsSync(p) && readFileSync(p, 'utf8') !== files[name])
      throw new Error(
        `${name} changed. The plain icons carry no centring rule, so nothing here should touch them, and the icon set's regression compares against them.`,
      )
  }
  mkdirSync(join(out, 'lockups'), { recursive: true })
  for (const [name, text] of Object.entries(files))
    writeFileSync(join(out, name), text)
  const worst = checkLockups()
  const stated = checkSpec()
  return { files, worst, stated }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || here
  const { files, worst, stated } = build(out)
  console.log(`${Object.keys(files).length} svg files in ${out}`)
  console.log(
    `wordmark: Saira ${WORD_WGHT}/${WORD_WDTH} from ${FONT.split('/').pop()}`,
  )
  console.log(`spec tier table agrees with gapFor(): ${JSON.stringify(stated)}`)
  console.log(
    `lockup clear air (exact): ${Object.entries(worst)
      .map(([a, v]) => `air${a}x >= ${v.toFixed(4)}`)
      .join(', ')}`,
  )
}
