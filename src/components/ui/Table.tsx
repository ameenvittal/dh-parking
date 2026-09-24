import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Admin table (docs 06 section 6): sticky header on surface-2, 44 px rows, hover canvas. */
export function Table({ className, wrapperClassName, ...props }: ComponentProps<'table'> & { wrapperClassName?: string }) {
  return (
    <div className={cn('relative w-full overflow-auto', wrapperClassName)}>
      <table className={cn('w-full caption-bottom border-collapse text-body-sm', className)} {...props} />
    </div>
  )
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('sticky top-0 z-10 bg-surface-2', className)} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('bg-surface', className)} {...props} />
}

export function TableRow({ className, selected, ...props }: ComponentProps<'tr'> & { selected?: boolean }) {
  return (
    <tr
      data-selected={selected || undefined}
      className={cn('border-b border-line transition-colors duration-100 hover:bg-canvas/80 data-[selected]:bg-primary-soft', className)}
      {...props}
    />
  )
}

export function TableHead({ className, numeric, ...props }: ComponentProps<'th'> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        'h-10 px-3 text-left align-middle text-caption font-semibold whitespace-nowrap text-muted',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, numeric, ...props }: ComponentProps<'td'> & { numeric?: boolean }) {
  return (
    <td
      className={cn('h-12 px-4 align-middle text-ink', numeric && 'text-right tabular-nums', className)}
      {...props}
    />
  )
}
