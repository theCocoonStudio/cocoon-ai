/**
 * The favicon at three settings, at 16 to 128 px, for a decision about the
 * clear-air rule after the trail lengthened to radius 0.6333 (the old camera
 * offset 1.90).
 *
 *   node assets/logo/explorations/favicon.mjs
 *
 * Rows: the tile before 2026-09-05, offset 1.30 and 10% clear air; the
 * shipped tile at 1.90 and FAVI_MARGIN; and a candidate, not taken, where 10%
 * holds for the black triangle and the pale planes may come within 4% of the
 * edge.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { png } from '../../lib/raster.js'
import * as M from '../mark.js'

const here = dirname(fileURLToPath(import.meta.url))
const SIZES = [16, 32, 48, 64, 128]
const PALE_MARGIN = 0.04

/** Fill that puts the black triangle `front` clear and the rest `pale` clear, whichever binds. */
function fillFor({ front = 0.1, pale = PALE_MARGIN, ...opts }) {
  const [ix, iy, iw, ih] = M.build(opts).bounds
  const [fx, fy, fw, fh] = M.frontBounds(opts)
  const cx = fx + fw / 2
  const cy = fy + fh / 2
  const reachAll = Math.max(cx - ix, ix + iw - cx, cy - iy, iy + ih - cy)
  const reachFront = Math.max(fw, fh) / 2
  const k = Math.min(
    (0.5 * (1 - 2 * pale)) / reachAll,
    (0.5 * (1 - 2 * front)) / reachFront,
  )
  return k * Math.max(fw, fh)
}

const rows = [
  {
    label: 'before 2026-09-05: radius 0.4333 (off 1.30), every plane 10% clear',
    kw: { radius: 1.3 / 3, margin: 0.1 },
  },
  {
    label: `shipped now: radius 0.6333, every plane ${M.FAVI_MARGIN * 100}% clear`,
    kw: {},
  },
  {
    label: `not taken: radius 0.6333, black triangle 10% clear, pale planes ${PALE_MARGIN * 100}%`,
    kw: { fill: fillFor({ cut: 'dense' }), margin: PALE_MARGIN },
  },
]

let body = ''
let y = 10
const W = 80 + SIZES.reduce((a, s) => a + s + 16, 0)
for (const r of rows) {
  const tile = M.favicon(M.FAVI_LIGHT, { cut: 'dense', ...r.kw })
  const dark = M.favicon(M.FAVI_DARK, { cut: 'dense', reverse: true, ...r.kw })
  body += `<text x="10" y="${y + 11}" font-family="monospace" font-size="10" fill="#444">${r.label}   scale ${tile.match(/scale\(([^)]+)\)/)[1]}</text>`
  for (const [svg, dy] of [
    [tile, 0],
    [dark, 140],
  ]) {
    let x = 10
    for (const s of SIZES) {
      body += svg
        .replace(/^<\?xml[^>]*>\n/, '')
        .replace(
          '<svg ',
          `<svg x="${x}" y="${y + 18 + dy}" width="${s}" height="${s}" `,
        )
      x += s + 16
    }
  }
  y += 300
}
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="#FFFFFF"/>${body}</svg>`
writeFileSync(join(here, 'favicon.png'), png(sheet, { width: W * 3 }))
console.log(`favicon.png ${W}x${y} at 3x`)
for (const r of rows) console.log(' ', r.label)
