import type { ReactNode } from 'react'
import { StickyActionBar } from '@/components/shell/StickyActionBar'

/** Step content with 16 px gutters, then the sticky action bar. */
export function StepBody({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <>
      <div className="mx-auto flex w-full max-w-160 flex-1 flex-col gap-5 px-4 pt-4 pb-8">{children}</div>
      <StickyActionBar>{actions}</StickyActionBar>
    </>
  )
}
