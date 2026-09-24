import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type KpiItem = {
  key: string
  label: ReactNode
  value: ReactNode
  delta?: ReactNode
  tone?: 'default' | 'danger' | 'warning' | 'success'
  onClick?: () => void
}

type KpiStripProps = {
  items: KpiItem[]
  /** `compact` for phones: smaller numbers, used on the zone screen. */
  size?: 'default' | 'compact'
  className?: string
}

const toneText = {
  default: 'text-ink',
  danger: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
} as const

const colsBySize: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-3 lg:grid-cols-6',
}

/** One bordered strip divided by `line` rules, not floating cards (docs 06 section 6). */
export function KpiStrip({ items, size = 'default', className }: KpiStripProps) {
  const cols = colsBySize[items.length] ?? 'grid-cols-3'
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-surface', className)}>
      <div className={cn('-mr-px -mb-px grid', cols)}>
        {items.map((item) => {
          const Tag = item.onClick ? 'button' : 'div'
          return (
            <Tag
              key={item.key}
              type={item.onClick ? 'button' : undefined}
              onClick={item.onClick}
              className={cn(
                'flex min-w-0 flex-col items-start border-r border-b border-line text-left',
                size === 'compact' ? 'gap-0 px-3 py-2.5' : 'gap-1 px-4 py-3 lg:px-5 lg:py-4',
                item.onClick && 'outline-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
              )}
            >
              <span
                className={cn(
                  'order-1 tabular-nums',
                  size === 'compact' ? 'text-h2' : 'text-h2 lg:text-h1',
                  toneText[item.tone ?? 'default'],
                )}
              >
                {item.value}
              </span>
              <span className="order-2 truncate text-body-sm text-muted">{item.label}</span>
              {item.delta ? <span className="order-3 text-caption text-muted">{item.delta}</span> : null}
            </Tag>
          )
        })}
      </div>
    </div>
  )
}
