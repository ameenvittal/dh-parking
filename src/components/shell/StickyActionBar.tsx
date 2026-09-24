import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type StickyActionBarProps = {
  children: ReactNode
  /** Side by side instead of stacked (zone detail: "Wrong slot" and "Confirm"). */
  row?: boolean
  className?: string
}

/** Bottom action area, primary button full width (docs 06 section 5.1). Sits above the safe area. */
export function StickyActionBar({ children, row = false, className }: StickyActionBarProps) {
  return (
    <div className={cn('sticky bottom-0 z-20 border-t border-line bg-surface pb-safe', className)}>
      <div className={cn('mx-auto flex w-full max-w-160 gap-2 px-4 py-3', row ? 'flex-row [&>*]:flex-1' : 'flex-col')}>{children}</div>
    </div>
  )
}
