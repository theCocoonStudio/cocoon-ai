import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ScrollContext } from './ScrollContext'
import { SectionFeature } from './features/SectionFeature'
import { useResizeEvent } from '@/ResizeEventProvider'

/**
 * Exposes scroll-based state and scroll-related controls.
 *
 * @param {object} props
 * @param {import('react').ReactNode} [props.children] context consumers; if toggleFeatureSections=true, `<div id="div1"><div id="div2">[...sectionElements]</div></div>`, where div1 is a scroll element and div2 + children are statically-positioned elements with no margin or border
 * @param {import('react').Ref<undefined> | undefined} [props.ref] imperative handle exposed through the ref
 * @param {number | undefined} [props.eps] the smallest change of scrollTop, in CSS pixels, that counts as scrolling between two frames; by default one device pixel, 1 / devicePixelRatio, resolved on the client
 * @param {boolean | undefined} [props.toggleFeatureSections=false] feature toggle: whether section index boundary tracking is enabled
 * @param {boolean | undefined} [props.toggleFeatureAnimations=false] feature toggle, reserved: the animation feature is not wired yet, so this toggles nothing
 * @param {object | undefined} [props.containerProps={}] props to apply to the div container wrapping props.children. No props are assigned internally. A direct ref is available in both the context and the handle (_containerRef)
 *
 */
export const ScrollProviderLogic = forwardRef(function ScrollProvider(
  {
    eps,
    toggleFeatureSections = false,
    toggleFeatureAnimations = false,
    containerProps = {},
    children,
  },
  forwardedRef,
) {
  /* start internal markup refs + state*/

  const container = useRef()
  const [element, setElement] = useState()
  const killLoop = useRef(false)
  useLayoutEffect(() => {
    setElement(container.current?.children[0])
    return () => {
      killLoop.current = true
    }
  }, [])
  /* end internal markup refs */

  /* start independent internal state*/

  const { width, height } = useResizeEvent('_internalKey', element?.children[0])

  /* end independent internal state*/

  /* start feature state */
  const [sectionFeature] = useState(
    () =>
      new SectionFeature(
        element,
        element?.scrollHeight || 0,
        element?.clientHeight || 0,
      ),
  )
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const activeSectionOffsetRef = useRef(0.0)

  /* end feature state */

  /* start exposed refs */

  const currentScrollTopRef = useRef(0)

  /* end exposed refs */

  /* start scroll handler */

  const isLoopRunning = useRef(false)
  const prevScrollTop = useRef(-1)

  const updateLoop = useCallback(() => {
    if (!element || killLoop.current) {
      isLoopRunning.current = false
      return
    }

    const currentScrollTop = element.scrollTop
    currentScrollTopRef.current = currentScrollTop

    // start feature calculations
    if (toggleFeatureSections) {
      activeSectionOffsetRef.current = sectionFeature.setScrollTop(
        currentScrollTopRef.current,
        setActiveSectionIndex,
      ).activeSectionOffset
    }

    if (toggleFeatureAnimations) {
      //
    }
    // end feature calculations

    // The loop runs while scrollTop moves by at least one threshold per frame and
    // stops on the first frame it does not. No settle frames: the browser fires a
    // scroll event for every frame in which the position changed, and that event
    // restarts the loop, so a frame without movement is the end, not a pause.
    const threshold = eps ?? 1 / (window.devicePixelRatio || 1)
    const hasScrollChanged =
      Math.abs(currentScrollTop - prevScrollTop.current) >= threshold

    if (!hasScrollChanged) {
      isLoopRunning.current = false
      return
    }

    prevScrollTop.current = currentScrollTop
    requestAnimationFrame(updateLoop)
  }, [
    element,
    eps,
    sectionFeature,
    toggleFeatureAnimations,
    toggleFeatureSections,
  ])

  const handleScroll = useCallback(() => {
    if (!element || isLoopRunning.current) return

    isLoopRunning.current = true
    // the first frame always runs: it reads the position, updates the refs and the
    // features, and continues only if the position moved again since this event
    prevScrollTop.current = element.scrollTop

    requestAnimationFrame(updateLoop)
  }, [element, updateLoop])

  /* end scroll handler */

  /* start layout effects */

  useLayoutEffect(() => {
    if (!element) return

    // feature state updates
    if (toggleFeatureSections) {
      sectionFeature.update(element, element.scrollHeight, element.clientHeight)
    }

    if (toggleFeatureAnimations) {
      //
    }
    // scroll handler updates
    element.addEventListener('scroll', handleScroll, { passive: true })
    // ensure scroll animation is updated after changes
    handleScroll()
    return () => {
      // scroll handler cleanup
      element.removeEventListener('scroll', handleScroll)
    }
  }, [
    handleScroll,
    sectionFeature,
    toggleFeatureSections,
    toggleFeatureAnimations,
    width,
    height,
    element,
  ]) // width and height must be included for the state to update on resizes and scroll handlers rerun to update the frame

  /* end layout effects */

  /* start imperative handle: refs and imperative callbacks */

  useImperativeHandle(
    forwardedRef,
    () => ({
      scrollTopRef: currentScrollTopRef,
      _sectionFeature: sectionFeature,
      _containerRef: container,
    }),
    [sectionFeature],
  )

  /* end imperative handle: refs and imperative callbacks */

  /* start memoized consumer return */

  const contextValue = useMemo(
    () => ({
      _containerRef: container,
      scrollTopRef: currentScrollTopRef,
      sections: {
        activeSectionIndex,
        activeSectionOffsetRef,
        _sectionFeature: sectionFeature,
      },
      // for situations wherein children are rendered later (e.g. async, SSR)
      initialLayoutReady: () => {
        setElement(container.current?.children[0])
      },
    }),
    [activeSectionIndex, sectionFeature],
  )

  /* end memoized consumer return */

  return (
    <ScrollContext.Provider value={contextValue}>
      <div ref={container} {...containerProps}>
        {children}
      </div>
    </ScrollContext.Provider>
  )
})
