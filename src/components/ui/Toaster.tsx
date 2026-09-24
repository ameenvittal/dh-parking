import { Toaster as Sonner } from 'sonner'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Bottom-center toasts across screen widths (docs 06 section 6). */
export function Toaster() {
  const wide = useMediaQuery('(min-width: 1024px)')
  return (
    <Sonner
      position="bottom-center"
      offset={wide ? 24 : 16}
      mobileOffset={{ bottom: 88, left: 16, right: 16 }}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            'group !rounded-md !border !border-line !bg-ink !text-on-primary !shadow-overlay !font-sans !text-body-sm !px-4 !py-3 !gap-3',
          title: '!font-semibold',
          description: '!text-on-primary/80',
          actionButton: '!bg-surface !text-ink !font-semibold !rounded-sm',
          cancelButton: '!bg-transparent !text-on-primary',
          icon: '!text-on-primary',
        },
      }}
    />
  )
}
