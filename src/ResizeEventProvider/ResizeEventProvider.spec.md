# ResizeEventProvider spec

Written after the code (PR #40 merged 2026-10-02 with the spec declared retroactive); the ids are the ones the tests carry.

## meta

meta.target: portable
meta.runtime: client
meta.file: ResizeEventProvider.jsx, useResizeEvent.jsx, ResizeEventContext.js

## imports

imports.1: import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
imports.2: import { ResizeEventContext } from './ResizeEventContext'

## props

props.1: debugMode — React ref to a boolean, optional; while `ref.current` is true an observer entry with no subscription throws instead of being dropped; a ref because the observer callback is created once
props.2: quiet — boolean, optional, default false; when true an invalid subscription is ignored instead of throwing
props.passthrough: no
props.ref: none

## slots

slots.mechanism: children
slots.1: children — rendered inside the context provider, no wrapper element

## context

context.consumed: none
context.provided: ResizeEventContext — { subscriptions, subscribe, unsubscribe }; subscriptions is keyed by key: { element, size: { width, height } }; subscribe(key, element | selector); unsubscribe(key, element)
context.hook.1: useResizeEvent(key, element?) — with an element, subscribes it under key in a layout effect and unsubscribes on cleanup; without, reads the size under key; returns { width, height }, both undefined until a subscription under key exists

## state

state.1: subscriptions — object keyed by key, initial {}
state.2: elementToKeys — WeakMap<Element, Set<string>>, internal, one set of keys per element
state.3: observer — one ResizeObserver, created on the first subscription, never during render
state.reset: none

## markup

markup.1: none; the provider renders only its children

## states

states.default: markup.1
states.disabled: none
states.pending: none
states.empty: none
states.error: none

## callbacks

callbacks.1: observer callback — for each entry, every key of the entry's element gets size { width, height } from contentRect; an element with no keys is unobserved
callbacks.neg.1: a key not registered under the entry's element does not change

## effects

effects.1: subscribe(key, element) — adds key to the element's set, observes the element on its first key, records clientWidth/clientHeight as the initial size
effects.2: unsubscribe(key, element) — removes key from the element's set, unobserves the element on its last key, removes key from subscriptions
effects.3: unmount — the observer, if created, is disconnected
effects.4: useResizeEvent cleanup — unsubscribes only what it subscribed; a reader (no element) removes nothing

## exits

exits.throws: subscribe with a non-element and quiet false throws; the observer callback throws on an entry with no keys while debugMode.current is true
exits.suspends: never
exits.handler-failures: none

## library

library.export: named `ResizeEventProvider` and `useResizeEvent` from src/index.js
library.side-effects: none
library.helper: none
library.generated: none
library.script: none
