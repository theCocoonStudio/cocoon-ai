# MorphTargets spec

## meta

meta.target: portable
meta.runtime: client
meta.file: src/MorphTargets/index.jsx

## imports

imports.1: import { useEffect, useImperativeHandle, useRef } from 'react'
imports.2: import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
imports.3: import { resampleGeometry } from '../utils/resampleGeometry.js'
imports.4: import { decimateGeometry } from '../utils/decimateGeometry.js'

## props

props.1: targets — BufferGeometry[], optional, default none; the alternative to slots.2, ignored when slots.2 is present
props.2: reduce — 'resample' | 'decimate', optional, default 'resample'
props.3: match — 'base' | 'lower', optional, default 'base'; 'base' keeps the base as authored and fits every target to its count, 'lower' keeps whichever of base and targets has the fewest vertices and reduces the rest (a reduced base is always decimated, since only edge collapse keeps faces; props.2 applies to targets)
props.4: normals — boolean, optional, default true; also build a normal morph attribute per target from the reduced target's normals, computed when the target has none
props.5: exit — 'throw' | 'render', optional, default 'throw'; see exits.throws
props.passthrough: no
props.ref: handle

## slots

slots.mechanism: children
slots.1: children — exactly one <mesh> element; its declared geometry is the base
slots.2: target geometries inside that mesh as <primitive object={geometry} attach="userData-target0" />, target1, target2 ...; contiguous from 0

## context

context.consumed: none
context.provided: none

## state

state: none
state.reset: none

## markup

markup.1: root <group>; children rendered inside unchanged
markup.2: after mount the mesh's geometry is the merged geometry: a copy of the base with its own buffers, indexed (a non-indexed base is vertex-merged first, and that merged count is the count targets are fitted to), plus morphAttributes.position[i] for every target, and morphAttributes.normal[i] when props.4
markup.3: mesh.morphTargetInfluences has one entry per target, all 0, and mesh.morphTargetDictionary maps target0, target1 ... to those indices
markup.4: under match 'lower' with a smaller target, the mesh renders the reduced base

## states

states.default: markup.1–3
states.lower: markup.1–4
states.render-exit: markup.1 only; the mesh is left exactly as declared (props.5 = 'render' and an exits.throws condition holds)
states.disposed: markup.1; mesh geometry is the base again, influences cleared (see dispose.after)
states.disabled: none
states.pending: none
states.empty: none
states.error: none

## callbacks

callbacks: none
callbacks.neg: none

## effects

effects.1: on mount and whenever the base geometry identity, the target list (identity or count), reduce, match, or normals changes → build the merged geometry, put it on the mesh, then dispose the previous merged geometry; influences carry over by index. Cleanup disposes the merged geometry and puts the base back
effects.2: dev-only console.warn from effects.1 when base vertices × targets exceeds 1,000,000, or when decimating a geometry above 100,000 vertices; absent in production builds

## exits

exits.throws: from effects.1 when the child is not a Mesh, no target is found in slots.2 or props.1, a geometry has no position attribute, or reduce is 'decimate' and a target has fewer vertices than the count it must match; only when props.5 is 'throw', else states.render-exit. Owner: the nearest error boundary above the Canvas
exits.suspends: never
exits.handler-failures: none

## refs

refs.1: group — internal, RefObject<Group>, the root group, set by React on mount; its first Mesh child is the wrapped mesh
refs.2: merged — internal, RefObject<BufferGeometry|null>, the merged geometry currently on the mesh
refs.3: base — internal, RefObject<BufferGeometry|null>, the mesh's geometry as declared, restored by handle.4

## handle

handle.1: mesh — Mesh | null, the wrapped mesh; null before mount
handle.2: geometry — BufferGeometry | null, the merged geometry on the mesh; null before mount and after handle.4
handle.3: set — (index, value) => void, writes mesh.morphTargetInfluences[index] clamped to 0–1; no-op before mount, after handle.4, or for an index without a target
handle.4: dispose — () => void, releases dispose.merged, restores the base on the mesh, clears influences; idempotent; the component stays inert until an effects.1 input changes, which rebuilds

## frame

frame.mode: none
frame.args: none
frame.tunnel: none
frame.writes-react: never
frame.invalidate: not needed — no frame work here; the owner drives influences from its own loop and owns invalidation
frame.sync: none

## dispose

dispose.merged: BufferGeometry built in effects.1, own buffers, nothing shared with the base — on rebuild (the old one, after the new one is on the mesh), on unmount, on handle.4
dispose.inputs: never — the base is fiber's (declared child), primitives and props.1 belong to whoever created them
dispose.after: mesh.geometry = base, mesh.morphTargetInfluences and morphTargetDictionary undefined as on a fresh Mesh, handle.2 = null, handle.3 no-op

## bridge

bridge: none

## library

library.export: named `MorphTargets` from src/index.js
library.side-effects: none
library.utils: src/utils/resampleGeometry.js and src/utils/decimateGeometry.js — plain functions, no React, unit-tested, not exported from the package
library.docs: docs/MorphTargets.md — props, handle, dispose rules, limits from effects.2; README lists the file structure
