import { CocoonIcon, iconNames } from '../CocoonIcon/index.jsx'
import { config } from '../../cocoon.config.js'
import { Demo } from '../Demo/index.jsx'
import { useSettings } from '../Demo/useSettings.js'
import { HazePlanes } from './index.jsx'

// HazePlanes' demo, a markup-only demo (the demo skill; manifest.spec
// consumer.1 with scene false): the haze around a piece of content in the
// wrapper's stage, every prop of the component as a setting in the sidebar,
// the ground colour painted on the stage so the planes' fade reads. Nothing
// through the site's Canvas, no loader, no handle (Demo.spec amend.1). The content the haze
// wraps is the demo's own choice, three of them: the mark (CocoonIcon), a word,
// a button; each shows a different surface the paint applies to (an SVG, text
// with no element of its own, a box with a border). The fixed exports the
// manifest reads (src/manifest.spec.md; scripts/manifest.mjs): `demo`, the
// component; `schema`; `scene`, false; `effects`, none.

/** A markup-only demo: no scene goes to the site's Canvas (manifest.4). */
export const scene = false
/** The effects this demo accepts: none; a DOM demo has no post-processing. */
export const effects = Object.freeze([])

const MODES = Object.freeze(['transform', 'shadow'])
const PAINTS = Object.freeze(['auto', 'color', 'background', 'both'])
const EASINGS = Object.freeze([
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
])
const CONTENTS = Object.freeze(['icon', 'word', 'button'])

/** The settings, defaults from cocoon.config.js where the component reads one (the scene, the ink, the cut and its ground). */
export const schema = Object.freeze({
  content: {
    kind: 'select',
    default: 'icon',
    options: CONTENTS,
    label: 'content',
    group: 'content',
  },
  icon: {
    kind: 'select',
    default: iconNames[0],
    options: iconNames,
    when: { key: 'content', value: 'icon' },
    group: 'content',
  },
  size: {
    kind: 'number',
    default: 96,
    min: 24,
    max: 320,
    step: 8,
    label: 'size (px)',
    group: 'content',
  },
  planes: {
    kind: 'number',
    default: config.scene.planes,
    min: 1,
    max: 8,
    step: 1,
    group: 'haze',
  },
  depth: {
    kind: 'number',
    default: config.scene.depth,
    min: 0.1,
    max: 1,
    step: 0.05,
    group: 'haze',
  },
  radius: {
    kind: 'number',
    default: config.scene.radius,
    min: 0,
    max: 2,
    step: 0.05,
    group: 'haze',
  },
  angle: {
    kind: 'number',
    default: config.scene.angle,
    min: 0,
    max: 360,
    step: 15,
    group: 'haze',
  },
  perspective: {
    kind: 'number',
    default: config.scene.perspective,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'haze',
  },
  cut: {
    kind: 'select',
    default: config.cut,
    options: Object.keys(config.cuts),
    group: 'haze',
  },
  surface: { kind: 'colour', default: config.ink, group: 'paint' },
  ground: {
    kind: 'colour',
    default: config.cuts[config.cut].ground,
    group: 'paint',
  },
  mode: { kind: 'select', default: MODES[0], options: MODES, group: 'paint' },
  paint: {
    kind: 'select',
    default: 'auto',
    options: PAINTS,
    when: { key: 'mode', value: 'transform' },
    group: 'paint',
  },
  cornerAuto: {
    kind: 'boolean',
    default: true,
    label: 'corner radius: auto',
    group: 'paint',
  },
  cornerRadius: {
    kind: 'number',
    default: 8,
    min: 0,
    max: 64,
    step: 1,
    label: 'corner radius (px)',
    when: { key: 'cornerAuto', value: false },
    group: 'paint',
  },
  fan: { kind: 'boolean', default: false, group: 'motion' },
  duration: {
    kind: 'number',
    default: 260,
    min: 0,
    max: 2000,
    step: 20,
    label: 'duration (ms)',
    group: 'motion',
  },
  easing: {
    kind: 'select',
    default: EASINGS[0],
    options: EASINGS,
    group: 'motion',
  },
})

/** The content the haze wraps, by the `content` setting. */
function Content({ values }) {
  const { content, icon, size } = values
  if (content === 'icon') return <CocoonIcon name={icon} size={size} />
  if (content === 'word') {
    return (
      <span
        style={{
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1,
          display: 'block',
        }}
      >
        Cocoon
      </span>
    )
  }
  return (
    <button
      type='button'
      style={{
        fontSize: Math.max(12, Math.round(size / 3)),
        padding: '0.4em 1em',
        border: '2px solid currentColor',
        borderRadius: 8,
        background: 'transparent',
        color: 'inherit',
      }}
    >
      Press
    </button>
  )
}

/**
 * HazePlanes' demo: the component around a piece of content, every prop a
 * setting. The props are the wrapper's: `openSettings`, `onOpenSettingsChange`,
 * the class and style props, `theme`, `label` (`docs/Demo.md`); nothing for
 * the Canvas, no loader, no handle, since nothing here is a scene.
 *
 * @param {object} props the Demo wrapper's props
 */
export function HazePlanesDemo(props) {
  const settings = useSettings(schema)
  const v = settings.values
  return (
    <Demo settings={settings} {...props}>
      <div
        className='cocoon-demo__haze'
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          background: v.ground,
          color: v.surface,
        }}
      >
        <HazePlanes
          planes={v.planes}
          depth={v.depth}
          radius={v.radius}
          angle={v.angle}
          perspective={v.perspective}
          cut={v.cut}
          surface={v.surface}
          ground={v.ground}
          mode={v.mode}
          paint={v.mode === 'transform' ? v.paint : 'auto'}
          cornerRadius={v.cornerAuto ? 'auto' : v.cornerRadius}
          fan={v.fan}
          duration={`${v.duration}ms`}
          easing={v.easing}
        >
          <Content values={v} />
        </HazePlanes>
      </div>
    </Demo>
  )
}

export { HazePlanesDemo as demo }
