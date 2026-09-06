import { useLayoutEffect, useRef, useState } from 'react'
import { hazeAnalyse, hazeTones } from '../utils/hazePlanes.js'

/**
 * Wraps content in the cocoon haze: the plane recession the logo and the icon
 * set are cut from, applied to a live element instead of drawn into a file.
 * The scene is `src/utils/hazePlanes.js`; nothing here restates it. Built
 * from HazePlanes.spec.md.
 *
 *   <HazePlanes>Heading</HazePlanes>
 *   <HazePlanes fan><CocoonIcon name="settings" size={48} /></HazePlanes>
 *   <HazePlanes mode="shadow" style={{ width: 80, height: 80, borderRadius: 8 }} />
 *   <HazePlanes paint={{ background: true, color: true, border: true }}><button>…</button></HazePlanes>
 *
 * Two mechanisms. `transform` duplicates the children once per plane, each
 * copy moved along the angle and scaled about its own centre: exact for any
 * shape. `shadow` is one box-shadow with a layer per plane: no extra nodes,
 * exact only on a square, since a spread is an outset and a plane is a scale.
 */

const MODES = ['transform', 'shadow']
const resolveMode = (m) => {
  if (!MODES.includes(m))
    throw new Error(
      `HazePlanes: mode="${m}" is not one of ${MODES.join(', ')}.`,
    )
  return m
}

// Native tab stops. Not exhaustive: contenteditable, media with controls and
// iframes are focusable too; add them here if one turns up inside a fan.
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),' +
  'select:not([disabled]),textarea:not([disabled]),' +
  '[tabindex]:not([tabindex="-1"])'

// A bare number is px; a string is handed to CSS as written.
const cssLength = (v) =>
  v === 0 || v == null ? undefined : typeof v === 'number' ? `${v}px` : v
// The shadow geometry needs a number of px; a CSS length it cannot resolve
// without layout counts as 0.
const px = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0)

// Which of a copy's surfaces take a tone. Strings are shorthands.
const PAINTS = {
  auto: { color: true },
  color: { color: true },
  background: { background: true },
  both: { background: true, color: true },
}
const resolvePaint = (p) => {
  if (p && typeof p === 'object')
    return { background: !!p.background, color: !!p.color, border: !!p.border }
  if (!(p in PAINTS))
    throw new Error(
      `HazePlanes: paint="${p}" is not one of ${Object.keys(PAINTS).join(', ')} or { background, color, border }.`,
    )
  return { background: false, color: false, border: false, ...PAINTS[p] }
}

const REDUCED = '(prefers-reduced-motion: reduce)'
const DEV = process.env.NODE_ENV !== 'production'

/**
 * @param {object} props
 * @param {number} [props.planes] copies, the face included; default 4
 * @param {number} [props.depth] the last plane's size as a fraction of the face; default 2/3
 * @param {number} [props.radius] the last plane's centre from the face's, in element widths; default 0.6333
 * @param {number} [props.angle] degrees, 0 right, 90 down; default 0
 * @param {number} [props.perspective] foreshortening of the middle planes, 0 is equal steps; default 1/6
 * @param {'vapour'|'dense'} [props.cut] names the haze total; default 'vapour'
 * @param {number} [props.haze] overrides the cut's total
 * @param {string} [props.surface] hex, the face's colour; default '#141414'
 * @param {string} [props.ground] hex, the colour behind the element; default '#FFFFFF'
 * @param {string} [props.ink] hex, the content's colour; default ground when the box is painted, surface otherwise
 * @param {string} [props.borderInk] hex, the border's colour; default surface
 * @param {'transform'|'shadow'} [props.mode] default 'transform'
 * @param {'auto'|'background'|'color'|'both'|{background?: boolean, color?: boolean, border?: boolean}} [props.paint] which of a copy's box, content and border take a tone; default 'auto', which is { color: true }. Transform mode only
 * @param {'auto'|number|string} [props.cornerRadius] border radius of the wrapper and the shadow geometry; 'auto' reads the content's; default 'auto'
 * @param {false|true|{xyz?: boolean, size?: 'grow'|'shrink'|false}} [props.fan] planes are transparent at rest and open on hover or focus; true is { xyz: true, size: 'shrink' }; default false
 * @param {string} [props.duration] CSS time; default '260ms'
 * @param {string} [props.easing] CSS timing function; default 'ease'
 */
