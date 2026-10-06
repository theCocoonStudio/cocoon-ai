import { describe, expect, it, vi } from 'vitest'
import { RenderTarget, Texture, Vector2 } from 'three/webgpu'
import { texture, uniform } from 'three/tsl'
import { ShaderPass } from './ShaderPass.js'
import {
  advectionMaterial,
  forceMaterial,
  poissonMaterial,
  pressureMaterial,
  viscousMaterial,
} from './tsl/passes.js'
import {
  bindWall,
  boundaryChildren,
  disposeBoundary,
  followWall,
} from './boundary.js'

// The pass is the unit under the hook: a TSL node material, a quad, a scene, a
// camera and a target, with the input nodes it reads kept by name. No GL is
// needed for any of this, so these run in Node: a node material compiles only
// when a renderer builds it. The uniform tests are the probes that settled PR
// #29's reviews, in the port's terms: the hook drives a pass by repointing a
// texture node and by mutating a uniform's value, and nothing is shared
// between two passes unless the hook shares it.

/** The uniform nodes the hook shares, fresh. */
function nodes() {
  return {
    boundarySpace: uniform(new Vector2()),
    px: uniform(new Vector2(1, 1)),
    fboSize: uniform(new Vector2(8, 8)),
    force: uniform(new Vector2()),
    center: uniform(new Vector2()),
    scale: uniform(new Vector2(100, 100)),
    dt: uniform(0.014),
    v: uniform(30),
    isBFECC: uniform(1, 'bool'),
  }
}

function viscousPass(u = nodes()) {
  const inputs = {
    velocity: texture(new Texture()),
    velocity_new: texture(new Texture()),
    v: u.v,
    dt: u.dt,
  }
  return new ShaderPass({
    material: viscousMaterial({
      ...inputs,
      px: u.px,
      boundarySpace: u.boundarySpace,
    }),
    inputs,
    children: boundaryChildren,
    onDispose: disposeBoundary,
  })
}

describe('ShaderPass inputs', () => {
  it('owns its inputs: two passes from one builder read two force nodes, and neither sees the other', () => {
    const a = new ShaderPass({
      material: forceMaterial(nodes()),
      inputs: { force: uniform(new Vector2(1, 1)) },
    })
    const b = new ShaderPass({
      material: forceMaterial(nodes()),
      inputs: { force: uniform(new Vector2(2, 2)) },
    })
    expect(a.uniforms).not.toBe(b.uniforms)
    expect(a.uniforms.force.value.x).toBe(1)
    expect(b.uniforms.force.value.x).toBe(2)
  })

  it('repoints a texture node per step and leaves every other input alone', () => {
    const p = viscousPass()
    const before = Object.keys(p.uniforms).sort()
    const next = new Texture()
    p.updateUniforms({ velocity_new: { value: next } })
    expect(Object.keys(p.uniforms).sort()).toEqual(before)
    expect(p.uniforms.velocity_new.value).toBe(next)
    expect(p.uniforms.v.value).toBe(30)
  })

  it('ignores a name it does not read, so a pass may be given the whole table', () => {
    const p = viscousPass()
    expect(() => p.updateUniforms({ nothing: { value: 1 } })).not.toThrow()
    expect(p.uniforms.nothing).toBeUndefined()
  })

  it('sees a write to a shared uniform node, which is how the hook drives scalars and vectors', () => {
    const u = nodes()
    const p = viscousPass(u)
    u.dt.value = 0.02
    expect(p.uniforms.dt.value).toBe(0.02)
    u.px.value.set(0.5, 0.25)
    expect(p.uniforms.dt).toBe(u.dt)
  })
})

