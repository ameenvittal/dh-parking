import { Switch as SwitchPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent bg-line-strong outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary lg:h-6 lg:w-10',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-6 rounded-full bg-surface shadow-raised transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 lg:size-5 lg:data-[state=checked]:translate-x-4" />
    </SwitchPrimitive.Root>
  )
}
