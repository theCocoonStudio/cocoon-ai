# ScrollProvider spec

Written after the code (PR #40 merged 2026-10-02 with the spec declared retroactive); the ids are the ones the tests carry.

## meta

meta.target: portable
meta.runtime: client
meta.file: ScrollProvider.jsx (wraps ScrollProviderLogic.jsx in a ResizeEventProvider), useScroll.jsx, ScrollContext.js, features/SectionFeature.js, features/AnimationFeature.js

## imports

imports.1: import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
imports.2: import { ResizeEventProvider, useResizeEvent } from '@/ResizeEventProvider'
imports.3: import { SectionFeature } from './features/SectionFeature'

## props

props.1: eps — number, CSS pixels, optional; the smallest change of scrollTop between two frames that counts as scrolling; default one device pixel, 1 / devicePixelRatio, resolved on the client
props.2: toggleFeatureSections — boolean, optional, default false; track the active section and the offset within it
props.3: toggleFeatureAnimations — boolean, optional, default false, reserved; toggles nothing until the animation feature is wired
props.4: containerProps — object, optional, default {}; spread onto the wrapper div, nothing assigned internally
props.passthrough: no (containerProps is the explicit channel)
props.ref: handle (see handle.*)

## slots

slots.mechanism: children
slots.1: children — rendered inside the wrapper div; the first child is the scroll element; with props.2, its first child is a static container whose children are the sections, statically positioned with no margin or border

## context

context.consumed: ResizeEventContext, through useResizeEvent('_internalKey', staticContainer): the static container's size, so a layout change re-runs the features
context.provided: ScrollContext — { scrollTopRef, _containerRef, sections: { activeSectionIndex, activeSectionOffsetRef, _sectionFeature }, initialLayoutReady }
context.hook.1: useScroll() — returns the context object

## state

state.1: element — the scroll element, set from the wrapper's first child in a layout effect after mount, or by initialLayoutReady
state.2: activeSectionIndex — number, React state, initial 0; set once per section change by the sections feature
state.3: scrollTopRef — RefObject<number>, initial 0, written each loop frame
state.4: activeSectionOffsetRef — RefObject<number>, initial 0, written each loop frame when props.2
state.5: sectionFeature — one SectionFeature instance for the provider's life, updated with the element and its heights in the layout effect when props.2
state.reset: none

## markup

markup.1: root <div> with containerProps spread and the wrapper ref, containing children

## states

states.default: markup.1
states.disabled: none
states.pending: none
states.empty: none
states.error: none

## callbacks

callbacks.1: scroll — on the scroll element, passive; starts the frame loop if it is not running
callbacks.2: onSectionChange — internal, SectionFeature → setActiveSectionIndex, once per change
callbacks.neg.1: a scroll event while the loop runs starts nothing

## effects

effects.1: frame loop — each frame reads scrollTop into state.3, runs the enabled features, and continues only if the position moved by at least props.1 since the previous frame; the first frame after a scroll event always runs; stops on the first frame without movement (a later scroll event restarts it)
effects.2: layout — on element, static-container size, or toggles changing: the sections feature is updated with the element and its scrollHeight/clientHeight, the scroll listener is attached, and the loop runs once; cleanup removes the listener
effects.3: unmount — the loop is cancelled (its next frame exits) and the listener removed

## exits

exits.throws: SectionFeature throws when the cumulative section heights exceed the scroll height, and when a scrollTop is outside every section range
exits.suspends: never
exits.handler-failures: none

## handle

handle.1: scrollTopRef — state.3
handle.2: _sectionFeature — state.5
handle.3: _containerRef — the wrapper div's ref

## library

library.export: named `ScrollProvider` and `useScroll` from src/index.js
library.side-effects: none
library.helper: features/SectionFeature.js and features/AnimationFeature.js, pure classes with their own tests
library.generated: none
library.script: none
