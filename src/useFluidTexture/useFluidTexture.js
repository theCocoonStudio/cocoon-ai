import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Camera, HalfFloatType, PlaneGeometry, RGFormat, Vector2 } from 'three'
import { useFBO } from '@react-three/drei'
import { advectionPassConfig } from './AdvectionPass.canvas'
import { forcePassConfig } from './ForcePass.canvas'
import { meshForcePassConfig } from './MeshForcePass.canvas'
import { viscousPassConfig } from './ViscousPass.canvas'
import { divergencePassConfig } from './DivergencePass.canvas'
import { poissonPassConfig } from './PoissonPass.canvas'
import { pressurePassConfig } from './PressurePass.canvas'
import { outputPassConfig } from './OutputPass.canvas'
import { ShaderPass } from './ShaderPass'
import { FrameSplitter } from './frame'
import { bindWall, followWall } from './boundary.js'

// force calculation default
const defaultForceCallback = (delta, clock, pointer, pointerDiff) => ({
  force: pointerDiff,
  center: pointer,
})
export const useFluidTexture = ({
  /* simulation physics options */
  poissonIterations = 32,
  viscousIterations = 32,
  forceValue = 1,
  resolution = 0.5,
  runEvery = 1,
  forceSize = 100,
  viscous = 30,
  isBounce = true,
  dt = 0.014,
  isViscous = true,
  BFECC = true,
  forceCallbackRef,
  forceMesh,
  customCamera,
  /* fbo options */
  fboWidth,
  fboHeight,
  fboOpts = { type: HalfFloatType, format: RGFormat },
  outputFboOpts = { type: HalfFloatType },
  /* render options */
  manual = false, // auto mode default
  priority = -1, // auto mode only
  pause = false, // auto mode only,
  pauseRef = {},
  manualRef = {},
}) => {
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

  // shared objects
  const [camera] = useState(() => new Camera())
  const [geometry] = useState(() => new PlaneGeometry(2.0, 2.0))

  // intermediate values
  const [pointerDiff] = useState(() => new Vector2(0, 0))
  const [oldPointer] = useState(() => new Vector2(0, 0))
  const [oldForceMeshPosition] = useState(() => new Vector2(0, 0))
  const [viewportSize] = useState(() => new Vector2(0, 0))

  // fbos
  const vel0 = useFBO(width, height, {
    depthBuffer: false,
    ...fboOpts,
  })
  const vel1 = useFBO(width, height, {
    depthBuffer: false,
    ...fboOpts,
  })
  const visc0 = useFBO(width, height, {
    depthBuffer: false,
    ...fboOpts,
  })
  const visc1 = useFBO(width, height, {
    depthBuffer: false,
    ...fboOpts,
  })
  const div = useFBO(width, height, {
    depthBuffer: false,
    ...fboOpts,
  })
  const pressure0 = useFBO(width, height, {
    depthBuffer: false,
    ...fboOpts,
  })
  const pressure1 = useFBO(width, height, {
    depthBuffer: false,
    ...fboOpts,
  })
  const output = useFBO(width, height, {
    depthBuffer: false,
    ...outputFboOpts,
  })

  // uniforms
  const [Uniforms] = useState(() => {
    const _uniforms = {
      boundarySpace: new Vector2(),
      cellScale: new Vector2(),
      fboSize: new Vector2(),
      force: new Vector2(),
      meshForce: new Vector2(),
      center: new Vector2(),
      scale: new Vector2(forceSize, forceSize),
      dt: { value: dt },
      viscous: { value: viscous },
      BFECC: { value: BFECC },
    }

    const setDt = (_dt) => {
      _uniforms.dt.value = _dt
    }
    const setViscous = (_viscous) => {
      _uniforms.viscous.value = _viscous
    }
    const setBFECC = (_BFECC) => {
      _uniforms.BFECC.value = _BFECC
    }
    const get = () => _uniforms
    return {
      get,
      setDt,
      setViscous,
      setBFECC,
    }
  })

  // reactive uniform updates
  useEffect(() => {
    // vectors
    const { boundarySpace, cellScale, fboSize } = Uniforms.get()
    fboSize.set(width, height)
    cellScale.set(1.0 / fboSize.x, 1.0 / fboSize.y)

    if (isBounce) {
      boundarySpace.set(0, 0)
    } else {
      boundarySpace.copy(cellScale)
    }
    // primitives
    Uniforms.setDt(dt)
    Uniforms.setViscous(viscous)
    Uniforms.setBFECC(BFECC)
  }, [BFECC, Uniforms, dt, height, isBounce, viscous, width])

  // shader passes
  const [advectionPass] = useState(() => {
    const uniforms = Uniforms.get()
    return new ShaderPass({
      ...advectionPassConfig,
      camera,
      geometry,
    })
      .updateUniforms({
        boundarySpace: {
          value: uniforms.cellScale,
        },
        px: {
          value: uniforms.cellScale,
        },
        fboSize: {
          value: uniforms.fboSize,
        },
        velocity: {
          value: vel0.texture,
        },
        dt: uniforms.dt,
        isBFECC: uniforms.BFECC,
      })
      .setFBO(vel1)
  })
  const [forcePass] = useState(() => {
    const uniforms = Uniforms.get()
    return new ShaderPass({
      ...forcePassConfig,
      camera,
      geometry,
    })
      .updateUniforms({
        px: {
          value: uniforms.cellScale,
        },
        force: {
          value: uniforms.force,
        },
        center: {
          value: uniforms.center,
        },
        scale: {
          value: uniforms.scale,
        },
      })
      .setFBO(vel1)
  })

  const [meshForcePass] = useState(() =>
    new ShaderPass({
      ...meshForcePassConfig,
      camera: null,
      geometry: forceMesh ? forceMesh.geometry : null,
    })
      .updateUniforms({
        force: {
          value: Uniforms.get().meshForce,
        },
      })
      .setFBO(vel1),
  )

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
    const uniforms = Uniforms.get()
    return new ShaderPass({
      ...viscousPassConfig,
      camera,
      geometry,
    })
      .updateUniforms({
        boundarySpace: {
          value: uniforms.boundarySpace,
        },
        velocity: {
          value: vel1.texture,
        },
        velocity_new: {
          value: visc0.texture,
        },
        v: uniforms.viscous,
        px: {
          value: uniforms.cellScale,
        },
        dt: uniforms.dt,
      })
      .setFBO(visc1)
  })
  const [divergencePass] = useState(() => {
    const uniforms = Uniforms.get()
    return new ShaderPass({
      ...divergencePassConfig,
      camera,
      geometry,
    })
      .updateUniforms({
        boundarySpace: {
          value: uniforms.boundarySpace,
        },
        velocity: {
          value: visc0.texture,
        },
        dt: uniforms.dt,
        px: {
          value: uniforms.cellScale,
        },
      })
      .setFBO(div)
  })
  const [poissonPass] = useState(() => {
    const uniforms = Uniforms.get()
    return new ShaderPass({
      ...poissonPassConfig,
      camera,
      geometry,
    })
      .updateUniforms({
        boundarySpace: {
          value: uniforms.boundarySpace,
        },
        pressure: {
          value: pressure0.texture,
        },
        divergence: {
          value: div.texture,
        },
        px: {
          value: uniforms.cellScale,
        },
      })
      .setFBO(pressure1)
  })
  const [pressurePass] = useState(() => {
    const uniforms = Uniforms.get()
    return new ShaderPass({
      ...pressurePassConfig,
      camera,
      geometry,
    })
      .updateUniforms({
        boundarySpace: {
          value: uniforms.boundarySpace,
        },
        pressure: {
          value: pressure0.texture,
        },
        velocity: {
          value: visc0.texture,
        },
        px: {
          value: uniforms.cellScale,
        },
        dt: uniforms.dt,
      })
      .setFBO(vel0)
  })
  const [outputPass] = useState(() =>
    new ShaderPass({
      ...outputPassConfig,
      camera,
      geometry,
    })
      .updateUniforms({
        velocity: {
          value: vel0.texture,
        },
        px: {
          value: Uniforms.get().cellScale,
        },
      })
      .setFBO(output),
  )

  // the walls: velocity copies its neighbour negated, pressure copies it as is
  const [wallsBound] = useState(() => {
    const px = { value: Uniforms.get().cellScale }
    bindWall(advectionPass, 'velocity', px, -1)
    bindWall(viscousPass, 'velocity_new', px, -1)
    bindWall(poissonPass, 'pressure', px, 1)
    bindWall(pressurePass, 'velocity', px, -1)
    return true
  })
  void wallsBound

  // render callback
  const render = useCallback(
    (state, delta) => {
      const uniforms = Uniforms.get()
      // advection pass
      for (const pass of [
        advectionPass,
        viscousPass,
        poissonPass,
        pressurePass,
      ])
        pass.modifyChildren((wall) => {
          wall.visible = isBounce
        })
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

        uniforms.force.set(force.x * forceValue, force.y * forceValue)
        uniforms.center.set(center.x, center.y)
        uniforms.scale.set(radius, radius)
        forcePass.render(gl)
      } else {
        meshForcePass.mesh.position.copy(forceMesh.position)
        meshForcePass.mesh.scale.copy(forceMesh.scale).multiplyScalar(0.99)
        meshForcePass.mesh.rotation.copy(forceMesh.rotation)
        const activeCamera = customCamera || defaultCamera
        activeCamera.getViewSize(
          activeCamera.position.z - forceMesh.position.z,
          viewportSize,
        )

        uniforms.meshForce
          .set(
            (forceMesh.position.x - oldForceMeshPosition.x) / viewportSize.x,
            (forceMesh.position.y - oldForceMeshPosition.y) / viewportSize.y,
          )
          .multiplyScalar(2)

        oldForceMeshPosition.set(forceMesh.position.x, forceMesh.position.y)
        meshForcePass.render(gl)
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
            velocity_new: {
              value: fbo_in.texture,
            },
          })
          followWall(viscousPass, 'velocity_new').setFBO(fbo_out).render(gl)
        }
        vel = fbo_out
      }

      // divergence pass
      divergencePass
        .updateUniforms({
          velocity: { value: vel.texture },
        })
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

      // pressure pass
      pressurePass.updateUniforms({
        velocity: {
          value: vel.texture,
        },
        pressure: {
          value: pressure.texture,
        },
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
      // dispose passed-in values (useFBO autodisposes)
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

  return { texture: output.texture, render }
}
