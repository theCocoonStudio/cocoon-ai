// The pure part of AgentSceneGroup (AgentSceneGroup.spec.md, library.helper): the index from the
// service's document to the live three objects, a write applied through it, a node added or
// removed, and the diff of two documents by node set. No React, no renderer, no GL: every function
// here runs in Node on three's own classes, which is how tests.1 tests it.
//
// The service composes the document and resolves every change to JSON pointers into it (the
// gateway's stream.1): `/materials/0/color`, `/geometries/0/width`, `/object/background`,
// `/object/fog`, `/object/children/1/intensity`. The index keeps a mirror of the document as JSON,
// kept in step with every write, so a pointer resolves by the mirror's own uuids and indices and
// never by a guess about the live tree's order. The live objects are the ones the loader made;
// a write lands on them in place (a colour set, a number assigned, a geometry rebuilt from its
// parameters), the scene-level properties (background, fog) land on the host scene the component
// names, since a Group has neither (markup.2).
import { Color, Fog, FogExp2 } from 'three/webgpu'

/** The representation's version this build reads (props.2, handle.6, versioning.1). */
export const VERSION = 1

const COLOUR_KEYS = new Set([
  'color',
  'emissive',
  'specular',
  'sheenColor',
  'attenuationColor',
  'groundColor',
])
/** The geometries the index can rebuild from a changed parameter, with each constructor's argument order. */
const GEOMETRY_PARAMETERS = {
  BoxGeometry: [
    'width',
    'height',
    'depth',
    'widthSegments',
    'heightSegments',
    'depthSegments',
  ],
  SphereGeometry: [
    'radius',
    'widthSegments',
    'heightSegments',
    'phiStart',
    'phiLength',
    'thetaStart',
    'thetaLength',
  ],
  PlaneGeometry: ['width', 'height', 'widthSegments', 'heightSegments'],
  CylinderGeometry: [
    'radiusTop',
    'radiusBottom',
    'height',
    'radialSegments',
    'heightSegments',
    'openEnded',
    'thetaStart',
    'thetaLength',
  ],
  TorusGeometry: ['radius', 'tube', 'radialSegments', 'tubularSegments', 'arc'],
  CircleGeometry: ['radius', 'segments', 'thetaStart', 'thetaLength'],
  IcosahedronGeometry: ['radius', 'detail'],
}

const tokensOf = (pointer) =>
  pointer
    .split('/')
    .slice(1)
    .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'))

/** Read a pointer in a plain document; undefined where the path breaks. */
export function pointerGet(doc, pointer) {
  let node = doc
  for (const t of tokensOf(pointer)) {
    if (node === null || typeof node !== 'object') return undefined
    node = node[t]
  }
  return node
}

function pointerParent(doc, pointer) {
  const tokens = tokensOf(pointer)
  const key = tokens.pop()
  let node = doc
  for (const t of tokens) {
    if (node === null || typeof node !== 'object' || node[t] === undefined)
      throw new Error(`AgentSceneGroup: the document has no ${pointer}`)
    node = node[t]
  }
  if (node === null || typeof node !== 'object')
    throw new Error(`AgentSceneGroup: the document has no ${pointer}`)
  return [node, key]
}

/** Every (uuid, type) pair a document names: its geometries, its materials, its object tree. */
export function nodeSetOf(document) {
  const set = new Set()
  for (const g of document.geometries ?? [])
    set.add(`geometry ${g.uuid} ${g.type}`)
  for (const m of document.materials ?? [])
    set.add(`material ${m.uuid} ${m.type}`)
  const walk = (o) => {
    if (!o) return
    set.add(`object ${o.uuid} ${o.type}`)
    for (const c of o.children ?? []) walk(c)
  }
  walk(document.object)
  return set
}

/** True when two documents name the same nodes (effects.1: equal sets take their values in place). */
export function sameNodeSet(a, b) {
  const sa = nodeSetOf(a)
  const sb = nodeSetOf(b)
  if (sa.size !== sb.size) return false
  for (const k of sa) if (!sb.has(k)) return false
  return true
}

