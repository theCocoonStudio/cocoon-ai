import { useContext, useLayoutEffect, useMemo } from 'react'
import { ResizeEventContext } from './ResizeEventContext'

/**
 * A hook that encapsulates ResizeEventProvider's subscription logic while returning the desired size declaratively
 *
 * @param {string} [key] a unique key to associate with a subscription
 * @param {HTMLElement | undefined} [element] if setting a subcription, the node being subscribed
 * @returns {object} {width, height} of the subscribed element, by key
 */
export function useResizeEvent(key, element) {
  const {
    subscriptions: { [key]: { size: { width, height } } = { size: {} } },
    subscribe,
    unsubscribe,
  } = useContext(ResizeEventContext)

  // subscription logic
  useLayoutEffect(() => {
    const oldKey = key
    const oldElement = element
    if (element instanceof HTMLElement) {
      subscribe(key, element)
    }
    return () => {
      if (oldElement instanceof HTMLElement) {
        unsubscribe(oldKey, oldElement)
      }
    }
  }, [element, key, subscribe, unsubscribe])

  const result = useMemo(() => ({ width, height }), [height, width])

  return result
}
