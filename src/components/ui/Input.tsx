import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export type InputProps = ComponentProps<'input'> & { invalid?: boolean; warning?: boolean }

export const inputClasses =
  'h-12 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3.5 text-body text-ink outline-none transition-all duration-150 placeholder:text-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus/30 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle lg:h-10 lg:text-body-sm'

export function Input({ className, invalid, warning, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        inputClasses,
        warning && 'border-warning',
        invalid && 'border-danger focus-visible:border-danger',
        className,
      )}
      {...props}
    />
  )
}
