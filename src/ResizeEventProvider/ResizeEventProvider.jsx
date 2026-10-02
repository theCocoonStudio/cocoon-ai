import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResizeEventContext } from './ResizeEventContext'

/**
 * Provides updated width and height values of subscribed refs; wraps a ResizeObserver and updates declaratively
 *
 * @param {object} props
 * @param {import('react').Ref<boolean>} [props.debugMode=false] throws if a non-fatal yet inconsistent runtime state is detected; only the value of the ref should change after mount
 * @param {boolean} [props.quiet=false] whether invalid subscriptions throw
 * @param {import('react').ReactNode} [props.children] context consumers
 *
 */
export function ResizeEventProvider({ debugMode, quiet = false, children }) {
  const [subscriptions, setSubscriptions] = useState({})

  const elementToKeyMap = useRef(new WeakMap())

  const observerCallback = useCallback(
    (entries, _observer) => {
      setSubscriptions((prev) => {
        const override = {}
        for (const {
          target,
          contentRect: { width, height },
        } of entries) {
          const key = elementToKeyMap.current.get(target)
          if (!key) {
            if (debugMode?.current) {
              throw new Error(
                'an observer entry is not associated with a subscriptions key',
              )
            }
            _observer.unobserve(target)
          } else {
            override[key] = { ...prev[key], size: { width, height } }
          }
        }
        return { ...prev, ...override }
      })
    },
    [debugMode],
  )

  const [observer] = useState(() => {
    return new ResizeObserver(observerCallback)
  })

  // disconnect on unmount
  useEffect(() => () => observer.disconnect(), [observer])

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
      elementToKeyMap.current.set(
        resolved,
        elementToKeyMap.current.has(resolved)
          ? `${elementToKeyMap.current.get(resolved)}::${key}`
          : key,
      )

      setSubscriptions(({ [key]: { element } = {}, ...prev }) => {
        if (
          element !== resolved &&
          !Object.keys(prev).find((_key) => prev[_key].element === element)
        ) {
          observer.observe(resolved)
        }
        return {
          ...prev,
          [key]: {
            element: resolved,
            size: {
              width: resolved.clientWidth,
              height: resolved.clientHeight,
            },
          },
        }
      })
    },
    [observer, quiet],
  )

  const unsubscribe = useCallback((key, element) => {
    if (elementToKeyMap.current.has(element)) {
      const newKey = elementToKeyMap.current
        .get(element)
        .split('::')
        .filter((_key) => _key !== key)
        .join('::')

      if (newKey) {
        elementToKeyMap.current.set(element, newKey)
      } else {
        elementToKeyMap.current.delete(element)
      }
    }
    // eslint-disable-next-line no-unused-vars
    setSubscriptions(({ [key]: _, ...prev }) => {
      return {
        ...prev,
      }
    })
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
