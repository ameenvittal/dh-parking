import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-fade-in', className)}
      {...props}
    />
  )
}

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }

/** Centered dialog, max-width 480 px, radius lg, shadow-overlay (docs 06 section 6). */
export function DialogContent({ className, children, hideClose = false, ...props }: DialogContentProps) {
  const { t } = useTranslation('common')
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay className="grid place-items-center p-4">
      <DialogPrimitive.Content
        className={cn(
          'relative flex max-h-full w-full max-w-120 flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-5 shadow-overlay outline-none data-[state=open]:animate-pop-in lg:p-6',
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label={t('actions.close')}
            className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-md text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus lg:size-9"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 pr-10', className)} {...props} />
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-2 flex flex-col-reverse gap-2 lg:flex-row lg:justify-end [&>*]:w-full lg:[&>*]:w-auto', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-h3 text-ink', className)} {...props} />
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-body text-muted lg:text-body-sm', className)} {...props} />
}
