/**
 * The cocoon wordmark at any (wght, wdth) instance of Saira, with the infinity
 * mark that replaces the two adjacent o's.
 *
 * Everything about the mark is derived from the instanced o:
 *   sv = vertical stem     = (outer_w - counter_w) / 2
 *   sh = horizontal stroke = (outer_h - counter_h) / 2
 *   a  = centreline semi-x = (outer_w - sv) / 2
 *   b  = centreline semi-y = (outer_h - sh) / 2
 *   D  = half loop separation = D_RATIO * a
 *
 * The centreline is a lemniscate: a superellipse arc around each loop centre,
 * joined by two straight connectors crossing at the origin, stroked with an
 * elliptical pen (sv/2, sh/2) that reproduces the o exactly. The negative-
 * slope connector is cut on both sides of the positive-slope one.
 *
 * Font access is fontkit. Outline coordinates stay fractional after
 * instancing, as fontTools leaves them; only advances are rounded.
 */
import * as fontkit from 'fontkit'
import { fmt } from '../lib/fmt.js'

export const SE_N = 3.5 // superellipse exponent
export const EPS_DEG = 65 // inner wedge half-angle; the arc covers 360 - 2·eps
export const D_RATIO = 260 / 201.5 // loop centre offset as a multiple of a
export const WEAVE_GAP = 45 // clear space each side of the over-stroke
export const MARK_SB = 75 // side bearing each side of the mark
export const RF_RATIO = 0.71 // fillet radius as a multiple of a
const FLAT = 1200 // samples per loop arc

// ---- small vector helpers (numpy stand-ins) --------------------------------
const linspace = (a, b, n) => {
  const step = (b - a) / (n - 1)
  const out = Array.from({ length: n }, (_, i) => i * step + a)
  out[n - 1] = b
  return out
}
const norm = (v) => Math.sqrt(v[0] * v[0] + v[1] * v[1])
const otRound = (v) => Math.floor(v + 0.5)

// ---- font ------------------------------------------------------------------
export function instance(path, wght, wdth) {
  return fontkit.openSync(path).getVariation({ wght, wdth })
}

function quad(p0, c, p1, n) {
  return linspace(0, 1, n).map((t) => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1],
  ])
}
function cubic(p0, c1, c2, p1, n) {
  return linspace(0, 1, n).map((t) => [
    (1 - t) ** 3 * p0[0] +
      3 * (1 - t) ** 2 * t * c1[0] +
      3 * (1 - t) * t ** 2 * c2[0] +
      t ** 3 * p1[0],
    (1 - t) ** 3 * p0[1] +
      3 * (1 - t) ** 2 * t * c1[1] +
      3 * (1 - t) * t ** 2 * c2[1] +
      t ** 3 * p1[1],
  ])
}

/** Flattened contours of a glyph: [[[x, y], ...], ...]. */
export function glyphContours(font, char) {
  const glyph = font.glyphForCodePoint(char.codePointAt(0))
  const contours = []
  let cur = []
  const R = (v) => v
  for (const { command, args } of glyph.path.commands) {
    if (command === 'moveTo') {
      if (cur.length) contours.push(cur)
      cur = [[R(args[0]), R(args[1])]]
    } else if (command === 'lineTo') cur.push([R(args[0]), R(args[1])])
    else if (command === 'quadraticCurveTo') {
      const p0 = cur[cur.length - 1]
      cur.push(
        ...quad(
          p0,
          [R(args[0]), R(args[1])],
          [R(args[2]), R(args[3])],
          24,
        ).slice(1),
      )
    } else if (command === 'bezierCurveTo') {
      const p0 = cur[cur.length - 1]
      cur.push(
        ...cubic(
          p0,
          [R(args[0]), R(args[1])],
          [R(args[2]), R(args[3])],
          [R(args[4]), R(args[5])],
          24,
        ).slice(1),
      )
    } else if (command === 'closePath') {
      if (cur.length) contours.push(cur)
      cur = []
    }
  }
  if (cur.length) contours.push(cur)
  return contours
}

