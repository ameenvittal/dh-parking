import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'

export type BottomNavItem = {
  to: string
  label: ReactNode
  icon: LucideIcon
  /** Match only the exact path (for index routes). */
  end?: boolean
  badge?: number
  onClick?: () => void
}

type BottomNavProps = { items: BottomNavItem[]; ariaLabel: string; className?: string }

/** App-style bottom tab bar with safe-area padding. */
export function BottomNav({ items, ariaLabel, className }: BottomNavProps) {
  return (
    <nav aria-label={ariaLabel} className={cn('sticky bottom-0 z-30 border-t border-line bg-surface pb-safe', className)}>
      <ul className="mx-auto flex max-w-160 items-stretch">
        {items.map((item) => {
          const Icon = item.icon
          const inner = (active: boolean) => (
            <>
              <span className="relative">
                <Icon size={24} strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-caption leading-none text-on-primary tabular-nums">
                    {item.badge > 99 ? '99' : item.badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate text-caption">{item.label}</span>
            </>
          )
          const cls = (active: boolean) =>
            cn(
              'flex h-16 w-full flex-col items-center justify-center gap-1 px-1 outline-none focus-visible:bg-surface-2',
              active ? 'text-primary' : 'text-muted',
            )
          return (
            <li key={item.to} className="min-w-0 flex-1">
              {item.onClick ? (
                <button type="button" onClick={item.onClick} className={cls(false)}>
                  {inner(false)}
                </button>
              ) : (
                <NavLink to={item.to} end={item.end} className={({ isActive }) => cls(isActive)}>
                  {({ isActive }) => inner(isActive)}
                </NavLink>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
