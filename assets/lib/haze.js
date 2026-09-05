/**
 * The cocoon four-plane engine, for any flat shape.
 *
 * The mark is four congruent shapes standing in a row in 3D, seen through a
 * shift camera whose image plane is parallel to them. That collapses to one
 * rule: with the camera's principal point at the origin, plane k is the front
 * shape scaled about the origin by S_k = D / (D + k·d), and nothing else. The
 * front shape's area centroid sits at (-cameraX · W, 0), so all four centroids
 * share one level line and the recession is purely horizontal. Fillets scale
 * with the shape. Tone is aerial perspective mixed in linear light.
 *
 * The scene constants come from src/utils/hazePlanes.js, the same module the
 * HazePlanes component reads, so the logo, the icons and the live effect
 * cannot drift apart.
 *
 * Shapes are drawn in SVG coordinates (y down) on a nominal 1000 grid. A shape
 * is a list of elements: a polygon (an array of [x, y]) or a circle
 * ({ C: [cx, cy, r] }), either wrapped in hole(...) to subtract. Fill rule is
 * evenodd within a fill group, so a hole only has to overlap.
 */
import {
  HAZE_CUTS,
  HAZE_DEFAULTS,
  hazeTones,
} from '../../src/utils/hazePlanes.js'
import { fmt } from './fmt.js'

// ---- scene -----------------------------------------------------------------
export const SIDE = 1000 // design box width; scene distances are in it
export const CAM_DIST = HAZE_DEFAULTS.distance * SIDE
export const SPACING = HAZE_DEFAULTS.spacing * SIDE
export const CAM_OFF = HAZE_DEFAULTS.cameraX // in shape widths
export const N = HAZE_DEFAULTS.planes
export const CORNER_R = 0.02 // front fillet radius, fraction of the box

export const INK = '#141414'
/** Haze colour per cut. The transmittance totals live in HAZE_CUTS. */
export const CUT_GROUND = { vapour: '#FFFFFF', dense: '#E8E8E8' }

const hypot = (dx, dy) => Math.sqrt(dx * dx + dy * dy)

/** Projected scale of each plane: exactly 1 : 6/7 : 3/4 : 2/3 at the house scene. */
export function scales(n = N, dist = CAM_DIST, spacing = SPACING) {
  const out = []
  for (let k = 0; k < n; k++) out.push(dist / (dist + k * spacing))
  return out
}

/** Tone of plane k for a cut, hex. Reversed swaps surface and haze. */
export function tone(k, cut = 'vapour', reverse = false, n = N) {
  if (!(cut in HAZE_CUTS)) throw new Error(`haze: unknown cut "${cut}"`)
  const ground = CUT_GROUND[cut]
  return hazeTones({
    planes: n,
    haze: HAZE_CUTS[cut],
    surface: reverse ? ground : INK,
    ground: reverse ? INK : ground,
  })[k]
}

// ---- shape elements --------------------------------------------------------
export const circle = (cx, cy, r) => ({ C: [cx, cy, r] })
export const hole = (el) => ({ hole: el })

/** Canonicalise to [{ kind, v, hole }]: v is [[x, y], ...] or [cx, cy, r]. */
export function norm(elems) {
  return elems.map((e) => {
    if (e && e.kind) return e
    let isHole = false
    if (e && e.hole) {
      isHole = true
      e = e.hole
    }
    if (e && e.C) return { kind: 'C', v: e.C.map(Number), hole: isHole }
    return {
      kind: 'P',
      v: e.map(([x, y]) => [Number(x), Number(y)]),
      hole: isHole,
    }
  })
}

function map(elems, fn) {
  return elems.map(({ kind, v, hole }) => {
    if (kind === 'C') {
      const [cx, cy, r] = v
      const [nx, ny] = fn([cx, cy])
      const [sx, sy] = fn([cx + r, cy])
      return { kind, v: [nx, ny, hypot(sx - nx, sy - ny)], hole }
    }
    return { kind, v: v.map(fn), hole }
  })
}

function unit(a, b) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const L = hypot(dx, dy)
  return [dx / L, dy / L]
}

