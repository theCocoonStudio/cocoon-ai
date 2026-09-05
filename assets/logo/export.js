#!/usr/bin/env node
/**
 * export:logo — render the mark or the lockup at chosen scene values, with a
 * sheet of neighbours around each chosen value.
 *
 *   npm run export:logo -- --off 1.9
 *   npm run export:logo -- --off 1.9 --spacing 1.2 -b 0.1 -c 2
 *   npm run export:logo -- --off 1.9:0.05:3 --view icon --cut dense
 *
 * Each parameter is given as `--<name> <value>[:<buffer>[:<count>]]`. The
 * buffer is the step on either side of the value and the count is how many
 * steps; `-b` and `-c` set them for every parameter that does not carry its
 * own. `--off 1.9 -b 0.1 -c 2` sweeps 1.7, 1.8, 1.9, 2.0, 2.1. Parameters
 * are swept one at a time, the others held at their chosen values, so the
 * sheet has one block of rows per swept parameter with the chosen row marked.
 *
 * Two files land in `--out`: `<name>.svg`, the artwork at the chosen values,
 * and `<name>-examples.svg` plus `.png`, the sheet. `<name>` defaults to
 * `cocoon-<view>-<cut>`.
 *
 * The scene parameters are the engine's: `off`, `spacing`, `dist`, `planes`,
 * `corner`, `haze`, and the mark's `apex`. The lockup adds `size`, `gap`,
 * `air`, and the wordmark's `wght` and `wdth`; a `gap` left unset is derived
 * for each scene by the tier rule at `air`, the same rule the shipped lockups
 * follow.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAM_OFF, CORNER_R, CUT_GROUND, INK, N, SIDE } from '../lib/haze.js'
import { HAZE_CUTS, HAZE_DEFAULTS } from '../../src/utils/hazePlanes.js'
import { png } from '../lib/raster.js'
import * as M from './mark.js'
import { WORD_WDTH, WORD_WGHT, lockup } from './lockup.js'
import { gapFor } from './build.js'

const here = dirname(fileURLToPath(import.meta.url))
export const OUT_DIR = join(here, 'explorations', 'export')
export const DEFAULT_COUNT = 2
export const DEFAULT_AIR = 2

/**
 * The sweepable parameters. `buffer` is the default step, chosen so two
 * steps either side are a visible change without leaving the useful range.
 * `valid` rejects values the engine cannot draw; those rows are dropped.
 */
export const PARAMS = {
  off: {
    doc: 'camera offset, in shape widths',
    value: CAM_OFF,
    buffer: 0.1,
    valid: (v) => v > 0,
  },
  spacing: {
    doc: 'plane spacing, in design boxes',
    value: HAZE_DEFAULTS.spacing,
    buffer: 0.1,
    valid: (v) => v > 0,
  },
  dist: {
    doc: 'camera distance to the front plane, in design boxes',
    value: HAZE_DEFAULTS.distance,
    buffer: 0.5,
    valid: (v) => v > 0,
  },
  planes: {
    doc: 'number of planes',
    value: N,
    buffer: 1,
    integer: true,
    valid: (v) => v >= 1,
  },
  corner: {
    doc: 'front fillet radius, fraction of the box',
    value: CORNER_R,
    buffer: 0.005,
    valid: (v) => v >= 0,
  },
  haze: {
    doc: 'transmittance total across the planes; the cut sets the default',
    value: (o) => HAZE_CUTS[o.cut],
    buffer: 0.02,
    valid: (v) => v > 0 && v < 1,
  },
  apex: {
    doc: "the triangle's apex angle, degrees",
    value: M.APEX_DEG,
    buffer: 4,
    valid: (v) => v > 0 && v < 180,
  },
  size: {
    doc: 'icon height, in x-height bands (lockup only)',
    value: 1.0,
    buffer: 0.1,
    lockup: true,
    valid: (v) => v > 0,
  },
  gap: {
    doc: 'front-edge gap, in stems; derived by the tier rule when unset (lockup only)',
    value: null,
    buffer: 0.25,
    lockup: true,
    valid: (v) => v >= 0,
  },
  air: {
    doc: 'clear air the derived gap must deliver, in stems; ignored when gap is set (lockup only)',
    value: DEFAULT_AIR,
    buffer: 0.5,
    lockup: true,
    valid: (v) => v >= 0,
  },
  wght: {
    doc: "the wordmark's weight axis (lockup only)",
    value: WORD_WGHT,
    buffer: 50,
    lockup: true,
    valid: (v) => v >= 100 && v <= 900,
  },
  wdth: {
    doc: "the wordmark's width axis (lockup only)",
    value: WORD_WDTH,
    buffer: 5,
    lockup: true,
    valid: (v) => v >= 50 && v <= 125,
  },
}

