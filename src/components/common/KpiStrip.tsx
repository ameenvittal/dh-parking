import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type KpiItem = {
  key: string
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  tone?: 'default' | 'danger' | 'warning' | 'success'
  statusColor?: 'available' | 'assigned' | 'enroute' | 'waiting' | 'occupied' | 'exited' | 'danger' | 'warning' | 'primary'
  icon?: LucideIcon
  badge?: ReactNode
  onClick?: () => void
}

type KpiStripProps = {
  items: KpiItem[]
  /** `compact` for phones: smaller numbers, used on the zone screen. */
  size?: 'default' | 'compact'
  className?: string
  footer?: ReactNode
}

const toneText = {
  default: 'text-ink',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
} as const

const statusStyles = {
  available: {
    accent: 'border-t-status-available',
    iconBg: 'bg-status-available-soft text-status-available',
  },
  assigned: {
    accent: 'border-t-status-assigned',
    iconBg: 'bg-status-assigned-soft text-status-assigned',
  },
  enroute: {
    accent: 'border-t-status-enroute',
    iconBg: 'bg-status-enroute-soft text-status-enroute',
  },
  waiting: {
    accent: 'border-t-status-waiting',
    iconBg: 'bg-status-waiting-soft text-status-waiting',
  },
  occupied: {
    accent: 'border-t-status-occupied',
    iconBg: 'bg-status-occupied-soft text-status-occupied',
  },
  exited: {
    accent: 'border-t-status-exited',
    iconBg: 'bg-status-exited-soft text-status-exited',
  },
  danger: {
    accent: 'border-t-danger',
    iconBg: 'bg-danger-soft text-danger',
  },
  warning: {
    accent: 'border-t-warning',
    iconBg: 'bg-warning-soft text-warning',
  },
  primary: {
    accent: 'border-t-primary',
    iconBg: 'bg-primary-soft text-primary',
  },
} as const

const colsBySize: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-3 lg:grid-cols-6',
}

/** One bordered strip divided by `line` rules with subtle raised shadow (docs 06 section 6). */
export function KpiStrip({ items, size = 'default', className, footer }: KpiStripProps) {
  const cols = colsBySize[items.length] ?? 'grid-cols-3'
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface shadow-raised', className)}>
      <div className={cn('-mr-px -mb-px grid', cols)}>
        {items.map((item) => {
          const Tag = item.onClick ? 'button' : 'div'
          const Icon = item.icon
          const style = item.statusColor ? statusStyles[item.statusColor] : null

          return (
            <Tag
              key={item.key}
              type={item.onClick ? 'button' : undefined}
              onClick={item.onClick}
              className={cn(
                'group flex min-w-0 flex-col items-start border-r border-b border-line text-left transition-colors',
                style && `border-t-2 ${style.accent}`,
                size === 'compact' ? 'gap-0.5 px-3 py-2.5' : 'gap-1 p-3.5 sm:p-4 lg:p-5',
                item.onClick && 'cursor-pointer outline-none hover:bg-canvas/70 active:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
              )}
            >
              <div className="flex w-full items-center justify-between gap-1.5">
                <span className="truncate text-body-sm font-medium text-muted">{item.label}</span>
                {Icon ? (
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-md',
                      style ? style.iconBg : 'bg-surface-2 text-muted',
                    )}
                  >
                    <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
                  </span>
                ) : item.badge ? (
                  item.badge
                ) : null}
              </div>
              <span
                className={cn(
                  'tabular-nums font-bold tracking-tight',
                  size === 'compact' ? 'text-h2' : 'text-h2 lg:text-h1',
                  toneText[item.tone ?? 'default'],
                )}
              >
                {item.value}
              </span>
              {item.delta ? (
                <span
                  className={cn(
                    'truncate text-caption',
                    item.tone === 'danger' ? 'font-semibold text-danger' : 'text-muted',
                  )}
                >
                  {item.delta}
                </span>
              ) : null}
            </Tag>
          )
        })}
      </div>
      {footer ? <div className="border-t border-line bg-surface-2/40 px-4 py-2.5">{footer}</div> : null}
    </div>
  )
}
