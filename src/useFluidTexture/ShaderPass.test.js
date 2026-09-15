import { describe, expect, it, vi } from 'vitest'
import { Vector2, WebGLRenderTarget } from 'three'
import { ShaderPass } from './ShaderPass.js'
import { forcePassConfig } from './ForcePass.canvas'
import { viscousPassConfig } from './ViscousPass.canvas'
import { advectionPassConfig } from './AdvectionPass.canvas'
import { pressurePassConfig } from './PressurePass.canvas'

// The pass is the unit under the hook: a material, a quad, a scene, a camera
// and a target, with a uniforms table it owns. No GL is needed for any of
// this, so these run in Node. The first three tests are the probes that
// settled PR #29's reviews, kept so the faults they caught fail here.

describe('ShaderPass uniforms', () => {
  it('owns its table: two passes from one config write to two objects, and the config is untouched', () => {
    const a = new ShaderPass({ ...forcePassConfig }).updateUniforms({
      force: { value: new Vector2(1, 1) },
    })
    const b = new ShaderPass({ ...forcePassConfig }).updateUniforms({
      force: { value: new Vector2(2, 2) },
    })
    expect(a.uniforms).not.toBe(b.uniforms)
    expect(a.material.uniforms).not.toBe(b.material.uniforms)
    expect(a.material.uniforms.force.value.x).toBe(1)
    expect(b.material.uniforms.force.value.x).toBe(2)
    expect(forcePassConfig.materialConfig.uniforms.force.value.x).toBe(0)
  })

  it('binds entries as given, without wrapping, and the material reads the same table object', () => {
    const p = new ShaderPass({ ...viscousPassConfig }).updateUniforms({
      v: { value: 30 },
    })
    expect(p.material.uniforms).toBe(p.uniforms)
    expect(p.material.uniforms.v).toEqual({ value: 30 })
  })

  it('keeps every other uniform across a per-frame update of one', () => {
    const p = new ShaderPass({ ...viscousPassConfig }).updateUniforms({
      boundarySpace: { value: new Vector2() },
      v: { value: 30 },
      px: { value: new Vector2(1, 1) },
      dt: { value: 0.014 },
    })
    const before = Object.keys(p.material.uniforms).sort()
    p.updateUniforms({ velocity_new: { value: null } })
    expect(Object.keys(p.material.uniforms).sort()).toEqual(before)
    expect(p.material.uniforms.v.value).toBe(30)
  })

  it('sees a write to a shared value object, which is how the hook drives scalars', () => {
    const dt = { value: 0.014 }
    const p = new ShaderPass({ ...viscousPassConfig }).updateUniforms({ dt })
    dt.value = 0.02
    expect(p.material.uniforms.dt.value).toBe(0.02)
  })

  it('starts the table fresh only when asked, at construction', () => {
    const p = new ShaderPass({ ...viscousPassConfig }).updateUniforms({
      v: { value: 1 },
    })
    p.updateUniforms({ dt: { value: 2 } }, true)
    expect(Object.keys(p.material.uniforms)).toEqual(['dt'])
  })
})

describe('ShaderPass objects', () => {
  it('builds the wall as a child of the advection pass and of the pressure pass, the last to write velocity', () => {
    for (const config of [advectionPassConfig, pressurePassConfig]) {
      const p = new ShaderPass({ ...config })
      expect(p.children.isLineSegments).toBe(true)
      expect(p.children.material).not.toBe(p.material)
      expect(p.scene.children).toContain(p.children)
      // drawn after the quad: added to the scene second
      expect(p.scene.children.indexOf(p.children)).toBeGreaterThan(
        p.scene.children.indexOf(p.mesh),
      )
    }
  })

  it('takes a render target through setFBO and reports it', () => {
    const fbo = new WebGLRenderTarget(4, 4)
    const p = new ShaderPass({ ...forcePassConfig }).setFBO(fbo)
    expect(p.fbo).toBe(fbo)
    fbo.dispose()
  })

  it('swaps geometry through updateGeometry and disposes the old one only when told', () => {
    const p = new ShaderPass({ ...forcePassConfig })
    const first = p.geometry
    const spy = vi.spyOn(first, 'dispose')
    p.updateGeometry(null) // null: keep what is there
    expect(p.geometry).toBe(first)
    expect(spy).not.toHaveBeenCalled()
    p.updateGeometry(undefined) // undefined: a new default plane, the old kept alive
    expect(p.geometry).not.toBe(first)
    expect(p.mesh.geometry).toBe(p.geometry)
    expect(spy).not.toHaveBeenCalled()
    const second = p.geometry
    const spy2 = vi.spyOn(second, 'dispose')
    p.updateGeometry(undefined, true) // and with dispose: the replaced one goes
    expect(spy2).toHaveBeenCalledTimes(1)
  })

  it('disposes what the flags name and hands the children to onDispose', () => {
    const p = new ShaderPass({ ...advectionPassConfig })
    const material = vi.spyOn(p.material, 'dispose')
    const geometry = vi.spyOn(p.geometry, 'dispose')
    const child = vi.spyOn(p.children.material, 'dispose')
    p.dispose(true, false, false, true)
    expect(material).toHaveBeenCalledTimes(1)
    expect(geometry).not.toHaveBeenCalled()
    expect(child).toHaveBeenCalledTimes(1)
  })

  it('renders into its target and restores the default target after', () => {
    const fbo = new WebGLRenderTarget(4, 4)
    const p = new ShaderPass({ ...forcePassConfig }).setFBO(fbo)
    const calls = []
    const renderer = {
      setRenderTarget: (t) => calls.push(['target', t]),
      render: (s, c) => calls.push(['render', s, c]),
    }
    const before = vi.fn()
    p.setOnBeforeRender(before).render(renderer)
    expect(calls.map((c) => c[0])).toEqual(['target', 'render', 'target'])
    expect(calls[0][1]).toBe(fbo)
    expect(calls[2][1]).toBeNull()
    expect(calls[1][1]).toBe(p.scene)
    expect(before).toHaveBeenCalledWith(p)
    fbo.dispose()
  })
})
