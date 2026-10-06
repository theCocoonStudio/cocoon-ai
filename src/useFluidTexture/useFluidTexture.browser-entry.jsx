// The page src/useFluidTexture/useFluidTexture.browser.test.js drives: the
// hook in a real Canvas on the WebGPU renderer, stepped by hand, its output
// read back as pixels. The renderer takes its WebGL 2 backend where the page
// has no WebGPU (headless Chromium under SwiftShader), the same TSL on either.
// `window.__opts` (set before load) are extra hook options; `window.__fluid`
// is what the test calls.
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, extend, useThree } from '@react-three/fiber'
import {
  FloatType,
  Mesh,
  MeshBasicNodeMaterial,
  NodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  RenderTarget,
  Scene,
  RGBAFormat,
  UnsignedByteType,
  WebGPURenderer,
} from 'three/webgpu'
import { positionGeometry, texture, vec3, vec4 } from 'three/tsl'
import { useFluidTexture } from './useFluidTexture.js'

// fiber's JSX catalogue is the legacy `three`; the node material is registered here
extend({ MeshBasicNodeMaterial })

function Fluid() {
  const forceRef = useRef(() => ({
    force: window.__force ?? { x: 0, y: 0 },
    center: window.__center ?? { x: 0, y: 0 },
    radius: window.__radius,
  }))
  const {
    texture: output,
    render,
    fields,
  } = useFluidTexture({
    forceCallbackRef: forceRef,
    fboWidth: 64,
    fboHeight: 64,
    manual: true,
    ...(window.__opts ?? {}),
  })
  const { gl, scene, camera, size } = useThree()
  const material = useRef(null)
  useEffect(() => {
    const clock = { t: 0, getElapsedTime: () => clock.t }
    const state = { clock, pointer: null }
    const w = gl.domElement.width
    const h = gl.domElement.height
    // the readback target: the scene drawn into bytes, read with the renderer's own readback
    const shot = new RenderTarget(w, h, {
      type: UnsignedByteType,
      format: RGBAFormat,
      depthBuffer: false,
    })
    const raw = new RenderTarget(w, h, {
      type: FloatType,
      format: RGBAFormat,
      depthBuffer: false,
    })
    // a copy pass with no lighting model: the basic material clamps negative values
    const rawCopy = texture(fields.velocity)
    const rawMaterial = new NodeMaterial()
    rawMaterial.vertexNode = vec4(positionGeometry.xy, 0.0, 1.0)
    rawMaterial.fragmentNode = rawCopy // default uv: the node flips y for a render-target texture
    rawMaterial.depthTest = false
    rawMaterial.depthWrite = false
    const rawScene = new Scene()
    rawScene.add(new Mesh(new PlaneGeometry(2, 2), rawMaterial))
    const rawCamera = new OrthographicCamera(-1, 1, 1, -1, -1, 1)
    // The WebGPU backend pads every row but the last to 256 bytes and hands the padded buffer back
    // (three's copyTextureToBuffer); the WebGL backend's buffer is tight. The stride in texels, from the length.
    const strideOf = (buf, width, height, channels) =>
      height > 1
        ? (buf.length - width * channels) / (height - 1) / channels
        : width
    const read = async () => {
      gl.setRenderTarget(shot)
      gl.render(scene, camera)
      gl.setRenderTarget(null)
      const buf = await gl.readRenderTargetPixelsAsync(shot, 0, 0, w, h)
      // the readback's row order differs per backend (measured against a screenshot, 2026-10-06):
      // the WebGPU backend returns the top row first, the WebGL backend the bottom row first
      const stride = strideOf(buf, w, h, 4)
      const topFirst = window.__backend === 'webgpu'
      const grey = []
      for (let row = 0; row < h; row++) {
        const y = topFirst ? row : h - 1 - row
        for (let x = 0; x < w; x++) {
          const i = (y * stride + x) * 4
          grey.push(Math.round((buf[i] + buf[i + 1] + buf[i + 2]) / 3))
        }
      }
      return { width: w, height: h, grey }
    }
    window.__fluid = {
      /** Step the simulation n times with a fixed delta. */
      step(n = 1, delta = 1 / 60) {
        for (let i = 0; i < n; i++) {
          clock.t += delta
          render(state, delta)
        }
      },
      /** Draw the output texture and return its grey levels, row-major, top row first. */
      read,
      /** Draw one component of the velocity, mid grey at rest, and return grey levels. */
      async readVelocity(channel = 'x') {
        const shown = material.current
        const saved = shown.colorNode
        const v = texture(fields.velocity)[channel].mul(0.5).add(0.5)
        shown.colorNode = vec4(vec3(v), 1.0)
        shown.needsUpdate = true
        const img = await read()
        shown.colorNode = saved
        shown.needsUpdate = true
        return img
      },
      /** A field's raw floats at (x, y): copied through a plain fragment into a float target and read back. */
      async readFieldRaw(name, x, y) {
        rawCopy.value = name === 'output' ? output : fields[name]
        gl.setRenderTarget(raw)
        gl.render(rawScene, rawCamera)
        gl.setRenderTarget(null)
        const buf = await gl.readRenderTargetPixelsAsync(raw, 0, 0, w, h)
        const row = window.__backend === 'webgpu' ? y : h - 1 - y
        const i = (row * strideOf(buf, w, h, 4) + x) * 4
        return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
      },
      /** The output target's raw bytes at (x, y), top row first. */
      async readRGBA(x, y) {
        gl.setRenderTarget(shot)
        gl.render(scene, camera)
        gl.setRenderTarget(null)
        const buf = await gl.readRenderTargetPixelsAsync(shot, 0, 0, w, h)
        const row = window.__backend === 'webgpu' ? y : h - 1 - y
        const i = (row * strideOf(buf, w, h, 4) + x) * 4
        return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
      },
      size: { width: size.width, height: size.height },
    }
    window.__ready = true
    return () => {
      shot.dispose()
      raw.dispose()
      rawMaterial.dispose()
    }
  }, [gl, scene, camera, render, size, fields, output])
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      {/* toneMapped off: the output pass's white must read as 255, not ACES's 226 */}
      <meshBasicNodeMaterial ref={material} map={output} toneMapped={false} />
    </mesh>
  )
}

createRoot(document.getElementById('root')).render(
  <Canvas
    orthographic
    camera={{
      position: [0, 0, 1],
      zoom: 1,
      left: -1,
      right: 1,
      top: 1,
      bottom: -1,
    }}
    frameloop='always'
    dpr={1}
    gl={async (props) => {
      const renderer = new WebGPURenderer({
        ...props,
        antialias: false,
        // `window.__forceWebGL` (set before load) picks the backend; otherwise WebGPU where an adapter answers
        forceWebGL: window.__forceWebGL ?? false,
      })
      await renderer.init()
      window.__backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl'
      return renderer
    }}
  >
    <Fluid />
  </Canvas>,
)
