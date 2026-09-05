/**
 * Front shapes for the cocoon icon set.
 *
 * Each function returns a shape: a list of elements in SVG coordinates (y
 * down) on a nominal 1000 grid. An element is a polygon (an array of [x, y]),
 * a circle (circle(cx, cy, r)), or either wrapped in hole(...). Only ratios
 * matter; the engine normalises the longer dimension to the design box.
 *
 * BAR is the stroke thickness every stroke-built icon shares. Every dimension
 * derived from it is expressed as a multiple, so re-cutting the set at another
 * weight means changing BAR alone. The build checks that claim.
 */
import { circle, hole } from '../lib/haze.js'

export const BAR = 0.15 * 1000
export const BOX = 1000

const RAD = Math.PI / 180

// ---- primitives ------------------------------------------------------------
function rot(pts, deg, ox = 0, oy = 0) {
  const a = deg * RAD
  const c = Math.cos(a)
  const s = Math.sin(a)
  return pts.map(([x, y]) => [
    (x - ox) * c - (y - oy) * s + ox,
    (x - ox) * s + (y - oy) * c + oy,
  ])
}

/** Reflect left-right. Polygons are reversed so every fillet's sweep flips too. */
function mirrorX(shape, axis = BOX / 2) {
  return shape.map((e) => {
    if (e && e.C) return circle(2 * axis - e.C[0], e.C[1], e.C[2])
    return [...e].reverse().map(([x, y]) => [2 * axis - x, y])
  })
}

export const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

/** A solid arrow: shaft of thickness `bar` from `tail`, opening into a head ending at `tip`. */
export function arrow(
  tip,
  tail,
  bar = BAR,
  headW = bar * 3.2,
  headLen = bar * 2,
) {
  const [tx, ty] = tip
  const [sx, sy] = tail
  const L = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2)
  const d = [(tx - sx) / L, (ty - sy) / L]
  const p = [-d[1], d[0]]
  const base = [tx - d[0] * headLen, ty - d[1] * headLen]
  const off = (o, across) => [o[0] + p[0] * across, o[1] + p[1] * across]
  const hb = bar / 2
  const hh = headW / 2
  return [
    off(tail, hb),
    off(base, hb),
    off(base, hh),
    tip,
    off(base, -hh),
    off(base, -hb),
    off(tail, -hb),
  ]
}

/** A stack of n horizontal bars, top-aligned at y = 0. */
export function bars(
  n,
  length,
  bar = BAR,
  gap = bar * 1.35,
  x0 = 0,
  indents = null,
  lengths = null,
) {
  const out = []
  for (let i = 0; i < n; i++) {
    const y = i * (bar + gap)
    const a = x0 + (indents ? indents[i] : 0)
    const w = lengths ? lengths[i] : length
    out.push(rect(a, y, a + w, y + bar))
  }
  return out
}

/** Points along an ellipse arc, degrees, for curves the fillet cannot make. */
function arc(cx, cy, rx, ry, a0, a1, n = 24) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const t = (a0 + ((a1 - a0) * i) / n) * RAD
    out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)])
  }
  return out
}

// ---- the set ---------------------------------------------------------------
/** exit / close. A plus turned 45 degrees, arms corner to corner. */
export function cross(bar = BAR) {
  const h = bar / 2
  const a = BOX / Math.SQRT2 - bar / 2
  const plus = [
    [a, -h],
    [a, h],
    [h, h],
    [h, a],
    [-h, a],
    [-h, h],
    [-a, h],
    [-a, -h],
    [-h, -h],
    [-h, -a],
    [h, -a],
    [h, -h],
  ]
  return [rot(plus, 45)]
}

export function arrowRight(bar = BAR) {
  return [arrow([BOX, BOX / 2], [0, BOX / 2], bar)]
}

export function arrowLeft(bar = BAR) {
  return mirrorX(arrowRight(bar))
}

export function arrowUp(bar = BAR) {
  return [rot(arrowRight(bar)[0], -90, BOX / 2, BOX / 2)]
}

/** An up arrow under a rule as wide as the arrowhead, so the pair recedes as one object. */
export function scrollTop(bar = BAR) {
  const headW = bar * 4
  const headLen = bar * 2.6
  const gap = bar * 0.6
  const tip = bar + gap
  return [
    rect((BOX - headW) / 2, 0, (BOX + headW) / 2, bar),
    arrow([BOX / 2, tip], [BOX / 2, BOX], bar, headW, headLen),
  ]
}

