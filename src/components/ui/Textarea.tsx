import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = ComponentProps<'textarea'> & { invalid?: boolean }

export function Textarea({ className, invalid, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full min-w-0 resize-y rounded-md border border-line-strong bg-surface px-3 py-2.5 text-body text-ink outline-none transition-colors placeholder:text-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:bg-surface-2 lg:text-body-sm',
        invalid && 'border-danger',
        className,
      )}
      {...props}
    />
  )
}
