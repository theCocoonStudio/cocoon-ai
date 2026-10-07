import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  EquirectangularReflectionMapping,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  PMREMGenerator,
} from 'three/webgpu'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { config } from '../../cocoon.config.js'
import { Demo } from '../Demo/index.jsx'
import {
  ResizeEventProvider,
  useResizeEvent,
} from '../ResizeEventProvider/index.jsx'
import { useSettings } from '../Demo/useSettings.js'
import { placeInView } from '../utils/placeInView.js'
import { useFluidTexture } from './useFluidTexture.js'

// The fluid's demo, the demo skill's first run (.claude/skills/demo/SKILL.md):
// a plane facing the site's perspective camera, covering the demo's area of
// the page exactly, the fluid's picture on it as a colour, bump or alpha map,
// under a basic or a standard material with its lights; the settings in the
// wrapper's sidebar. The scene goes through the site's tunnel into its one
// Canvas; nothing here renders a Canvas. Built with docs/useFluidTexture.md's
// Demo section and the resolved file's Demo entries.

/** The environments: one lazy module each, local to the install (the assets package ships them as data URLs). */
const ENVIRONMENTS = {
  apartment: () => import('@pmndrs/assets/hdri/apartment.exr.js'),
  bridge: () => import('@pmndrs/assets/hdri/bridge.exr.js'),
  city: () => import('@pmndrs/assets/hdri/city.exr.js'),
  dawn: () => import('@pmndrs/assets/hdri/dawn.exr.js'),
  esplanade: () => import('@pmndrs/assets/hdri/esplanade.exr.js'),
  forest: () => import('@pmndrs/assets/hdri/forest.exr.js'),
  hall: () => import('@pmndrs/assets/hdri/hall.exr.js'),
  lab: () => import('@pmndrs/assets/hdri/lab.exr.js'),
  lobby: () => import('@pmndrs/assets/hdri/lobby.exr.js'),
  night: () => import('@pmndrs/assets/hdri/night.exr.js'),
  park: () => import('@pmndrs/assets/hdri/park.exr.js'),
  sky: () => import('@pmndrs/assets/hdri/sky.exr.js'),
  studio: () => import('@pmndrs/assets/hdri/studio.exr.js'),
  sunrise: () => import('@pmndrs/assets/hdri/sunrise.exr.js'),
  sunset: () => import('@pmndrs/assets/hdri/sunset.exr.js'),
  venice: () => import('@pmndrs/assets/hdri/venice.exr.js'),
  warehouse: () => import('@pmndrs/assets/hdri/warehouse.exr.js'),
  workshop: () => import('@pmndrs/assets/hdri/workshop.exr.js'),
}

const standard = { key: 'material', value: 'standard' }

/** The settings, defaults from cocoon.config.js where the hook has one. */
export const fluidDemoSchema = Object.freeze({
  forceValue: {
    kind: 'number',
    default: config.fluid.forceValue,
    min: 0,
    max: 10,
    step: 0.1,
    group: 'fluid',
  },
  forceSize: {
    kind: 'number',
    default: config.fluid.forceSize,
    min: 10,
    max: 400,
    step: 10,
    group: 'fluid',
  },
  resolution: {
    kind: 'number',
    default: config.fluid.resolution,
    min: 0.1,
    max: 1,
    step: 0.05,
    live: false,
    group: 'fluid',
  },
  poissonIterations: {
    kind: 'number',
    default: config.fluid.poissonIterations,
    min: 1,
    max: 64,
    step: 1,
    group: 'fluid',
  },
  isViscous: {
    kind: 'boolean',
    default: config.fluid.isViscous,
    group: 'fluid',
  },
  viscous: {
    kind: 'number',
    default: config.fluid.viscous,
    min: 0,
    max: 100,
    step: 1,
    when: { key: 'isViscous', value: true },
    group: 'fluid',
  },
  dt: {
    kind: 'number',
    default: config.fluid.dt,
    min: 0.001,
    max: 0.05,
    step: 0.001,
    group: 'fluid',
  },
  isBounce: { kind: 'boolean', default: config.fluid.isBounce, group: 'fluid' },
  BFECC: { kind: 'boolean', default: config.fluid.BFECC, group: 'fluid' },
  material: {
    kind: 'select',
    default: 'basic',
    options: ['basic', 'standard'],
    live: false,
    group: 'material',
  },
  map: {
    kind: 'select',
    default: 'color',
    options: ['color', 'bump', 'alpha'],
    live: false,
    group: 'material',
  },
  color: { kind: 'colour', default: '#ffffff', group: 'material' },
  bumpScale: {
    kind: 'number',
    default: 1,
    min: 0,
    max: 10,
    step: 0.1,
    when: { key: 'map', value: 'bump' },
    group: 'material',
  },
  background: {
    kind: 'colour',
    default: '#141414',
    when: { key: 'map', value: 'alpha' },
    group: 'material',
  },
  roughness: {
    kind: 'number',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    when: standard,
    group: 'material',
  },
  metalness: {
    kind: 'number',
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
    when: standard,
    group: 'material',
  },
  emissive: {
    kind: 'colour',
    default: '#000000',
    when: standard,
    group: 'material',
  },
  environment: {
    kind: 'select',
    default: 'none',
    options: ['none', 'room', ...Object.keys(ENVIRONMENTS)],
    when: standard,
    group: 'lights',
  },
  envMapIntensity: {
    kind: 'number',
    default: 1,
    min: 0,
    max: 4,
    step: 0.1,
    when: standard,
    group: 'lights',
  },
  directionalLight: {
    kind: 'boolean',
    default: true,
    when: standard,
    group: 'lights',
  },
  lightIntensity: {
    kind: 'number',
    default: 2,
    min: 0,
    max: 10,
    step: 0.1,
    when: standard,
    group: 'lights',
  },
  lightColor: {
    kind: 'colour',
    default: '#ffffff',
    when: standard,
    group: 'lights',
  },
  lightPosition: {
    kind: 'vector',
    default: [2, 3, 4],
    step: 0.5,
    when: standard,
    group: 'lights',
  },
})

