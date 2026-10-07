// The page src/useFluidTexture/useFluidTexture.demo.browser.test.js drives:
// the site's shape in miniature, one fixed full-viewport Canvas on the WebGPU
// renderer with a perspective camera and the tunnel's Out, and the fluid's
// demo in a div at `window.__rect` (viewport px). `window.__demo` is what the
// test calls: a readback of the whole canvas as grey, a pointer stroke across
// the demo, and a setter that drives the sidebar's inputs the way a hand would.
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import tunnel from 'tunnel-rat'
import {
  RenderTarget,
  RGBAFormat,
  UnsignedByteType,
  WebGPURenderer,
} from 'three/webgpu'
import { FluidTextureDemo } from './useFluidTexture.demo.jsx'

const t = tunnel()
const rect = window.__rect ?? { x: 16, y: 8, width: 288, height: 160 }

function Readback() {
  const { gl, scene, camera, size } = useThree()
  useEffect(() => {
    const w = gl.domElement.width
    const h = gl.domElement.height
    const shot = new RenderTarget(w, h, {
      type: UnsignedByteType,
      format: RGBAFormat,
      depthBuffer: true,
    })
    const strideOf = (buf) => (h > 1 ? (buf.length - w * 4) / (h - 1) / 4 : w)
    window.__demo = {
      /** The canvas as grey levels, row-major, top row first, with the alpha beside it. */
      async read() {
        gl.setRenderTarget(shot)
        gl.render(scene, camera)
        gl.setRenderTarget(null)
        const buf = await gl.readRenderTargetPixelsAsync(shot, 0, 0, w, h)
        const stride = strideOf(buf)
        const topFirst = window.__backend === 'webgpu'
        const grey = []
        const alpha = []
        for (let row = 0; row < h; row++) {
          const y = topFirst ? row : h - 1 - row
          for (let x = 0; x < w; x++) {
            const i = (y * stride + x) * 4
            grey.push(Math.round((buf[i] + buf[i + 1] + buf[i + 2]) / 3))
            alpha.push(buf[i + 3])
          }
        }
        return { width: w, height: h, grey, alpha }
      },
      /** A pointer stroke across the canvas, in viewport px, as the events fiber listens for. */
      stroke(points) {
        for (const [x, y] of points) {
          gl.domElement.dispatchEvent(
            new PointerEvent('pointermove', {
              clientX: x,
              clientY: y,
              bubbles: true,
              pointerType: 'mouse',
            }),
          )
        }
      },
      /** Set a sidebar input by its label, through the DOM, as React sees a user's change. */
      set(label, value) {
        const el = [
          ...document.querySelectorAll('.cocoon-demo__settings label'),
        ].find((l) => l.textContent === label)
        if (!el) throw new Error(`no setting labelled "${label}"`)
        const input = document.getElementById(el.htmlFor)
        const proto = Object.getPrototypeOf(input)
        const setter = Object.getOwnPropertyDescriptor(
          proto,
          input.type === 'checkbox' ? 'checked' : 'value',
        ).set
        setter.call(input, value)
        input.dispatchEvent(
          new Event(input.tagName === 'SELECT' ? 'change' : 'input', {
            bubbles: true,
          }),
        )
      },
      size: { width: size.width, height: size.height },
      rect,
      /** The stage's rectangle as measured, which shrinks when the sidebar is open. */
      stage() {
        const r = document
          .querySelector('.cocoon-demo__probe')
          .getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      },
    }
    window.__ready = true
    return () => shot.dispose()
  }, [gl, scene, camera, size])
  return null
}

function Page() {
  return (
    <>
      <Canvas
        style={{ position: 'fixed', inset: 0 }}
        camera={{ position: [0, 0, 5], fov: 50 }}
        frameloop='always'
        dpr={1}
        gl={async (props) => {
          const renderer = new WebGPURenderer({
            ...props,
            forceWebGL: window.__forceWebGL ?? false,
          })
          await renderer.init()
          window.__backend = renderer.backend.isWebGPUBackend
            ? 'webgpu'
            : 'webgl'
          return renderer
        }}
      >
        <t.Out />
        <Readback />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
        }}
      >
        <FluidTextureDemo
          tunnel={t}
          openSettings={window.__openSettings ?? false}
        />
      </div>
    </>
  )
}

document.getElementById('root').style.cssText =
  'position:fixed;inset:0;width:auto;height:auto'
createRoot(document.getElementById('root')).render(<Page />)
