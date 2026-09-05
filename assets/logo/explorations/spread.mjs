import { writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
import { Resvg } from '@resvg/resvg-js'
import * as M from '../mark.js'
import { lockup } from '../lockup.js'
import { CAM_OFF } from '../../lib/haze.js'

// Variants: camera offset in shape widths (spreads planes sideways), and plane spacing (size steps + tone steps stay)
const CUT = process.argv[2] || 'vapour'
const variants = [
  { label: 'current  off 1.30', off: CAM_OFF },
  { label: 'off 1.60', off: 1.6 },
  { label: 'off 1.90', off: 1.9 },
  { label: 'off 2.20', off: 2.2 },
  { label: 'off 1.60 spacing 1.5', off: 1.6, spacing: 1.5 * 1000 },
  { label: 'off 1.90 spacing 1.5', off: 1.9, spacing: 1.5 * 1000 },
]
const widths = [120, 200, 320, 600] // lockup width in px
const rows = []
let y = 20
const cells = []
for (const v of variants) {
  const iconKw = {
    cut: 'vapour',
    off: v.off,
    ...(v.spacing ? { spacing: v.spacing } : {}),
  }
  // gap: keep the tier rule but the trail is longer now; recompute worst trail for this scene
  const fb = M.frontBounds(iconKw),
    ab = M.build(iconKw).bounds
  const trail = ab[0] + ab[2] - (fb[0] + fb[2])
  const trailStems = (trail * ((1.1 * 526) / fb[3])) / 71.1
  const gapStems = Math.ceil((2 + trailStems) * 4) / 4
  const { svg, info } = lockup({ size: 1, gapStems, iconKw })
  let x = 20
  for (const w of widths) {
    const h = w / info.ratio
    cells.push({ x, y, w, h, svg })
    x += w + 30
  }
  rows.push({
    label: `${v.label}   gap ${gapStems} stems, trail ${trailStems.toFixed(2)} stems`,
    y,
  })
  y += (600 / 4174) * 526 + 70
}
// composite sheet: embed each lockup as nested <svg> at its pixel width
const W = 20 + widths.reduce((a, b) => a + b + 30, 0)
let body = ''
for (const c of cells) {
  const inner = c.svg
    .replace(/^<\?xml[^>]*>\n/, '')
    .replace(
      '<svg ',
      `<svg x="${c.x}" y="${c.y + 24}" width="${c.w}" height="${c.h}" `,
    )
  body += inner
}
for (const r of rows)
  body += `<text x="20" y="${r.y + 14}" font-family="monospace" font-size="13" fill="#444">${r.label}</text>`
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="white"/>${body}</svg>`
writeFileSync(`${here}/sheet-${CUT}.svg`, sheet)
writeFileSync(
  `${here}/sheet-${CUT}.png`,
  new Resvg(sheet, { fitTo: { mode: 'width', value: W * 2 } }).render().asPng(),
)
console.log('sheet', W, Math.round(y), 'px at 2x')
