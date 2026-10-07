import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  HalfFloatType,
  OrthographicCamera,
  PlaneGeometry,
  RGFormat,
  Vector2,
} from 'three/webgpu'
import { texture, uniform } from 'three/tsl'
import { config } from '../../cocoon.config.js'
import {
  advectionMaterial,
  divergenceMaterial,
  forceMaterial,
  meshForceMaterial,
  outputMaterial,
  poissonMaterial,
  pressureMaterial,
  viscousMaterial,
} from './tsl/passes.js'
import { ShaderPass } from './ShaderPass.js'
import { FrameSplitter } from './frame.js'
import { useRenderTarget } from './targets.js'
import {
  bindWall,
  boundaryChildren,
  disposeBoundary,
  followWall,
} from './boundary.js'

// force calculation default
const defaultForceCallback = (delta, clock, pointer, pointerDiff) => ({
  force: pointerDiff,
  center: pointer,
})

/** The fields' targets: two channels, half float, as the WebGL version had. Module constants so the targets are not rebuilt per render. */
const FIELD_OPTS = Object.freeze({ type: HalfFloatType, format: RGFormat })
const OUTPUT_OPTS = Object.freeze({ type: HalfFloatType })

/** The caller's options over the config's defaults, an undefined option not overriding. */
function withDefaults(options) {
  const out = { ...config.fluid }
  for (const k in options) if (options[k] !== undefined) out[k] = options[k]
  return out
}

/**
 * A 2D fluid simulation on the GPU, as a texture. Needs the WebGPU renderer
 * (`three/webgpu`), on either of its backends: the passes are TSL node
 * materials. See docs/useFluidTexture.md.
 */
