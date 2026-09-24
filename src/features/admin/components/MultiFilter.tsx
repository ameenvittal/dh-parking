import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

type MultiFilterProps<T extends string> = {
  label: string
  options: { value: T; label: string }[]
  value: T[]
  onChange: (value: T[]) => void
  clearLabel: string
  className?: string
}

/** Filter button with a checkbox list. Shows the count of picked values. */
export function MultiFilter<T extends string>({ label, options, value, onChange, clearLabel, className }: MultiFilterProps<T>) {
  const id = useId()
  const active = value.length > 0
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-body-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus lg:h-9',
            active ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
            className,
          )}
        >
          {label}
          {active ? <span className="rounded-sm bg-surface px-1.5 text-caption tabular-nums">{value.length}</span> : null}
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <ul className="flex max-h-72 flex-col overflow-y-auto">
          {options.map((o) => {
            const cid = `${id}-${o.value}`
            const checked = value.includes(o.value)
            return (
              <li key={o.value}>
                <label htmlFor={cid} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 text-body-sm text-ink hover:bg-surface-2 lg:min-h-9">
                  <Checkbox
                    id={cid}
                    checked={checked}
                    onCheckedChange={(c) => onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))}
                  />
                  {o.label}
                </label>
              </li>
            )
          })}
        </ul>
        {active ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 w-full rounded-sm px-2 py-2 text-left text-body-sm font-semibold text-primary outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus"
          >
            {clearLabel}
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