export function HazePlanes({
  children,
  planes = 4,
  depth = 2 / 3,
  radius = 1.9 / 3,
  angle = 0,
  perspective = 1 / 6,
  cut = 'vapour',
  haze,
  surface = '#141414',
  ground = '#FFFFFF',
  ink,
  borderInk,
  mode = 'transform',
  paint = 'auto',
  cornerRadius = 'auto',
  fan = false,
  duration = '260ms',
  easing = 'ease',
  className,
  style,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...rest
}) {
  const mech = resolveMode(mode)
  const painted = resolvePaint(paint)
  const fanOn = fan === true || (fan && typeof fan === 'object')
  const fanXyz = fanOn ? (fan === true ? true : (fan.xyz ?? true)) : false
  const fanSize = fanOn
    ? fan === true
      ? 'shrink'
      : fan.size === undefined
        ? 'shrink'
        : fan.size || false
    : false
  const fanWhere = fanOn ? `${fanXyz ? 'xyz' : ''}:${fanSize || ''}` : null
  const ref = useRef(null)
  const [box, setBox] = useState({ width: 0, height: 0, cornerRadius: 0 })
  const [open, setOpen] = useState(false)
  const [needsFocus, setNeedsFocus] = useState(false)
  const [reduced, setReduced] = useState(false)

  // state.reset: a change of fan closes the planes. Adjusted during render,
  // the React pattern for state that follows a prop, rather than in an effect.
  const [prevFan, setPrevFan] = useState(fanWhere)
  if (prevFan !== fanWhere) {
    setPrevFan(fanWhere)
    setOpen(false)
  }
  const isOpen = !fanWhere || open

  // effects.1: radius is in element widths, so the element is measured rather
  // than told; the haze survives a reflow, a font swap or a container query.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      // The content's own corner, read here so cornerRadius 'auto' follows
      // the child without being told. The content span is the last child.
      const inner = el.lastElementChild?.firstElementChild
      const cr =
        inner && typeof getComputedStyle === 'function'
          ? parseFloat(getComputedStyle(inner).borderTopLeftRadius) ||
            parseFloat(getComputedStyle(inner).borderRadius) ||
            0
          : 0
      setBox({ width: r.width, height: r.height, cornerRadius: cr })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // effects.2: a fan with nothing focusable inside exists only for a mouse,
  // so the wrapper takes the tab stop. Re-scanned on mutation, because a child
  // can become focusable in a passive effect or after async content arrives.
  useLayoutEffect(() => {
    const el = ref.current
    if (!fanWhere || !el) return
    const scan = () => setNeedsFocus(!el.querySelector(FOCUSABLE))
    // The first scan goes through the same deferred path as a mutation, so
    // the effect body itself sets no state.
    queueMicrotask(scan)
    const mo = new MutationObserver(scan)
    mo.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['tabindex', 'href', 'disabled'],
    })
    return () => mo.disconnect()
  }, [fanWhere])

  // effects.3
  useLayoutEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia(REDUCED)
    const sync = () => setReduced(mq.matches)
    queueMicrotask(sync)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const ready = box.width > 0
  const corner = cornerRadius === 'auto' ? box.cornerRadius : cornerRadius
  const scene = ready
    ? hazeAnalyse({
        planes,
        depth,
        radius,
        angle,
        perspective,
        ...(haze == null ? { cut } : { haze }),
        surface,
        ground,
        width: box.width,
        height: box.height,
        cornerRadius: px(corner),
      })
    : null
  const ramp = (near) =>
    scene && mech === 'transform'
      ? hazeTones({
          planes,
          ...(haze == null ? { cut } : { haze }),
          surface: near,
          ground,
        })
      : null
  // Content that stands alone is the surface; content on a painted box
  // contrasts with it, so it ramps from the ground unless told otherwise.
  const inkTones = painted.color
    ? ramp(ink ?? (painted.background ? ground : surface))
    : null
  const borderTones = painted.border ? ramp(borderInk ?? surface) : null

  // effects.4
  useLayoutEffect(() => {
    if (!DEV || !scene) return
    if (mech === 'shadow' && box.width !== box.height)
      console.warn(
        `HazePlanes: mode="shadow" is exact only on a square; this element is ${box.width} x ${box.height}, so the far plane is ${scene.worstError.toFixed(1)}px off a true scale. Use mode="transform".`,
      )
    if (scene.hidden.length)
      console.warn(
        `HazePlanes: plane${scene.hidden.length > 1 ? 's' : ''} ${scene.hidden.join(', ')} do not clear the element and will not show; raise radius or lower depth.`,
      )
  }, [scene?.worstError, scene?.hidden.length, mech, box.width, box.height]) // eslint-disable-line react-hooks/exhaustive-deps

  const time = reduced ? '0ms' : duration
  // The closed pose: on the face's position when xyz fans, at the face's size
  // or at nothing when size fans, transparent always. Everything moves together.
  const atPlace = isOpen || !fanXyz
  const scaleOf = (p) =>
    isOpen || !fanSize ? Number(p.scale.toFixed(6)) : fanSize === 'grow' ? 0 : 1
  const f = (v) => Number(v.toFixed(3))

  // Shadow mode has no fan: its layers cannot fade separately.
  const shadow = scene
    ? scene.planes
        .map(
          (p) =>
            `${f(p.dx)}px ${f(p.dy)}px 0 ${f(p.spread)}px ${scene.tones[p.k]}`,
        )
        .join(', ')
    : undefined

  const wrapper = {
    position: 'relative',
    display: 'inline-block',
    borderRadius: cssLength(corner),
    ...(mech === 'shadow' && scene
      ? { background: scene.tones[0], boxShadow: shadow }
      : null),
    ...style,
  }

  // markup.3–6: copies, furthest first, each moved along the angle and scaled
  // about its own centre. aria-hidden and unselectable, so they stay out of
  // the accessibility tree and out of a selection.
  const copies =
    mech === 'transform' && scene
      ? scene.planes
          .slice()
          .reverse()
          .map((p) => (
            <span
              key={p.k}
              aria-hidden='true'
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                userSelect: 'none',
                transformOrigin: '50% 50%',
                transform: `translate(${f(atPlace ? p.dx : 0)}px, ${f(atPlace ? p.dy : 0)}px) scale(${scaleOf(p)})`,
                opacity: isOpen ? 1 : 0,
                transitionProperty: 'transform, opacity',
                transitionDuration: time,
                transitionTimingFunction: easing,
                ...(painted.background
                  ? { background: scene.tones[p.k] }
                  : null),
                ...(painted.color ? { color: inkTones[p.k] } : null),
                ...(painted.border ? { borderColor: borderTones[p.k] } : null),
              }}
            >
              {children}
            </span>
          ))
      : null

  const handler = (own, set) =>
    fanWhere
      ? (e) => {
          own?.(e)
          setOpen(set)
        }
      : own

  // No z-index: the copies are siblings in back-to-front order and the
  // content is last, so it paints on top. A z-index here creates a stacking
  // context whose paint order inverts under isolation, a bug paid for once.
  return (
    <span
      ref={ref}
      className={className}
      style={wrapper}
      onMouseEnter={handler(onMouseEnter, true)}
      onMouseLeave={handler(onMouseLeave, false)}
      onFocus={handler(onFocus, true)}
      onBlur={handler(onBlur, false)}
      tabIndex={fanWhere && needsFocus ? 0 : undefined}
      {...rest}
    >
      {copies}
      <span style={{ position: 'relative', display: 'block' }}>{children}</span>
    </span>
  )
}