function polyAreaCentroid(poly) {
  let A = 0
  let ax = 0
  let ay = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    const cr = x0 * y1 - x1 * y0
    A += cr
    ax += (x0 + x1) * cr
    ay += (y0 + y1) * cr
  }
  A /= 2
  if (Math.abs(A) < 1e-12) return [0, 0, 0]
  return [Math.abs(A), ax / (6 * A), ay / (6 * A)]
}

/** Area centroid of the whole shape, holes subtracting. */
export function centroid(elems) {
  let W = 0
  let wx = 0
  let wy = 0
  for (const { kind, v, hole: isHole } of norm(elems)) {
    let A, gx, gy
    if (kind === 'C') {
      const [cx, cy, r] = v
      A = Math.PI * r * r
      gx = cx
      gy = cy
    } else [A, gx, gy] = polyAreaCentroid(v)
    const s = isHole ? -1 : 1
    W += s * A
    wx += s * A * gx
    wy += s * A * gy
  }
  return [wx / W, wy / W]
}

/** Bounds of the sharp geometry: [x, y, w, h]. */
export function bounds(elems) {
  const xs = []
  const ys = []
  for (const { kind, v } of norm(elems)) {
    if (kind === 'C') {
      const [cx, cy, r] = v
      xs.push(cx - r, cx + r)
      ys.push(cy - r, cy + r)
    } else {
      for (const [x, y] of v) {
        xs.push(x)
        ys.push(y)
      }
    }
  }
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y]
}

/**
 * SVG subpath for a closed polygon with every corner filleted at radius r,
 * tangent to both edges and bulging out toward the vertex it replaces. Convex
 * and reflex corners alike: t = r / tan(θ/2) from the angle between the edge
 * rays, and the sweep follows the turn direction. Where two corners would
 * overrun a short edge, both tangent distances are scaled back until they fit.
 */
export function fillet(poly, r, prec = 3) {
  poly = poly.filter((p, i) => {
    const q = poly[(i - 1 + poly.length) % poly.length]
    return hypot(p[0] - q[0], p[1] - q[1]) > 1e-9
  })
  const n = poly.length
  if (n < 3) throw new Error('fillet: polygon has fewer than 3 distinct points')
  const halves = []
  const ts = []
  for (let i = 0; i < n; i++) {
    const V = poly[i]
    const A = poly[(i - 1 + n) % n]
    const B = poly[(i + 1) % n]
    const u = unit(A, V)
    const w = unit(B, V)
    const c = Math.max(-1, Math.min(1, u[0] * w[0] + u[1] * w[1]))
    const half = Math.acos(c) / 2
    halves.push(half)
    ts.push(half > 1e-12 ? r / Math.tan(half) : 0)
  }
  for (let iter = 0; iter < 16; iter++) {
    let clean = true
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const L = hypot(poly[i][0] - poly[j][0], poly[i][1] - poly[j][1])
      if (ts[i] + ts[j] > L) {
        const f = L / (ts[i] + ts[j])
        ts[i] *= f
        ts[j] *= f
        clean = false
      }
    }
    if (clean) break
  }
  const d = []
  for (let i = 0; i < n; i++) {
    const V = poly[i]
    const A = poly[(i - 1 + n) % n]
    const B = poly[(i + 1) % n]
    const u = unit(A, V)
    const w = unit(B, V)
    const t = ts[i]
    const rr = t * Math.tan(halves[i])
    const P = [V[0] + u[0] * t, V[1] + u[1] * t]
    const Q = [V[0] + w[0] * t, V[1] + w[1] * t]
    const z = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0])
    const sweep = z > 0 ? 1 : 0
    d.push(`${i === 0 ? 'M ' : 'L '}${fmt(P[0], prec)} ${fmt(P[1], prec)}`)
    d.push(
      `A ${fmt(rr, prec)} ${fmt(rr, prec)} 0 0 ${sweep} ${fmt(Q[0], prec)} ${fmt(Q[1], prec)}`,
    )
  }
  d.push('Z')
  return d.join(' ')
}

