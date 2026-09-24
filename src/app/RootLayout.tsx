import { Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { PageFallback } from './PageFallback'

export function RootLayout() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
    </>
  )
}
