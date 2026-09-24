import { Suspense } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { DemoDock } from '@/features/sim/DemoDock'
import { PageFallback } from './PageFallback'

export function RootLayout() {
  return (
    <>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
      <Suspense fallback={null}>
        <DemoDock />
      </Suspense>
      <ScrollRestoration />
    </>
  )
}
