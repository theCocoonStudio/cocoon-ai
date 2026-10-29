import { createRef } from 'react'
import { renderToString } from 'react-dom/server'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import tunnel from 'tunnel-rat'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentSceneGroup, VERSION, validateTones } from './index.jsx'
import { AgentSceneGroup as Exported } from '../index.js'
import fixture from './fixtures/turn.json'

// tests.2: the test renderer with a mocked GL (compileAsync stubbed, the backend declared), the
// component sent through a tunnel whose Out sits in the same root, the fixture the service
// recorded (fixtures/turn.json) replayed through a fake stream.

const TONES = Object.freeze({
  ink: '#141414',
  surface: '#ffffff',
  ground: '#101418',
  accent: '#2a9d8f',
})
const template = () => structuredClone(fixture.template)
const turn = (n) => fixture.turns[n]
const changes = (n) => turn(n).events.filter((e) => e.type === 'change')
const fakeStream = () => {
  const listeners = new Set()
  return {
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    emit(e) {
      for (const l of listeners) l(e)
    },
    get size() {
      return listeners.size
    },
  }
}
const glMock = (over = {}) => ({
  gl: {
    compileAsync: vi.fn(async () => {}),
    backend: { isWebGPUBackend: true },
    ...over,
  },
})
const emit = (stream, e) =>
  ReactThreeTestRenderer.act(async () => {
    stream.emit(e)
  })

async function mount(props = {}, opts = glMock()) {
  const t = tunnel()
  const handle = createRef()
  const stream = fakeStream()
  const element = (p) => (
    <>
      <AgentSceneGroup
        tunnel={t}
        document={template()}
        hash={fixture.templateHash}
        tones={TONES}
        stream={stream}
        compile={false}
        ref={handle}
        {...p}
      />
      <t.Out />
    </>
  )
  const renderer = await ReactThreeTestRenderer.create(element(props), opts)
  return {
    renderer,
    handle,
    stream,
    t,
    gl: opts.gl,
    update: (p) => renderer.update(element({ ...props, ...p })),
    get group() {
      return handle.current.root
    },
    get host() {
      return renderer.scene.instance
    },
  }
}

afterEach(() => vi.restoreAllMocks())

