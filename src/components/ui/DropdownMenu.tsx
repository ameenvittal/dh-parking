import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger
export const DropdownMenuGroup = MenuPrimitive.Group

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-48 overflow-hidden rounded-md border border-line bg-surface p-1 shadow-overlay data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

type ItemProps = ComponentProps<typeof MenuPrimitive.Item> & { danger?: boolean }

export function DropdownMenuItem({ className, danger, ...props }: ItemProps) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-body text-ink outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2 lg:min-h-9 lg:text-body-sm [&_svg]:size-4.5 [&_svg]:text-muted',
        danger && 'text-danger [&_svg]:text-danger',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-3 py-2 text-body-sm text-muted', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />
}
