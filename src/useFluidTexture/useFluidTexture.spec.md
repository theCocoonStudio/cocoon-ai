# useFluidTexture spec

Retroactive, written with the port to TSL on 2026-10-06. The hook predates the spec skill; this is the spec its behaviour answers to, and the tests reference these ids.

## meta

meta.target: portable
meta.runtime: client
meta.file: useFluidTexture.js
meta.kind: hook # returns textures and a callback; renders nothing itself

## imports

imports.1: import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
imports.2: import { useFrame, useThree } from '@react-three/fiber'
imports.3: import { Camera, HalfFloatType, PlaneGeometry, RGFormat, Vector2 } from 'three/webgpu'
imports.4: import { texture, uniform } from 'three/tsl'
imports.5: import { config } from '../../cocoon.config.js'
imports.6: the pass materials from ./tsl/passes.js, the runner ./ShaderPass.js, the wall ./boundary.js, the targets ./targets.js, the frame splitter ./frame.js

## props

props.1: poissonIterations — integer, optional, default config.fluid.poissonIterations; Jacobi iterations of the pressure solve
props.2: viscousIterations — integer, optional, default config.fluid.viscousIterations; Jacobi iterations of the diffusion solve
props.3: viscous — number, optional, default config.fluid.viscous; the viscosity coefficient
props.4: isViscous — boolean, optional, default config.fluid.isViscous; run the diffusion solve
props.5: forceValue — number, optional, default config.fluid.forceValue; scales the force callback's force
props.6: forceSize — number, optional, default config.fluid.forceSize; the force quad's radius, cells, when the callback gives none
props.7: resolution — number, optional, default config.fluid.resolution; the fields' size as a fraction of the viewport
props.8: runEvery — integer > 0, optional, default config.fluid.runEvery; step every n frames
props.9: dt — number, optional, default config.fluid.dt; the time step per simulation step
props.10: isBounce — boolean, optional, default config.fluid.isBounce; draw the wall
props.11: BFECC — boolean, optional, default config.fluid.BFECC; advection with BFECC's error correction
props.12: forceCallbackRef — RefObject<(delta, time, pointer, pointerDiff) => { force, center, radius? }>, optional; read each step, so a change never renders
props.13: forceMesh — Mesh, optional; when given, replaces the callback: the mesh's projection pushes the fluid
props.14: customCamera — Camera, optional; the camera the mesh force is projected through, default the Canvas camera
props.15: fboWidth, fboHeight — integers, optional; fixed field size, overriding resolution
props.16: fboOpts — RenderTarget options, optional, default a module constant { type: HalfFloatType, format: RGFormat }; referentially stable or the targets rebuild each render
props.17: outputFboOpts — RenderTarget options, optional, default a module constant { type: HalfFloatType }
props.18: manual — boolean, optional, default false; no stepping in the frame loop after the warm-up; the caller steps through the returned render
props.22: setRendererOptionsInternally — boolean, optional, default true; the two force passes toggle the renderer's autoClear around their own render; false leaves the renderer's options to the app
props.19: priority — number, optional, default -1; useFrame's priority for the step
props.20: pause — boolean, optional, default false; auto mode only
props.21: pauseRef, manualRef — RefObject<boolean>, optional; the imperative forms of pause and manual
props.passthrough: none
props.ref: none

## slots

slots.mechanism: none
slots.1: none

## context

context.consumed: fiber's root state: gl, camera, size
context.provided: none

## state

state.1: none that renders; every per-step value lives in refs and uniform nodes
state.reset: none

## markup

markup.1: none; the hook returns { texture, render, fields }
markup.2: texture — the output target's texture: white where the fluid is still, darker where it moves, the interior only
markup.3: render(state, delta) — one simulation step, callable by hand
markup.4: fields.velocity, fields.pressure, fields.divergence — the fields' textures, getters, the rim included

## states

states.default: markup.1–4, stepping every runEvery frames after a five-frame warm-up
states.manual: markup.1–4, the warm-up only, then steps on render()
states.paused: markup.1–4, no steps while pause or pauseRef.current
states.pending: none
states.empty: none
states.error: exits.throws

## callbacks

callbacks.1: forceCallbackRef.current — called once per step with (delta, clock time, pointer clone, pointer diff clone); returns { force, center, radius? }; the force is scaled by forceValue
callbacks.neg.1: not called while forceMesh is given
callbacks.neg.2: not called on a frame that does not step

## effects

effects.1: uniform values follow props: fboSize, cellScale, boundarySpace (zero with the wall, one cell without), dt, viscous, BFECC
effects.2: a size change rebuilds the eight targets and repoints every pass and wall at the new textures
effects.3: forceMesh change swaps the mesh pass's geometry and camera

## exits

exits.throws: at mount when the Canvas renderer is not the WebGPU renderer (gl.isWebGPURenderer false): the passes are TSL node materials
exits.suspends: never
exits.handler-failures: a force callback that throws propagates out of the frame loop; not caught

## refs

refs.1: forceCallbackRef — read each step
refs.2: pauseRef, manualRef — read each frame
refs.3: targets — internal, the current targets after a size change, written by effects.2
refs.4: last — internal, the pressure target the last step ended on, written by the step

## handle

handle: none

## frame

frame.mode: internal
frame.args: priority (props.19), default -1
frame.1: five warm-up steps on mount regardless of manual or pause, so every program compiles and every target allocates up front
frame.2: then, unless manual or paused, one step every runEvery frames: advection, force (pointer or mesh), diffusion when isViscous, divergence, pressure solve, projection, output
frame.3: the two force passes render with autoClear off and restore it, synchronously, nothing else running between: they add into the velocity advection just wrote; off when props.22 is false
frame.4: the wall is drawn after the quad of every pass that writes velocity or pressure, when isBounce
frame.writes-react: never
frame.invalidate: not needed
frame.sync.1: props → uniform node values (effects.1); not read from props in the loop
frame.sync.2: size → targets (effects.2)

## dispose

dispose.targets: eight RenderTargets from useRenderTarget — on size or option change and on unmount
dispose.geometry: the shared PlaneGeometry — on unmount
dispose.passes: eight pass materials and the four walls' geometry and material — on unmount
dispose.after: none; the hook is gone with its component

## bridge

bridge: none

## library

library.export: named `useFluidTexture` from src/index.js
library.side-effects: none
library.helper: src/useFluidTexture/tsl/passes.js (the materials), ShaderPass.js (the runner), boundary.js (the wall), targets.js (the targets), frame.js (the frame splitter)
library.generated: none
library.script: none

## budget

budget.1: none stated; the 3D hook's spec carries the first
