// The page src/ScrollProvider/ScrollProvider.browser.test.js drives: both
// providers in a real document, real scrolling, a real ResizeObserver, real
// frames. `window.__sectionHeight` (set before load) sizes the sections;
// `window.__scroll` is what the test calls.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ScrollProvider } from './ScrollProvider'
import { useScroll } from './useScroll'
import { ResizeEventProvider, useResizeEvent } from '../ResizeEventProvider'

// count frames so a test can show the loop stops when scrolling stops
let frames = 0
const raf = window.requestAnimationFrame.bind(window)
window.requestAnimationFrame = (cb) => {
  frames += 1
  return raf(cb)
}

function Sections() {
  const { sections } = useScroll()
  // the state value, so a test can read what a consumer rendered; written after commit
  useEffect(() => {
    window.__index = sections.activeSectionIndex
  })
  return null
}

function Sized() {
  const ref = useRef()
  const [el, setEl] = useState()
  useLayoutEffect(() => setEl(ref.current), [])
  const { width, height } = useResizeEvent('sized', el)
  useEffect(() => {
    window.__sized = { width, height }
  })
  return (
    <div
      ref={ref}
      id='sized'
      style={{ width: 50, height: 20, position: 'absolute', left: 0, top: 0 }}
    />
  )
}

function Page() {
  const handle = useRef()
  const h = window.__sectionHeight ?? 100
  useLayoutEffect(() => {
    const scroller = document.getElementById('scroller')
    window.__scroll = {
      /** Scroll the element and wait two frames. */
      async scrollTo(y) {
        scroller.scrollTop = y
        await window.__scroll.frame(2)
      },
      /** Wait n frames. */
      frame(n = 1) {
        return new Promise((resolve) => {
          const step = (left) =>
            left <= 0 ? resolve() : raf(() => step(left - 1))
          step(n)
        })
      },
      /** What the refs and the feature hold now. */
      read() {
        const f = handle.current._sectionFeature
        return {
          scrollTop: handle.current.scrollTopRef.current,
          index: f.activeSectionIndex,
          offset: f.activeSectionOffset,
          rendered: window.__index,
          frames,
          sized: window.__sized,
        }
      },
      /** Resize every section; the static container's height changes with them. */
      setSectionHeight(px) {
        for (const s of document.querySelectorAll('section'))
          s.style.height = `${px}px`
      },
      /** Resize the hook's element. */
      setSizedWidth(px) {
        document.getElementById('sized').style.width = `${px}px`
      },
    }
    window.__ready = true
  }, [])
  return (
    <>
      <ResizeEventProvider>
        <Sized />
      </ResizeEventProvider>
      <ScrollProvider
        ref={handle}
        toggleFeatureSections
        containerProps={{ style: { height: '100%' } }}
      >
        <div id='scroller' style={{ height: '100%', overflowY: 'auto' }}>
          <main style={{ margin: 0, padding: 0 }}>
            <section style={{ height: h, margin: 0, border: 0 }} />
            <section style={{ height: h, margin: 0, border: 0 }} />
            <section style={{ height: h, margin: 0, border: 0 }} />
          </main>
        </div>
        <Sections />
      </ScrollProvider>
    </>
  )
}

createRoot(document.getElementById('root')).render(<Page />)
