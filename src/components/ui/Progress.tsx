import { Progress as ProgressPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type ProgressProps = ComponentProps<typeof ProgressPrimitive.Root> & { value: number; indicatorClassName?: string }

/** 4 px bar, primary on surface-2 (stepper, occupancy). `value` is 0 to 100. */
export function Progress({ className, value, indicatorClassName, ...props }: ProgressProps) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <ProgressPrimitive.Root
      value={v}
      className={cn('relative h-1 w-full overflow-hidden rounded-full bg-surface-2', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full bg-primary transition-all duration-200', indicatorClassName)}
        style={{ width: `${v}%` }}
      />
    </ProgressPrimitive.Root>
  )
}