export const VIEWS = {
  lockup: { widths: [120, 200, 320, 600] },
  icon: { widths: [32, 64, 128, 256] },
}

const usage = () => {
  const rows = Object.entries(PARAMS)
    .map(([k, p]) => `  --${k.padEnd(9)}${p.doc}`)
    .join('\n')
  return (
    `usage: npm run export:logo -- [--<param> <value>[:<buffer>[:<count>]]]... [options]\n\n` +
    `parameters (swept one at a time around the value given)\n${rows}\n\n` +
    `options\n` +
    `  -b, --buffer <n>   default step either side of a value (per-parameter defaults otherwise)\n` +
    `  -c, --count <n>    default number of steps either side (${DEFAULT_COUNT})\n` +
    `  --view <v>         lockup | icon (lockup)\n` +
    `  --cut <c>          ${Object.keys(HAZE_CUTS).join(' | ')} (vapour)\n` +
    `  --reverse          light on dark\n` +
    `  --widths <a,b,..>  cell widths in px on the sheet\n` +
    `  --out <dir>        output folder (assets/logo/explorations/export)\n` +
    `  --name <n>         file stem (cocoon-<view>-<cut>)\n` +
    `  -h, --help\n`
  )
}

const num = (s, what) => {
  const v = Number(s)
  if (s === '' || s == null || Number.isNaN(v))
    throw new Error(`export:logo: ${what} wants a number, got "${s}"`)
  return v
}

/** argv (after node and the script) -> { params, buffer, count, view, cut, reverse, widths, out, name, help }. */
export function parseArgs(argv) {
  const o = {
    params: {},
    buffer: null,
    count: DEFAULT_COUNT,
    view: 'lockup',
    cut: 'vapour',
    reverse: false,
    widths: null,
    out: OUT_DIR,
    name: null,
    help: false,
  }
  const args = [...argv]
  const take = (flag) => {
    if (!args.length) throw new Error(`export:logo: ${flag} wants a value`)
    return args.shift()
  }
  while (args.length) {
    let a = args.shift()
    let inline = null
    const eq = a.indexOf('=')
    if (a.startsWith('--') && eq > 0) {
      inline = a.slice(eq + 1)
      a = a.slice(0, eq)
    }
    const val = () => (inline != null ? inline : take(a))
    switch (a) {
      case '-h':
      case '--help':
        o.help = true
        break
      case '-b':
      case '--buffer':
        o.buffer = num(val(), a)
        break
      case '-c':
      case '--count':
        o.count = num(val(), a)
        break
      case '--view':
        o.view = val()
        break
      case '--cut':
        o.cut = val()
        break
      case '--reverse':
        o.reverse = true
        break
      case '--widths':
        o.widths = val()
          .split(',')
          .map((w) => num(w, a))
        break
      case '--out':
        o.out = val()
        break
      case '--name':
        o.name = val()
        break
      default: {
        const key = a.replace(/^--/, '')
        if (!a.startsWith('--') || !(key in PARAMS))
          throw new Error(`export:logo: unknown argument "${a}"\n\n${usage()}`)
        const [v, b, c] = val().split(':')
        const p = { value: num(v, a) }
        if (b != null && b !== '') p.buffer = num(b, a)
        if (c != null && c !== '') p.count = num(c, a)
        o.params[key] = p
      }
    }
  }
  if (!(o.view in VIEWS))
    throw new Error(`export:logo: unknown view "${o.view}"`)
  if (!(o.cut in HAZE_CUTS))
    throw new Error(`export:logo: unknown cut "${o.cut}"`)
  if (!(o.count >= 0) || o.count !== Math.floor(o.count))
    throw new Error(`export:logo: count must be a whole number >= 0`)
  if (o.buffer != null && !(o.buffer > 0))
    throw new Error(`export:logo: buffer must be > 0`)
  for (const k of Object.keys(o.params))
    if (PARAMS[k].lockup && o.view !== 'lockup')
      throw new Error(`export:logo: --${k} applies to the lockup view only`)
  return o
}

