import { Car, LayoutDashboard, Menu, Radar, TriangleAlert } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useMatches } from 'react-router'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { BottomNav } from '@/components/shell/BottomNav'
import { isAdminRouteHandle } from '@/app/routeHandle'
import { PageFallback } from '@/app/PageFallback'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { MobileNavSheet } from './MobileNavSheet'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useAdminEvent } from './useAdminEvent'
import { useOpenAlertCount } from './useOpenAlertCount'

const COLLAPSE_KEY = 'eventpark.sidebarCollapsed'

function readCollapsed(): boolean | null {
  try {
    const v = localStorage.getItem(COLLAPSE_KEY)
    return v === null ? null : v === '1'
  } catch {
    return null
  }
}

/**
 * Admin frame (docs 06 section 5.2): sidebar, top bar, content with 24 px padding
 * and max width 1440. Below 1024 px: menu sheet plus a bottom nav, like a phone app.
 * Map routes (handle.fullBleed) get the whole content area.
 */
export function AdminShell() {
  const { t, i18n } = useTranslation('common')
  const admin = useAdminEvent()
  const { count, sos } = useOpenAlertCount(admin.eventId)
  const wide = useMediaQuery('(min-width: 1200px)')
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(readCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)
  const collapsed = userCollapsed ?? !wide

  const matches = useMatches()
  const handle = [...matches].reverse().map((m) => m.handle).find(isAdminRouteHandle)
  const title = handle ? t(handle.titleKey) : t('appName')
  const fullBleed = handle?.fullBleed ?? false

  // Admin screens are English only (user decision, see docs/10 section 3).
  useEffect(() => {
    if (i18n.resolvedLanguage !== 'en') void i18n.changeLanguage('en')
  }, [i18n])

  useEffect(() => {
    document.title = `${title} | ${t('appName')}`
  }, [title, t])

  const toggle = () => {
    const next = !collapsed
    setUserCollapsed(next)
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-app overflow-hidden bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={toggle} alertCount={count} sos={sos} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} admin={admin} alertCount={count} sos={sos} onOpenMenu={() => setMenuOpen(true)} />
        <OfflineBanner />
        <main
          className={cn(
            'relative min-h-0 flex-1',
            fullBleed ? 'overflow-hidden' : 'overflow-y-auto',
          )}
        >
          {fullBleed ? (
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          ) : (
            <div className="mx-auto w-full max-w-360 px-4 py-4 lg:px-6 lg:py-6">
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </div>
          )}
        </main>
        <BottomNav
          ariaLabel={t('shell.mainNav')}
          className="lg:hidden"
          items={[
            { to: '/admin', label: t('adminNav.dashboard'), icon: LayoutDashboard, end: true },
            { to: '/admin/live', label: t('adminNav.live'), icon: Radar },
            { to: '/admin/vehicles', label: t('adminNav.vehicles'), icon: Car },
            { to: '/admin/alerts', label: t('adminNav.alerts'), icon: TriangleAlert, badge: count },
            { to: '#more', label: t('adminNav.more'), icon: Menu, onClick: () => setMenuOpen(true) },
          ]}
        />
      </div>
      <MobileNavSheet open={menuOpen} onOpenChange={setMenuOpen} admin={admin} alertCount={count} sos={sos} />
    </div>
  )
}
