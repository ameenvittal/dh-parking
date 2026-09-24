import type { ComponentProps } from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from '@/lib/utils'

/**
 * Mobile bottom sheet (vaul). docs 06 section 5.1: snap points peek 120 px, half 50%, full 92%.
 * Pass `snapPoints={DRAWER_SNAPS}` (from ./drawerSnaps) with `activeSnapPoint` to use them;
 * the default is content height.
 */

export function Drawer({ shouldScaleBackground = false, ...props }: ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
}

export const DrawerTrigger = DrawerPrimitive.Trigger
export const DrawerClose = DrawerPrimitive.Close
export const DrawerPortal = DrawerPrimitive.Portal

export function DrawerOverlay({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return <DrawerPrimitive.Overlay className={cn('fixed inset-0 z-50 bg-ink/40', className)} {...props} />
}

type DrawerContentProps = ComponentProps<typeof DrawerPrimitive.Content> & {
  /** Hide the dim overlay (non-modal sheets over a map). */
  noOverlay?: boolean
}

export function DrawerContent({ className, children, noOverlay = false, ...props }: DrawerContentProps) {
  return (
    <DrawerPrimitive.Portal>
      {noOverlay ? null : <DrawerOverlay />}
      <DrawerPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-11/12 w-full max-w-160 flex-col rounded-t-xl border-t border-line bg-surface shadow-overlay outline-none',
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-line-strong" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

export function DrawerHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 px-4 pt-2 pb-3', className)} {...props} />
}

export function DrawerBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 pb-4', className)} {...props} />
}

export function DrawerFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 border-t border-line px-4 pt-3 pb-3 pb-safe', className)} {...props} />
}

export function DrawerTitle({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Title>) {
  return <DrawerPrimitive.Title className={cn('text-h3 text-ink', className)} {...props} />
}

export function DrawerDescription({ className, ...props }: ComponentProps<typeof DrawerPrimitive.Description>) {
  return <DrawerPrimitive.Description className={cn('text-body text-muted', className)} {...props} />
}
