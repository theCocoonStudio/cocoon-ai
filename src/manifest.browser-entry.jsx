// The page src/manifest.browser.test.js drives: the consumer's shape (the
// site's), one fixed full-viewport Canvas outside the page tree on the WebGPU
// renderer, a tunnel whose Out sits in it, a theme, a loader element, and every
// manifest entry rendered through its demo the way the consumer will, each in
// a div of its own at a known rectangle (src/manifest.spec.md, tests.1).
// `window.__fit` is what the test reads: per entry, whether it mounted, its
// loader's presence, when onReady fired against the mount, the handle's facts,
// the sidebar's labels; and the Canvas's scene child count.
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import tunnel from 'tunnel-rat'
import { WebGPURenderer } from 'three/webgpu'
import { demos } from './manifest.js'

const t = tunnel()
export const RECT = { x: 16, width: 288, height: 160, gap: 16 }
const rectOf = (i) => ({
  x: RECT.x,
  y: RECT.gap / 2 + i * (RECT.height + RECT.gap),
  width: RECT.width,
  height: RECT.height,
})
const state = Object.fromEntries(
  demos.map((e) => [e.name, { readyAt: null, handle: null }]),
)

function SceneFacts() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    window.__fit = {
      entries: () =>
        demos.map((e, i) => {
          const el = document.getElementById(`demo-${e.name}`)
          const stage = el?.querySelector('.cocoon-demo__stage')
          const h = state[e.name].handle
          return {
            name: e.name,
            scene: e.scene,
            mounted: !!el?.querySelector('.cocoon-demo'),
            loader: !!stage?.querySelector(':scope > .loader'),
            readyMs:
              state[e.name].readyAt === null
                ? null
                : state[e.name].readyAt - window.__mountedAt,
            handle: h
              ? {
                  root: !!h.root?.isGroup,
                  materials: h.materials.length,
                  compile: typeof h.compile,
                }
              : null,
            labels: [
              ...(el?.querySelectorAll('.cocoon-demo__settings label') ?? []),
            ]
              .filter((l) => !l.closest('.cocoon-demo__vector'))
              .map((l) => l.textContent),
            rect: rectOf(i),
          }
        }),
      sceneChildren: () => scene.children.length,
      /** Set a sidebar input of one demo by its label, through the DOM, as React sees a user's change. */
      set(name, label, value) {
        const el = document.getElementById(`demo-${name}`)
        const l = [...el.querySelectorAll('.cocoon-demo__settings label')].find(
          (x) => x.textContent === label,
        )
        if (!l) throw new Error(`${name}: no setting labelled "${label}"`)
        const input = document.getElementById(l.htmlFor)
        const setter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(input),
          input.type === 'checkbox' ? 'checked' : 'value',
        ).set
        setter.call(input, value)
        input.dispatchEvent(
          new Event(input.tagName === 'SELECT' ? 'change' : 'input', {
            bubbles: true,
          }),
        )
      },
    }
    window.__ready = true
  }, [scene])
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
        <SceneFacts />
      </Canvas>
      {demos.map((entry, i) => {
        const Demo = entry.demo
        const r = rectOf(i)
        return (
          <div
            key={entry.name}
            id={`demo-${entry.name}`}
            style={{
              position: 'absolute',
              left: r.x,
              top: r.y,
              width: r.width,
              height: r.height,
            }}
          >
            <Demo
              {...(entry.scene ? { tunnel: t } : {})}
              theme='site'
              demoContainerClass='site-demo'
              openSettings
              loader={<div className='loader'>loading</div>}
              onReady={() => {
                state[entry.name].readyAt = performance.now()
              }}
              ref={(h) => {
                state[entry.name].handle = h
              }}
            />
          </div>
        )
      })}
    </>
  )
}

window.__mountedAt = performance.now()
document.getElementById('root').style.cssText =
  'position:fixed;inset:0;width:auto;height:auto'
createRoot(document.getElementById('root')).render(<Page />)
