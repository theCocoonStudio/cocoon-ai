/**
 * The cocoon plane recession as a scene, and the CSS that expresses it.
 *
 * A row of copies of an element stands behind it, each a fixed step smaller
 * and a fixed step further along one direction, seen through haze. There is
 * no camera: the picture is orthographic, so the shrinking is in the world
 * and the steps are where the parameters put them. Four numbers and a count
 * reach every output, and none of them is redundant:
 *
 *   planes       how many copies, the element's own face included
 *   depth        the last plane's size as a fraction of the face
 *   radius       the last plane's centre from the face's centre, in widths
 *   angle        which way, degrees: 0 right, 90 down, as CSS rotates
 *   perspective  how the middle planes are spaced between face and last:
 *                0 is equal steps; larger foreshortens, the near steps long
 *                and the far ones short, along the hyperbola a camera would
 *                give. One number, the same easing every time
 *
 *     f(k)   = (1 - 1/(1 + k·p)) / (1 - 1/(1 + (n-1)·p))    p = 0: k/(n-1)
 *     S_k    = 1 - (1 - depth) · f(k)                        size of plane k
 *     d_k    = radius · f(k) · width                         its displacement
 *     spread = -(1 - S_k) · width / 2                        as a box-shadow
 *     L_k    = L_surface · T^k + L_ground · (1 - T^k)        mixed in linear light
 *     T      = haze^(1 / (planes - 1))
 *
 * Widths are element widths, so a scene survives any resize.
 *
 * The same scene cuts the logo and the icon set; the generators under assets/
 * read their constants from here so the three cannot drift.
 */

/** House scene and subject defaults. */
export const HAZE_DEFAULTS = Object.freeze({
  planes: 4,
  depth: 2 / 3,
  radius: 1.9 / 3, // the 1.90 camera offset of the old model, chosen on the spread sheets
  angle: 0,
  perspective: 1 / 6,
  haze: 0.1,
  width: 48,
  height: null,
  cornerRadius: 0,
  surface: '#141414',
  ground: '#FFFFFF',
  technique: 'auto',
  tolerance: 1,
  selector: '.haze',
  responsive: false,
  precision: 4,
  comment: true,
})

/** Named haze totals: the fraction of surface radiance surviving the whole row. */
export const HAZE_CUTS = Object.freeze({
  vapour: 0.1, // 0.275² until 2026-09-06; see the logo spec's tone table
  dense: 0.15 ** 2,
})

// ---- colour ----------------------------------------------------------------

function parseHex(s) {
  let h = String(s).trim().replace(/^#/, '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (!/^[0-9a-fA-F]{6}$/.test(h))
    throw new Error(`hazePlanes: bad colour "${s}"`)
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function toHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0')
          .toUpperCase(),
      )
      .join('')
  )
}

function srgbToLinear(c) {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(v) {
  v = Math.max(0, Math.min(1, v))
  return Math.round(
    255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055),
  )
}

// ---- options ---------------------------------------------------------------

/**
 * Fill in defaults and validate. `cut` sets `haze` by name.
 * @param {object} [opts]
 * @returns {object} a complete option set
 */
export function hazeResolve(opts) {
  const o = { ...HAZE_DEFAULTS, ...opts }
  if (typeof o.cut === 'string') {
    if (!(o.cut in HAZE_CUTS))
      throw new Error(`hazePlanes: unknown cut "${o.cut}"`)
    o.haze = HAZE_CUTS[o.cut]
  }
  if (o.height == null) o.height = o.width
  if (!(o.width > 0)) throw new Error('hazePlanes: width must be > 0')
  if (!(o.planes >= 2)) throw new Error('hazePlanes: planes must be >= 2')
  if (!(o.depth > 0 && o.depth <= 1))
    throw new Error('hazePlanes: depth must be in (0, 1]')
  if (!(o.radius >= 0)) throw new Error('hazePlanes: radius must be >= 0')
  if (!Number.isFinite(o.angle))
    throw new Error('hazePlanes: angle must be a number')
  if (!(o.perspective >= 0))
    throw new Error('hazePlanes: perspective must be >= 0')
  if (!(o.haze > 0 && o.haze < 1))
    throw new Error('hazePlanes: haze must be in (0, 1)')
  if (!(o.cornerRadius >= 0))
    throw new Error('hazePlanes: cornerRadius must be >= 0')
  return o
}

// ---- scene -----------------------------------------------------------------

/**
 * Where plane k sits between the face (0) and the last plane (1). Equal steps
 * at perspective 0; the hyperbola 1 - 1/(1 + k·p), normalised, otherwise.
 * @param {number} k plane index, 0 .. planes - 1
 * @param {number} planes
 * @param {number} perspective
 * @returns {number} 0 at k = 0, 1 at k = planes - 1
 */
export function hazeProfile(k, planes, perspective) {
  const n = planes - 1
  if (n <= 0) return 0
  if (!(perspective > 0)) return k / n
  const h = (i) => 1 - 1 / (1 + i * perspective)
  return h(k) / h(n)
}