/** The writes that turn document `a` into document `b`, leaf by leaf, for two documents of one node set. */
export function writesBetween(a, b) {
  const writes = []
  const leaf = (v) =>
    v === null ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    v.type === 'Fog' ||
    v.type === 'FogExp2'
  const walk = (x, y, pointer) => {
    const keys = new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})])
    for (const k of keys) {
      const p = `${pointer}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`
      const vx = x?.[k]
      const vy = y?.[k]
      if (k === 'children' || k === 'metadata') continue // structure is the diff of node sets; metadata is the loader's
      if (leaf(vx) && leaf(vy)) {
        if (JSON.stringify(vx) !== JSON.stringify(vy))
          writes.push({ pointer: p, value: vy === undefined ? null : vy })
      } else if (
        vx !== null &&
        typeof vx === 'object' &&
        vy !== null &&
        typeof vy === 'object'
      ) {
        walk(vx, vy, p)
      } else if (JSON.stringify(vx) !== JSON.stringify(vy)) {
        writes.push({ pointer: p, value: vy === undefined ? null : vy })
      }
    }
  }
  for (const section of ['geometries', 'materials']) {
    const xa = a[section] ?? []
    const xb = b[section] ?? []
    for (let i = 0; i < Math.max(xa.length, xb.length); i++)
      walk(xa[i], xb[i], `/${section}/${i}`)
  }
  const objects = (o, pointer, out) => {
    if (!o) return out
    out.push([o, pointer])
    ;(o.children ?? []).forEach((c, i) =>
      objects(c, `${pointer}/children/${i}`, out),
    )
    return out
  }
  const oa = objects(a.object, '/object', [])
  const ob = objects(b.object, '/object', [])
  for (let i = 0; i < oa.length; i++) walk(oa[i][0], ob[i]?.[0], oa[i][1])
  return writes
}

/** The resources a live tree holds, each once: geometries, materials, and the textures on them. */
export function resourcesOf(objects) {
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  const visit = (o) => {
    if (o.geometry) geometries.add(o.geometry)
    const ms = Array.isArray(o.material)
      ? o.material
      : o.material
        ? [o.material]
        : []
    for (const m of ms) {
      materials.add(m)
      for (const v of Object.values(m)) if (v && v.isTexture) textures.add(v)
    }
  }
  for (const root of objects) root.traverse(visit)
  return {
    geometries: [...geometries],
    materials: [...materials],
    textures: [...textures],
  }
}

/** Dispose every resource of a live tree (dispose.loaded, dispose.node); three's dispose() is safe to repeat. */
export function disposeAll(objects) {
  const r = resourcesOf(objects)
  for (const t of r.textures) t.dispose()
  for (const m of r.materials) m.dispose()
  for (const g of r.geometries) g.dispose()
  for (const o of objects)
    o.traverse((x) => {
      if (x.isLight && typeof x.dispose === 'function') x.dispose()
    })
}

/**
 * The index (refs.3): the document's mirror and the live objects it names, built at a load and kept
 * in step by every write, so a pointer from the service lands on the right object. `host` is the
 * scene that takes the document's scene-level properties (markup.2); `container` the live object
 * whose children are the document's `/object/children` (the component's group).
 */
export class SceneIndex {
  constructor({ document, container, host, loader }) {
    this.document = structuredClone(document)
    this.container = container
    this.host = host
    this.loader = loader
    this.byUuid = new Map()
    this.geometries = []
    this.materials = []
    this.rebuild()
  }

  /** Re-read the live tree: every object by uuid, the geometries and materials by the document's order. */
  rebuild() {
    this.byUuid.clear()
    this.container.traverse((o) => {
      if (o !== this.container) this.byUuid.set(o.uuid, o)
    })
    const geometries = new Map()
    const materials = new Map()
    this.container.traverse((o) => {
      if (o.geometry) geometries.set(o.geometry.uuid, o.geometry)
      const ms = Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : []
      for (const m of ms) materials.set(m.uuid, m)
    })
    this.geometries = (this.document.geometries ?? []).map(
      (g) => geometries.get(g.uuid) ?? null,
    )
    this.materials = (this.document.materials ?? []).map(
      (m) => materials.get(m.uuid) ?? null,
    )
  }

  /** The live owner of a pointer's parent and the key the pointer names: { owner, key, section }. */
  resolve(pointer) {
    const tokens = tokensOf(pointer)
    const key = tokens[tokens.length - 1]
    const [section, index] = tokens
    if (section === 'geometries' || section === 'materials') {
      if (tokens.length !== 3)
        throw new Error(
          `AgentSceneGroup: ${pointer} is not a property of a geometry or a material`,
        )
      const owner = this[section][Number(index)]
      if (!owner)
        throw new Error(
          `AgentSceneGroup: the live scene has no ${section}/${index}`,
        )
      return { owner, key, section }
    }
    if (section !== 'object')
      throw new Error(
        `AgentSceneGroup: ${pointer} is outside the document's object, geometries and materials`,
      )
    if (tokens.length === 2) return { owner: this.host, key, section: 'scene' } // /object/background, /object/fog
    // /object/children/i(/children/j)*/key: the object by the mirror's uuid at that position
    const entry = pointerGet(this.document, `/${tokens.slice(0, -1).join('/')}`)
    if (!entry || typeof entry.uuid !== 'string')
      throw new Error(
        `AgentSceneGroup: the document has no object at ${pointer}`,
      )
    const owner = this.byUuid.get(entry.uuid)
    if (!owner)
      throw new Error(
        `AgentSceneGroup: the live scene has no object ${entry.uuid}`,
      )
    return { owner, key, section: 'object' }
  }

