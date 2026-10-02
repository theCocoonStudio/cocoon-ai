// @vitest-environment node
// Server render: nothing in either provider may touch a browser global during render.
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ResizeEventProvider } from './ResizeEventProvider'
import { ScrollProvider } from '../ScrollProvider/ScrollProvider'

describe('ssr', () => {
  it('ssr: ResizeEventProvider renders on the server', () => {
    expect(typeof globalThis.ResizeObserver).toBe('undefined')
    expect(
      renderToString(
        <ResizeEventProvider>
          <p>x</p>
        </ResizeEventProvider>,
      ),
    ).toBe('<p>x</p>')
  })

  it('ssr: ScrollProvider renders on the server', () => {
    expect(
      renderToString(
        <ScrollProvider toggleFeatureSections>
          <div>
            <div />
          </div>
        </ScrollProvider>,
      ),
    ).toBe('<div><div><div></div></div></div>')
  })
})
