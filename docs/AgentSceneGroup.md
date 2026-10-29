---
title: Agent scene group
summary: "The agent's scene on the home page: the service's three.js document rendered into the site's Canvas through the tunnel, the stream's changes applied live, a handle for the page."
credits: [Izzy Erlich, Claude Fable 5.1]
since: 2026-10-29
tags: [scene, agent, webgpu, home]
---

# AgentSceneGroup

`src/AgentSceneGroup/index.jsx`, with `apply.js` beside it (the pure part). The renderer half of the agent over the home page's scene: the service on the Droplet composes a three.js document (three's own ObjectLoader format, node materials included) and streams each change the agent makes to it; this component loads the document into its own group, sent through the site's tunnel into the site's one Canvas the way a demo's scene is, applies the stream's changes live, and takes the whole document at a turn's end so a page that missed an event is made whole. Built from `AgentSceneGroup.spec.md`; `AgentSceneGroup.resolved.md` records what the build settled. The service's half, the tools, the loop and the stream's shapes, is cocoon-gateway's `docs/scene-agent.spec.md`.

## Props

| prop        | type                                              | notes                                                                                                                                                                                            |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `document`  | object, required                                  | the representation the service composed, at the version this build reads (`metadata.cocoon.version`); replaced whole at a turn's end and after a theme switch; never written by the page         |
| `hash`      | string, required                                  | the service's hash of `document`; the component hashes nothing                                                                                                                                   |
| `stream`    | `{ subscribe(listener) → unsubscribe }`, optional | the turn's events as the service emits them; read imperatively, a change never renders; absent between turns                                                                                     |
| `tunnel`    | tunnel-rat tunnel, required                       | the site's tunnel; its `Out` sits in the site's Canvas; the component never renders a Canvas                                                                                                     |
| `tones`     | `{ ink, surface, ground, accent }`, required      | the site's four tones as `#rrggbb`; the service composes the document from them (they travel with every request), so here they are only refused when malformed                                   |
| `compile`   | boolean, default `true`                           | compile on mount; `false` when the page compiles every scene in its own batch and calls the handle's `compile()` itself                                                                          |
| `onReady`   | `() => void`, optional                            | once, when the first compile resolves                                                                                                                                                            |
| `onCompile` | `(pending: boolean) => void`, optional            | `true` when a structural change (a node added, a document with other nodes) starts a compile, `false` when it resolves; the page shows its own loader meanwhile, the previous objects stay shown |
| `ref`       | handle                                            | see below                                                                                                                                                                                        |

Passthrough: none. The component renders nothing in the DOM: the agent's words, the page's loader and everything else on the page are the site's markup.

## The handle

| member      | what it is                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `root`      | the group the document's objects sit under, for the site to traverse or raycast                                                      |
| `materials` | every material the loaded document uses, so the home page compiles in a batch with the demos'                                        |
| `compile()` | three's `compileAsync` of the group against the Canvas's scene and camera; one promise, idempotent, re-armed after a structural load |
| `hash`      | the scene's current hash, the service's, for the page's next request                                                                 |
| `backend`   | `'webgpu'` or `'webgl'`, read from the renderer, for the page to declare with its request                                            |
| `version`   | the representation's version this build reads, for the page to declare; a document of another version throws at mount                |

## The stream

Each `change` event the service emits carries `before`, the hash it applied to, and `hash`, the hash after. The component applies a change only when `before` is the hash it holds; otherwise the event is dropped and the whole document at `done` makes the page whole. The forms, resolved by the service so the page holds no table: a `set` carries `writes`, JSON pointers into the document with the values as the document carries them (a colour as three's integer, a fog as its object or `null`), applied in place (a colour set, a number assigned, a geometry rebuilt from its parameters, the background and fog onto the Canvas's scene); an `add` carries the composed `node` and its slot's `pointer`, parsed by the loader, appended and compiled behind `onCompile`; a `remove` carries the `uuid`, the node taken out and disposed; an `undo` or `reset` carries the whole `document`, applied as `done` is: in place when it names the nodes the group already holds, a fresh load behind `onCompile` otherwise, with the previous objects shown until the swap.

## The theme

The site passes its four tones with every request and the service composes the base from them on the table's themed paths, so the agent reads what the page shows and the hash covers the tones. A theme switch is a request with the new tones and no prompt; the page passes the returned document as `document` and the component applies it in place, no compile, no loader. Nothing here reads CSS or holds a palette.

## Disposal

Every geometry, material and texture the loader made is disposed on a structural reload (the old objects) and on unmount; a removed node is disposed at its event; the Canvas scene's background and fog are restored on unmount to what they were before the mount.

## Limits

- A set that arrives while a structural swap is still compiling lands on the objects being replaced; the whole document at the turn's end makes the page whole. Named in the resolved spec.
- Nothing moves per frame: the scene changes by events, not by time; an animated template is a later addition.
- The WebGPU-only node kinds are the service's to withhold for a `webgl` client; the component renders what the document carries.
