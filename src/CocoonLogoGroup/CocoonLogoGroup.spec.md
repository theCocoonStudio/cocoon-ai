# CocoonLogoGroup spec

Written 2026-09-13 from Izzy's answers to the spec questions (session 31600e62). The logo as a group of extruded meshes for the site nav, replacing the markup logo.

## meta

meta.target: portable
meta.runtime: client
meta.file: src/CocoonLogoGroup/index.jsx

## imports

imports.1: import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
imports.2: import { buildLogo } from './build.js'

## props

props.1: view — 'lockup' | 'icon', optional, default 'lockup'; the icon left of the wordmark, or the icon alone
props.2: width — number > 0, world units, optional, default 1; the ink's width. The height follows the artwork's aspect
props.3: depth — number > 0, world units, optional, default a quarter of the ink height; the group's z extent from the front faces to the back faces, bevels included
props.4: maxSize — number > 0, px, optional, default 1000; the widest the logo is expected to be drawn
props.5: eps — number ≥ 0, px, optional, default 0.25; the chord error allowed at props.4 when the outlines are simplified
props.6: scene — { planes, depth, radius, angle, perspective }, optional, each key defaulting to HAZE_DEFAULTS in src/utils/hazePlanes.js; the plane recession in that module's units. Its `depth` is the last plane's size, not props.3
props.7: cut — 'vapour' | 'dense', optional, default 'vapour'; names the haze total
props.8: haze — number in (0, 1), optional; overrides props.7
props.9: reverse — boolean, optional, default false; swaps surface and ground in the ramp
props.10: surface — CSS hex colour, optional, default '#141414'; the near end of the ramp
props.11: ground — CSS hex colour, optional, default '#FFFFFF'; the far end of the ramp. Nothing is painted with it
props.12: size — number > 0, optional, default 1; lockup only: the icon's height as a multiple of the wordmark's x-height band
props.13: air — number ≥ 0, optional, default 2; lockup only: the clear air in wordmark stems the derived gap must deliver
props.14: gap — number ≥ 0, optional; lockup only: the front-edge gap in stems, replacing the derivation from props.13
props.15: extrudeOptions — object, optional; merged over the defaults in markup.5 for every geometry
props.16: meshStandardMaterialProps — false | object, optional, default false; an object swaps every material for a meshStandardMaterial carrying those props
props.17: meshProps — object, optional, default {}; spread last onto every mesh
props.18: materialProps — object, optional, default {}; spread last onto every material
props.19: geometryProps — object, optional, default {}; spread last onto every geometry
props.passthrough: yes → spread onto the root <group>
props.ref: handle

## slots

slots.mechanism: none

## context

context.consumed: none
context.provided: none

## state

state: none
state.reset: none

## markup

markup.1: root <group>
markup.2: one <mesh name="plane<k>"> per plane k = 0 .. planes−1, in that order, k = 0 the front triangle
markup.3: lockup view: a further <mesh name="wordmark"> after the planes; absent in the icon view
markup.4: each mesh holds one ExtrudeGeometry of its outline, built in useMemo by buildLogo and attached as a primitive: normalised so the larger xy extent is 1, the xy bounding box centred on the origin, the z extent centred on 0; and one material per markup.6. Each mesh is scaled uniformly by its world width and positioned by markup.7–8, so the geometry's z extent is the piece's depth over that width
markup.5: extrusion defaults, geometry units: steps 1, curveSegments 1 (the outlines are already polylines), bevelEnabled true, bevelSegments 3, bevelThickness = bevelSize = b, bevelOffset = −b, depth = the piece's depth − 2b; b is 0.3 of one triangle's depth (props.3 ÷ planes), the same on every piece, so the silhouette stays the SVG's and the bevel is the same radius everywhere. props.15 merges over these
markup.6: plane k's material colour is hazeTones[k] for props.6–11; the wordmark takes tone 0. meshBasicMaterial with toneMapped false; when props.16 is an object, meshStandardMaterial with props.16 and three's toneMapped. props.18 spreads last on either
markup.7: placement, icon view: plane k is the front triangle scaled about its centroid by S_k and moved d_k along the angle, as hazePlanes states; the ink bounding box of all planes is centred on the origin in xy and the front triangle's front face is at z = 0; plane k spans z from −k·(props.3 ÷ planes) to −(k+1)·(props.3 ÷ planes)
markup.8: placement, lockup view: the wordmark at its own width, the icon scaled so its height is props.12 x-height bands, centred on the band, its front triangle's right edge props.14 stems left of the wordmark's box — props.14 derived as air + the worst trail over the shipped sizes and props.12, rounded up to the quarter stem, when unset; the whole ink centred on the origin in xy, front faces at z = 0, the wordmark spanning z from −props.3 to 0 and the planes as markup.7
markup.9: y up and facing +z: the SVG's y axis is negated
markup.10: every outline is simplified before shaping to a chord error of props.5 px at props.4, in design units props.5 × (ink width in design units ÷ props.4)

