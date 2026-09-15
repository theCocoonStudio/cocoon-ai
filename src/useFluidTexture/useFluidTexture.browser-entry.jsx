// The page src/useFluidTexture/useFluidTexture.browser.test.js drives: the
// hook in a real Canvas, stepped by hand, its output read back as pixels.
// `window.__opts` (set before load) are extra hook options; `window.__fluid`
// is what the test calls.
import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { useFluidTexture } from './useFluidTexture.js'

function Fluid() {
  const forceRef = useRef(() => ({
    force: window.__force ?? { x: 0, y: 0 },
    center: window.__center ?? { x: 0, y: 0 },
    radius: window.__radius,
  }))
  const { texture, render } = useFluidTexture({
    forceCallbackRef: forceRef,
    fboWidth: 64,
    fboHeight: 64,
    manual: true,
    ...(window.__opts ?? {}),
  })
  const { gl, scene, camera, size } = useThree()
  useEffect(() => {
    const clock = { t: 0, getElapsedTime: () => clock.t }
    const state = { clock, pointer: null }
    window.__fluid = {
      /** Step the simulation n times with a fixed delta. */
      step(n = 1, delta = 1 / 60) {
        for (let i = 0; i < n; i++) {
          clock.t += delta
          render(state, delta)
        }
      },
      /** Draw the output texture to the canvas and return its grey levels, row-major, top row first. */
      read() {
        gl.render(scene, camera)
        const ctx = gl.getContext()
        const w = gl.domElement.width
        const h = gl.domElement.height
        const buf = new Uint8Array(w * h * 4)
        ctx.readPixels(0, 0, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf)
        const grey = []
        for (let y = h - 1; y >= 0; y--)
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4
            grey.push(Math.round((buf[i] + buf[i + 1] + buf[i + 2]) / 3))
          }
        return { width: w, height: h, grey }
      },
      size: { width: size.width, height: size.height },
    }
    window.__ready = true
  }, [gl, scene, camera, render, size])
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      {/* toneMapped off: the output pass's white must read as 255, not ACES's 226 */}
      <meshBasicMaterial map={texture} toneMapped={false} />
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
    gl={{ preserveDrawingBuffer: true, antialias: false }}
    dpr={1}
  >
    <Fluid />
  </Canvas>,
)
