import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export const Sheet = SheetPrimitive.Root
export const SheetTrigger = SheetPrimitive.Trigger
export const SheetClose = SheetPrimitive.Close

const sheetVariants = cva(
  'fixed z-50 flex flex-col bg-surface shadow-overlay outline-none',
  {
    variants: {
      side: {
        right: 'inset-y-0 right-0 h-full w-full max-w-130 border-l border-line data-[state=open]:animate-slide-in-right',
        left: 'inset-y-0 left-0 h-full w-72 border-r border-line data-[state=open]:animate-slide-in-left',
        bottom: 'inset-x-0 bottom-0 max-h-11/12 rounded-t-xl pb-safe data-[state=open]:animate-sheet-up',
      },
    },
    defaultVariants: { side: 'right' },
  },
)

type SheetContentProps = ComponentProps<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetVariants> & { hideClose?: boolean }

/** Side panel. Admin detail drawer is `side="right"` at 520 px; mobile nav is `side="left"`. */
export function SheetContent({ className, children, side, hideClose = false, ...props }: SheetContentProps) {
  const { t } = useTranslation('common')
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-fade-in" />
      <SheetPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {hideClose ? null : (
          <SheetPrimitive.Close
            aria-label={t('actions.close')}
            className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-md text-muted outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus lg:top-3 lg:right-3 lg:size-9"
          >
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 border-b border-line px-4 py-4 pr-14 lg:px-6', className)} {...props} />
}

export function SheetBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6', className)} {...props} />
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 pb-safe lg:px-6', className)}
      {...props}
    />
  )
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('text-h3 text-ink', className)} {...props} />
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-body-sm text-muted', className)} {...props} />
}