const extent = (pts, i) => {
  let lo = Infinity
  let hi = -Infinity
  for (const p of pts) {
    if (p[i] < lo) lo = p[i]
    if (p[i] > hi) hi = p[i]
  }
  return [lo, hi]
}

/** [a, b, sv, sh] from the instanced o. */
export function oMetrics(font) {
  const cs = glyphContours(font, 'o').sort((p, q) => {
    const [pl, ph] = extent(p, 0)
    const [ql, qh] = extent(q, 0)
    return qh - ql - (ph - pl)
  })
  const [outer, counter] = cs
  const ow = extent(outer, 0)[1] - extent(outer, 0)[0]
  const oh = extent(outer, 1)[1] - extent(outer, 1)[0]
  const cw = extent(counter, 0)[1] - extent(counter, 0)[0]
  const ch = extent(counter, 1)[1] - extent(counter, 1)[0]
  const sv = (ow - cw) / 2
  const sh = (oh - ch) / 2
  return [(ow - sv) / 2, (oh - sh) / 2, sv, sh]
}

// ---- the mark --------------------------------------------------------------
const se = (t, a, b, n) => {
  const ct = Math.cos(t)
  const st = Math.sin(t)
  return [
    a * Math.sign(ct) * Math.abs(ct) ** (2 / n),
    b * Math.sign(st) * Math.abs(st) ** (2 / n),
  ]
}

