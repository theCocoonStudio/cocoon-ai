import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useThree } from '@react-three/fiber'
import { NodeObjectLoader } from 'three/webgpu'
import {
  SceneIndex,
  VERSION,
  applySceneProperties,
  disposeAll,
  loadDocument,
  sameNodeSet,
  sceneSnapshot,
  writesBetween,
} from './apply.js'

// AgentSceneGroup: the renderer half of the agent over the home page's scene
// (AgentSceneGroup.spec.md). The service on the Droplet composes a three.js
// document and streams each change the agent makes; this component loads the
// document into its own group through the site's tunnel into the site's one
// Canvas, applies the stream's changes live by the pointers the service
// resolved (a colour, a number, a geometry rebuilt; a node added or removed,
// compiled behind onCompile), and takes the whole document at a turn's end so
// a page that missed an event is made whole. The document's background and fog
// land on the Canvas's scene while mounted, since a Group has neither
// (markup.2). It renders no DOM: the agent's words are the site's markup. The
// pure part is apply.js; `AgentSceneGroup.resolved.md` records what the build
// settled.

export { VERSION } from './apply.js'

const TONE_KEYS = ['ink', 'surface', 'ground', 'accent']
const HEX = /^#[0-9a-fA-F]{6}$/

/** Throws, naming the key, unless `tones` is exactly the four hex colours (theme.1, exits.throws). */
export function validateTones(tones) {
  if (!tones || typeof tones !== 'object') {
    throw new Error(
      `AgentSceneGroup: \`tones\` is required, an object with ${TONE_KEYS.join(', ')}`,
    )
  }
  for (const key of TONE_KEYS) {
    if (typeof tones[key] !== 'string' || !HEX.test(tones[key])) {
      throw new Error(
        `AgentSceneGroup: tones.${key} must be a hex colour #rrggbb, got ${JSON.stringify(tones[key])}`,
      )
    }
  }
  for (const key of Object.keys(tones)) {
    if (!TONE_KEYS.includes(key)) {
      throw new Error(
        `AgentSceneGroup: tones.${key} is not one of ${TONE_KEYS.join(', ')}`,
      )
    }
  }
}

/**
 * The scene inside the Canvas, rendered by the tunnel's Out: the hooks that need
 * fiber's root state (gl, camera, scene) run here, the handle is built here, and
 * the outer component only validates and sends this through the tunnel (the
 * fluid demo's shape; defaults.1 in the resolved spec).
 */
function AgentScene({
  document,
  hash,
  stream,
  compileOnMount,
  onReady,
  onCompile,
  ref,
}) {
  const { gl, camera, scene } = useThree(({ gl, camera, scene }) => ({
    gl,
    camera,
    scene,
  }))
  const loader = useMemo(() => new NodeObjectLoader(), [])
  const root = useRef(null)
  const index = useRef(null)
  const hashRef = useRef(hash)
  const snapshot = useRef(null)
  const compiled = useRef(null)
  const readyFired = useRef(false)
  const onReadyRef = useRef(onReady)
  const onCompileRef = useRef(onCompile)
  useEffect(() => {
    onReadyRef.current = onReady
    onCompileRef.current = onCompile
  })
  // state.1 and state.2: nothing renders from them (no DOM, the group is the group), they are the
  // component's own record of readiness and of a structural compile in flight
  const [, setReady] = useState(false)
  const [, setPending] = useState(false)

  // handle.3: three's compileAsync of the group against the Canvas's scene and camera; one promise,
  // idempotent, re-armed by a structural load; onReady once, whoever called it (callbacks.1)
  const compile = useCallback(() => {
    if (!compiled.current) {
      compiled.current = Promise.resolve(
        gl.compileAsync(root.current, camera, scene),
      ).then(() => {
        if (!readyFired.current) {
          readyFired.current = true
          setReady(true)
          onReadyRef.current?.()
        }
      })
    }
    return compiled.current
  }, [gl, camera, scene])

  // effects.1, the structural half: the next document parsed into fresh objects, compiled off the
  // tree, then swapped in and the old objects disposed (dispose.loaded); the previous objects stay
  // shown meanwhile (states.pending); onCompile true then false (callbacks.2)
  const structural = useCallback(
    (next) => {
      const parsed = loader.parse(next)
      setPending(true)
      onCompileRef.current?.(true)
      const swap = Promise.resolve(gl.compileAsync(parsed, camera, scene)).then(
        () => {
          const group = root.current
          if (!group) return
          const old = [...group.children]
          for (const c of old) group.remove(c)
          disposeAll(old)
          for (const c of [...parsed.children]) group.add(c)
          index.current = new SceneIndex({
            document: next,
            container: group,
            host: scene,
            loader,
          })
          applySceneProperties(index.current, next)
          setPending(false)
          onCompileRef.current?.(false)
        },
      )
      compiled.current = swap.then(() => {
        if (!readyFired.current) {
          readyFired.current = true
          setReady(true)
          onReadyRef.current?.()
        }
      })
      return compiled.current
    },
    [gl, camera, scene, loader],
  )

  // a whole document (props.1 at a turn's end, `done`, an undo or a reset): in place when it names
  // the same nodes, structural otherwise (effects.1); the hash is the service's
  const applyDocument = useCallback(
    (next, nextHash) => {
      if (index.current && sameNodeSet(index.current.document, next)) {
        for (const w of writesBetween(index.current.document, next))
          index.current.write(w)
      } else if (index.current) {
        structural(next)
      }
      hashRef.current = nextHash
    },
    [structural],
  )

  // the load (effects.1): the first document under the group, the host scene's background and fog
  // taken (markup.2) after a snapshot for the restore (dispose.after); every later document applied
  useLayoutEffect(() => {
    const group = root.current
    if (!index.current) {
      snapshot.current = sceneSnapshot(scene)
      index.current = loadDocument({
        document,
        container: group,
        host: scene,
        loader,
      }).index
      hashRef.current = hash
      return
    }
    applyDocument(document, hash)
  }, [document, hash, scene, loader, applyDocument])

  // props.7: compile on mount unless the page compiles in its own batch (handle.3)
  useEffect(() => {
    if (compileOnMount) compile()
  }, [compileOnMount, compile])

  // refs.1 / effects.2 / effects.3: the stream's events as they arrive; a `change` applies only when
  // its `before` is the hash held here (callbacks.neg.1), a whole document always applies
  useEffect(() => {
    if (!stream) return undefined
    return stream.subscribe((event) => {
      if (!event || typeof event !== 'object') return
      if (event.type === 'done') {
        applyDocument(event.document, event.hash)
        return
      }
      if (event.type !== 'change') return
      if (event.before !== hashRef.current) return
      if (event.document) {
        applyDocument(event.document, event.hash)
        return
      }
      const idx = index.current
      if (event.change === 'set') {
        for (const w of event.writes ?? []) idx.write(w)
      } else if (event.change === 'add') {
        setPending(true)
        onCompileRef.current?.(true)
        const node = idx.addNode(event.node, event.pointer)
        Promise.resolve(gl.compileAsync(node, camera, scene)).then(() => {
          setPending(false)
          onCompileRef.current?.(false)
        })
      } else if (event.change === 'remove') {
        idx.removeNode(event.uuid)
      }
      hashRef.current = event.hash
    })
  }, [stream, gl, camera, scene, applyDocument])

  // dispose.loaded and dispose.after: everything the loader made disposed, the group emptied, the
  // host scene's background and fog as they were
  useEffect(() => {
    const group = root.current
    return () => {
      const children = [...group.children]
      for (const c of children) group.remove(c)
      disposeAll(children)
      if (snapshot.current) {
        scene.background = snapshot.current.background
        scene.fog = snapshot.current.fog
      }
      index.current = null
    }
  }, [scene])

  useImperativeHandle(
    ref,
    () => ({
      get root() {
        return root.current
      },
      get materials() {
        return index.current ? index.current.allMaterials : []
      },
      compile,
      get hash() {
        return hashRef.current
      },
      get backend() {
        return gl.backend && gl.backend.isWebGPUBackend ? 'webgpu' : 'webgl'
      },
      version: VERSION,
    }),
    [compile, gl],
  )

  return <group ref={root} />
}