export const useFluidTexture = (options = {}) => {
  const {
    /* simulation physics options, defaults in cocoon.config.js */
    poissonIterations,
    viscousIterations,
    forceValue,
    resolution,
    runEvery,
    forceSize,
    viscous,
    isBounce,
    dt,
    isViscous,
    BFECC,
    forceCallbackRef,
    forceMesh,
    customCamera,
    /* target options */
    fboWidth,
    fboHeight,
    fboOpts = FIELD_OPTS,
    outputFboOpts = OUTPUT_OPTS,
    /* render options */
    setRendererOptionsInternally = true, // the force passes toggle the renderer's autoClear around their own render
    manual = false, // auto mode default
    priority = -1, // auto mode only
    pause = false, // auto mode only,
    pauseRef = {},
    manualRef = {},
  } = withDefaults(options)

  // reactive state data (along with passed args)
  const sizeCallback = useCallback(
    (state) => ({
      width: fboWidth || Math.floor(state.get().size.width * resolution),
      height: fboHeight || Math.floor(state.get().size.height * resolution),
    }),
    [fboHeight, fboWidth, resolution],
  )
  const sizeEqFn = useCallback((prev, curr) => {
    return prev.width === curr.width && prev.height === curr.height
  }, [])

  const { width, height } = useThree(sizeCallback, sizeEqFn)
  const { gl, camera: defaultCamera } = useThree(({ gl, camera }) => ({
    gl,
    camera,
  }))
  // the passes are TSL node materials: the legacy WebGLRenderer cannot build them
  if (gl && !gl.isWebGPURenderer) {
    throw new Error(
      'useFluidTexture: the Canvas must use the WebGPU renderer (three/webgpu), on either of its backends; see docs/useFluidTexture.md',
    )
  }

  // shared objects
  // an identity-extent orthographic camera: the passes set clip positions themselves, but the WebGPU
  // backend adapts every camera's projection to its clip space and a bare Camera has no method for it
  const [camera] = useState(() => new OrthographicCamera(-1, 1, 1, -1, -1, 1))
  const [geometry] = useState(() => new PlaneGeometry(2.0, 2.0))

  // intermediate values
  const [pointerDiff] = useState(() => new Vector2(0, 0))
  const [oldPointer] = useState(() => new Vector2(0, 0))
  const [oldForceMeshPosition] = useState(() => new Vector2(0, 0))
  const [viewportSize] = useState(() => new Vector2(0, 0))

  // the fields: render targets, rebuilt on a size change
  const vel0 = useRenderTarget(width, height, fboOpts)
  const vel1 = useRenderTarget(width, height, fboOpts)
  const visc0 = useRenderTarget(width, height, fboOpts)
  const visc1 = useRenderTarget(width, height, fboOpts)
  const div = useRenderTarget(width, height, fboOpts)
  const pressure0 = useRenderTarget(width, height, fboOpts)
  const pressure1 = useRenderTarget(width, height, fboOpts)
  const output = useRenderTarget(width, height, outputFboOpts)

  // uniform nodes, shared by the passes; vectors are mutated in place, scalars through .value
  const [Uniforms] = useState(() => {
    const _uniforms = {
      boundarySpace: uniform(new Vector2()),
      cellScale: uniform(new Vector2()),
      fboSize: uniform(new Vector2()),
      force: uniform(new Vector2()),
      meshForce: uniform(new Vector2()),
      center: uniform(new Vector2()),
      scale: uniform(new Vector2(forceSize, forceSize)),
      dt: uniform(dt),
      viscous: uniform(viscous),
      BFECC: uniform(BFECC ? 1 : 0, 'bool'),
    }
    const setDt = (_dt) => {
      _uniforms.dt.value = _dt
    }
    const setViscous = (_viscous) => {
      _uniforms.viscous.value = _viscous
    }
    const setBFECC = (_BFECC) => {
      _uniforms.BFECC.value = _BFECC ? 1 : 0
    }
    const get = () => _uniforms
    return { get, setDt, setViscous, setBFECC }
  })

  // reactive uniform updates
  useEffect(() => {
    // vectors
    const { boundarySpace, cellScale, fboSize } = Uniforms.get()
    fboSize.value.set(width, height)
    cellScale.value.set(1.0 / width, 1.0 / height)
    if (isBounce) {
      boundarySpace.value.set(0, 0)
    } else {
      boundarySpace.value.copy(cellScale.value)
    }
    // primitives
    Uniforms.setDt(dt)
    Uniforms.setViscous(viscous)
    Uniforms.setBFECC(BFECC)
  }, [BFECC, Uniforms, dt, height, isBounce, viscous, width])

  // shader passes: each gets its own texture nodes (swapped per step) and the shared uniform nodes
  const [advectionPass] = useState(() => {
    const u = Uniforms.get()
    const inputs = { velocity: texture(vel0.texture) }
    return new ShaderPass({
      material: advectionMaterial({
        velocity: inputs.velocity,
        dt: u.dt,
        isBFECC: u.BFECC,
        fboSize: u.fboSize,
        px: u.cellScale,
      }),
      inputs,
      camera,
      geometry,
      children: boundaryChildren,
      onDispose: disposeBoundary,
    }).setFBO(vel1)
  })
  const [forcePass] = useState(() => {
    const u = Uniforms.get()
    return new ShaderPass({
      material: forceMaterial({
        force: u.force,
        center: u.center,
        scale: u.scale,
        px: u.cellScale,
      }),
      inputs: { force: u.force, center: u.center, scale: u.scale },
      camera,
      geometry,
      clear: false, // adds into the velocity advection just wrote
    }).setFBO(vel1)
  })
  const [meshForcePass] = useState(() => {
    const u = Uniforms.get()
    return new ShaderPass({
      material: meshForceMaterial({ force: u.meshForce }),
      inputs: { force: u.meshForce },
      camera: null,
      geometry: forceMesh ? forceMesh.geometry : null,
      clear: false,
    }).setFBO(vel1)
  })

  useEffect(() => {
    if (forceMesh) {
      meshForcePass.updateGeometry(forceMesh.geometry)
      meshForcePass.updateCamera(customCamera || defaultCamera)
      oldPointer.set(0, 0)
    } else {
      oldForceMeshPosition.set(0, 0)
    }
  }, [
    customCamera,
    defaultCamera,
    forceMesh,
    meshForcePass,
    oldForceMeshPosition,
    oldPointer,
  ])

  const [viscousPass] = useState(() => {
    const u = Uniforms.get()
    const inputs = {
      velocity: texture(vel1.texture),
      velocity_new: texture(visc0.texture),
    }
    return new ShaderPass({
      material: viscousMaterial({
        velocity: inputs.velocity,
        velocity_new: inputs.velocity_new,
        v: u.viscous,
        px: u.cellScale,
        dt: u.dt,
        boundarySpace: u.boundarySpace,
      }),
      inputs,
      camera,
      geometry,
      children: boundaryChildren,
      onDispose: disposeBoundary,
    }).setFBO(visc1)
  })
  const [divergencePass] = useState(() => {
    const u = Uniforms.get()
    const inputs = { velocity: texture(visc0.texture) }
    return new ShaderPass({
      material: divergenceMaterial({
        velocity: inputs.velocity,
        dt: u.dt,
        px: u.cellScale,
        boundarySpace: u.boundarySpace,
      }),
      inputs,
      camera,
      geometry,
    }).setFBO(div)
  })
  const [poissonPass] = useState(() => {
    const u = Uniforms.get()
    const inputs = {
      pressure: texture(pressure0.texture),
      divergence: texture(div.texture),
    }
    return new ShaderPass({
      material: poissonMaterial({
        pressure: inputs.pressure,
        divergence: inputs.divergence,
        px: u.cellScale,
        boundarySpace: u.boundarySpace,
      }),
      inputs,
      camera,
      geometry,
      children: boundaryChildren,
      onDispose: disposeBoundary,
    }).setFBO(pressure1)
  })
  const [pressurePass] = useState(() => {
    const u = Uniforms.get()
    const inputs = {
      pressure: texture(pressure0.texture),
      velocity: texture(visc0.texture),
    }
    return new ShaderPass({
      material: pressureMaterial({
        pressure: inputs.pressure,
        velocity: inputs.velocity,
        px: u.cellScale,
        dt: u.dt,
        boundarySpace: u.boundarySpace,
      }),
      inputs,
      camera,
      geometry,
      children: boundaryChildren,
      onDispose: disposeBoundary,
    }).setFBO(vel0)
  })
  const [outputPass] = useState(() => {
    const u = Uniforms.get()
    const inputs = { velocity: texture(vel0.texture) }
    return new ShaderPass({
      material: outputMaterial({ velocity: inputs.velocity, px: u.cellScale }),
      inputs,
      camera,
      geometry,
    }).setFBO(output)
  })

  // the current targets (the repoint effect writes them after a size change)
  // and what the last step left in pressure (the render callback writes it,
  // outside React's render): the fields the hook exposes read both
  const targets = useRef({ vel0, div, pressure0, pressure1 })
  const last = useRef({ pressure: null })

  // a size change rebuilt the targets: repoint every pass at the new textures
  useEffect(() => {
    advectionPass
      .updateUniforms({ velocity: { value: vel0.texture } })
      .setFBO(vel1)
    forcePass.setFBO(vel1)
    meshForcePass.setFBO(vel1)
    viscousPass
      .updateUniforms({
        velocity: { value: vel1.texture },
        velocity_new: { value: visc0.texture },
      })
      .setFBO(visc1)
    divergencePass
      .updateUniforms({ velocity: { value: visc0.texture } })
      .setFBO(div)
    poissonPass
      .updateUniforms({
        pressure: { value: pressure0.texture },
        divergence: { value: div.texture },
      })
      .setFBO(pressure1)
    pressurePass
      .updateUniforms({
        pressure: { value: pressure0.texture },
        velocity: { value: visc0.texture },
      })
      .setFBO(vel0)
    outputPass
      .updateUniforms({ velocity: { value: vel0.texture } })
      .setFBO(output)
    // the walls: velocity copies its neighbour negated, pressure copies it as is
    const px = Uniforms.get().cellScale
    bindWall(advectionPass, 'velocity', px, -1)
    bindWall(viscousPass, 'velocity_new', px, -1)
    bindWall(poissonPass, 'pressure', px, 1)
    bindWall(pressurePass, 'velocity', px, -1)
    targets.current = { vel0, div, pressure0, pressure1 }
  }, [
    Uniforms,
    advectionPass,
    div,
    divergencePass,
    forcePass,
    meshForcePass,
    output,
    outputPass,
    poissonPass,
    pressure0,
    pressure1,
    pressurePass,
    vel0,
    vel1,
    visc0,
    visc1,
    viscousPass,
  ])

  // render callback
  const render = useCallback(
    (state, delta) => {
      const uniforms = Uniforms.get()
      for (const pass of [
        advectionPass,
        viscousPass,
        poissonPass,
        pressurePass,
      ])
        pass.modifyChildren((wall) => {
          wall.visible = isBounce
        })
      // advection pass
      advectionPass.render(gl)

      // external force pass
      if (!forceMesh) {
        const fc =
          typeof forceCallbackRef?.current === 'function'
            ? forceCallbackRef.current
            : defaultForceCallback

        const { clock, pointer } = state || {}

        if (pointer) {
          pointerDiff.subVectors(pointer, oldPointer)
          oldPointer.copy(pointer)
        }

        const {
          force,
          center,
          radius = forceSize,
        } = fc(
          delta,
          clock && clock.getElapsedTime(),
          pointer && pointer.clone(),
          pointer && pointerDiff.clone(),
        )

        uniforms.force.value.set(force.x * forceValue, force.y * forceValue)
        uniforms.center.value.set(center.x, center.y)
        uniforms.scale.value.set(radius, radius)
        forcePass.render(gl, setRendererOptionsInternally)
      } else {
        meshForcePass.mesh.position.copy(forceMesh.position)
        meshForcePass.mesh.scale.copy(forceMesh.scale).multiplyScalar(0.99)
        meshForcePass.mesh.rotation.copy(forceMesh.rotation)
        const activeCamera = customCamera || defaultCamera
        activeCamera.getViewSize(
          activeCamera.position.z - forceMesh.position.z,
          viewportSize,
        )

        uniforms.meshForce.value
          .set(
            (forceMesh.position.x - oldForceMeshPosition.x) / viewportSize.x,
            (forceMesh.position.y - oldForceMeshPosition.y) / viewportSize.y,
          )
          .multiplyScalar(2)

        oldForceMeshPosition.set(forceMesh.position.x, forceMesh.position.y)
        meshForcePass.render(gl, setRendererOptionsInternally)
      }
      // viscosity pass
      let vel = vel1
      if (isViscous) {
        let fbo_in, fbo_out
        for (let i = 0; i < viscousIterations; i++) {
          if (i % 2 == 0) {
            fbo_in = visc0
            fbo_out = visc1
          } else {
            fbo_in = visc1
            fbo_out = visc0
          }
          viscousPass.updateUniforms({
            velocity_new: { value: fbo_in.texture },
          })
          followWall(viscousPass, 'velocity_new').setFBO(fbo_out).render(gl)
        }
        vel = fbo_out
      }

      // divergence pass
      divergencePass
        .updateUniforms({ velocity: { value: vel.texture } })
        .render(gl)

      // poisson pass
      let p_in, p_out
      for (let i = 0; i < poissonIterations; i++) {
        if (i % 2 == 0) {
          p_in = pressure0
          p_out = pressure1
        } else {
          p_in = pressure1
          p_out = pressure0
        }
        poissonPass.updateUniforms({ pressure: { value: p_in.texture } })
        followWall(poissonPass, 'pressure').setFBO(p_out).render(gl)
      }
      const pressure = p_out
      last.current.pressure = p_out

      // pressure pass
      pressurePass.updateUniforms({
        velocity: { value: vel.texture },
        pressure: { value: pressure.texture },
      })
      followWall(pressurePass, 'velocity').render(gl)

      // output pass
      outputPass.render(gl)
    },
    [
      Uniforms,
      advectionPass,
      customCamera,
      defaultCamera,
      divergencePass,
      forceCallbackRef,
      forceMesh,
      forcePass,
      forceSize,
      forceValue,
      gl,
      isBounce,
      isViscous,
      meshForcePass,
      oldForceMeshPosition,
      oldPointer,
      outputPass,
      pointerDiff,
      poissonIterations,
      poissonPass,
      pressure0,
      pressure1,
      pressurePass,
      setRendererOptionsInternally,
      vel1,
      viewportSize,
      visc0,
      visc1,
      viscousIterations,
      viscousPass,
    ],
  )

  // frame splitter and reactive updates
  const frameSplitter = useMemo(() => new FrameSplitter(), [])
  useEffect(() => {
    frameSplitter.set(render, runEvery)
  }, [frameSplitter, render, runEvery])
  // simulation updates
  const initialFramesRendered = useRef(0)
  useFrame((state, delta) => {
    // render at least 5 frames to initialize (allows for upfront compilation)
    if (initialFramesRendered.current > 4) {
      if (!manual && !pause && !pauseRef?.current && !manualRef?.current) {
        frameSplitter.frame(state, delta)
      }
    } else {
      frameSplitter.frame(state, delta)
      initialFramesRendered.current++
    }
  }, priority)

  // dispose on component unmount
  useEffect(
    () => () => {
      // dispose passed-in values (the targets dispose themselves)
      geometry.dispose()
      // dispose internal values
      advectionPass.dispose(true, false, false, true)
      forcePass.dispose(true, false, false, true)
      meshForcePass.dispose(true, false, false, true)
      viscousPass.dispose(true, false, false, true)
      divergencePass.dispose(true, false, false, true)
      poissonPass.dispose(true, false, false, true)
      pressurePass.dispose(true, false, false, true)
      outputPass.dispose(true, false, false, true)
    },
    [
      advectionPass,
      divergencePass,
      forcePass,
      geometry,
      meshForcePass,
      outputPass,
      poissonPass,
      pressurePass,
      viscousPass,
    ],
  )

  // The fields, for consumers that want more than the picture: velocity for
  // displacement or refraction, pressure and divergence for their own looks.
  // Getters, since pressure alternates between two targets step by step.
  const [fields] = useState(() => ({
    get velocity() {
      return targets.current.vel0.texture
    },
    get pressure() {
      const t = targets.current
      const p = last.current.pressure
      // after a size change the last step's target is gone; until the next step, the first of the new pair
      return (p === t.pressure0 || p === t.pressure1 ? p : t.pressure0).texture
    },
    get divergence() {
      return targets.current.div.texture
    },
  }))

  return { texture: output.texture, render, fields }
}