describe('AgentSceneGroup', () => {
  it("[markup.1] the group holds the document's objects as its children, nothing wrapped around them", async () => {
    const { group, handle, renderer } = await mount()
    expect(group.type).toBe('Group')
    expect(group.children.map((c) => c.type)).toEqual(['Mesh', 'AmbientLight'])
    expect(group.children.map((c) => c.uuid)).toEqual([
      'mesh-main',
      'light-ambient',
    ])
    expect(handle.current.root).toBe(group)
    expect(renderer.scene.children.map((c) => c.instance.type)).toEqual([
      'Group',
    ])
    await renderer.unmount()
  })

  it("[markup.2] [dispose.after] the document's background and fog land on the Canvas's scene while mounted and are restored on unmount", async () => {
    const { host, renderer } = await mount()
    expect(host.background.getHex()).toBe(fixture.template.object.background)
    expect(host.fog).toBeNull()
    await renderer.unmount()
    expect(host.background).toBeNull()
    expect(host.fog).toBeNull()
  })

  it('[handle.1] [handle.2] [handle.4] [handle.5] [handle.6] the handle: root, materials, hash, backend, version', async () => {
    const { handle, group, renderer } = await mount()
    const h = handle.current
    expect(h.root).toBe(group)
    expect(h.materials.map((m) => m.uuid)).toEqual(['material-main'])
    expect(h.hash).toBe(fixture.templateHash)
    expect(h.backend).toBe('webgpu')
    expect(h.version).toBe(VERSION)
    expect(VERSION).toBe(fixture.version)
    await renderer.unmount()
  })

  it('[handle.5] the backend reads webgl when the renderer has no WebGPU backend', async () => {
    const { handle, renderer } = await mount(
      {},
      glMock({ backend: { isWebGPUBackend: false } }),
    )
    expect(handle.current.backend).toBe('webgl')
    await renderer.unmount()
  })

  it('[handle.3] [callbacks.1] [props.7] compile is one promise, idempotent, compiling the group against the scene and camera; onReady fires once; with compile false nothing compiles until the page asks', async () => {
    const onReady = vi.fn()
    const { handle, gl, group, host, renderer } = await mount({ onReady })
    expect(gl.compileAsync).not.toHaveBeenCalled()
    const p1 = handle.current.compile()
    const p2 = handle.current.compile()
    expect(p1).toBe(p2)
    await ReactThreeTestRenderer.act(async () => p1)
    expect(gl.compileAsync).toHaveBeenCalledTimes(1)
    expect(gl.compileAsync.mock.calls[0][0]).toBe(group)
    expect(gl.compileAsync.mock.calls[0][2]).toBe(host)
    expect(onReady).toHaveBeenCalledTimes(1)
    await ReactThreeTestRenderer.act(async () => handle.current.compile())
    expect(onReady).toHaveBeenCalledTimes(1)
    await renderer.unmount()
  })

  it('[props.7] compile defaults to true: the mount compiles and onReady fires', async () => {
    const onReady = vi.fn()
    const { gl, renderer } = await mount({ compile: undefined, onReady })
    await ReactThreeTestRenderer.act(async () => {})
    expect(gl.compileAsync).toHaveBeenCalledTimes(1)
    expect(onReady).toHaveBeenCalledTimes(1)
    await renderer.unmount()
  })

  it('[effects.2] [refs.1] [refs.4] the recorded turn applied through the stream: a set lands on the material, an add appends the light (compiled behind onCompile true then false), the hash follows each event; a say changes nothing', async () => {
    const onCompile = vi.fn()
    const { handle, stream, group, gl, renderer } = await mount({ onCompile })
    expect(stream.size).toBe(1)
    for (const e of turn(0).events) await emit(stream, e)
    const mesh = group.children[0]
    expect(mesh.material.color.getHex()).toBe(0xff0000)
    expect(mesh.material.roughness).toBe(0.2)
    expect(group.children.map((c) => c.uuid)).toEqual([
      'mesh-main',
      'light-ambient',
      'slot:light.key',
    ])
    expect(group.children[2].type).toBe('PointLight')
    expect(onCompile.mock.calls.map((c) => c[0])).toEqual([true, false])
    expect(gl.compileAsync).toHaveBeenCalledTimes(1)
    expect(gl.compileAsync.mock.calls[0][0]).toBe(group.children[2])
    expect(handle.current.hash).toBe(changes(0).at(-1).hash)
    expect(handle.current.materials.map((m) => m.uuid)).toEqual([
      'material-main',
    ])
    await renderer.unmount()
  })

  it("[effects.2] a remove takes the node out and disposes it; a fog set reaches the Canvas's scene; a size set rebuilds the geometry", async () => {
    const { handle, stream, group, host, renderer } = await mount()
    for (const e of turn(0).events) await emit(stream, e)
    const geometryBefore = group.children[0].geometry
    const disposeSpy = vi.fn()
    for (const e of turn(1).events) {
      if (e.change === 'remove') {
        const node = group.children.find((c) => c.uuid === e.uuid)
        node.dispose = disposeSpy
      }
      await emit(stream, e)
    }
    expect(group.children.map((c) => c.uuid)).toEqual([
      'mesh-main',
      'light-ambient',
      'slot:light.key',
    ])
    expect(disposeSpy).toHaveBeenCalledTimes(1)
    expect(host.fog.isFog).toBe(true)
    expect(group.children[0].geometry).not.toBe(geometryBefore)
    expect(group.children[0].geometry.parameters.width).toBe(1.5)
    expect(handle.current.hash).toBe(turn(1).done.hash)
    await renderer.unmount()
  })

  it('[effects.3] [callbacks.neg.1] a change whose `before` is not the hash held is dropped: nothing changes, nothing compiles, nothing fires', async () => {
    const onCompile = vi.fn()
    const { handle, stream, group, gl, renderer } = await mount({ onCompile })
    const [set, , add] = changes(0)
    await emit(stream, { ...set, before: 'not-the-hash' })
    await emit(stream, { ...add, before: 'not-the-hash' })
    expect(group.children[0].material.color.getHex()).toBe(
      fixture.template.materials[0].color,
    )
    expect(group.children.length).toBe(2)
    expect(gl.compileAsync).not.toHaveBeenCalled()
    expect(onCompile).not.toHaveBeenCalled()
    expect(handle.current.hash).toBe(fixture.templateHash)
    await renderer.unmount()
  })

  it('[effects.2] [effects.1] `done` always applies: with the nodes the group already holds it writes the values in place; with other nodes it loads afresh behind onCompile and swaps the objects', async () => {
    const onCompile = vi.fn()
    const { handle, stream, group, gl, host, renderer } = await mount({
      onCompile,
    })
    // the same nodes (the template's): a colour and the fog written in place, no compile
    const recoloured = template()
    recoloured.materials[0].color = 0x00ff00
    recoloured.object.fog = { type: 'Fog', color: 1, near: 1, far: 2 }
    await emit(stream, {
      type: 'done',
      document: recoloured,
      hash: 'h-recoloured',
    })
    expect(group.children[0].material.color.getHex()).toBe(0x00ff00)
    expect(host.fog.near).toBe(1)
    expect(gl.compileAsync).not.toHaveBeenCalled()
    expect(onCompile).not.toHaveBeenCalled()
    expect(handle.current.hash).toBe('h-recoloured')
    // other nodes (turn 1's end holds a light): the fresh objects compiled, then swapped in
    const oldMesh = group.children[0]
    const disposed = vi.fn()
    oldMesh.geometry.dispose = disposed
    await emit(stream, turn(1).done)
    expect(onCompile.mock.calls.map((c) => c[0])).toEqual([true, false])
    expect(gl.compileAsync).toHaveBeenCalledTimes(1)
    expect(gl.compileAsync.mock.calls[0][0].type).toBe('Scene') // the parsed root, off the tree
    expect(group.children.map((c) => c.uuid)).toEqual([
      'mesh-main',
      'light-ambient',
      'slot:light.key',
    ])
    expect(group.children[0]).not.toBe(oldMesh)
    expect(disposed).toHaveBeenCalledTimes(1)
    expect(group.children[0].material.color.getHex()).toBe(0xff0000)
    expect(host.fog.isFog).toBe(true)
    expect(handle.current.hash).toBe(turn(1).done.hash)
    await renderer.unmount()
  })

  it('[effects.2] an undo and a reset carry whole documents and apply as `done` does', async () => {
    const { handle, stream, group, host, renderer } = await mount()
    for (const e of [...turn(0).events, ...turn(1).events])
      await emit(stream, e)
    for (const e of turn(2).events) await emit(stream, e)
    expect(group.children.map((c) => c.uuid)).toEqual([
      'mesh-main',
      'light-ambient',
    ])
    expect(group.children[0].material.color.getHex()).toBe(
      fixture.template.materials[0].color,
    )
    expect(host.fog).toBeNull()
    expect(handle.current.hash).toBe(fixture.templateHash)
    await renderer.unmount()
  })

  it('[effects.1] [props.1] [props.3] a new `document` prop with the same nodes writes its values in place and takes its hash; the previous objects stay', async () => {
    const { handle, group, update, gl, renderer } = await mount()
    const mesh = group.children[0]
    const next = template()
    next.materials[0].roughness = 0.9
    await ReactThreeTestRenderer.act(async () =>
      update({ document: next, hash: 'h-next' }),
    )
    expect(group.children[0]).toBe(mesh)
    expect(mesh.material.roughness).toBe(0.9)
    expect(handle.current.hash).toBe('h-next')
    expect(gl.compileAsync).not.toHaveBeenCalled()
    await renderer.unmount()
  })

  it('[effects.4] a `tones` change alone changes nothing: no write, no compile', async () => {
    const { group, update, gl, renderer } = await mount()
    const before = group.children[0].material.color.getHex()
    await ReactThreeTestRenderer.act(async () =>
      update({ tones: { ...TONES, ink: '#000000', ground: '#ffffff' } }),
    )
    expect(group.children[0].material.color.getHex()).toBe(before)
    expect(gl.compileAsync).not.toHaveBeenCalled()
    await renderer.unmount()
  })

  it('[dispose.loaded] unmount disposes every geometry and material the loader made and empties the group', async () => {
    const { group, renderer } = await mount()
    const mesh = group.children[0]
    const g = vi.fn()
    const m = vi.fn()
    mesh.geometry.dispose = g
    mesh.material.dispose = m
    await renderer.unmount()
    expect(g).toHaveBeenCalledTimes(1)
    expect(m).toHaveBeenCalledTimes(1)
    expect(group.children.length).toBe(0)
  })

  it('[refs.1] the stream is unsubscribed on unmount and resubscribed on change', async () => {
    const { stream, update, renderer } = await mount()
    expect(stream.size).toBe(1)
    const other = fakeStream()
    await ReactThreeTestRenderer.act(async () => update({ stream: other }))
    expect(stream.size).toBe(0)
    expect(other.size).toBe(1)
    await renderer.unmount()
    expect(other.size).toBe(0)
  })

  it('two instances: each holds its own objects, hash and stream; a change on one reaches nothing of the other', async () => {
    const t1 = tunnel()
    const t2 = tunnel()
    const h1 = createRef()
    const h2 = createRef()
    const s1 = fakeStream()
    const s2 = fakeStream()
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <AgentSceneGroup
          tunnel={t1}
          document={template()}
          hash='one'
          tones={TONES}
          stream={s1}
          compile={false}
          ref={h1}
        />
        <AgentSceneGroup
          tunnel={t2}
          document={template()}
          hash='two'
          tones={TONES}
          stream={s2}
          compile={false}
          ref={h2}
        />
        <t1.Out />
        <t2.Out />
      </>,
      glMock(),
    )
    expect(h1.current.root).not.toBe(h2.current.root)
    const [set] = changes(0)
    await emit(s1, { ...set, before: 'one', hash: 'one-b' })
    expect(h1.current.root.children[0].material.color.getHex()).toBe(0xff0000)
    expect(h2.current.root.children[0].material.color.getHex()).toBe(
      fixture.template.materials[0].color,
    )
    expect(h1.current.hash).toBe('one-b')
    expect(h2.current.hash).toBe('two')
    await renderer.unmount()
  })

  it('[library.export] AgentSceneGroup is exported from src/index.js', () => {
    expect(Exported).toBe(AgentSceneGroup)
  })

  it('server render: the outer component renders to a string without a browser global', () => {
    const t = tunnel()
    expect(() =>
      renderToString(
        <AgentSceneGroup
          tunnel={t}
          document={template()}
          hash='x'
          tones={TONES}
        />,
      ),
    ).not.toThrow()
  })
})