## states

states.default: markup.1–2, 4–10 with markup.3, the lockup
states.icon: markup.1–2, 4–7, 9–10, no markup.3
states.standard: states.default or states.icon with props.16 an object, markup.6's second material
states.disabled: none
states.pending: none
states.empty: none
states.error: none

## callbacks

callbacks: none
callbacks.neg: none

## effects

effects: none

## exits

exits.throws: from render when props.1 is not 'lockup' or 'icon', when hazeResolve refuses the scene or a colour, when props.2, 3, 4 or 12 is not > 0, or props.5, 13 or 14 is negative; the message names the prop. Owner: the nearest error boundary above the Canvas
exits.suspends: never
exits.handler-failures: none

## refs

refs.1: group — internal, RefObject<Group>, the root, set by React on mount
refs.2: meshes — internal, RefObject<Mesh[]>, one entry per child mesh in markup order, set by ref callbacks on mount

## handle

handle.1: group — Group | null, the root; null before mount
handle.2: planes — [{ mesh, geometry, material }], front first, one per plane; each member null before mount
handle.3: wordmark — { mesh, geometry, material } in the lockup view, null in the icon view and before mount

## frame

frame.mode: none
frame.args: none
frame.tunnel: none
frame.writes-react: never
frame.invalidate: not needed — nothing here moves; the owner that moves the group owns invalidation
frame.sync: none

## dispose

dispose.geometry.plane<k>: ExtrudeGeometry built in useMemo and attached as a primitive, which fiber never disposes — the component, on unmount and when a rebuild replaces it; props.19 `dispose={null}` hands both moments to the owner. A primitive rather than JSX args because the geometry is translated to its centre after construction, which JSX gives no moment for
dispose.geometry.wordmark: as above
dispose.material.plane<k>: declared in JSX — fiber, on unmount
dispose.material.wordmark: as above
dispose.shapes: the Shape objects from buildLogo in useMemo hold no GPU memory — nothing to release

## bridge

bridge: none

## library

library.export: named `CocoonLogoGroup` from src/index.js
library.side-effects: none
library.utils: src/utils/simplifyPolyline.js — the Ramer–Douglas–Peucker pass moved out of assets/logo/wordmark.js, which imports it back; plain function, unit-tested, not exported from the package
library.helper: src/CocoonLogoGroup/build.js — buildLogo(props) → the pieces: geometry, world width, position, depth, tone, extrusion options; no React, what the component and the export script both render from
library.generated: src/CocoonLogoGroup/logo.js — written by assets/logo/build.js: the front triangle's outline and the wordmark's six contours flattened at 0.05 design units, the wordmark's bounds and x-height constants, the shipped sizes; never hand-edited
library.script: assets/logo/export-group.js, `npm run export:logo-group -- [--prop value ...]` — renders the group through a perspective camera to SVG and PNG in Node without GL, every prop value printed on the sheet; output to assets/logo/explorations/export/
library.docs: docs/CocoonLogoGroup.md — props, handle, dispose rules, the camera that approximates the flat logo; docs/export-logo-group.md — the script; README scripts and layout rows