/** The pointer in the fluid's own space: the canvas's pointer (NDC, the whole viewport) mapped into the demo's rectangle. */
function pointerInRect(pointer, rect, canvas, out) {
  const px = ((pointer.x + 1) / 2) * canvas.width
  const py = ((1 - pointer.y) / 2) * canvas.height
  out.x = ((px - rect.x) / rect.width) * 2 - 1
  out.y = -(((py - rect.y) / rect.height) * 2 - 1)
  return out
}

/**
 * The scene, rendered by the site's Canvas through the tunnel, under its own
 * ResizeEventProvider. The canvas's size and the stage's come from that
 * provider, not from fiber's `size`, which can lag a frame inside a View or a
 * portal (Izzy's review of #67). `rectRef` is the demo's rectangle's position
 * in viewport coordinates, written on the DOM side on scroll and resize;
 * `probe` is the stage-sized element the provider measures.
 */
function FluidScene({ values, rectRef, probe, distance, priority, ref }) {
  const { gl, camera } = useThree(({ gl, camera }) => ({ gl, camera }))
  const canvas = useResizeEvent('canvas', gl.domElement)
  const stage = useResizeEvent('stage', probe)
  const plane = useRef(null)
  const background = useRef(null)
  // what the force callback reads: the canvas size, mirrored from the provider in an effect
  const view = useRef({ canvas: { width: 1, height: 1 } })
  useEffect(() => {
    if (canvas.width && canvas.height)
      view.current.canvas = { width: canvas.width, height: canvas.height }
  }, [canvas.width, canvas.height])
  const [forceCallbackRef] = useState(() => {
    const center = { x: 0, y: 0 }
    const force = { x: 0, y: 0 }
    return {
      current: (delta, clock, pointer, pointerDiff) => {
        const rect = rectRef.current
        const { canvas } = view.current
        if (!pointer || !rect || !rect.width || !rect.height) {
          force.x = force.y = 0
          return { force, center }
        }
        pointerInRect(pointer, rect, canvas, center)
        // the diff is in canvas NDC; the fluid's NDC spans the rect, so scale by the ratio
        force.x = pointerDiff.x * (canvas.width / rect.width)
        force.y = pointerDiff.y * (canvas.height / rect.height)
        return { force, center }
      },
    }
  })
  const { texture } = useFluidTexture({
    forceCallbackRef,
    fboWidth: Math.max(2, Math.round((stage.width ?? 0) * values.resolution)),
    fboHeight: Math.max(2, Math.round((stage.height ?? 0) * values.resolution)),
    forceValue: values.forceValue,
    forceSize: values.forceSize,
    poissonIterations: values.poissonIterations,
    isViscous: values.isViscous,
    viscous: values.viscous,
    dt: values.dt,
    isBounce: values.isBounce,
    BFECC: values.BFECC,
  })

  // the material: one per kind, built in an effect and held in a ref, never flowing through render, so the
  // effects below may write it; assigned to the mesh imperatively; disposed on change and unmount (dispose.material)
  const isStandard = values.material === 'standard'
  const materialRef = useRef(null)
  useEffect(() => {
    const m = isStandard
      ? new MeshStandardNodeMaterial()
      : new MeshBasicNodeMaterial()
    materialRef.current = m
    const mesh = plane.current
    if (mesh) mesh.material = m
    return () => {
      materialRef.current = null
      m.dispose()
    }
  }, [isStandard])

  // the texture's slot and the colour settings, applied in place
  useEffect(() => {
    const material = materialRef.current
    if (!material) return
    material.map = null
    material.alphaMap = null
    if (isStandard) material.bumpMap = null
    if (values.map === 'alpha') material.alphaMap = texture
    else if (values.map === 'bump' && isStandard) {
      material.bumpMap = texture
      material.bumpScale = values.bumpScale
    } else material.map = texture // bump under basic has no lighting to show it: the colour map instead
    material.transparent = values.map === 'alpha'
    material.color.set(values.color)
    if (isStandard) {
      material.roughness = values.roughness
      material.metalness = values.metalness
      material.emissive.set(values.emissive)
      material.envMapIntensity = values.envMapIntensity
    }
    material.needsUpdate = true
  }, [
    isStandard,
    texture,
    values.map,
    values.bumpScale,
    values.color,
    values.roughness,
    values.metalness,
    values.emissive,
    values.envMapIntensity,
  ])

  // the environment: per material, never the site's scene; loaded only when picked, disposed when replaced (dispose.environment)
  useEffect(() => {
    const material = materialRef.current
    if (!isStandard || !material) return undefined
    let ignore = false
    let owned = null
    const apply = (env, holder) => {
      if (ignore) {
        holder?.dispose()
        return
      }
      owned = holder
      material.envMap = env
      material.needsUpdate = true
    }
    const name = values.environment
    if (name === 'none') apply(null, null)
    else if (name === 'room') {
      const generator = new PMREMGenerator(gl)
      const target = generator.fromScene(new RoomEnvironment())
      generator.dispose()
      apply(target.texture, target)
    } else {
      ENVIRONMENTS[name]()
        .then((m) => new EXRLoader().loadAsync(m.default))
        .then((tex) => {
          tex.mapping = EquirectangularReflectionMapping
          apply(tex, tex)
        })
        .catch((e) => {
          if (!ignore)
            console.error(
              `FluidTextureDemo: environment "${name}" failed to load`,
              e,
            )
        })
    }
    return () => {
      ignore = true
      material.envMap = null
      owned?.dispose()
    }
  }, [values.environment, isStandard, gl])

  // placement: the plane covers the demo's rectangle at `distance` in front of the camera, every frame,
  // at the given priority; the rectangle's size is the provider's, its position the DOM side's
  useFrame(() => {
    const rect = rectRef.current
    const mesh = plane.current
    const size = view.current.canvas
    if (!rect || !mesh || !stage.width || !stage.height) return
    const r = { x: rect.x, y: rect.y, width: stage.width, height: stage.height }
    placeInView({ rect: r, canvas: size, camera, distance }, mesh)
    const back = background.current
    if (back) {
      placeInView(
        { rect: r, canvas: size, camera, distance: distance * 1.01 },
        back,
      )
    }
  }, priority)

  return (
    <group ref={ref}>
      <mesh ref={plane}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {values.map === 'alpha' && (
        <mesh ref={background}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={values.background} />
        </mesh>
      )}
      {isStandard && values.directionalLight && (
        <directionalLight
          position={values.lightPosition}
          intensity={values.lightIntensity}
          color={values.lightColor}
        />
      )}
    </group>
  )
}