describe('ShaderPass objects', () => {
  it('builds the wall as a child of every pass that writes velocity or pressure, drawn after the quad', () => {
    const u = nodes()
    const builders = [
      () =>
        advectionMaterial({
          velocity: texture(new Texture()),
          dt: u.dt,
          isBFECC: u.isBFECC,
          fboSize: u.fboSize,
          px: u.px,
        }),
      () =>
        viscousMaterial({
          velocity: texture(new Texture()),
          velocity_new: texture(new Texture()),
          v: u.v,
          px: u.px,
          dt: u.dt,
          boundarySpace: u.boundarySpace,
        }),
      () =>
        poissonMaterial({
          pressure: texture(new Texture()),
          divergence: texture(new Texture()),
          px: u.px,
          boundarySpace: u.boundarySpace,
        }),
      () =>
        pressureMaterial({
          pressure: texture(new Texture()),
          velocity: texture(new Texture()),
          px: u.px,
          dt: u.dt,
          boundarySpace: u.boundarySpace,
        }),
    ]
    for (const build of builders) {
      const p = new ShaderPass({
        material: build(),
        children: boundaryChildren,
        onDispose: disposeBoundary,
      })
      expect(p.children.isLineSegments).toBe(true)
      expect(p.children.material).not.toBe(p.material)
      expect(p.children.geometry.attributes.inward.count).toBe(8)
      expect(p.scene.children).toContain(p.children)
      // drawn after the quad: added to the scene second
      expect(p.scene.children.indexOf(p.children)).toBeGreaterThan(
        p.scene.children.indexOf(p.mesh),
      )
    }
  })

  it('the wall follows the input it is bound to: bindWall sets the nodes, followWall tracks a swap', () => {
    const u = nodes()
    const p = viscousPass(u)
    bindWall(p, 'velocity_new', u.px, -1)
    const wall = p.children.userData.nodes
    expect(wall.field.value).toBe(p.uniforms.velocity_new.value)
    expect(wall.scale.value).toBe(-1)
    expect(wall.px.value).toBe(u.px.value)
    const next = new Texture()
    p.updateUniforms({ velocity_new: { value: next } })
    expect(wall.field.value).not.toBe(next)
    followWall(p, 'velocity_new')
    expect(wall.field.value).toBe(next)
  })

  it('takes a render target through setFBO and reports it', () => {
    const fbo = new RenderTarget(4, 4)
    const p = new ShaderPass({ material: forceMaterial(nodes()) }).setFBO(fbo)
    expect(p.fbo).toBe(fbo)
    fbo.dispose()
  })

  it('swaps geometry through updateGeometry and disposes the old one only when told', () => {
    const p = new ShaderPass({ material: forceMaterial(nodes()) })
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
    const p = viscousPass()
    const material = vi.spyOn(p.material, 'dispose')
    const geometry = vi.spyOn(p.geometry, 'dispose')
    const child = vi.spyOn(p.children.material, 'dispose')
    p.dispose(true, false, false, true)
    expect(material).toHaveBeenCalledTimes(1)
    expect(geometry).not.toHaveBeenCalled()
    expect(child).toHaveBeenCalledTimes(1)
  })

  it('renders into its target and restores the default target after', () => {
    const fbo = new RenderTarget(4, 4)
    const p = new ShaderPass({ material: forceMaterial(nodes()) }).setFBO(fbo)
    const calls = []
    const renderer = {
      autoClear: true,
      setRenderTarget: (t) => calls.push(['target', t]),
      render: (s, c) => calls.push(['render', s, c]),
    }
    p.render(renderer)
    expect(calls.map((c) => c[0])).toEqual(['target', 'render', 'target'])
    expect(calls[0][1]).toBe(fbo)
    expect(calls[2][1]).toBeNull()
    expect(calls[1][1]).toBe(p.scene)
    fbo.dispose()
  })

  it('a pass with clear off renders with autoClear off and restores it; a pass with clear on leaves it', () => {
    const seen = []
    const renderer = {
      autoClear: true,
      setRenderTarget() {},
      render() {
        seen.push(this.autoClear)
      },
    }
    new ShaderPass({ material: forceMaterial(nodes()), clear: false }).render(
      renderer,
    )
    expect(seen).toEqual([false])
    expect(renderer.autoClear).toBe(true)
    new ShaderPass({ material: forceMaterial(nodes()) }).render(renderer)
    expect(seen).toEqual([false, true])
  })
})