export function menu(bar = BAR) {
  return bars(3, BOX, bar)
}

/** Marker plus rule, three rows; the markers keep it from reading as menu. */
export function toc(bar = BAR) {
  const m = bar * 1.15
  const lead = m + bar * 1.15
  const out = []
  for (const row of bars(3, BOX - lead, bar, bar * 1.6, lead)) {
    const y = row[0][1]
    out.push(rect(0, y - (m - bar) / 2, m, y + bar + (m - bar) / 2))
    out.push(row)
  }
  return out
}

/**
 * A gear. Teeth are straight-sided and the valleys stepped along the root
 * circle, so every corner is one the fillet can take. Tooth depth 0.8 BAR and
 * rim 4/3 BAR reproduce the drawn proportions at the shipped weight; they are
 * preserved ratios, so look at the gear if the set is ever re-cut.
 */
export function settings(bar = BAR, teeth = 8) {
  const R = BOX / 2
  const Rr = R - 0.8 * bar
  const rim = Rr - (4 / 3) * bar
  const step = 360 / teeth
  const tipHalf = step * 0.178
  const rootHalf = step * 0.311
  const pts = []
  for (let i = 0; i < teeth; i++) {
    const c = i * step
    for (const [a, r] of [
      [c - rootHalf, Rr],
      [c - tipHalf, R],
      [c + tipHalf, R],
      [c + rootHalf, Rr],
    ]) {
      const t = a * RAD
      pts.push([BOX / 2 + r * Math.cos(t), BOX / 2 + r * Math.sin(t)])
    }
    const v0 = c + rootHalf
    const v1 = c + step - rootHalf
    for (const j of [1, 2]) {
      const t = (v0 + ((v1 - v0) * j) / 3) * RAD
      pts.push([BOX / 2 + Rr * Math.cos(t), BOX / 2 + Rr * Math.sin(t)])
    }
  }
  return [pts, hole(circle(BOX / 2, BOX / 2, rim))]
}

/** A filled disc with the i knocked out, so the plane behind shows through. */
export function info(bar = BAR) {
  const R = BOX / 2
  const w = bar * 0.92
  const dotR = (w / 2) * 1.06
  return [
    circle(R, R, R),
    hole(circle(R, R - R * 0.46, dotR)),
    hole(rect(R - w / 2, R - R * 0.2, R + w / 2, R + R * 0.6)),
  ]
}

/** The conventional external-link frame. Not in SET: a hollow shape fills with its own echoes. */
export function launchFrame(bar = BAR) {
  const t = bar
  const [x0, y0, x1, y1] = [0, BOX * 0.24, BOX * 0.76, BOX]
  const cutX = x1 - t
  const cutY = y0 + t
  const frame = [
    [x0, y0],
    [cutX - t * 1.05, y0],
    [cutX - t * 1.05, y0 + t],
    [x0 + t, y0 + t],
    [x0 + t, y1 - t],
    [x1 - t, y1 - t],
    [x1 - t, cutY + t * 1.05],
    [x1, cutY + t * 1.05],
    [x1, y1],
    [x0, y1],
  ]
  return [
    frame,
    arrow([BOX, 0], [BOX * 0.6, BOX * 0.4], bar, bar * 3, bar * 2.1),
  ]
}

/** A filled panel with the arrow unioned into its corner, leaving up and right. */
export function launchSolid(bar = BAR) {
  const x1 = BOX * 0.74
  const y0 = BOX * 0.26
  return [
    rect(0, y0, x1, BOX),
    arrow([BOX, 0], [x1 - bar * 1.1, y0 + bar * 1.1], bar, bar * 3, bar * 2.1),
  ]
}

/** A solid house with the doorway knocked out; the roof overhangs by one stroke each side. */
export function home(bar = BAR) {
  const eave = BOX * 0.43
  const wall = bar
  const doorW = BOX * 0.23
  const doorH = BOX * 0.4
  const body = [
    [BOX / 2, 0],
    [BOX, eave],
    [BOX - wall, eave],
    [BOX - wall, BOX],
    [wall, BOX],
    [wall, eave],
    [0, eave],
  ]
  return [
    body,
    hole(rect((BOX - doorW) / 2, BOX - doorH, (BOX + doorW) / 2, BOX)),
  ]
}

