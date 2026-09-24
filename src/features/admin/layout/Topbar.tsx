import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AccountMenu } from './AccountMenu'
import { AlertsBell } from './AlertsBell'
import { EventSwitcher } from './EventSwitcher'
import type { AdminEvent } from './useAdminEvent'

type TopbarProps = {
  title: string
  admin: AdminEvent
  alertCount: number
  sos: boolean
  onOpenMenu: () => void
}

/** 56 px: page title, event switcher, alerts bell, account menu (docs 06 section 5.2). */
export function Topbar({ title, admin, alertCount, sos, onOpenMenu }: TopbarProps) {
  const { t } = useTranslation('common')
  return (
    <header className="z-30 shrink-0 border-b border-line bg-surface pt-safe">
      <div className="flex h-14 items-center gap-2 px-2 lg:gap-3 lg:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t('shell.openMenu')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
        >
          <Menu size={24} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-h3 text-ink lg:text-h2">{title}</h1>
        <EventSwitcher admin={admin} className="hidden md:flex" />
        <AlertsBell count={alertCount} sos={sos} />
        <AccountMenu />
      </div>
    </header>
  )
}
