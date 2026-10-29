// tests.1: apply.js without GL, on three's own classes and the fixture the service recorded
// (fixtures/turn.json: the template and three scripted turns, gateway agent/first-build).
import { describe, expect, it } from 'vitest'
import { Group, NodeObjectLoader, Scene } from 'three/webgpu'
import {
  VERSION,
  applySceneProperties,
  disposeAll,
  loadDocument,
  nodeSetOf,
  pointerGet,
  resourcesOf,
  sameNodeSet,
  writesBetween,
} from './apply.js'
import fixture from './fixtures/turn.json'

const loader = new NodeObjectLoader()
const template = () => structuredClone(fixture.template)
const mount = (document = template()) => {
  const container = new Group()
  const host = new Scene()
  const { index, children } = loadDocument({
    document,
    container,
    host,
    loader,
  })
  return { container, host, index, children }
}
const turn = (n) => fixture.turns[n]
const changes = (n) => turn(n).events.filter((e) => e.type === 'change')

describe('apply.js (tests.1)', () => {
  it("[props.2] the version this build reads is the fixture's", () => {
    expect(VERSION).toBe(fixture.version)
  })

  it("[refs.3] loadDocument puts the document's children under the container and indexes them by the mirror's uuids", () => {
    const { container, index, children } = mount()
    expect(children.map((c) => c.type)).toEqual(['Mesh', 'AmbientLight'])
    expect(container.children).toEqual(children)
    expect(index.resolve('/object/children/0/visible').owner.uuid).toBe(
      'mesh-main',
    )
    expect(index.resolve('/materials/0/color').owner.uuid).toBe('material-main')
    expect(index.resolve('/geometries/0/width').owner.uuid).toBe(
      'geometry-main',
    )
    expect(index.resolve('/object/background').section).toBe('scene')
  })

  it("[markup.2] the document's background and fog land on the host scene, not on the container", () => {
    const { host, container } = mount()
    expect(host.background.getHex()).toBe(fixture.template.object.background)
    expect(host.fog).toBeNull()
    expect(container.background).toBeUndefined()
  })

  it('[effects.2 set] every write of the recorded turns lands in place: a colour, a number, a fog, a size (the geometry rebuilt), a boolean; a null write removes the fog', () => {
    const { index, host, container } = mount()
    const mesh = container.children[0]
    const geometryBefore = mesh.geometry
    for (const e of [...changes(0), ...changes(1)]) {
      if (e.change !== 'set') continue
      for (const w of e.writes) index.write(w)
    }
    expect(mesh.material.color.getHex()).toBe(0xff0000)
    expect(mesh.material.roughness).toBe(0.2)
    expect(host.fog.isFog).toBe(true) // turn 1 set it thin and never turned it off
    index.write({ pointer: '/object/fog', value: null })
    expect(host.fog).toBeNull()
    expect(mesh.geometry).not.toBe(geometryBefore)
    expect(mesh.geometry.parameters.width).toBe(1.5)
    expect(mesh.geometry.parameters.depth).toBe(1.5)
    expect(mesh.visible).toBe(true)
    // the mirror followed every write, so the next pointer resolves on the new state
    expect(pointerGet(index.document, '/materials/0/color')).toBe(0xff0000)
    expect(pointerGet(index.document, '/geometries/0/width')).toBe(1.5)
    expect(pointerGet(index.document, '/object/fog')).toBeUndefined()
  })

  it("[effects.2 set] a fog write builds a Fog on the host with the document's numbers", () => {
    const { index, host } = mount()
    const fogOn = changes(1).find(
      (e) =>
        e.change === 'set' &&
        e.input.path === 'fog' &&
        e.input.value === 'thin',
    )
    for (const w of fogOn.writes) index.write(w)
    expect(host.fog.isFog).toBe(true)
    expect(host.fog.near).toBe(5)
    expect(host.fog.far).toBe(30)
    expect(host.fog.color.getHex()).toBe(fixture.template.object.background)
  })

  it('[effects.2 add] a node of an add is parsed from its fragment, appended under the pointer and indexed; [effects.2 remove] a remove takes it out and disposes it', () => {
    const { index, container } = mount()
    const add = changes(0).find((e) => e.change === 'add')
    const node = index.addNode(add.node, add.pointer)
    expect(node.type).toBe('PointLight')
    expect(node.uuid).toBe('slot:light.key')
    expect(node.name).toBe('light.key')
    expect(container.children.at(-1)).toBe(node)
    expect(pointerGet(index.document, '/object/children/2/uuid')).toBe(
      'slot:light.key',
    )
    expect(index.resolve('/object/children/2/intensity').owner).toBe(node)
    let disposed = 0
    node.dispose = () => {
      disposed += 1
    }
    const removed = index.removeNode('slot:light.key')
    expect(removed).toBe(node)
    expect(container.children.map((c) => c.uuid)).toEqual([
      'mesh-main',
      'light-ambient',
    ])
    expect(pointerGet(index.document, '/object/children/2')).toBeUndefined()
    expect(disposed).toBe(1)
    expect(() => index.removeNode('slot:light.key')).toThrow(
      /no object slot:light.key/,
    )
  })

  it('[effects.1] the diff by node set: equal sets after values alone, different after a structural change; the writes between two documents of one set', () => {
    const t = template()
    const afterTurn0 = turn(0).done.document
    expect(sameNodeSet(t, t)).toBe(true)
    expect(sameNodeSet(t, afterTurn0)).toBe(false) // a light was added
    expect(nodeSetOf(afterTurn0).has('object slot:light.key PointLight')).toBe(
      true,
    )
    const recoloured = structuredClone(t)
    recoloured.materials[0].color = 0x00ff00
    recoloured.object.background = 0x000000
    delete recoloured.object.fog
    expect(sameNodeSet(t, recoloured)).toBe(true)
    expect(writesBetween(t, recoloured)).toEqual([
      { pointer: '/materials/0/color', value: 0x00ff00 },
      { pointer: '/object/background', value: 0x000000 },
    ])
    // applied through the index they reproduce the document
    const { index, container, host } = mount()
    for (const w of writesBetween(t, recoloured)) index.write(w)
    expect(container.children[0].material.color.getHex()).toBe(0x00ff00)
    expect(host.background.getHex()).toBe(0)
  })

  it("[effects.1] undo and reset carry whole documents: reset's equals the template; undo's, one step back from a set that changed nothing, equals the turn's end", () => {
    const [undo, reset] = changes(2)
    expect(undo.change).toBe('undo')
    expect(reset.change).toBe('reset')
    expect(sameNodeSet(reset.document, fixture.template)).toBe(true)
    expect(writesBetween(reset.document, fixture.template)).toEqual([])
    expect(reset.hash).toBe(fixture.templateHash)
    expect(sameNodeSet(undo.document, turn(1).done.document)).toBe(true)
    expect(writesBetween(turn(1).done.document, undo.document)).toEqual([])
    expect(undo.before).toBe(turn(1).done.hash)
  })

  it('[dispose.loaded] disposeAll disposes every geometry, material and texture once, and resourcesOf lists them once', () => {
    const { container } = mount()
    const r = resourcesOf([container])
    expect(r.geometries.length).toBe(1)
    expect(r.materials.length).toBe(1)
    let g = 0
    let m = 0
    r.geometries[0].dispose = () => {
      g += 1
    }
    r.materials[0].dispose = () => {
      m += 1
    }
    disposeAll([container])
    disposeAll([container])
    expect([g, m]).toEqual([2, 2]) // three's dispose is safe to repeat; the caller decides when
  })

  it('[exits.throws] a pointer outside the document, a missing live object and an unknown geometry class are refused by name', () => {
    const { index } = mount()
    expect(() => index.write({ pointer: '/textures/0/x', value: 1 })).toThrow(
      /outside the document/,
    )
    expect(() =>
      index.write({ pointer: '/materials/4/color', value: 1 }),
    ).toThrow(/no materials\/4/)
    expect(() =>
      index.addNode({ type: 'PointLight', uuid: 'x' }, '/object/nothing'),
    ).toThrow(/not an array/)
    const { index: other } = mount()
    other.geometries[0].type = 'OddGeometry'
    expect(() =>
      other.write({ pointer: '/geometries/0/width', value: 2 }),
    ).toThrow(/cannot be rebuilt/)
  })

  it('[effects.4] applySceneProperties re-bases only background and fog, from any document', () => {
    const { index, host } = mount()
    const t = template()
    t.object.background = 0x123456
    t.object.fog = { type: 'FogExp2', color: 0x123456, density: 0.1 }
    applySceneProperties(index, t)
    expect(host.background.getHex()).toBe(0x123456)
    expect(host.fog.isFogExp2).toBe(true)
  })
})
