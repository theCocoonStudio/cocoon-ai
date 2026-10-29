// The page src/AgentSceneGroup/AgentSceneGroup.browser.test.js drives (tests.3):
// the site's shape in miniature, one fixed full-viewport Canvas on the WebGPU
// renderer with the tunnel's Out, and the agent's scene mounted through the
// tunnel with the fixture's template. `window.__agent` is what the test calls:
// `emit(event)` feeds the stream the component subscribes to, `facts()` reads
// the scene's state through the handle, and `afterFrame(fn)` reads after one
// animation frame (budget.2).
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import tunnel from 'tunnel-rat'
import { WebGPURenderer } from 'three/webgpu'
import { AgentSceneGroup } from './index.jsx'
import fixture from './fixtures/turn.json'

const t = tunnel()
const TONES = {
  ink: '#141414',
  surface: '#ffffff',
  ground: '#101418',
  accent: '#2a9d8f',
}
const listeners = new Set()
const stream = {
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
const state = {
  readyAt: null,
  compileEvents: [],
  handle: null,
}

window.__agent = {
  emit(event) {
    for (const l of listeners) l(event)
  },
  facts() {
    const h = state.handle
    const root = h && h.root
    const mesh = root && root.children.find((c) => c.uuid === 'mesh-main')
    const scene = root && root.parent
    return {
      readyMs:
        state.readyAt === null ? null : state.readyAt - window.__mountedAt,
      compileEvents: [...state.compileEvents],
      hash: h && h.hash,
      backend: h && h.backend,
      version: h && h.version,
      materials: h ? h.materials.map((m) => m.uuid) : [],
      children: root
        ? root.children.map((c) => ({ type: c.type, uuid: c.uuid }))
        : [],
      colour: mesh ? mesh.material.color.getHex() : null,
      roughness: mesh ? mesh.material.roughness : null,
      width: mesh ? mesh.geometry.parameters.width : null,
      visible: mesh ? mesh.visible : null,
      fogNear: scene && scene.fog ? scene.fog.near : null,
      background: scene && scene.background ? scene.background.getHex() : null,
    }
  },
  afterFrame() {
    return new Promise((resolve) =>
      requestAnimationFrame(() => resolve(window.__agent.facts())),
    )
  },
}

/** The harness waits for `window.__ready`: set once the Canvas's root is up. */
function Ready() {
  useEffect(() => {
    window.__ready = true
  }, [])
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
        <Ready />
      </Canvas>
      <AgentSceneGroup
        tunnel={t}
        document={fixture.template}
        hash={fixture.templateHash}
        tones={TONES}
        stream={stream}
        onReady={() => {
          state.readyAt = performance.now()
        }}
        onCompile={(pending) => {
          state.compileEvents.push(pending)
        }}
        ref={(h) => {
          state.handle = h
        }}
      />
    </>
  )
}

window.__mountedAt = performance.now()
document.getElementById('root').style.cssText =
  'position:fixed;inset:0;width:auto;height:auto'
createRoot(document.getElementById('root')).render(<Page />)