  /** One write (stream.1's `{ pointer, value }`): on the mirror, then on the live object, in place. */
  write({ pointer, value }) {
    const { owner, key, section } = this.resolve(pointer)
    const [parent, k] = pointerParent(this.document, pointer)
    if (value === null) delete parent[k]
    else parent[k] = structuredClone(value)
    if (section === 'scene') return this.writeScene(key, value)
    if (section === 'geometries')
      return this.rebuildGeometry(owner, key, value, pointer)
    if (COLOUR_KEYS.has(key) && owner[key] && owner[key].isColor) {
      owner[key].setHex(value)
      return owner
    }
    if (typeof owner[key] === 'boolean' && typeof value === 'boolean') {
      owner[key] = value
      if (owner.isMaterial) owner.needsUpdate = true
      return owner
    }
    owner[key] = value
    return owner
  }

  writeScene(key, value) {
    if (key === 'background') {
      this.host.background =
        value === null || value === undefined ? null : new Color(value)
    } else if (key === 'fog') {
      this.host.fog =
        value === null || value === undefined
          ? null
          : value.type === 'FogExp2'
            ? new FogExp2(value.color, value.density)
            : new Fog(value.color, value.near, value.far)
    } else {
      this.host[key] = value
    }
    return this.host
  }

  /** A geometry parameter changed: a new geometry of the same class from the merged parameters, swapped onto every mesh using the old one, the old disposed. */
  rebuildGeometry(old, key, value, pointer) {
    const order = GEOMETRY_PARAMETERS[old.type]
    if (!order)
      throw new Error(
        `AgentSceneGroup: ${pointer}: a ${old.type} cannot be rebuilt from a parameter here`,
      )
    const params = { ...old.parameters, [key]: value }
    const fresh = new old.constructor(...order.map((name) => params[name]))
    fresh.uuid = old.uuid
    this.container.traverse((o) => {
      if (o.geometry === old) o.geometry = fresh
    })
    const i = this.geometries.indexOf(old)
    if (i >= 0) this.geometries[i] = fresh
    old.dispose()
    return fresh
  }

  /** The node of an `add` (stream.1): the fragment parsed by the loader, appended to the pointer's live array and the mirror's. */
  addNode(fragment, pointer) {
    const target = pointerGet(this.document, pointer)
    if (!Array.isArray(target))
      throw new Error(
        `AgentSceneGroup: ${pointer} is not an array in the document`,
      )
    const node = this.loader.parse({
      metadata: { version: 4.6, type: 'Object', generator: 'AgentSceneGroup' },
      geometries: this.document.geometries ?? [],
      materials: this.document.materials ?? [],
      object: fragment,
    })
    target.push(structuredClone(fragment))
    const parent =
      pointer === '/object/children'
        ? this.container
        : this.byUuid.get(
            pointerGet(this.document, pointer.replace(/\/children$/, '')).uuid,
          )
    parent.add(node)
    this.rebuild()
    return node
  }

  /** The node of a `remove` (stream.1), by uuid: out of the live tree and the mirror, its resources disposed (dispose.node). */
  removeNode(uuid) {
    const node = this.byUuid.get(uuid)
    if (!node)
      throw new Error(`AgentSceneGroup: the live scene has no object ${uuid}`)
    node.parent.remove(node)
    disposeAll([node])
    const prune = (o) => {
      if (!o.children) return
      o.children = o.children.filter((c) => c.uuid !== uuid)
      for (const c of o.children) prune(c)
    }
    prune(this.document.object)
    this.rebuild()
    return node
  }

  /** Every material the live tree uses (handle.2). */
  get allMaterials() {
    return resourcesOf([this.container]).materials
  }
}

/** The host scene's own properties the document sets (markup.2), as they are now, for the restore on unmount. */
export function sceneSnapshot(scene) {
  return { background: scene.background, fog: scene.fog }
}

/** The document's scene-level properties onto the host scene (markup.2): background and fog. */
export function applySceneProperties(index, document) {
  const o = document.object ?? {}
  index.writeScene(
    'background',
    o.background === undefined ? null : o.background,
  )
  index.writeScene('fog', o.fog === undefined ? null : o.fog)
}

/** Load a document into live objects: the document's children under `container`, the index built. */
export function loadDocument({ document, container, host, loader }) {
  const root = loader.parse(document)
  const children = [...root.children]
  for (const c of children) container.add(c)
  const index = new SceneIndex({ document, container, host, loader })
  applySceneProperties(index, document)
  return { index, children }
}
