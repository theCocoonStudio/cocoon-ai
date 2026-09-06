/**
 * launch candidates: the current filled panel beside three redraws, each a
 * solid mass (spec §6: a hollow frame fills with its own echoes), at 16 to
 * 64 px as shipped and at 128 px under the haze.
 *
 *   node assets/icons/explorations/launch.mjs
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as H from '../../lib/haze.js'
import { png } from '../../lib/raster.js'
import { BAR, BOX, arrow, launchNotch, launchSolid, rect } from '../shapes.js'

const here = dirname(fileURLToPath(import.meta.url))

/** D. Two masses: a small square low left, a long arrow clear of it. */
export function launchTwo(bar = BAR) {
  const s = BOX * 0.56
  return [
    rect(0, BOX - s, s, BOX),
    arrow([BOX, 0], [BOX * 0.42, BOX * 0.58], bar, bar * 3.2, bar * 2.2),
  ]
}

/** E. Channel: the panel with a clear-air channel cut around the arrow, the arrow in it. */
export function launchChannel(bar = BAR, gap = bar * 0.55) {
  const x1 = BOX * 0.74
  const y0 = BOX * 0.26
  const tip = [BOX, 0]
  const tail = [x1 - bar * 1.6, y0 + bar * 1.6]
  const d = [tip[0] - tail[0], tip[1] - tail[1]]
  const L = Math.hypot(...d)
  const u = [d[0] / L, d[1] / L]
  const dil = arrow(
    [tip[0] + u[0] * gap, tip[1] + u[1] * gap],
    [tail[0] - u[0] * gap, tail[1] - u[1] * gap],
    bar + 2 * gap,
    bar * 3 + 2 * gap,
    bar * 2.1 + gap,
  )
  return [
    rect(0, y0, x1, BOX),
    H.hole(dil),
    arrow(tip, tail, bar, bar * 3, bar * 2.1),
  ]
}

const ROWS = [
  [
    'before 2026-09-06: filled panel, arrow unioned into the corner',
    launchSolid,
  ],
  [
    'B notch, chosen: corner knocked out, arrow leaving through it',
    launchNotch,
  ],
  ['D two masses: small square, long arrow clear of it', launchTwo],
  ['E channel: clear air cut around the arrow, arrow in it', launchChannel],
]
const SIZES = [16, 24, 32, 48, 64]

const embed = (svg, x, y, w, h) =>
  svg
    .replace(/^<\?xml[^>]*>\n/, '')
    .replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `)

let body = ''
let y = 12
const rowH = 128 + 40
for (const [label, fn] of ROWS) {
  body += `<text x="12" y="${y + 12}" font-family="monospace" font-size="11" fill="#444">${label}</text>`
  let x = 12
  const { pieces, viewBox } = H.front(fn(), { square: true })
  const face = H.svg(pieces, viewBox)
  for (const s of SIZES) {
    body += embed(
      face.replace(/currentColor/g, '#141414'),
      x,
      y + 20 + (64 - s),
      s,
      s,
    )
    x += s + 16
  }
  const { pieces: hp, bounds } = H.build(fn(), { cut: 'vapour' })
  const haze = H.svg(hp, bounds)
  const hw = 128 * (bounds[2] / bounds[3])
  body += embed(haze, x + 16, y + 20, hw, 128)
  y += rowH
}
const W = 12 + SIZES.reduce((a, s) => a + s + 16, 0) + 16 + 260
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="#FFFFFF"/>${body}</svg>`
writeFileSync(join(here, 'launch.png'), png(sheet, { width: W * 3 }))
console.log(`launch.png ${W}x${y} at 3x`)
