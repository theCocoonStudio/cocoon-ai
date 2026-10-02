import { useContext, useLayoutEffect, useMemo } from 'react'
import { ResizeEventContext } from './ResizeEventContext'

/**
 * A hook that encapsulates ResizeEventProvider's subscription logic while returning the desired size declaratively
 *
 * @param {string} key the key of a subscription: this component's own, when `element` is given, or another component's, to read its size
 * @param {HTMLElement | undefined} [element] the element to subscribe under `key`; an element, not a ref, so hold it in state and set it from the ref in a layout effect. Undefined reads the size registered under `key` elsewhere
 * @returns {{ width: number | undefined, height: number | undefined }} the size registered under `key`; both undefined until a subscription exists
 */
export function useResizeEvent(key, element) {
  const {
    subscriptions: { [key]: { size: { width, height } } = { size: {} } },
    subscribe,
    unsubscribe,
  } = useContext(ResizeEventContext)

  // subscription logic: only a consumer that subscribed unsubscribes, so a reader
  // of someone else's key never removes their subscription
  useLayoutEffect(() => {
    if (!(element instanceof HTMLElement)) return
    subscribe(key, element)
    return () => {
      unsubscribe(key, element)
    }
  }, [element, key, subscribe, unsubscribe])

  const result = useMemo(() => ({ width, height }), [height, width])

  return result
}