/** A full circle as two half-arcs. */
export function circlePath(cx, cy, r, prec = 3) {
  const f = (v) => fmt(v, prec)
  return (
    `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} ` +
    `A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`
  )
}

/**
 * Normalise a front shape to the design box and project it into n planes.
 *
 * `off` is the camera's offset in the shape's own projected widths, so every
 * icon spreads the same fraction of itself; a value above 10 is taken as
 * absolute design units. `mirror` puts the camera the same distance to the
 * left, so the planes recede leftward. `fit` picks which dimension is held at
 * `box`: 'max' (default), 'width' or 'height'.
 *
 * Returns [{ elems, scale }, ...], front-most first.
 */
export function place(
  shape,
  {
    box = SIDE,
    off = CAM_OFF,
    n = N,
    dist = CAM_DIST,
    spacing = SPACING,
    fit = 'max',
    mirror = false,
  } = {},
) {
  let elems = norm(shape)
  const [, , w, h] = bounds(elems)
  const ref = { max: Math.max(w, h), width: w, height: h }[fit]
  const k = box / ref
  elems = map(elems, (p) => [p[0] * k, p[1] * k])
  const [, , wn] = bounds(elems)
  const offset = off > 10 ? off : off * wn
  const [gx, gy] = centroid(elems)
  const x0 = mirror ? offset : -offset
  elems = map(elems, (p) => [p[0] - gx + x0, p[1] - gy])
  return scales(n, dist, spacing).map((S) => ({
    elems: map(elems, (p) => [p[0] * S, p[1] * S]),
    scale: S,
  }))
}

/** Split elements into fill groups: a non-hole opens a group, a hole joins the last. */
export function group(elems) {
  const groups = []
  for (const el of elems) {
    if (el.hole && groups.length) groups[groups.length - 1].push(el)
    else groups.push([el])
  }
  return groups
}

function drawGroups(elems, r, prec) {
  return group(elems).map((g) => ({
    d: g
      .map(({ kind, v }) =>
        kind === 'C' ? circlePath(v[0], v[1], v[2], prec) : fillet(v, r, prec),
      )
      .join(' '),
    evenodd: g.some((el) => el.hole),
  }))
}

/**
 * The haze render: [{ paths, fill }, ...] front-most first, plus the bounds of
 * the sharp geometry across all planes. `paths` is [{ d, evenodd }].
 */
export function build(
  shape,
  {
    cut = 'vapour',
    reverse = false,
    box = SIDE,
    corner = CORNER_R,
    n = N,
    prec = 3,
    ...place_
  } = {},
) {
  const planes = place(shape, { box, n, ...place_ })
  const pieces = []
  const all = []
  planes.forEach(({ elems, scale }, k) => {
    pieces.push({
      paths: drawGroups(elems, corner * box * scale, prec),
      fill: tone(k, cut, reverse, n),
    })
    all.push(...elems)
  })
  return { pieces, bounds: bounds(all) }
}