/**
 * The tone ramp, near plane first. Mixed in linear light and only then encoded
 * to sRGB; compositing in gamma space is why distant objects come out too dark.
 * @param {object} [opts] scene options; `surface`, `ground`, `planes`, `haze` or `cut`
 * @returns {string[]} one hex colour per plane
 */
export function hazeTones(opts) {
  const o = hazeResolve(opts)
  const s = parseHex(o.surface)
  const g = parseHex(o.ground)
  const T = o.haze ** (1 / (o.planes - 1))
  const out = []
  for (let k = 0; k < o.planes; k++) {
    const t = T ** k
    const rgb = []
    for (let i = 0; i < 3; i++)
      rgb.push(
        linearToSrgb(srgbToLinear(s[i]) * t + srgbToLinear(g[i]) * (1 - t)),
      )
    out.push(toHex(rgb))
  }
  return out
}

/**
 * Per-plane geometry, tones, and how far a box-shadow rendering misses the
 * true scaled copy.
 *
 * A box-shadow spread is an isotropic outset; a plane is a scale. They agree
 * only on a square with sharp corners or a full circle, so each plane reports:
 *   heightError  (1 - S) * |W - H|, zero only when W === H
 *   radiusError  |S * r - max(0, r + spread)|, zero at r = 0 and r = W / 2
 *   clears       how far the plane's leading edge escapes the element's own
 *                border box along the direction of travel; a shadow under the
 *                box is never drawn, so <= 0 means hidden
 *
 * @param {object} [opts] scene and subject options
 * @returns {{ opts: object, planes: object[], tones: string[], worstError: number, hidden: number[], ok: boolean }}
 *   `planes` holds k = 1 .. planes-1 with scale, offset, dx, dy, spread and the
 *   errors; `hidden` lists planes that do not clear the box; `ok` is true
 *   when box-shadow is within `tolerance` and no plane is hidden
 */
export function hazeAnalyse(opts) {
  const o = hazeResolve(opts)
  const { width: W, height: H, cornerRadius: r } = o
  const rad = (o.angle * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  const halfBox = (Math.abs(ux) * W + Math.abs(uy) * H) / 2
  const planes = []
  for (let k = 1; k < o.planes; k++) {
    const f = hazeProfile(k, o.planes, o.perspective)
    const scale = 1 - (1 - o.depth) * f
    const u = 1 - scale
    const spread = (-u * W) / 2
    const offset = o.radius * f * W
    planes.push({
      k,
      scale,
      offset,
      dx: offset * ux,
      dy: offset * uy,
      spread,
      heightError: Math.abs(H + 2 * spread - H * scale),
      radiusError: Math.abs(r * scale - Math.max(0, r + spread)),
      clears: offset - u * halfBox,
    })
  }
  const worstError = planes.reduce(
    (a, p) => Math.max(a, p.heightError, p.radiusError),
    0,
  )
  const hidden = planes.filter((p) => p.clears <= 0).map((p) => p.k)
  return {
    opts: o,
    planes,
    tones: hazeTones(o),
    worstError,
    hidden,
    ok: worstError <= o.tolerance && hidden.length === 0,
  }
}

/**
 * The shallowest depth (the smallest last plane) whose worst box-shadow error
 * stays within a pixel budget. Error grows as depth falls, so this bisects
 * between the given depth and 1. Returns the given depth when the geometry is
 * already clean there.
 * @param {object} [opts]
 * @param {number} [tolerancePx] defaults to `opts.tolerance`
 * @returns {number}
 */
export function hazeMinDepth(opts, tolerancePx) {
  const o = hazeResolve(opts)
  const tol = tolerancePx == null ? o.tolerance : tolerancePx
  const err = (depth) => hazeAnalyse({ ...o, depth }).worstError
  if (err(o.depth) <= tol) return o.depth
  let lo = o.depth
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2
    if (err(m) <= tol) hi = m
    else lo = m
  }
  return hi
}

// ---- CSS -------------------------------------------------------------------

function len(v, o) {
  if (o.responsive) {
    const n = Number((v / o.width).toFixed(6))
    return n === 0 ? '0' : `calc(var(--haze-w) * ${n})`
  }
  return Number(v.toFixed(o.precision)) === 0
    ? '0'
    : `${v.toFixed(o.precision)}px`
}

function boxShadowRule(a) {
  const o = a.opts
  const rules = a.planes.map(
    (p) =>
      `    ${len(p.dx, o)} ${len(p.dy, o)} 0 ${len(p.spread, o)} ${a.tones[p.k]}`,
  )
  return (
    `${o.selector} {\n` +
    (o.responsive ? `  --haze-w: ${o.width}px;\n` : '') +
    `  background: ${a.tones[0]};\n` +
    `  box-shadow:\n${rules.join(',\n')};\n}\n`
  )
}

