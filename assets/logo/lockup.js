/**
 * The lockup: icon left of the wordmark, anchored in the wordmark's own units.
 *
 *   size  the icon's total height as a multiple of the x-height band (526)
 *   gap   clear space from the front triangle's right edge to the wordmark's
 *         box, in wordmark stems (71.1). Measured to the front triangle, not
 *         the icon's box: the box ends at the faint fourth tip, so a gap to it
 *         changes with icon size while the air the eye sees does not
 *   align the icon's vertical extent centred on the x-height band
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fmt } from '../lib/fmt.js'
import * as M from './mark.js'
import * as W from './wordmark.js'

const here = dirname(fileURLToPath(import.meta.url))
export const FONT = join(here, 'Saira-VariableFont_wdth,wght.ttf')
export const WORD_WGHT = 350
export const WORD_WDTH = 107
export const STEM = 71.1
export const XH_TOP = 518
export const XH_BOT = -8
export const XH = XH_TOP - XH_BOT // 526
export const XH_MID = (XH_TOP + XH_BOT) / 2 // 255

let cache = null
/** The wordmark path and its SVG bounds, built once. */
export function wordmark() {
  if (!cache) {
    const { pieces } = W.buildWordmark(FONT, WORD_WGHT, WORD_WDTH)
    cache = { d: W.toSvgPath(pieces), bounds: W.pieceBounds(pieces), pieces }
  }
  return cache
}

/** { svg, info } for one lockup. `iconKw` passes through to the mark. */
export function lockup({
  size = 1.15,
  gapStems = 3,
  reverse = false,
  iconKw = {},
} = {}) {
  const { d: wd, bounds: wb } = wordmark()
  const ikw = { reverse, ...iconKw }
  const { pieces, bounds: ib } = M.build(ikw)
  const [ix, iy, iw, ih] = ib
  const H = size * XH
  const k = H / ih
  const g = gapStems * STEM
  const ty = -XH_MID - k * (iy + ih / 2)
  const [fx, , fw] = M.frontBounds(ikw)
  const tx = wb[0] - g - k * (fx + fw)
  const icX0 = tx + k * ix
  const icY0 = ty + k * iy
  const icX1 = icX0 + k * iw
  const icY1 = icY0 + k * ih
  const x0 = Math.min(icX0, wb[0])
  const x1 = Math.max(icX1, wb[0] + wb[2])
  const y0 = Math.min(icY0, wb[1])
  const y1 = Math.max(icY1, wb[1] + wb[3])
  // The wordmark takes plane 0's tone: same material, same depth, no air between.
  const wordFill = pieces[0].fill
  let body = ''
  for (const { paths, fill } of [...pieces].reverse())
    for (const { d } of paths) body += `\n    <path d="${d}" fill="${fill}"/>`
  const f = (v) => fmt(v, 3)
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg viewBox="${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}" xmlns="http://www.w3.org/2000/svg">\n` +
    `  <g transform="translate(${f(tx)} ${f(ty)}) scale(${fmt(k, 6)})">${body}\n  </g>\n` +
    `  <path d="${wd}" fill="${wordFill}" fill-rule="nonzero"/>\n</svg>\n`
  return {
    svg,
    info: {
      size,
      gapStems,
      iconH: H,
      iconW: k * iw,
      gap: g,
      scale: k,
      width: x1 - x0,
      height: y1 - y0,
      ratio: (x1 - x0) / (y1 - y0),
    },
  }
}
