import { useContext, useMemo } from 'react'
import { ScrollContext } from './ScrollContext'

/**
 * A consumer hook for ScrollProvider
 *
 * @returns {object} the context
 */
export function useScroll() {
  const context = useContext(ScrollContext)

  const result = useMemo(() => context, [context])

  return result
}