/** Serialise pieces (front-most first) into one SVG, painted back to front. */
export function svg(pieces, [x, y, w, h], prec = 3) {
  let body = ''
  for (const { paths, fill } of [...pieces].reverse())
    for (const { d, evenodd } of paths)
      body += `\n  <path d="${d}" fill="${fill}"${evenodd ? ' fill-rule="evenodd"' : ''}/>`
  const f = (v) => fmt(v, prec)
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg viewBox="${f(x)} ${f(y)} ${f(w)} ${f(h)}" xmlns="http://www.w3.org/2000/svg">${body}\n</svg>\n`
  )
}

// ---- measuring what is actually drawn --------------------------------------
const pmod = (a, m) => ((a % m) + m) % m

/**
 * Axis extremes of a circular arc, endpoints included. A fillet rounds the
 * corner inward, so bounds read off the polygon overstate the artwork by up
 * to r; this measures the ink that gets painted.
 */
function arcExtremes(p0, p1, r, large, sweep) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const dx2 = (x0 - x1) / 2
  const dy2 = (y0 - y1) / 2
  const q = dx2 * dx2 + dy2 * dy2
  if (q < 1e-18) return [p0, p1]
  r = Math.max(r, Math.sqrt(q))
  let k = Math.sqrt(Math.max(r * r - q, 0) / q)
  if (large === sweep) k = -k
  const cx = k * dy2 + (x0 + x1) / 2
  const cy = -k * dx2 + (y0 + y1) / 2
  const a0 = Math.atan2(y0 - cy, x0 - cx)
  const a1 = Math.atan2(y1 - cy, x1 - cx)
  let da = a1 - a0
  if (sweep && da < 0) da += 2 * Math.PI
  if (!sweep && da > 0) da -= 2 * Math.PI
  const pts = [p0, p1]
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    let t = pmod(a - a0, 2 * Math.PI)
    if (!sweep) t -= 2 * Math.PI
    const inside = sweep ? 0 <= t && t <= da : da <= t && t <= 0
    if (inside) pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return pts
}

/** Bounds of one path string over the subset this module emits: M/L, A (rx == ry, no rotation), Z. */
export function pathBounds(d) {
  const tok = d.replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  const pts = []
  let cur = null
  let i = 0
  while (i < tok.length) {
    const c = tok[i]
    if (c === 'M' || c === 'L') {
      cur = [Number(tok[i + 1]), Number(tok[i + 2])]
      pts.push(cur)
      i += 3
    } else if (c === 'A') {
      const r = Number(tok[i + 1])
      const large = Math.trunc(Number(tok[i + 4]))
      const sweep = Math.trunc(Number(tok[i + 5]))
      const nxt = [Number(tok[i + 6]), Number(tok[i + 7])]
      pts.push(...arcExtremes(cur, nxt, r, large, sweep))
      cur = nxt
      i += 8
    } else if (c === 'Z') i += 1
    else throw new Error(`unhandled path command ${c} in ${d.slice(0, 60)}`)
  }
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y]
}

/** Bounds over [{ d }] paths. */
export function pathsBounds(paths) {
  const bs = paths.map(({ d }) => pathBounds(d))
  const x = Math.min(...bs.map((b) => b[0]))
  const y = Math.min(...bs.map((b) => b[1]))
  return [
    x,
    y,
    Math.max(...bs.map((b) => b[0] + b[2])) - x,
    Math.max(...bs.map((b) => b[1] + b[3])) - y,
  ]
}

// ---- what ships ------------------------------------------------------------
/** Inherits the CSS `color` of the container. The house black is set by the consumer. */
export const FILL = 'currentColor'

/**
 * The front plane alone: { pieces, viewBox, ink }, ready for svg().
 *
 * `ink` is the drawn outline's bounding box measured after translation, in
 * the viewBox's coordinates, so a centring check can catch a wrong
 * translation. `origin: 'bbox'` puts the viewBox at 0 0; `origin: 'scene'`
 * keeps scene coordinates, which is what lets the build compare this against
 * plane 0 of build() character for character.
 */
export function front(
  shape,
  {
    square = false,
    box = SIDE,
    corner = CORNER_R,
    prec = 3,
    fill = FILL,
    origin = 'bbox',
    ...place_
  } = {},
) {
  let elems = place(shape, { box, n: 1, ...place_ })[0].elems
  const r = corner * box
  const [bx, by, w, h] = pathsBounds(drawGroups(elems, r, 12))
  let vb
  if (origin === 'scene') vb = [bx, by, w, h]
  else {
    const t = Math.max(w, h)
    const [dx, dy] = square
      ? [-bx + (t - w) / 2, -by + (t - h) / 2]
      : [-bx, -by]
    elems = map(elems, (p) => [p[0] + dx, p[1] + dy])
    vb = square ? [0, 0, t, t] : [0, 0, w, h]
  }
  const paths = drawGroups(elems, r, prec)
  return { pieces: [{ paths, fill }], viewBox: vb, ink: pathsBounds(paths) }
}

/** The two shipped files for one icon: [{ name, text }]. */
export function emit(name, shape, opts = {}) {
  return [
    ['', false],
    ['-square', true],
  ].map(([suffix, square]) => {
    const { pieces, viewBox } = front(shape, { ...opts, square })
    return { name: `${name}${suffix}.svg`, text: svg(pieces, viewBox) }
  })
}