/**
 * @typedef {object} AgentSceneGroupHandle
 * @property {import('three').Group} root the group the document's objects sit under, for the site to traverse or raycast
 * @property {import('three').Material[]} materials every material the loaded document uses, for the home page's batch compile
 * @property {() => Promise<void>} compile compiles the group against the Canvas's scene and camera; one promise, idempotent, re-armed after a structural load
 * @property {string} hash the scene's current hash, the service's, for the page's next request
 * @property {'webgpu'|'webgl'} backend the Canvas renderer's backend, for the page to declare
 * @property {number} version the representation's version this build reads, for the page to declare
 */

/**
 * @typedef {object} AgentSceneGroupProps
 * @property {object} document the representation the service composed, replaced whole at a turn's end and after a theme switch
 * @property {string} hash the service's hash of `document`
 * @property {{ subscribe: (listener: (event: object) => void) => () => void }} [stream] the turn's events as the service emits them; absent between turns
 * @property {{ In: import('react').ComponentType<{children?: import('react').ReactNode}> }} tunnel the site's tunnel; its Out sits in the site's Canvas
 * @property {{ ink: string, surface: string, ground: string, accent: string }} tones the site's four tones as hex colours; the service composes from them, this component only refuses a malformed set
 * @property {boolean} [compile=true] compile on mount; false when the page calls the handle's compile in its own batch
 * @property {() => void} [onReady] once, when the first compile resolves
 * @property {(pending: boolean) => void} [onCompile] true when a structural change starts a compile, false when it resolves
 * @property {import('react').Ref<AgentSceneGroupHandle>} [ref] the handle
 */

/**
 * The agent's scene on the home page: the service's document rendered into the
 * site's Canvas through the tunnel, the stream's changes applied live, the
 * handle with root, materials, compile, hash, backend and version.
 *
 * @param {AgentSceneGroupProps} props
 */
export function AgentSceneGroup({
  document,
  hash,
  stream,
  tunnel,
  tones,
  compile = true,
  onReady,
  onCompile,
  ref,
}) {
  if (!tunnel || !tunnel.In) {
    throw new Error(
      "AgentSceneGroup: `tunnel` is required, a tunnel-rat tunnel whose Out is rendered in the site's Canvas",
    )
  }
  validateTones(tones)
  const version = document?.metadata?.cocoon?.version
  if (version !== VERSION) {
    throw new Error(
      `AgentSceneGroup: the document's version is ${JSON.stringify(version)}; this build reads ${VERSION}`,
    )
  }
  const { In } = tunnel
  return (
    <In>
      <AgentScene
        document={document}
        hash={hash}
        stream={stream}
        compileOnMount={compile}
        onReady={onReady}
        onCompile={onCompile}
        ref={ref}
      />
    </In>
  )
}
