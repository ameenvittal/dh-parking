import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ChipProps = Omit<ComponentProps<'button'>, 'children'> & {
  selected?: boolean
  icon?: ReactNode
  children: ReactNode
}

/** Selectable chip (docs 06 section 6). 36 px tall, radius sm. */
export function Chip({ selected = false, icon, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-body-sm font-semibold whitespace-nowrap transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 active:scale-[0.98]',
        selected ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
