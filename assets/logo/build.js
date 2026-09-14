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
import { png } from '../lib/raster.js'
import { fmt } from '../lib/fmt.js'
import * as H from '../lib/haze.js'
import { INK } from '../lib/haze.js'
import { simplifyPolyline } from '../../src/utils/simplifyPolyline.js'
import * as M from './mark.js'
import * as W from './wordmark.js'
import {
  FONT,
  STEM,
  WORD_WDTH,
  WORD_WGHT,
  XH,
  XH_BOT,
  XH_TOP,
  lockup,
  wordmark,
} from './lockup.js'

const here = dirname(fileURLToPath(import.meta.url))

export const SQUARE_PAD = 60
export const SIZES = [0.9, 1.0, 1.1]
/** Tiers are named by clear air, in stems; the gap that delivers it is derived. */
export const AIR_TIERS = [1, 2, 3]
export const CUTS = { vapour: { cut: 'vapour' }, dense: { cut: 'dense' } }
/**
 * PNG previews: name -> [width, source file, background]. The lockup previews
 * are 1.00x / air2x / vapour; reversed ones stand on ink.
 */
export const PREVIEWS = {
  'cocoon-wordmark': [1800, 'cocoon-wordmark.svg'],
  'cocoon-icon-vapour': [1400, 'cocoon-icon-vapour.svg'],
  'cocoon-icon-vapour-reversed': [1400, 'cocoon-icon-vapour-reversed.svg', INK],
  'cocoon-icon-dense': [1400, 'cocoon-icon-dense.svg'],
  'cocoon-favicon': [512, 'cocoon-favicon.svg'],
  'cocoon-lockup': [2000, 'lockups/cocoon-lockup-icon1.00-air2x-vapour.svg'],
  'cocoon-lockup-reversed': [
    2000,
    'lockups/cocoon-lockup-icon1.00-air2x-vapour-reversed.svg',
    INK,
  ],
}

/**
 * Stems from the black triangle's right edge to the faintest tip, at the
 * largest icon size. `iconKw` describes the scene; the shipped one by default.
 */
export function trailWorst(sizes = SIZES, iconKw = {}) {
  const fb = M.frontBounds(iconKw)
  const ab = M.build(iconKw).bounds
  const trail = ab[0] + ab[2] - (fb[0] + fb[2])
  return (trail * ((Math.max(...sizes) * XH) / fb[3])) / STEM
}

/** Front-edge gap for a tier: air + the worst trail, rounded up to the quarter stem. */
export function gapFor(air, sizes = SIZES, iconKw = {}) {
  return Math.ceil((air + trailWorst(sizes, iconKw)) * 4) / 4
}

/** Every tier must deliver its stated clear air at every icon size. Exact arithmetic, no tolerance. */
export function checkLockups(sizes = SIZES, tiers = AIR_TIERS, gap = gapFor) {
  const fb = M.frontBounds()
  const ab = M.build().bounds
  const trail = ab[0] + ab[2] - (fb[0] + fb[2])
  const worst = {}
  for (const air of tiers) {
    const g = gap(air, sizes)
    for (const size of sizes) {
      const k = (size * XH) / fb[3]
      const got = g - (trail * k) / STEM
      if (got < air)
        throw new Error(
          `lockup air FAILED: air${air}x at icon ${size.toFixed(2)}x delivers ${got.toFixed(4)} stems, floor ${air}. gap(${air}) = ${g}.`,
        )
      worst[air] = Math.min(worst[air] ?? Infinity, got)
    }
  }
  return worst
}

// ---- the logo mesh's data ----------------------------------------------------
export const LOGO_MODULE = join(
  here,
  '..',
  '..',
  'src',
  'CocoonLogoGroup',
  'logo.js',
)
/** Chord error of the emitted outlines, design units; the mesh simplifies again at mount. */
export const LOGO_TOL = 0.05

function inside(pt, poly) {
  let ins = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    )
      ins = !ins
  }
  return ins
}

