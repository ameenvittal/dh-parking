import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type SegmentOption<T extends string> = { value: T; label: ReactNode; icon?: ReactNode; disabled?: boolean }

type SegmentedControlProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: SegmentOption<T>[]
  ariaLabel: string
  size?: 'md' | 'sm'
  className?: string
  /** Stack icon above label (vehicle type picker). */
  stacked?: boolean
}

/** docs 06 section 6: track surface-2, active segment surface + shadow-raised. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
  className,
  stacked = false,
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex w-full gap-1 rounded-md bg-surface-2 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm px-2 font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50',
              size === 'md' ? 'min-h-11 text-body-sm' : 'min-h-8 text-body-sm',
              stacked && 'min-h-14 flex-col gap-0.5 py-1.5 text-caption',
              active ? 'bg-surface text-ink shadow-raised' : 'text-muted hover:text-ink',
            )}
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