/** Drop the float noise of x + i·b so 1.9 - 0.2 labels as 1.7. */
export const tidy = (v) => Number(v.toFixed(10))

/**
 * The values a parameter takes: x - c·b ... x + c·b, in order. Integer
 * parameters round and deduplicate. Values the engine rejects are dropped.
 */
export function sweep(key, { value, buffer, count }) {
  const p = PARAMS[key]
  const out = []
  for (let i = -count; i <= count; i++) {
    let v = tidy(value + i * buffer)
    if (p.integer) v = Math.round(v)
    if (!p.valid(v)) continue
    if (!out.includes(v)) out.push(v)
  }
  return out
}

/** The chosen value of every parameter, defaults filled in for the scene. */
export function chosen(o) {
  const out = {}
  for (const [k, p] of Object.entries(PARAMS)) {
    if (p.lockup && o.view !== 'lockup') continue
    if (k in o.params) out[k] = o.params[k].value
    else {
      const v = typeof p.value === 'function' ? p.value(o) : p.value
      out[k] = v == null ? null : tidy(v)
    }
  }
  return out
}

/**
 * The rows of the sheet: the chosen values first, then for each swept
 * parameter its values in order, the others held. `{ label, values, chosen }`.
 */
export function variants(o) {
  const base = chosen(o)
  const rows = []
  for (const [k, given] of Object.entries(o.params)) {
    const buffer = given.buffer ?? o.buffer ?? PARAMS[k].buffer
    const count = given.count ?? o.count
    for (const v of sweep(k, { value: given.value, buffer, count })) {
      const values = { ...base, [k]: v }
      const isChosen = v === given.value
      rows.push({
        param: k,
        label: `${k} ${v}${isChosen ? '  (chosen)' : ''}`,
        values,
        chosen: isChosen,
      })
    }
  }
  if (!rows.length)
    rows.push({ param: null, label: 'chosen', values: base, chosen: true })
  return rows
}

/** Engine and mark options for a set of values. */
export function iconKw(values, o) {
  const kw = { cut: o.cut, reverse: o.reverse }
  if (values.off != null) kw.off = values.off
  if (values.spacing != null) kw.spacing = values.spacing * SIDE
  if (values.dist != null) kw.dist = values.dist * SIDE
  if (values.planes != null) kw.n = values.planes
  if (values.corner != null) kw.corner = values.corner
  if (values.haze != null) kw.haze = values.haze
  if (values.apex != null) kw.apex = values.apex
  return kw
}

