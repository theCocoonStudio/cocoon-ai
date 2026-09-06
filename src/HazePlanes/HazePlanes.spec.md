# HazePlanes spec

Retroactive: written 2026-09-06 from the component in `cocoon-ai-records/temp/React Components/HazePlanes` (Opus, 2026-08-30/31) and its verification notes, with the corrections Izzy asked for folded in. Where a line changes what the old component did, it says so.

## meta

meta.target: portable
meta.runtime: client
meta.file: src/HazePlanes/index.jsx

## imports

imports.1: import { useLayoutEffect, useRef, useState } from 'react'
imports.2: import { hazeAnalyse, hazeTones } from '../utils/hazePlanes.js'

## props

props.1: planes — integer ≥ 2, optional, default 4; the element's own face included
props.2: depth — number in (0, 1], optional, default 2/3; the last plane's size as a fraction of the face
props.3: radius — number ≥ 0, optional, default 0.6333; the last plane's centre from the face's centre, in element widths
props.4: angle — number, degrees, optional, default 0; 0 right, 90 down, as CSS rotates (was 180, with a comment claiming the mark recedes left; it recedes right)
props.5: perspective — number ≥ 0, optional, default 1/6; foreshortening of the middle planes, 0 is equal steps
props.6: cut — 'vapour' | 'dense', optional, default 'vapour'; names the haze total
props.7: haze — number in (0, 1), optional, default none; overrides props.6 when given
props.8: surface — CSS hex colour, optional, default '#141414'; the colour the face paints, and the near end of the box ramp
props.9: ground — CSS hex colour, optional, default '#FFFFFF'; the colour behind the element, and the far end of every ramp
props.10: ink — CSS hex colour, optional, default props.9; the near end of the content ramp under paint 'both' (new; see markup.6)
props.11: mode — 'transform' | 'shadow', optional, default 'transform'; the old aliases element, text and box are refused (exits.throws)
props.12: paint — 'auto' | 'background' | 'color' | 'both', optional, default 'auto', which is 'color'; transform mode only, ignored under shadow
props.13: cornerRadius — number (px) or CSS length string, optional, default 0; the border radius of the wrapper and, under shadow mode, of the shadow geometry (was `radius`; renamed because props.3 is the scene's radius)
props.14: fan — false | true | { xyz: boolean, size: 'grow' | 'shrink' | falsy }, optional, default false; true is { xyz: true, size: 'shrink' }, and an object fills its missing keys from that. Planes stand open at rest when false; otherwise they are transparent at rest and fade in as they open on hover or focus, every animated quantity moving together. xyz: the planes start on the face's position and travel to their places. size 'shrink': the planes start at the face's size and shrink to their final size; 'grow': they start at 0 and grow; falsy: they are at their final size throughout (Izzy, 2026-09-06)
props.15: duration — CSS time string, optional, default '260ms'
props.16: easing — CSS timing function, optional, default 'ease', what CSS does; 'ease-in', 'ease-out', 'ease-in-out', 'linear' and any cubic-bezier pass through (was a custom cubic-bezier)
props.17: className — string, optional
props.18: style — object, optional, merged last onto the wrapper
props.passthrough: yes → spread onto the root <span>
props.ref: accepted → root DOM node

## slots

slots.mechanism: children
slots.1: children — any content; replicated once per plane under transform mode, so it must carry no element ids (contracts)

## context

context.consumed: none
context.provided: none

## state

state.1: box — { width, height } in px, initial { 0, 0 }; the wrapper's content box, measured
state.2: open — boolean, initial !fan; whether the planes stand open
state.3: needsFocus — boolean, initial false; whether the wrapper must take a tab stop for the fan
state.reset: state.2 resets to !fan whenever props.14 changes

## markup

markup.1: root <span> position relative, display inline-block, border-radius props.13, className props.17, then props.18, then passthrough
markup.2: the content in a <span> position relative, display block, rendered last so it paints above every plane without z-index
markup.3: transform mode, once state.1 has a width: one <span aria-hidden="true"> per plane k = 1 .. planes−1, absolutely positioned over the content box, pointer-events none, user-select none, DOM order furthest first, each holding a copy of children
markup.4: each copy k carries transform translate(dx_k, dy_k) scale(S_k) about its own centre, from hazeAnalyse at state.1's width and height; open state per states.*
markup.5: paint 'color' gives copy k `color: tone_k`; 'background' gives `background: tone_k`; tone_k from hazeTones with props.8 and props.9
markup.6: paint 'both' gives copy k `background: tone_k` from the surface ramp and `color: inkTone_k` from a second ramp, hazeTones with props.10 as surface and props.9 as ground, so the copy's content stays legible on its own box (fix: the old component gave both the same tone and the content vanished)
markup.7: shadow mode: the root carries `background: tone_0` and a box-shadow with one layer per plane, `dx dy 0 spread tone_k`, from hazeAnalyse; no copies exist
markup.8: transform mode: each copy transition-property transform, opacity, with props.15 and props.16; shadow mode: no transition
markup.9: before state.1 has a width, no planes: markup.1–2 only

## states

states.default: markup.1–9 with the planes open: fan false, or fan set and state.2 true
states.closed: fan set and state.2 false: every copy at opacity 0 and at its start pose: translate(0, 0) when xyz else its final translate; scale 1 under size 'shrink', 0 under 'grow', its final scale when size is falsy. Shadow mode has no fan: its layers cannot fade separately, so fan is ignored there and the planes stand open
states.opening: fan set and state.2 true: every copy at its open pose, translate d_k scale S_k opacity 1, reached by one transition from states.closed
states.unmeasured: markup.9
states.disabled: none
states.pending: none
states.empty: none
states.error: none

## callbacks

callbacks.1: onMouseEnter, onMouseLeave, onFocus, onBlur on the root — only when fan is set — set state.2 true, false, true, false; after the passthrough handlers of the same name, which still fire
callbacks.neg.1: none of the four is attached when fan is false

## effects

effects.1: on mount → a ResizeObserver on the root writes state.1 from the content rect on every size change; disconnected on unmount
effects.2: on mount and whenever fan changes → if fan is set, scan the root for a focusable descendant (a[href], button, input, select, textarea, [tabindex] not -1, none disabled) and set state.3 to its absence; a MutationObserver on the subtree (childList, subtree, tabindex, href, disabled) rescans; disconnected when fan turns off or on unmount
effects.3: on mount → a matchMedia listener for prefers-reduced-motion: reduce; while it matches, props.15 is treated as '0ms' (new: the old component ignored it)
effects.4: dev-only console.warn, absent in production builds, when mode is 'shadow' and state.1 is not square, naming the height error hazeAnalyse reports; and when any plane is in hazeAnalyse's hidden list (new: the old component computed and ignored both)

## exits

exits.throws: from render when props.11 is not 'transform' or 'shadow', naming both, and when a colour prop is not a hex colour (hazeResolve throws). Owner: the nearest error boundary
exits.suspends: never
exits.handler-failures: none

## library

library.export: named `HazePlanes` from src/index.js
library.side-effects: none
library.utils: src/utils/hazePlanes.js — the scene; nothing in the component restates it
library.docs: docs/HazePlanes.md — props, the two mechanisms and when shadow is exact, the fan, what the first paint shows
