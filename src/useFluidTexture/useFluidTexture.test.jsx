import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { RawShaderMaterial, ShaderMaterial } from 'three'
import { useFluidTexture } from './useFluidTexture.js'

// The hook in @react-three/test-renderer. Its GL is a mock, so three's own
// draw path cannot run the passes; each test stubs the renderer's two draw
// calls and tests the hook's logic around them: what it returns, what it
// builds once, when it steps, what it disposes. The simulation's output is
// tested in the browser, useFluidTexture.browser.test.js.

// What the hook returned, reported from an effect rather than assigned during render.
let latest = null
function Probe(props) {
  const out = useFluidTexture(props)
  useEffect(() => {
    latest = out
  })
  return (
    <mesh>
      <planeGeometry />
      <meshBasicMaterial map={out.texture} />
    </mesh>
  )
}

const fc = () => ({ force: { x: 0, y: 0 }, center: { x: 0, y: 0 } })

/** Mount with the draw calls stubbed; returns the renderer, the gl and a list of targets rendered into. */
async function mount(props = {}) {
  const renderer = await ReactThreeTestRenderer.create(<Probe {...props} />)
  const gl = renderer.scene.instance.__r3f.root.getState().gl
  const targets = []
  vi.spyOn(gl, 'setRenderTarget').mockImplementation((t) => targets.push(t))
  vi.spyOn(gl, 'render').mockImplementation(() => {})
  return { renderer, gl, targets }
}

afterEach(() => vi.restoreAllMocks())

describe('useFluidTexture', () => {
  it('returns the output texture, a render callback and the fields', async () => {
    const { renderer } = await mount({ forceCallbackRef: { current: fc } })
    expect(latest.texture.isTexture).toBe(true)
    expect(typeof latest.render).toBe('function')
    const { fields } = latest
    expect(fields.velocity.isTexture).toBe(true)
    expect(fields.pressure.isTexture).toBe(true)
    expect(fields.divergence.isTexture).toBe(true)
    expect(fields.velocity).not.toBe(latest.texture)
    // pressure alternates between two targets: after an odd number of iterations the getter follows it
    const before = fields.pressure
    await renderer.advanceFrames(1, 16)
    expect(fields.pressure.isTexture).toBe(true)
    expect(fields.velocity).toBe(latest.fields.velocity) // stable identity
    void before
    await renderer.unmount()
  })

  it('builds its passes once: a re-render constructs no new material', async () => {
    const { renderer } = await mount({ forceCallbackRef: { current: fc } })
    // Every ShaderMaterial and RawShaderMaterial runs setValues in its constructor.
    const constructed = vi.spyOn(ShaderMaterial.prototype, 'setValues')
    await renderer.update(
      <Probe forceCallbackRef={{ current: fc }} viscous={31} />,
    )
    expect(constructed).not.toHaveBeenCalled()
    await renderer.unmount()
  })

  it('steps five warm-up frames on mount even when manual or paused, and none after', async () => {
    const { renderer, targets } = await mount({
      forceCallbackRef: { current: fc },
      manual: true,
    })
    await renderer.advanceFrames(5, 16)
    const afterWarmup = targets.length
    expect(afterWarmup).toBeGreaterThan(0)
    await renderer.advanceFrames(3, 16)
    expect(targets.length).toBe(afterWarmup)
    await renderer.unmount()
  })

  it('in auto mode keeps stepping after the warm-up, and pause stops it', async () => {
    const pauseRef = { current: false }
    const { renderer, targets } = await mount({
      forceCallbackRef: { current: fc },
      pauseRef,
    })
    await renderer.advanceFrames(6, 16)
    const n = targets.length
    await renderer.advanceFrames(1, 16)
    expect(targets.length).toBeGreaterThan(n)
    pauseRef.current = true
    const m = targets.length
    await renderer.advanceFrames(2, 16)
    expect(targets.length).toBe(m)
    await renderer.unmount()
  })

  it('steps every runEvery frames, the warm-up counted in frames rather than steps', async () => {
    const { renderer, targets } = await mount({
      forceCallbackRef: { current: fc },
      runEvery: 3,
    })
    await renderer.advanceFrames(5, 16) // frames 0..4: steps at 0 and 3
    const perStep = targets.length / 2
    expect(Number.isInteger(perStep)).toBe(true)
    const n = targets.length
    await renderer.advanceFrames(3, 16) // frames 5..7: one step, at 6
    expect(targets.length - n).toBe(perStep)
    await renderer.unmount()
  })

  it('calls the force callback with delta, clock time, pointer and pointer diff, and scales the force', async () => {
    const seen = []
    const ref = {
      current: (...args) => (
        seen.push(args),
        { force: { x: 1, y: 0 }, center: { x: 0.5, y: 0.5 } }
      ),
    }
    const { renderer } = await mount({ forceCallbackRef: ref, forceValue: 2 })
    await renderer.advanceFrames(1, 16)
    expect(seen).toHaveLength(1)
    const [delta, time, pointer, diff] = seen[0]
    expect(typeof delta).toBe('number')
    expect(typeof time).toBe('number')
    expect(pointer).toHaveProperty('x')
    expect(diff).toHaveProperty('x')
    await renderer.unmount()
  })

  it('falls back to the pointer-diff callback when no ref is given', async () => {
    const { renderer, targets } = await mount()
    await expect(renderer.advanceFrames(1, 16)).resolves.toBeUndefined()
    expect(targets.length).toBeGreaterThan(0)
    await renderer.unmount()
  })

  it('renders the manual callback on demand', async () => {
    const { renderer, gl, targets } = await mount({
      forceCallbackRef: { current: fc },
      manual: true,
    })
    await renderer.advanceFrames(5, 16)
    const n = targets.length
    latest.render(
      {
        clock: { getElapsedTime: () => 1 },
        pointer: {
          x: 0,
          y: 0,
          clone() {
            return { ...this }
          },
        },
      },
      0.016,
    )
    expect(targets.length).toBeGreaterThan(n)
    expect(gl.render).toHaveBeenCalled()
    await renderer.unmount()
  })

  it('disposes every pass material and the boundary on unmount', async () => {
    const { renderer } = await mount({ forceCallbackRef: { current: fc } })
    const disposed = vi.spyOn(ShaderMaterial.prototype, 'dispose')
    const disposedRaw = vi.spyOn(RawShaderMaterial.prototype, 'dispose')
    await renderer.unmount()
    // eight passes plus the advection boundary's material; RawShaderMaterial extends ShaderMaterial, so both spies see it
    expect(
      disposed.mock.calls.length + disposedRaw.mock.calls.length,
    ).toBeGreaterThanOrEqual(9)
  })

  it('two instances mount together and return two textures', async () => {
    const seen = []
    function Two() {
      const a = useFluidTexture({
        forceCallbackRef: { current: fc },
        fboWidth: 8,
        fboHeight: 8,
      })
      const b = useFluidTexture({
        forceCallbackRef: { current: fc },
        fboWidth: 16,
        fboHeight: 16,
      })
      useEffect(() => {
        seen.push([a.texture, b.texture])
      })
      return null
    }
    const renderer = await ReactThreeTestRenderer.create(<Two />)
    const [a, b] = seen[0]
    expect(a).not.toBe(b)
    await renderer.unmount()
  })
})