/*
 * Exact for any shape and aspect: every plane, including the element's own
 * face, is a real copy, moved along the direction and scaled about its own
 * centre.
 *
 * No z-index, deliberately. Keeping the background on the element and pushing
 * copies behind it with z-index:-1 breaks two opposite ways: `isolation:
 * isolate` on the element makes it the stacking context root, so its
 * background paints first and the copies land in front; without it the copies
 * drop to the ancestor's negative-z step and vanish behind the first ancestor
 * that paints a background. Siblings in back-to-front DOM order have neither
 * failure mode: first child is the furthest plane, last is the face.
 */
function transformRules(a) {
  const o = a.opts
  const sel = o.selector
  const base = sel.replace(/^[.#]/, '')
  const plane = `${base}-plane`
  const content = `${base}-content`
  const all = [{ k: 0, scale: 1, dx: 0, dy: 0 }, ...a.planes]
  const out = [
    `${sel} {\n  position: relative;\n  background: none;\n}\n`,
    `${sel} > .${plane} {\n  position: absolute;\n  inset: 0;\n` +
      `  border-radius: inherit;\n  transform-origin: 50% 50%;\n}\n`,
  ]
  all
    .slice()
    .reverse()
    .forEach((p, i) => {
      const note =
        p.k === 0 ? ", the element's own face" : i === 0 ? ', the furthest' : ''
      out.push(
        `${sel} > .${plane}:nth-child(${i + 1}) {   /* plane ${p.k}${note} */\n` +
          `  background: ${a.tones[p.k]};\n` +
          (p.k === 0
            ? ''
            : `  transform: translate(${len(p.dx, o)}, ${len(p.dy, o)}) scale(${Number(p.scale.toFixed(6))});\n`) +
          `}\n`,
      )
    })
  out.push(
    `${sel} > .${content} {\n  position: relative;   /* above the planes */\n}\n`,
  )
  out.push(
    `/* markup, back to front:\n   <div class="${base}">\n` +
      all.map(() => `     <i class="${plane}"></i>\n`).join('') +
      `     <span class="${content}">...</span>\n   </div> */\n`,
  )
  return out.join('\n')
}

function header(a, chosen) {
  const o = a.opts
  const r6 = (v) => Number(v.toFixed(6))
  const L = [
    `/* hazePlanes - ${chosen}`,
    ' *',
    ` * scene    ${o.planes} planes, depth ${r6(o.depth)}, radius ${r6(o.radius)}w, angle ${r6(o.angle)}deg, perspective ${r6(o.perspective)}`,
    ` * air      haze ${r6(o.haze)}, so T = ${r6(o.haze ** (1 / (o.planes - 1)))} per gap`,
    ` * subject  ${o.width} x ${o.height}, corner radius ${o.cornerRadius}, ${a.tones[0]} on ${o.ground}`,
    ` * gives    scales ${a.planes.map((p) => Number(p.scale.toFixed(4))).join(' : ')}`,
    ` *          ramp   ${a.tones.join(' -> ')}`,
  ]
  if (chosen === 'box-shadow') {
    L.push(' *')
    L.push(
      ` * fidelity worst geometric error ${Number(a.worstError.toFixed(2))}px, ` +
        `${a.worstError <= o.tolerance ? 'within' : 'OVER'} tolerance ${o.tolerance}px`,
    )
    if (o.height !== o.width) {
      const last = a.planes[a.planes.length - 1]
      L.push(
        ` *          NOT SQUARE - spread is an isotropic outset, so the far plane is ` +
          `${Number((o.height + 2 * last.spread).toFixed(1))}px tall where a true scale gives ` +
          `${Number((o.height * last.scale).toFixed(1))}px`,
      )
    }
    if (a.worstError > o.tolerance)
      L.push(
        ` *          depth >= ${Number(hazeMinDepth(o, o.tolerance).toFixed(3))} ` +
          'would bring it inside tolerance, at the cost of the recession',
      )
    if (a.hidden.length)
      L.push(
        ` *          planes ${a.hidden.join(', ')} do not clear the element edge and will not draw`,
      )
  } else {
    L.push(' *')
    L.push(
      ` * fidelity exact for any shape and aspect; costs ${a.planes.length} extra elements`,
    )
  }
  L.push(' */')
  return L.join('\n') + '\n'
}

/**
 * The scene as CSS text. `technique: 'auto'` emits box-shadow where the
 * geometry supports it within `tolerance` and the transform stack otherwise.
 * @param {object} [opts]
 * @returns {string}
 */
export function hazeShadow(opts) {
  const a = hazeAnalyse(opts)
  const o = a.opts
  const chosen =
    o.technique === 'auto' ? (a.ok ? 'box-shadow' : 'transform') : o.technique
  if (chosen !== 'box-shadow' && chosen !== 'transform')
    throw new Error(`hazePlanes: unknown technique "${o.technique}"`)
  return (
    (o.comment ? header(a, chosen) + '\n' : '') +
    (chosen === 'box-shadow' ? boxShadowRule(a) : transformRules(a))
  )
}