describe('AgentSceneGroup exits', () => {
  it('[exits.throws] [theme.1] validateTones refuses a missing object, a missing key, a non-hex value and an extra key, naming the key', () => {
    expect(() => validateTones(undefined)).toThrow(/`tones` is required/)
    expect(() => validateTones({ ...TONES, accent: undefined })).toThrow(
      /tones\.accent must be a hex colour/,
    )
    expect(() => validateTones({ ...TONES, ink: 'red' })).toThrow(
      /tones\.ink must be a hex colour #rrggbb, got "red"/,
    )
    expect(() => validateTones({ ...TONES, extra: '#000000' })).toThrow(
      /tones\.extra is not one of/,
    )
    expect(() => validateTones(TONES)).not.toThrow()
    expect(() => validateTones({ ...TONES, ink: '#ABCDEF' })).not.toThrow()
  })

  it('[exits.throws] a missing tunnel, a malformed tones and a document of another version throw at mount, each naming its cause', async () => {
    const silent = vi.spyOn(console, 'error').mockImplementation(() => {})
    const t = tunnel()
    const doc = template()
    await expect(
      ReactThreeTestRenderer.create(
        <AgentSceneGroup document={doc} hash='x' tones={TONES} />,
        glMock(),
      ),
    ).rejects.toThrow(/`tunnel` is required/)
    await expect(
      ReactThreeTestRenderer.create(
        <AgentSceneGroup
          tunnel={t}
          document={doc}
          hash='x'
          tones={{ ...TONES, ground: 'white' }}
        />,
        glMock(),
      ),
    ).rejects.toThrow(/tones\.ground/)
    const other = template()
    other.metadata.cocoon.version = VERSION + 1
    await expect(
      ReactThreeTestRenderer.create(
        <AgentSceneGroup tunnel={t} document={other} hash='x' tones={TONES} />,
        glMock(),
      ),
    ).rejects.toThrow(
      new RegExp(`version is ${VERSION + 1}; this build reads ${VERSION}`),
    )
    const unversioned = template()
    delete unversioned.metadata.cocoon
    await expect(
      ReactThreeTestRenderer.create(
        <AgentSceneGroup
          tunnel={t}
          document={unversioned}
          hash='x'
          tones={TONES}
        />,
        glMock(),
      ),
    ).rejects.toThrow(/version is undefined/)
    silent.mockRestore()
  })

  it('[exits.throws] a document the loader refuses throws from the load, not caught', async () => {
    const silent = vi.spyOn(console, 'error').mockImplementation(() => {})
    const t = tunnel()
    const broken = template()
    delete broken.object
    await expect(
      ReactThreeTestRenderer.create(
        <>
          <AgentSceneGroup
            tunnel={t}
            document={broken}
            hash='x'
            tones={TONES}
            compile={false}
          />
          <t.Out />
        </>,
        glMock(),
      ),
    ).rejects.toThrow()
    silent.mockRestore()
  })
})
