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
 * The scene, rendered by the site's Canvas through the tunnel. `rectRef` is the
 * demo's rectangle in viewport coordinates, written on the DOM side; `rectSize`
 * its size as props, so the fluid's targets follow it.
 */
function FluidScene({ values, rectRef, rectSize, distance, ref }) {
  const { gl, camera, size } = useThree(({ gl, camera, size }) => ({
    gl,
    camera,
    size,
  }))
  const plane = useRef(null)
  const background = useRef(null)
  // what the force callback reads: the current rect and canvas size, mirrored from props in an effect
  const view = useRef({ rect: null, canvas: { width: 1, height: 1 } })
  useEffect(() => {
    view.current.canvas = { width: size.width, height: size.height }
  }, [size.width, size.height])
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
    fboWidth: Math.max(2, Math.round(rectSize.width * values.resolution)),
    fboHeight: Math.max(2, Math.round(rectSize.height * values.resolution)),
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

  // placement: the plane covers the demo's rectangle at `distance` in front of the camera, every frame
  useFrame(() => {
    const rect = rectRef.current
    const mesh = plane.current
    if (!rect || !mesh) return
    placeInView(
      {
        rect,
        canvas: { width: size.width, height: size.height },
        camera,
        distance,
      },
      mesh,
    )
    const back = background.current
    if (back) {
      placeInView(
        {
          rect,
          canvas: { width: size.width, height: size.height },
          camera,
          distance: distance * 1.01,
        },
        back,
      )
    }
  })

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
 * @property {import('react').Ref<import('three').Group>} [ref] the scene's root group, for the site to traverse or raycast
 */

/**
 * The fluid's demo. Renders the wrapper with the fluid's settings and sends its
 * scene through `tunnel`; the rest of the props are the wrapper's.
 * @param {FluidTextureDemoProps & import('../Demo/index.jsx').DemoProps} props
 */
export function FluidTextureDemo({ tunnel, distance = 1, ref, ...props }) {
  if (!tunnel || !tunnel.In) {
    throw new Error(
      "FluidTextureDemo: `tunnel` is required, a tunnel-rat tunnel whose Out is rendered in the site's Canvas",
    )
  }
  const settings = useSettings(fluidDemoSchema)
  const probe = useRef(null)
  const rectRef = useRef(null)
  const [rectSize, setRectSize] = useState({ width: 0, height: 0 })
  // the demo's rectangle in viewport coordinates: measured on size change by a ResizeObserver, re-read on scroll and resize
  useLayoutEffect(() => {
    const el = probe.current
    if (!el) return undefined
    const measure = () => {
      const r = el.getBoundingClientRect()
      rectRef.current = { x: r.x, y: r.y, width: r.width, height: r.height }
      setRectSize((prev) =>
        prev.width === r.width && prev.height === r.height
          ? prev
          : { width: r.width, height: r.height },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      observer.disconnect()
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
        <FluidScene
          key={settings.key}
          ref={ref}
          values={settings.values}
          rectRef={rectRef}
          rectSize={rectSize}
          distance={distance}
        />
      </In>
    </Demo>
  )
}