function filletArc(P, T, Rf) {
  const nrm = [-T[1], T[0]]
  const C = [P[0] + nrm[0] * Rf, P[1] + nrm[1] * Rf]
  const d = norm(C)
  const base = Math.atan2(C[1], C[0])
  const off = Math.asin(Math.min(1, Rf / d))
  let best = null
  for (const sgn of [1, -1]) {
    const ang = base + sgn * off
    const u = [Math.cos(ang), Math.sin(ang)]
    const m = Math.sqrt(Math.max(d * d - Rf * Rf, 0))
    const F = [u[0] * m, u[1] * m]
    const dist = norm([F[0] - P[0], F[1] - P[1]])
    if (!best || dist < best.dist) best = { u, F, dist }
  }
  const { u } = best
  const dot = C[0] * u[0] + C[1] * u[1]
  const foot = [u[0] * dot, u[1] * dot]
  const ph0 = Math.atan2(P[1] - C[1], P[0] - C[0])
  const ph1 = Math.atan2(foot[1] - C[1], foot[0] - C[0])
  const twoPi = 2 * Math.PI
  const dph = ((((ph1 - ph0 + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI
  const arc = linspace(ph0, ph0 + dph, 160).map((ph) => [
    C[0] + Rf * Math.cos(ph),
    C[1] + Rf * Math.sin(ph),
  ])
  return { arc, foot, u }
}

const seg = (p0, p1, n) =>
  linspace(0, 1, n).map((t) => [
    p0[0] + t * (p1[0] - p0[0]),
    p0[1] + t * (p1[1] - p0[1]),
  ])

/** Closed lemniscate centreline as { left, connPos, right, connNeg }. */
export function markCentreline(
  a,
  b,
  { n = SE_N, epsDeg = EPS_DEG, dRatio = D_RATIO, rfRatio = RF_RATIO } = {},
) {
  const D = dRatio * a
  const Rf = rfRatio * a
  const eps = epsDeg * (Math.PI / 180)
  const left = linspace(eps, 2 * Math.PI - eps, FLAT).map((t) => {
    const p = se(t, a, b, n)
    return [p[0] - D, p[1] + 0]
  })
  const right = linspace(Math.PI - eps, -Math.PI + eps, FLAT).map((t) => {
    const p = se(t, a, b, n)
    return [p[0] + D, p[1] + 0]
  })
  const P = left[left.length - 1]
  const T0 = [P[0] - left[left.length - 2][0], P[1] - left[left.length - 2][1]]
  const L = norm(T0)
  const { arc: fil, foot: F } = filletArc(P, [T0[0] / L, T0[1] / L], Rf)
  const run = seg(F, [-F[0], -F[1]], 500)
  const back = fil
    .map((p) => [-p[0], -p[1]])
    .reverse()
    .slice(1)
  const connPos = [...fil, ...run.slice(1), ...back]
  const connNeg = connPos.map((p) => [p[0], -p[1]]).reverse()
  return { left, connPos, right, connNeg }
}

/** Elliptical-pen offset polylines [left, right] for a centreline. */
function penOffsets(pts, hx, hy) {
  const n = pts.length
  const grad = (i) => {
    if (i === 0) return [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]
    if (i === n - 1)
      return [pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]]
    return [
      (pts[i + 1][0] - pts[i - 1][0]) / 2,
      (pts[i + 1][1] - pts[i - 1][1]) / 2,
    ]
  }
  const lo = []
  const ro = []
  for (let i = 0; i < n; i++) {
    const d = grad(i)
    let L = Math.sqrt(d[0] * d[0] + d[1] * d[1])
    if (L === 0) L = 1e-9
    const tx = d[0] / L
    const ty = d[1] / L
    const nx = -ty
    const ny = tx
    let denom = Math.sqrt((hx * nx) ** 2 + (hy * ny) ** 2)
    if (denom === 0) denom = 1e-9
    const off = [(hx * hx * nx) / denom, (hy * hy * ny) / denom]
    lo.push([pts[i][0] + off[0], pts[i][1] + off[1]])
    ro.push([pts[i][0] - off[0], pts[i][1] - off[1]])
  }
  return [lo, ro]
}

function trimHead(poly, s, band) {
  let k = 0
  for (let i = 0; i < s.length; i++) {
    if (Math.abs(s[i]) > band) {
      k = i
      break
    }
  }
  if (k === 0) return poly
  const target = band * Math.sign(s[k])
  const s0 = s[k - 1]
  const s1 = s[k]
  const t = s1 !== s0 ? (target - s0) / (s1 - s0) : 0
  const p = [
    poly[k - 1][0] + t * (poly[k][0] - poly[k - 1][0]),
    poly[k - 1][1] + t * (poly[k][1] - poly[k - 1][1]),
  ]
  return [p, ...poly.slice(k)]
}

/** Mark outline as one closed polygon, origin-centred, nonzero fill. */
export function buildMark(a, b, sv, sh, { gap = WEAVE_GAP, ...kw } = {}) {
  const { left, connPos, right, connNeg } = markCentreline(a, b, kw)
  const hx = sv / 2
  const hy = sh / 2
  const mid = Math.floor(connNeg.length / 2)
  const cm = Math.floor(connPos.length / 2)
  const u0 = [
    connPos[cm + 1][0] - connPos[cm - 1][0],
    connPos[cm + 1][1] - connPos[cm - 1][1],
  ]
  const uL = norm(u0)
  const u = [u0[0] / uL, u0[1] / uL]
  const nrm = [-u[1], u[0]]
  const half = Math.sqrt((hx * nrm[0]) ** 2 + (hy * nrm[1]) ** 2)
  const band = half + gap
  const centre = [
    ...connNeg.slice(mid),
    ...left,
    ...connPos.slice(1, -1),
    ...right,
    ...connNeg.slice(0, mid),
  ]
  const [lo, ro] = penOffsets(centre, hx, hy)
  const sd = (P) => P.map((p) => nrm[0] * p[0] + nrm[1] * p[1])
  const pieces = []
  for (const offc of [lo, ro]) {
    const o2 = trimHead(offc, sd(offc), band)
    const rev = [...o2].reverse()
    const o3 = trimHead(rev, sd(rev), band)
    pieces.push([...o3].reverse())
  }
  return { outline: [...pieces[0], ...[...pieces[1]].reverse()], centre }
}

/** Ramer-Douglas-Peucker simplification. */
export function rdp(pts, tol = 0.05) {
  const n = pts.length
  if (n < 3) return pts
  const keep = new Array(n).fill(false)
  keep[0] = keep[n - 1] = true
  const stack = [[0, n - 1]]
  while (stack.length) {
    const [i, j] = stack.pop()
    if (j <= i + 1) continue
    const p = pts[i]
    const q = pts[j]
    const seg_ = [q[0] - p[0], q[1] - p[1]]
    const L = Math.sqrt(seg_[0] * seg_[0] + seg_[1] * seg_[1])
    let k = -1
    let best = -1
    for (let m = i + 1; m < j; m++) {
      const v = [pts[m][0] - p[0], pts[m][1] - p[1]]
      const d =
        L < 1e-12
          ? Math.sqrt(v[0] * v[0] + v[1] * v[1])
          : Math.abs(seg_[0] * v[1] - seg_[1] * v[0]) / L
      if (d > best) {
        best = d
        k = m
      }
    }
    if (best > tol) {
      keep[k] = true
      stack.push([i, k])
      stack.push([k, j])
    }
  }
  return pts.filter((_, i) => keep[i])
}

// ---- composition -----------------------------------------------------------
/** { pieces, meta }: pieces is a list of glyphs, each a list of contours. */
export function buildWordmark(fontPath, wght, wdth, markKw = {}) {
  const font = instance(fontPath, wght, wdth)
  const [a, b, sv, sh] = oMetrics(font)
  const oOuter = glyphContours(font, 'o').reduce((p, q) =>
    extent(q, 0)[1] - extent(q, 0)[0] > extent(p, 0)[1] - extent(p, 0)[0]
      ? q
      : p,
  )
  const [ylo, yhi] = extent(oOuter, 1)
  const yMid = (yhi + ylo) / 2
  const { outline } = buildMark(a, b, sv, sh, markKw)
  const mark = outline.map((p) => [p[0] + 0, p[1] + yMid])
  const [mx0, mx1] = extent(mark, 0)
  const markW = mx1 - mx0
  const markAdv = markW + 2 * MARK_SB
  const pieces = []
  let x = 0
  for (const item of ['c', 'o', 'c', 'MARK', 'n']) {
    if (item === 'MARK') {
      pieces.push([mark.map((p) => [p[0] + x + MARK_SB - mx0, p[1]])])
      x += markAdv
    } else {
      pieces.push(
        glyphContours(font, item).map((c) =>
          c.map((p) => [p[0] + x, p[1] + 0]),
        ),
      )
      x += otRound(font.glyphForCodePoint(item.codePointAt(0)).advanceWidth)
    }
  }
  return { pieces, meta: { a, b, sv, sh, adv: x, markW, wght, wdth } }
}

export function toSvgPath(pieces, tol = 0.05, prec = 1) {
  const out = []
  for (const contours of pieces)
    for (const c of contours)
      out.push(
        `M ${rdp(c, tol)
          .map((p) => `${fmt(p[0], prec)} ${fmt(-p[1], prec)}`)
          .join(' L ')} Z`,
      )
  return out.join(' ')
}

/** SVG bounds of the pieces: [x, y, w, h], y flipped. */
export function pieceBounds(pieces) {
  const all = pieces.flat(2)
  const [x0, x1] = extent(all, 0)
  const [y0, y1] = extent(all, 1)
  return [x0, -y1, x1 - x0, y1 - y0]
}

export function svg(
  pieces,
  { colour = '#141414', pad = 0, tol = 0.05, prec = 1 } = {},
) {
  const [x, y, w, h] = pieceBounds(pieces)
  const f = (v) => fmt(v, 2)
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg viewBox="${f(x - pad)} ${f(y - pad)} ${f(w + 2 * pad)} ${f(h + 2 * pad)}" xmlns="http://www.w3.org/2000/svg">\n` +
    `  <path d="${toSvgPath(pieces, tol, prec)}" fill="${colour}" fill-rule="nonzero"/>\n</svg>\n`
  )
}
