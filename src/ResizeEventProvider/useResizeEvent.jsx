import { useContext, useLayoutEffect, useMemo } from 'react'
import { ResizeEventContext } from './ResizeEventContext'

/**
 * A hook that encapsulates ResizeEventProvider's subscription logic while returning the desired size declaratively
 *
 * @param {string} [key] a unique key to associate with a subscription
 * @param {import('react').Ref<HTMLElement> | undefined} [ref] if setting a subcription, a ref to the node being subscribed
 * @returns {object} {width, height} of the subscribed element, by key
 */
export function useResizeEvent(key, ref) {
  const {
    subscriptions: { [key]: { size: { width, height } } = { size: {} } },
    subscribe,
    unsubscribe,
  } = useContext(ResizeEventContext)

  // subscription logic
  useLayoutEffect(() => {
    if (ref?.current instanceof HTMLElement) {
      subscribe(key, ref.current)
    }
    return () => {
      unsubscribe(key)
    }
  }, [key, ref, subscribe, unsubscribe])

  const result = useMemo(() => ({ width, height }), [height, width])

  return result
}
