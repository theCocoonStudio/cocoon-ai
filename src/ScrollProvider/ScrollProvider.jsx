import { forwardRef, useImperativeHandle, useRef } from 'react'

import { ResizeEventProvider } from '@/ResizeEventProvider'
import { ScrollProviderLogic } from './ScrollProviderLogic'

export const ScrollProvider = forwardRef(function ScrollProvider(
  { children, ...props },
  forwardedRef,
) {
  const ref = useRef()

  useImperativeHandle(forwardedRef, () => ref.current, [])

  return (
    <ResizeEventProvider>
      <ScrollProviderLogic ref={ref} {...props}>
        {children}
      </ScrollProviderLogic>
    </ResizeEventProvider>
  )
})