/**
 * What src/CocoonLogoGroup/logo.js holds, as data: the front triangle, sharp
 * and filleted, with its centroid at the origin on the 1000 box; the
 * wordmark's contours grouped as outlines with their holes; the anchoring
 * constants. Everything y up, as three has it, so the mesh negates nothing.
 */
export function logoData() {
  const flip = (pts) => pts.map(([x, y]) => [x, -y])
  const sharpSvg = H.place(M.triangle(), { n: 1 })[0].elems[0].v
  const outlineSvg = H.flattenPath(
    H.fillet(sharpSvg, H.CORNER_R * H.SIDE, 12),
    LOGO_TOL,
  )
  const contours = wordmark()
    .pieces.flat()
    .map((c) => simplifyPolyline(c, LOGO_TOL))
  const outer = contours.filter(
    (c) => !contours.some((o) => o !== c && inside(c[0], o)),
  )
  const groups = outer.map((o) => ({
    outer: o,
    holes: contours.filter((c) => c !== o && inside(c[0], o)),
  }))
  const [wx, wy, ww, wh] = W.pieceBounds(wordmark().pieces) // SVG y-down bounds
  return {
    triangle: { sharp: flip(sharpSvg), outline: flip(outlineSvg), box: H.SIDE },
    wordmark: {
      groups,
      bounds: [wx, -(wy + wh), wx + ww, -wy],
      xHeight: { top: XH_TOP, bottom: XH_BOT },
      stem: STEM,
    },
    sizes: SIZES,
  }
}

/** The module text. */
export function logoModule(data = logoData()) {
  const pt = (prec) => (p) => `[${fmt(p[0], prec)},${fmt(p[1], prec)}]`
  const pts = (arr, prec) => `[${arr.map(pt(prec)).join(',')}]`
  const t = data.triangle
  const w = data.wordmark
  return (
    `// GENERATED by assets/logo/build.js. Do not edit; run \`npm run assets:logo\`.\n` +
    `// The logo as outlines for the mesh, y up, chord error ${LOGO_TOL} design units:\n` +
    `// the front triangle with its centroid at the origin on the ${t.box} box, sharp and\n` +
    `// filleted, and the wordmark's contours in font units with their holes.\n\n` +
    `export const LOGO = /* @__PURE__ */ Object.freeze({\n` +
    `  triangle: {\n    box: ${t.box},\n    sharp: ${pts(t.sharp, 3)},\n    outline: ${pts(t.outline, 3)},\n  },\n` +
    `  wordmark: {\n    bounds: [${w.bounds.map((v) => fmt(v, 2)).join(', ')}],\n` +
    `    xHeight: { top: ${w.xHeight.top}, bottom: ${w.xHeight.bottom} },\n    stem: ${w.stem},\n` +
    `    groups: [\n${w.groups
      .map(
        (g) =>
          `      {\n        outer: ${pts(g.outer, 2)},\n        holes: [${g.holes.map((h) => pts(h, 2)).join(', ')}],\n      },`,
      )
      .join('\n')}\n    ],\n  },\n` +
    `  sizes: [${data.sizes.join(', ')}],\n})\n`
  )
}

export const SPEC = join(here, 'cocoon-logo-spec.md')

/** The spec's tier table must agree with gapFor(). Scoped to the one table whose second column is the gap. */
export function checkSpec(path = SPEC) {
  const text = readFileSync(path, 'utf8')
  const head = text.search(/\|\s*tier\s*\|\s*front-edge gap\s*\|/)
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
  for (const [name, [width, file, background]] of Object.entries(PREVIEWS))
    writeFileSync(
      join(out, `${name}.png`),
      png(files[file], { width, ...(background ? { background } : null) }),
    )
  if (out === here) writeFileSync(LOGO_MODULE, logoModule())
  const worst = checkLockups()
  const stated = checkSpec()
  return { files, worst, stated }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || here
  const { files, worst, stated } = build(out)
  console.log(
    `${Object.keys(files).length} svg files + ${Object.keys(PREVIEWS).length} png previews in ${out}`,
  )
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