/** Lens ring plus handle in two fill groups. Walls at 1.55 strokes keep the aperture under the ceiling. */
export function search(bar = BAR, wall = bar * 1.55) {
  const R = BOX * 0.38
  const cx = R
  const cy = R
  const d = Math.sqrt(0.5)
  const x0 = cx + R * d * 0.55
  const y0 = cy + R * d * 0.55
  const x1 = BOX - bar * 0.3
  const y1 = BOX - bar * 0.3
  const h = bar / 2
  return [
    circle(cx, cy, R),
    hole(circle(cx, cy, R - wall)),
    [
      [x0 - h * d, y0 + h * d],
      [x1 - h * d, y1 + h * d],
      [x1 + h * d, y1 - h * d],
      [x0 + h * d, y0 - h * d],
    ],
  ]
}

/** Head and shoulders, both solid. The bust is a drawn half-ellipse. */
export function account(bar = BAR) {
  const headR = BOX * 0.205
  const headCy = headR + BOX * 0.03
  const gap = bar * 0.62
  const top = headCy + headR + gap
  return [
    circle(BOX / 2, headCy, headR),
    arc(BOX / 2, BOX, BOX * 0.43, BOX - top, 180, 360),
  ]
}

/**
 * name -> [shape function, engine options]. `mirror` moves the camera to the
 * other side of the row; it leaves plane 0 congruent, which is why there is no
 * separate camera-right arrow-left: front-face only, it was the same file.
 */
export const SET = {
  'arrow-left': [arrowLeft, { mirror: true }],
  'arrow-right': [arrowRight, {}],
  'arrow-up': [arrowUp, {}],
  'scroll-top': [scrollTop, {}],
  menu: [menu, {}],
  toc: [toc, {}],
  settings: [settings, {}],
  info: [info, {}],
  exit: [cross, {}],
  launch: [launchSolid, {}],
  home: [home, {}],
  search: [search, {}],
  account: [account, {}],
}

/** Role and note per icon, for the contact sheet. */
export const NOTES = {
  'arrow-left': [
    'prev',
    'Mirrored camera - the planes recede leftward, so it reads as the exact counterpart of arrow-right.',
  ],
  'arrow-right': [
    'next',
    'The best case the system has: the rear heads trail off as a chevron echo.',
  ],
  'arrow-up': [
    'scroll up',
    'One of two narrow shapes, and the reason the camera offset is measured in shape widths rather than design units.',
  ],
  'scroll-top': [
    'scroll to 0',
    'The rule is exactly as wide as the arrowhead and sits within 0.6 stroke of it, so the pair recedes as one object rather than two.',
  ],
  menu: ['menu', 'Three rules, full width, equal length.'],
  toc: [
    'table of contents',
    'The markers are what keep it from reading as menu at small sizes.',
  ],
  settings: [
    'settings',
    'Teeth are straight-sided and the valleys stepped along the root circle, so every corner is a real corner the fillet can take.',
  ],
  info: [
    'info',
    'A filled disc with the i knocked out. The counter shows the plane behind - an outline ring would not.',
  ],
  exit: [
    'exit, close',
    'A plus turned 45 degrees, arms running corner to corner.',
  ],
  home: [
    'home',
    'A solid house with the doorway knocked out - the same remove-material-from-a-mass move as info. The roof overhangs the walls by one stroke each side, which is what stops it reading as a plain pentagon.',
  ],
  search: [
    'search',
    "The one hollow shape in the set, and it works only because the walls are heavy - at 1.55 stroke the aperture is small enough that the front plane's own step covers most of it. A solid disc was tried and rejected: it reads as a pin at 16 px and collides with info, which is also a black disc.",
  ],
  account: [
    'account',
    'Head and shoulders, both solid - no holes at all, which makes it the cleanest shape in the set for this system. The bust is a drawn half-ellipse; the fixed 0.02 fillet is far too tight for a shoulder.',
  ],
  launch: [
    'launch, open',
    'A filled panel with the arrow unioned into its corner, leaving up and to the right - the direction the logo points. The conventional hollow frame is the one shape this system fights: the planes behind land inside its own opening.',
  ],
}