/** { svg, ratio, gap } for one set of values in the chosen view. */
export function render(values, o) {
  const kw = iconKw(values, o)
  if (o.view === 'icon') {
    const { pieces, bounds } = M.build(kw)
    return { svg: M.svg(pieces, bounds), ratio: bounds[2] / bounds[3] }
  }
  const gapStems = values.gap ?? gapFor(values.air, [values.size], kw)
  const { svg, info } = lockup({
    size: values.size,
    gapStems,
    reverse: o.reverse,
    iconKw: kw,
    word: { wght: values.wght, wdth: values.wdth },
  })
  return { svg, ratio: info.ratio, gap: gapStems }
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Nest a standalone SVG at a position and size inside another. */
export function embed(svg, x, y, w, h) {
  return svg
    .replace(/^<\?xml[^>]*>\n/, '')
    .replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `)
}

/**
 * The sheet: one row per variant, one cell per width, the label above each
 * row. Rows for different parameters are separated by a rule. Returns
 * { svg, width, height }.
 */
export function sheet(rows, o, widths = VIEWS[o.view].widths) {
  const PAD = 20
  const GUT = 30
  const LABEL = 24
  const ground = o.reverse ? INK : CUT_GROUND[o.cut]
  const ink = o.reverse ? CUT_GROUND[o.cut] : INK
  const W = PAD + widths.reduce((a, w) => a + w + GUT, 0) - GUT + PAD
  let body = ''
  let y = PAD
  let lastParam = null
  for (const r of rows) {
    if (lastParam != null && r.param !== lastParam) {
      body += `\n  <line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${ink}" stroke-opacity="0.25"/>`
      y += PAD
    }
    lastParam = r.param
    const { svg, ratio, gap } = render(r.values, o)
    const label =
      r.label +
      (gap != null && r.values.gap == null ? `   gap ${gap} stems` : '')
    body += `\n  <text x="${PAD}" y="${y + 14}" font-family="monospace" font-size="13" fill="${ink}" fill-opacity="${r.chosen ? 1 : 0.6}">${esc(label)}</text>`
    let x = PAD
    let rowH = 0
    for (const w of widths) {
      const h = w / ratio
      body += '\n  ' + embed(svg, x, y + LABEL, w, h)
      x += w + GUT
      rowH = Math.max(rowH, h)
    }
    y += LABEL + rowH + PAD
  }
  const H = Math.ceil(y)
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n` +
    `  <rect width="100%" height="100%" fill="${ground}"/>${body}\n</svg>\n`
  return { svg, width: W, height: H }
}

/** The artwork at the chosen values, with the values recorded in a comment. */
export function chosenSvg(o) {
  const values = chosen(o)
  const { svg, gap } = render(values, o)
  const shown = { ...values }
  if (shown.gap == null && gap != null) shown.gap = gap
  const note = Object.entries(shown)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  return {
    svg: svg.replace(
      /^(<\?xml[^>]*>\n)/,
      `$1<!-- export:logo ${o.view} ${o.cut}${o.reverse ? ' reversed' : ''}: ${note} -->\n`,
    ),
    values: shown,
  }
}

/** Run the export for parsed options. Returns the paths written. */
export function run(o) {
  const name =
    o.name ?? `cocoon-${o.view}-${o.cut}${o.reverse ? '-reversed' : ''}`
  mkdirSync(o.out, { recursive: true })
  const one = chosenSvg(o)
  const rows = variants(o)
  const sh = sheet(rows, o, o.widths ?? VIEWS[o.view].widths)
  const paths = {
    chosen: join(o.out, `${name}.svg`),
    examples: join(o.out, `${name}-examples.svg`),
    examplesPng: join(o.out, `${name}-examples.png`),
  }
  writeFileSync(paths.chosen, one.svg)
  writeFileSync(paths.examples, sh.svg)
  writeFileSync(paths.examplesPng, png(sh.svg, { width: sh.width * 2 }))
  return { paths, values: one.values, rows, sheet: sh }
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  let o
  try {
    o = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exit(2)
  }
  if (o.help) {
    console.log(usage())
    process.exit(0)
  }
  const { paths, values, rows, sheet: sh } = run(o)
  console.log(
    `${o.view} ${o.cut}${o.reverse ? ' reversed' : ''}: ` +
      Object.entries(values)
        .map(([k, v]) => `${k}=${v}`)
        .join(' '),
  )
  for (const r of rows) console.log(`  ${r.label}`)
  console.log(
    `${paths.chosen}\n${paths.examples}\n${paths.examplesPng}  (${sh.width}x${sh.height} at 2x)`,
  )
}
