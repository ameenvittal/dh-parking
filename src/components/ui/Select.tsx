import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export type SelectOption = { value: string; label: string; disabled?: boolean }

export type SelectProps = Omit<ComponentProps<'select'>, 'children'> & {
  options: SelectOption[]
  placeholder?: string
  invalid?: boolean
}

/** Native select, restyled. Native gives the best picker on phones. */
export function Select({ className, options, placeholder, invalid, value, ...props }: SelectProps) {
  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <select
        value={value}
        aria-invalid={invalid || undefined}
        className={cn(
          'h-12 w-full appearance-none truncate rounded-md border border-line-strong bg-surface pr-10 pl-3 text-body text-ink outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-subtle lg:h-10 lg:text-body-sm',
          invalid && 'border-danger',
          value === '' && 'text-subtle',
        )}
        {...props}
      >
        {placeholder !== undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={20}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted lg:size-4"
      />
    </div>
  )
}
