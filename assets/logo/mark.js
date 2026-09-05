/**
 * The cocoon mark: four congruent isosceles triangles in a row, through the
 * shared engine. The two equal sides are the top and right edges, meeting at
 * the sharp top-right vertex, so the shape points up and right.
 *
 * Anything that centres or spaces the mark anchors on the front triangle, not
 * the four-triangle bounding box: the box ends at the fourth triangle's tip,
 * which is nearly invisible, so centring on it pushes the black triangle off
 * centre by however much faint ink trails behind it.
 */
import * as H from '../lib/haze.js'
import { fmt } from '../lib/fmt.js'

export const SIDE = 1000
export const APEX_DEG = 48 // 60 would be equilateral

/** The front triangle in SVG coordinates, traversed TR -> TL -> apex. */
export function triangle(e = SIDE, apexDeg = APEX_DEG) {
  const th = apexDeg * (Math.PI / 180)
  const b = 2 * e * Math.sin(th / 2)
  const x = (b * b) / (2 * e)
  const y = Math.sqrt(Math.max(b * b - x * x, 0))
  return [
    [
      [e, 0],
      [0, 0],
      [x, y],
    ],
  ]
}

/**
 * { pieces, bounds } for a cut, front-most first. `apex` is the triangle's
 * apex angle in degrees; every other option passes to the engine.
 */
export function build({
  cut = 'vapour',
  reverse = false,
  apex = APEX_DEG,
  ...opts
} = {}) {
  return H.build(triangle(SIDE, apex), { cut, reverse, ...opts })
}

/** Bounds of the front triangle alone. Its vertical extent is the whole mark's. */
export function frontBounds(opts = {}) {
  return build({ ...opts, n: 1 }).bounds
}

/**
 * Serialise with optional padding, squaring and background. `anchor` squares
 * the canvas about that point, growing the side until every piece of ink
 * still clears `pad`.
 */
export function svg(
  pieces,
  bounds,
  { pad = 0, square = false, bg = null, prec = 3, anchor = null } = {},
) {
  let [x, y, w, h] = bounds
  if (square && anchor) {
    const [ax, ay] = anchor
    const half = Math.max(ax - x, x + w - ax, ay - y, y + h - ay) + pad
    ;[x, y, w, h] = [ax - half, ay - half, 2 * half, 2 * half]
  } else {
    x -= pad
    y -= pad
    w += 2 * pad
    h += 2 * pad
    if (square) {
      const side = Math.max(w, h)
      x -= (side - w) / 2
      y -= (side - h) / 2
      w = h = side
    }
  }
  const f = (v) => fmt(v, prec)
  let body = ''
  for (const { paths, fill } of [...pieces].reverse())
    for (const { d } of paths) body += `\n  <path d="${d}" fill="${fill}"/>`
  const rect = bg
    ? `\n  <rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${bg}"/>`
    : ''
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" xmlns="http://www.w3.org/2000/svg">${rect}${body}\n</svg>\n`
  )
}

// ---- favicon ---------------------------------------------------------------
export const FAVI_SIZE = 1000
export const FAVI_RADIUS = 220
export const FAVI_MARGIN = 0.1 // least clear air between any ink and the tile edge
export const FAVI_LIGHT = '#F7F6F2' // off-white, so the tile keeps an edge on white chrome
export const FAVI_DARK = '#141414'

/**
 * The mark on a rounded tile. The front triangle is sized and centred; the
 * size is derived from the margin rule rather than picked. Throws if any ink
 * comes closer to the edge than `margin`.
 */
export function favicon(
  ground,
  {
    reverse = false,
    size = FAVI_SIZE,
    radius = FAVI_RADIUS,
    fill = null,
    margin = FAVI_MARGIN,
    prec = 3,
    ...opts
  } = {},
) {
  const { pieces, bounds: b } = build({ reverse, ...opts })
  const [ix, iy, iw, ih] = b
  const [fx, fy, fw, fh] = frontBounds({ reverse, ...opts })
  if (fill == null) {
    const cx = fx + fw / 2
    const cy = fy + fh / 2
    const reach = Math.max(cx - ix, ix + iw - cx, cy - iy, iy + ih - cy)
    const k = ((size / 2) * (1 - 2 * margin)) / reach
    fill = (k * Math.max(fw, fh)) / size
  }
  const k = (size * fill) / Math.max(fw, fh)
  const ax = fx + fw / 2
  const ay = fy + fh / 2
  const tx = size / 2 - k * ax
  const ty = size / 2 - k * ay
  const clear =
    Math.min(
      tx + k * ix,
      size - (tx + k * (ix + iw)),
      ty + k * iy,
      size - (ty + k * (iy + ih)),
    ) / size
  if (clear < margin - 1e-9)
    throw new Error(
      `favicon: ink clears only ${clear.toFixed(4)} of the tile, floor ${margin.toFixed(2)}`,
    )
  let body = ''
  for (const { paths, fill: c } of [...pieces].reverse())
    for (const { d } of paths) body += `\n    <path d="${d}" fill="${c}"/>`
  const s = fmt(size, 0)
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">\n` +
    `  <rect width="${s}" height="${s}" rx="${fmt(radius, 0)}" ry="${fmt(radius, 0)}" fill="${ground}"/>\n` +
    `  <g transform="translate(${fmt(tx, prec)} ${fmt(ty, prec)}) scale(${fmt(k, 6)})">${body}\n  </g>\n</svg>\n`
  )
}
