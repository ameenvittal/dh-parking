import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/Sheet'
import { BrandMark } from './BrandMark'
import { EventSwitcher } from './EventSwitcher'
import { SidebarNav } from './SidebarNav'
import type { AdminEvent } from './useAdminEvent'

type MobileNavSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  admin: AdminEvent
  alertCount: number
  sos: boolean
}

/** Below 1024 px the sidebar becomes a slide-in sheet with the event switcher on top. */
export function MobileNavSheet({ open, onOpenChange, admin, alertCount, sos }: MobileNavSheetProps) {
  const { t } = useTranslation('common')
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 pt-safe" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetTitle className="sr-only">{t('shell.mainNav')}</SheetTitle>
        <SheetDescription className="sr-only">{t('shell.mainNav')}</SheetDescription>
        <div className="flex h-14 shrink-0 items-center border-b border-line px-4">
          <BrandMark />
        </div>
        <div className="border-b border-line px-4 py-3 md:hidden">
          <p className="mb-1.5 text-body-sm font-semibold text-ink">{t('shell.event')}</p>
          <EventSwitcher admin={admin} className="w-full [&>div:first-child]:flex-1" />
        </div>
        <nav aria-label={t('shell.mainNav')} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-safe">
          <SidebarNav alertCount={alertCount} sos={sos} onNavigate={() => onOpenChange(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  )
}