/**
 * @typedef {object} FluidTextureDemoProps
 * @property {{ In: import('react').ComponentType<{children?: import('react').ReactNode}> }} tunnel the site's tunnel; its Out sits in the site's Canvas
 * @property {number} [distance=1] how far in front of the camera the plane sits, world units
 * @property {number} [priority=-1] useFrame's priority for the placement, as the hook takes one for its step
 * @property {import('react').Ref<import('three').Group>} [ref] the scene's root group, for the site to traverse or raycast
 */

/**
 * The fluid's demo. Renders the wrapper with the fluid's settings and sends its
 * scene through `tunnel`; the rest of the props are the wrapper's.
 * @param {FluidTextureDemoProps & import('../Demo/index.jsx').DemoProps} props
 */
export function FluidTextureDemo({
  tunnel,
  distance = 1,
  priority = -1,
  ref,
  ...props
}) {
  if (!tunnel || !tunnel.In) {
    throw new Error(
      "FluidTextureDemo: `tunnel` is required, a tunnel-rat tunnel whose Out is rendered in the site's Canvas",
    )
  }
  const settings = useSettings(fluidDemoSchema)
  const probe = useRef(null)
  const [probeEl, setProbeEl] = useState(null)
  const rectRef = useRef(null)
  // the demo's rectangle's position in viewport coordinates, re-read on scroll and resize; its size is the
  // scene's ResizeEventProvider's, which observes the probe element handed to it
  useLayoutEffect(() => {
    const el = probe.current
    if (!el) return undefined
    setProbeEl(el)
    const measure = () => {
      const r = el.getBoundingClientRect()
      rectRef.current = { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [])
  const { In } = tunnel
  return (
    <Demo settings={settings} {...props}>
      <div
        ref={probe}
        className='cocoon-demo__probe'
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
      <In>
        <ResizeEventProvider>
          <FluidScene
            key={settings.key}
            ref={ref}
            values={settings.values}
            rectRef={rectRef}
            probe={probeEl}
            distance={distance}
            priority={priority}
          />
        </ResizeEventProvider>
      </In>
    </Demo>
  )
}
