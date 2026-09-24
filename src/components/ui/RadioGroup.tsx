import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('flex flex-col', className)} {...props} />
}

export function RadioDot({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface outline-none focus-visible:ring-2 focus-visible:ring-focus data-[state=checked]:border-primary',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-primary" />
    </RadioGroupPrimitive.Item>
  )
}

type RadioRowProps = { value: string; label: ReactNode; description?: ReactNode; className?: string }

/** 52 px tall radio row for mobile lists (SOS reasons, report reasons). */
export function RadioRow({ value, label, description, className }: RadioRowProps) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      className={cn(
        'group flex min-h-13 w-full items-center gap-3 border-b border-line px-1 text-left outline-none last:border-b-0 focus-visible:bg-surface-2',
        className,
      )}
    >
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-line-strong bg-surface group-data-[state=checked]:border-primary">
        <span className="size-2.5 rounded-full bg-primary opacity-0 group-data-[state=checked]:opacity-100" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-body text-ink">{label}</span>
        {description ? <span className="text-body-sm text-muted">{description}</span> : null}
      </span>
    </RadioGroupPrimitive.Item>
  )
}
