import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRef } from 'react'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import { MorphTargets } from './index.jsx'

const BOX_COUNT = 24 // BoxGeometry(1,1,1) is indexed with 24 vertices

function Scene({
  handle,
  base = <boxGeometry />,
  targets = [new SphereGeometry(1, 8, 6)],
  ...props
}) {
  return (
    <MorphTargets ref={handle} {...props}>
      <mesh name='wrapped'>
        {base}
        {targets.map((g, i) => (
          <primitive key={i} object={g} attach={`userData-target${i}`} />
        ))}
        <meshStandardMaterial />
      </mesh>
    </MorphTargets>
  )
}

async function mount(props = {}) {
  const handle = createRef()
  const renderer = await ReactThreeTestRenderer.create(
    <Scene handle={handle} {...props} />,
  )
  const group = renderer.scene.children[0].instance
  const mesh = group.children.find((c) => c.isMesh)
  return { handle, renderer, group, mesh }
}

afterEach(() => vi.restoreAllMocks())

describe('MorphTargets', () => {
  it('[markup.1] renders a group with the mesh and its material inside unchanged', async () => {
    const { group, mesh } = await mount()
    expect(group.isGroup).toBe(true)
    expect(mesh.name).toBe('wrapped')
    expect(mesh.material.isMeshStandardMaterial).toBe(true)
  })

  it('[markup.2] puts a merged, indexed copy of the base with one morph attribute per target on the mesh', async () => {
    const targets = [
      new SphereGeometry(1, 8, 6),
      new TorusGeometry(1, 0.3, 6, 8),
    ]
    const { mesh } = await mount({ targets })
    const declared = mesh.userData.target0 // sanity: attach worked
    expect(declared).toBe(targets[0])
    const g = mesh.geometry
    expect(g.isBufferGeometry).toBe(true)
    expect(g.index).not.toBeNull()
    expect(g.attributes.position.count).toBe(BOX_COUNT)
    expect(g.morphAttributes.position).toHaveLength(2)
    expect(g.morphAttributes.normal).toHaveLength(2)
    for (const a of [
      ...g.morphAttributes.position,
      ...g.morphAttributes.normal,
    ])
      expect(a.count).toBe(BOX_COUNT)
    // fitted to the sphere: every morph position lies on the unit sphere
    const p = g.morphAttributes.position[0]
    for (let i = 0; i < p.count; i++)
      expect(Math.hypot(p.getX(i), p.getY(i), p.getZ(i))).toBeCloseTo(1, 5)
  })

  it('[markup.2] owns its buffers: nothing is shared with the base geometry', async () => {
    const base = new BoxGeometry()
    const { mesh } = await mount({
      base: <primitive object={base} attach='geometry' />,
    })
    expect(mesh.geometry).not.toBe(base)
    expect(mesh.geometry.attributes.position).not.toBe(base.attributes.position)
    expect(mesh.geometry.attributes.position.array).not.toBe(
      base.attributes.position.array,
    )
    expect(mesh.geometry.index).not.toBe(base.index)
    expect(base.morphAttributes.position).toBeUndefined()
  })

  it('[markup.2] merges a non-indexed base first and fits targets to the merged count', async () => {
    const base = new BoxGeometry().toNonIndexed() // 36 vertices
    const { mesh } = await mount({
      base: <primitive object={base} attach='geometry' />,
    })
    expect(mesh.geometry.index).not.toBeNull()
    expect(mesh.geometry.attributes.position.count).toBe(BOX_COUNT)
    expect(mesh.geometry.morphAttributes.position[0].count).toBe(BOX_COUNT)
  })

  it('[markup.2] [props.4] builds no normal morph attribute when normals is false', async () => {
    const { mesh } = await mount({ normals: false })
    expect(mesh.geometry.morphAttributes.position).toHaveLength(1)
    expect(mesh.geometry.morphAttributes.normal).toBeUndefined()
  })

  it('[markup.3] starts every influence at 0 and names the dictionary target0, target1 ...', async () => {
    const { mesh } = await mount({
      targets: [new SphereGeometry(1, 8, 6), new TorusGeometry(1, 0.3, 6, 8)],
    })
    expect(mesh.morphTargetInfluences).toEqual([0, 0])
    expect(mesh.morphTargetDictionary).toEqual({ target0: 0, target1: 1 })
  })

  it('[markup.4] [states.lower] [props.3] under match lower, a smaller target reduces the base on the mesh', async () => {
    const small = new BufferGeometry()
    small.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3),
    )
    small.setIndex([0, 1, 2, 1, 3, 2])
    const { mesh } = await mount({
      base: <sphereGeometry args={[1, 12, 8]} />,
      targets: [small],
      match: 'lower',
    })
    expect(mesh.geometry.attributes.position.count).toBeLessThanOrEqual(4)
    expect(mesh.geometry.morphAttributes.position[0].count).toBe(
      mesh.geometry.attributes.position.count,
    )
  })

  it('[states.default] [props.3] under the default match, a smaller target is fitted and the base keeps its count', async () => {
    const small = new BufferGeometry()
    small.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    )
    const { mesh } = await mount({ targets: [small] })
    expect(mesh.geometry.attributes.position.count).toBe(BOX_COUNT)
    expect(mesh.geometry.morphAttributes.position[0].count).toBe(BOX_COUNT)
  })

  it('[props.1] uses the targets prop when the mesh carries no target children', async () => {
    const handle = createRef()
    const sphere = new SphereGeometry(1, 8, 6)
    const renderer = await ReactThreeTestRenderer.create(
      <MorphTargets ref={handle} targets={[sphere]}>
        <mesh>
          <boxGeometry />
        </mesh>
      </MorphTargets>,
    )
    const mesh = renderer.scene.children[0].instance.children[0]
    expect(mesh.geometry.morphAttributes.position).toHaveLength(1)
    expect(mesh.morphTargetInfluences).toEqual([0])
  })

  it('[props.1] [slots.2] ignores the targets prop when child targets exist', async () => {
    const handle = createRef()
    const renderer = await ReactThreeTestRenderer.create(
      <MorphTargets
        ref={handle}
        targets={[new SphereGeometry(1, 8, 6), new TorusGeometry()]}
      >
        <mesh>
          <boxGeometry />
          <primitive
            object={new SphereGeometry(1, 8, 6)}
            attach='userData-target0'
          />
        </mesh>
      </MorphTargets>,
    )
    const m = renderer.scene.children[0].instance.children[0]
    expect(m.geometry.morphAttributes.position).toHaveLength(1)
  })

  it('[slots.2] reads child targets contiguously from 0; a gap ends the list', async () => {
    const handle = createRef()
    const renderer = await ReactThreeTestRenderer.create(
      <MorphTargets ref={handle}>
        <mesh>
          <boxGeometry />
          <primitive
            object={new SphereGeometry(1, 8, 6)}
            attach='userData-target0'
          />
          <primitive object={new TorusGeometry()} attach='userData-target2' />
        </mesh>
      </MorphTargets>,
    )
    const m = renderer.scene.children[0].instance.children[0]
    expect(m.geometry.morphAttributes.position).toHaveLength(1)
  })

  it('[contracts.4] warns in development about a child target after a gap', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await ReactThreeTestRenderer.create(
      <MorphTargets>
        <mesh>
          <boxGeometry />
          <primitive
            object={new SphereGeometry(1, 8, 6)}
            attach='userData-target0'
          />
          <primitive object={new TorusGeometry()} attach='userData-target2' />
        </mesh>
      </MorphTargets>,
    )
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/contiguous from target0; ignoring target2/),
    )
  })

  it('[props.2] decimate fits a larger target after edge collapse', async () => {
    const { mesh } = await mount({
      targets: [new SphereGeometry(1, 16, 12)],
      reduce: 'decimate',
    })
    expect(mesh.geometry.morphAttributes.position[0].count).toBe(BOX_COUNT)
    const p = mesh.geometry.morphAttributes.position[0]
    for (let i = 0; i < p.count; i++)
      expect(Math.hypot(p.getX(i), p.getY(i), p.getZ(i))).toBeCloseTo(1, 5)
  })

  describe('[exits.throws]', () => {
    const small = () => {
      const g = new BufferGeometry()
      g.setAttribute(
        'position',
        new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
      )
      return g
    }

    it('throws when the child is not a mesh', async () => {
      await expect(
        ReactThreeTestRenderer.create(
          <MorphTargets targets={[new SphereGeometry(1, 8, 6)]}>
            <group />
          </MorphTargets>,
        ),
      ).rejects.toThrow(/not a mesh/)
    })

    it('throws when no target is found', async () => {
      await expect(
        ReactThreeTestRenderer.create(
          <MorphTargets>
            <mesh>
              <boxGeometry />
            </mesh>
          </MorphTargets>,
        ),
      ).rejects.toThrow(/no target geometry/)
    })

    it('throws when a geometry has no position attribute', async () => {
      await expect(mount({ targets: [new BufferGeometry()] })).rejects.toThrow(
        /no position attribute/,
      )
    })

    it('throws under decimate when a target has fewer vertices than the base', async () => {
      await expect(
        mount({ targets: [small()], reduce: 'decimate' }),
      ).rejects.toThrow(/3 vertices, fewer than the 24/)
    })

    it('[states.render-exit] [props.5] with exit render, leaves the mesh exactly as declared instead', async () => {
      const box = new BoxGeometry()
      const { mesh, handle } = await mount({
        base: <primitive object={box} attach='geometry' />,
        targets: [small()],
        reduce: 'decimate',
        exit: 'render',
      })
      expect(mesh.geometry).toBe(box)
      expect(mesh.morphTargetInfluences).toBeUndefined()
      expect(handle.current.geometry).toBeNull()
      const noTargets = await ReactThreeTestRenderer.create(
        <MorphTargets exit='render'>
          <mesh>
            <primitive object={box} attach='geometry' />
          </mesh>
        </MorphTargets>,
      )
      expect(noTargets.scene.children[0].instance.children[0].geometry).toBe(
        box,
      )
      const notMesh = await ReactThreeTestRenderer.create(
        <MorphTargets exit='render' targets={[small()]}>
          <group name='g' />
        </MorphTargets>,
      )
      expect(notMesh.scene.children[0].instance.children[0].name).toBe('g')
    })
  })

  describe('[effects.1]', () => {
    it('rebuilds when a target changes, carries influences over, and disposes the previous merged geometry', async () => {
      const first = [new SphereGeometry(1, 8, 6)]
      const { renderer, mesh, handle } = await mount({ targets: first })
      const before = mesh.geometry
      const spy = vi.spyOn(before, 'dispose')
      handle.current.set(0, 0.4)
      await renderer.update(
        <Scene handle={handle} targets={[new TorusGeometry(1, 0.3, 6, 8)]} />,
      )
      expect(mesh.geometry).not.toBe(before)
      expect(mesh.geometry.morphAttributes.position).toHaveLength(1)
      expect(mesh.morphTargetInfluences).toEqual([0.4])
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('rebuilds when reduce, match or normals change', async () => {
      const targets = [new SphereGeometry(1, 16, 12)]
      const { renderer, mesh, handle } = await mount({ targets })
      const g1 = mesh.geometry
      await renderer.update(
        <Scene handle={handle} targets={targets} normals={false} />,
      )
      const g2 = mesh.geometry
      expect(g2).not.toBe(g1)
      expect(g2.morphAttributes.normal).toBeUndefined()
      await renderer.update(
        <Scene
          handle={handle}
          targets={targets}
          normals={false}
          reduce='decimate'
        />,
      )
      expect(mesh.geometry).not.toBe(g2)
      const g3 = mesh.geometry
      await renderer.update(
        <Scene
          handle={handle}
          targets={targets}
          normals={false}
          reduce='decimate'
          match='lower'
        />,
      )
      expect(mesh.geometry).not.toBe(g3)
    })

    it('rebuilds when the base geometry changes under the mesh', async () => {
      const targets = [new SphereGeometry(1, 8, 6)]
      const { renderer, mesh, handle } = await mount({ targets })
      const g1 = mesh.geometry
      await renderer.update(
        <Scene
          handle={handle}
          targets={targets}
          base={<sphereGeometry args={[1, 6, 4]} />}
        />,
      )
      expect(mesh.geometry).not.toBe(g1)
      expect(mesh.geometry.attributes.position.count).toBe(
        new SphereGeometry(1, 6, 4).attributes.position.count,
      )
      expect(mesh.geometry.morphAttributes.position[0].count).toBe(
        mesh.geometry.attributes.position.count,
      )
    })

    it('does not rebuild when an unrelated re-render leaves every input the same', async () => {
      const targets = [new SphereGeometry(1, 8, 6)]
      const { renderer, mesh, handle } = await mount({ targets })
      const g1 = mesh.geometry
      const spy = vi.spyOn(g1, 'dispose')
      await renderer.update(<Scene handle={handle} targets={targets} />)
      await renderer.update(
        <Scene handle={handle} targets={targets} exit='render' />,
      )
      expect(mesh.geometry).toBe(g1)
      expect(spy).not.toHaveBeenCalled()
    })

    it('[dispose.merged] disposes the merged geometry on unmount', async () => {
      const { renderer, mesh } = await mount()
      const spy = vi.spyOn(mesh.geometry, 'dispose')
      await renderer.unmount()
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('[dispose.inputs] never disposes a target or a primitive base, on rebuild, handle.dispose or unmount', async () => {
      const base = new BoxGeometry()
      const t1 = new SphereGeometry(1, 8, 6)
      const t2 = new TorusGeometry(1, 0.3, 6, 8)
      const spies = [base, t1, t2].map((g) => vi.spyOn(g, 'dispose'))
      const { renderer, handle } = await mount({
        base: <primitive object={base} attach='geometry' />,
        targets: [t1],
      })
      await renderer.update(
        <Scene
          handle={handle}
          base={<primitive object={base} attach='geometry' />}
          targets={[t2]}
        />,
      )
      handle.current.dispose()
      await renderer.update(
        <Scene
          handle={handle}
          base={<primitive object={base} attach='geometry' />}
          targets={[t1]}
        />,
      )
      await renderer.unmount()
      for (const s of spies) expect(s).not.toHaveBeenCalled()
    })
  })

  describe('[effects.2]', () => {
    // fiber itself warns once about THREE.Clock; only our own warnings count
    const ours = (spy) =>
      spy.mock.calls.flat().filter((m) => String(m).startsWith('MorphTargets:'))
    function bigBase(count) {
      const g = new BufferGeometry()
      g.setAttribute(
        'position',
        new Float32BufferAttribute(new Float32Array(count * 3), 3),
      )
      g.setIndex([0, 1, 2])
      return g
    }
    const tri = () => {
      const g = new BufferGeometry()
      g.setAttribute(
        'position',
        new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
      )
      return g
    }

    it('warns in development when base vertices × targets exceeds one million', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await mount({
        base: <primitive object={bigBase(400_000)} attach='geometry' />,
        targets: [tri(), tri(), tri()],
        normals: false,
      })
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/400000 vertices × 3 targets/),
      )
    })

    it('does not warn below the limit', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await mount({ targets: [new SphereGeometry(1, 8, 6)] })
      expect(ours(warn)).toEqual([])
    })

    it('is absent in production builds', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.resetModules()
      const { MorphTargets: Prod } = await import('./index.jsx')
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await ReactThreeTestRenderer.create(
        <Prod targets={[tri(), tri(), tri()]} normals={false}>
          <mesh>
            <primitive object={bigBase(400_000)} attach='geometry' />
          </mesh>
        </Prod>,
      )
      expect(ours(warn)).toEqual([])
      vi.unstubAllEnvs()
    })
  })

  describe('handle', () => {
    it('[handle.1] [handle.2] exposes the mesh and the merged geometry on it', async () => {
      const { handle, mesh } = await mount()
      expect(handle.current.mesh).toBe(mesh)
      expect(handle.current.geometry).toBe(mesh.geometry)
    })

    it('[handle.3] set writes the influence clamped to 0–1 and ignores an index without a target', async () => {
      const { handle, mesh } = await mount({
        targets: [new SphereGeometry(1, 8, 6), new TorusGeometry(1, 0.3, 6, 8)],
      })
      handle.current.set(0, 0.25)
      handle.current.set(1, 7)
      expect(mesh.morphTargetInfluences).toEqual([0.25, 1])
      handle.current.set(1, -3)
      expect(mesh.morphTargetInfluences).toEqual([0.25, 0])
      handle.current.set(2, 0.5)
      handle.current.set(-1, 0.5)
      expect(mesh.morphTargetInfluences).toEqual([0.25, 0])
    })

    it('[handle.4] [dispose.after] dispose releases the merged geometry, restores the base and clears influences', async () => {
      const box = new BoxGeometry()
      const { handle, mesh } = await mount({
        base: <primitive object={box} attach='geometry' />,
      })
      const merged = mesh.geometry
      const spy = vi.spyOn(merged, 'dispose')
      handle.current.set(0, 0.5)
      handle.current.dispose()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(mesh.geometry).toBe(box)
      expect(mesh.morphTargetInfluences).toBeUndefined()
      expect(handle.current.geometry).toBeNull()
      handle.current.set(0, 1)
      expect(mesh.morphTargetInfluences).toBeUndefined()
    })

    it('[handle.4] disposes nothing new on a second call', async () => {
      const { handle, mesh } = await mount()
      const spy = vi.spyOn(mesh.geometry, 'dispose')
      handle.current.dispose()
      handle.current.dispose()
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('[handle.4] stays inert on an unrelated re-render and rebuilds once an input changes', async () => {
      const box = new BoxGeometry()
      const targets = [new SphereGeometry(1, 8, 6)]
      const { renderer, handle, mesh } = await mount({
        base: <primitive object={box} attach='geometry' />,
        targets,
      })
      handle.current.dispose()
      await renderer.update(
        <Scene
          handle={handle}
          base={<primitive object={box} attach='geometry' />}
          targets={targets}
        />,
      )
      expect(mesh.geometry).toBe(box)
      expect(handle.current.geometry).toBeNull()
      await renderer.update(
        <Scene
          handle={handle}
          base={<primitive object={box} attach='geometry' />}
          targets={targets}
          normals={false}
        />,
      )
      expect(mesh.geometry).not.toBe(box)
      expect(handle.current.geometry).toBe(mesh.geometry)
      expect(mesh.morphTargetInfluences).toEqual([0])
    })

    it('[handle.4] unmount after dispose does not throw', async () => {
      const { renderer, handle } = await mount()
      handle.current.dispose()
      await expect(renderer.unmount()).resolves.toBeUndefined()
    })
  })

  it('[frame.mode] advancing frames changes nothing; the owner drives the influences', async () => {
    const { renderer, mesh, handle } = await mount()
    handle.current.set(0, 0.3)
    await renderer.advanceFrames(3, 16)
    expect(mesh.morphTargetInfluences).toEqual([0.3])
  })

  it('[library.export] is a named export of src/index.js', async () => {
    const lib = await import('../index.js')
    expect(typeof lib.MorphTargets).toBe('function')
    expect(lib.MorphTargets.name).toBe('MorphTargets')
  })
})
