import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type KeyValueProps = {
  label: ReactNode
  value: ReactNode
  /** Label above value instead of side by side. */
  stacked?: boolean
  className?: string
}

/** One labelled value row. Wrap several in a `<dl>`. */
export function KeyValue({ label, value, stacked = false, className }: KeyValueProps) {
  return (
    <div
      className={cn(
        stacked ? 'flex flex-col gap-0.5' : 'flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0',
        className,
      )}
    >
      <dt className="shrink-0 text-body-sm text-muted">{label}</dt>
      <dd className={cn('min-w-0 text-body text-ink lg:text-body-sm', !stacked && 'text-right')}>{value}</dd>
    </div>
  )
}
