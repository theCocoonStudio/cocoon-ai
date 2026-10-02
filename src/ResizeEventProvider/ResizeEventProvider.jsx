import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResizeEventContext } from './ResizeEventContext'

/**
 * Provides updated width and height values of subscribed elements; wraps one ResizeObserver and updates declaratively
 *
 * @param {object} props
 * @param {import('react').Ref<boolean>} [props.debugMode] a ref to a boolean; while true, an observer entry with no subscription throws instead of being dropped. A ref, because the observer callback is created once and reads the current value
 * @param {boolean} [props.quiet=false] whether invalid subscriptions are ignored instead of throwing
 * @param {import('react').ReactNode} [props.children] context consumers
 *
 */
export function ResizeEventProvider({ debugMode, quiet = false, children }) {
  const [subscriptions, setSubscriptions] = useState({})

  // One element can carry several keys (two consumers watching one node), so the
  // map holds a set of keys per element. Keys are not unique across elements either:
  // the subscriptions state is keyed by key, so a key names one element at a time.
  const elementToKeys = useRef(new WeakMap())

  // the debugMode ref prop is read through a local ref, so the observer callback,
  // created once, sees the current value without listing a ref read as a dependency
  const debugModeRef = useRef(debugMode)
  useEffect(() => {
    debugModeRef.current = debugMode
  }, [debugMode])

  const observerCallback = useCallback((entries, _observer) => {
    setSubscriptions((prev) => {
      const override = {}
      for (const {
        target,
        contentRect: { width, height },
      } of entries) {
        const keys = elementToKeys.current.get(target)
        if (!keys || keys.size === 0) {
          if (debugModeRef.current?.current) {
            throw new Error(
              'an observer entry is not associated with a subscriptions key',
            )
          }
          _observer.unobserve(target)
          continue
        }
        for (const key of keys) {
          override[key] = { ...prev[key], size: { width, height } }
        }
      }
      return { ...prev, ...override }
    })
  }, [])

  // The observer is created on the first subscription, never during render, so the
  // provider renders on a server that has no ResizeObserver. Subscriptions arrive from
  // layout effects, which run on the client only.
  const observerRef = useRef(null)
  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new ResizeObserver(observerCallback)
    }
    return observerRef.current
  }, [observerCallback])

  // disconnect on unmount
  useEffect(
    () => () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    },
    [],
  )

  const subscribe = useCallback(
    (key, el) => {
      const resolved = typeof el === 'string' ? document.querySelector(el) : el
      const valid = resolved instanceof HTMLElement

      if (!valid) {
        if (!quiet) {
          throw new Error('subscribe expects a valid element or query selector')
        }
        return
      }
      const keys = elementToKeys.current.get(resolved)
      if (keys) {
        keys.add(key)
      } else {
        elementToKeys.current.set(resolved, new Set([key]))
        getObserver().observe(resolved)
      }

      setSubscriptions((prev) => ({
        ...prev,
        [key]: {
          element: resolved,
          size: {
            width: resolved.clientWidth,
            height: resolved.clientHeight,
          },
        },
      }))
    },
    [getObserver, quiet],
  )

  const unsubscribe = useCallback((key, element) => {
    const keys = elementToKeys.current.get(element)
    if (keys) {
      keys.delete(key)
      if (keys.size === 0) {
        elementToKeys.current.delete(element)
        observerRef.current?.unobserve(element)
      }
    }
    // eslint-disable-next-line no-unused-vars
    setSubscriptions(({ [key]: _, ...prev }) => ({ ...prev }))
  }, [])

  const contextValue = useMemo(
    () => ({
      subscriptions,
      subscribe,
      unsubscribe,
    }),
    [subscriptions, subscribe, unsubscribe],
  )

  return (
    <ResizeEventContext.Provider value={contextValue}>
      {children}
    </ResizeEventContext.Provider>
  )
}
