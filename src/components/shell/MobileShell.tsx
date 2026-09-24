import type { ReactNode } from 'react'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { cn } from '@/lib/utils'

type MobileShellProps = {
  /** Usually a `<TopBar />`. */
  topBar?: ReactNode
  children: ReactNode
  /** Usually a `<StickyActionBar />`. */
  actionBar?: ReactNode
  /** Usually a `<BottomNav />`. */
  bottomNav?: ReactNode
  /** Remove content padding (full-bleed maps, custom layouts). */
  bleed?: boolean
  className?: string
  contentClassName?: string
}

/**
 * Mobile screen frame for driver, gate and zone (docs 06 section 5.1): top bar,
 * offline banner, scrolling content with 16 px side padding, then a sticky action
 * bar and an optional bottom nav. Centers at 640 px on larger screens.
 */
export function MobileShell({ topBar, children, actionBar, bottomNav, bleed = false, className, contentClassName }: MobileShellProps) {
  return (
    <div className={cn('flex min-h-app flex-col bg-canvas', className)}>
      {topBar}
      <OfflineBanner />
      <main
        className={cn(
          'mx-auto flex w-full max-w-160 flex-1 flex-col',
          bleed ? '' : 'gap-4 px-4 pt-4 pb-6',
          contentClassName,
        )}
      >
        {children}
      </main>
      {actionBar}
      {bottomNav}
    </div>
  )
}
