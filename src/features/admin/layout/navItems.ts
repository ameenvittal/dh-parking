import {
  CalendarDays,
  Car,
  ChartColumn,
  LayoutDashboard,
  LayoutGrid,
  MessagesSquare,
  PencilRuler,
  Radar,
  Settings,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type AdminNavItem = { to: string; labelKey: string; icon: LucideIcon; end?: boolean; alerts?: boolean }

/** docs/06 section 5.2 nav order. */
export const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', labelKey: 'adminNav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/live', labelKey: 'adminNav.live', icon: Radar },
  { to: '/admin/vehicles', labelKey: 'adminNav.vehicles', icon: Car },
  { to: '/admin/alerts', labelKey: 'adminNav.alerts', icon: TriangleAlert, alerts: true },
  { to: '/admin/map-editor', labelKey: 'adminNav.mapEditor', icon: PencilRuler },
  { to: '/admin/zones', labelKey: 'adminNav.zones', icon: LayoutGrid },
  { to: '/admin/staff', labelKey: 'adminNav.staff', icon: Users },
  { to: '/admin/reports', labelKey: 'adminNav.reports', icon: ChartColumn },
  { to: '/admin/assistant', labelKey: 'adminNav.assistant', icon: MessagesSquare },
  { to: '/admin/events', labelKey: 'adminNav.events', icon: CalendarDays },
  { to: '/admin/settings', labelKey: 'adminNav.settings', icon: Settings },
]

/** Phone bottom nav: the four live-operations screens plus "More" (opens the full nav sheet). */
export const ADMIN_BOTTOM_NAV = ['/admin', '/admin/live', '/admin/vehicles', '/admin/alerts']
