import { createBrowserRouter, type RouteObject } from 'react-router'
import { NotFoundPage } from './NotFoundPage'
import { PageFallback } from './PageFallback'
import { RoleGuard } from './RoleGuard'
import { RoleRedirect } from './RoleRedirect'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'
import type { AdminRouteHandle } from './routeHandle'

/**
 * All routes from docs/07 section 0 with the guards from docs/02 section 11.
 * Every page is lazy-loaded so the driver route stays small (docs 01 section 7).
 */

const admin = (titleKey: string, fullBleed = false): AdminRouteHandle => ({ titleKey, fullBleed })

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      { path: '/dev/tokens', lazy: () => import('./dev/TokensPage').then((m) => ({ Component: m.TokensPage })) },
      { path: '/dev/components', lazy: () => import('./dev/ComponentsPage').then((m) => ({ Component: m.ComponentsPage })) },
    ]
  : []

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    HydrateFallback: PageFallback,
    children: [
      { index: true, element: <RoleRedirect /> },

      /* Public */
      { path: '/login', lazy: () => import('@/features/auth/StaffLoginPage').then((m) => ({ Component: m.StaffLoginPage })) },
      { path: '/d/:token', lazy: () => import('@/features/auth/DriverTokenPage').then((m) => ({ Component: m.DriverTokenPage })) },
      { path: '/driver/login', lazy: () => import('@/features/auth/DriverLoginPage').then((m) => ({ Component: m.DriverLoginPage })) },
      /* Demo mode only (docs 01 decision 16): the simulated WhatsApp inbox. */
      { path: '/sim', lazy: () => import('@/features/sim/SimPage').then((m) => ({ Component: m.SimPage })) },

      /* Driver */
      {
        path: '/driver',
        element: <RoleGuard roles={['driver']} redirectTo="/driver/login" />,
        children: [
          { index: true, lazy: () => import('@/features/driver/DriverHomePage').then((m) => ({ Component: m.DriverHomePage })) },
          { path: 'navigate', lazy: () => import('@/features/driver/NavigatePage').then((m) => ({ Component: m.NavigatePage })) },
          { path: 'find', lazy: () => import('@/features/driver/FindVehiclePage').then((m) => ({ Component: m.FindVehiclePage })) },
        ],
      },

      /* Gate */
      {
        path: '/gate',
        element: <RoleGuard roles={['gate_volunteer', 'admin']} redirectTo="/login" />,
        children: [
          { index: true, lazy: () => import('@/features/gate/GateHomePage').then((m) => ({ Component: m.GateHomePage })) },
          { path: 'checkin', lazy: () => import('@/features/gate/CheckinPage').then((m) => ({ Component: m.CheckinPage })) },
          { path: 'exit', lazy: () => import('@/features/gate/ExitPage').then((m) => ({ Component: m.ExitPage })) },
          { path: 'vehicles', lazy: () => import('@/features/gate/GateVehiclesPage').then((m) => ({ Component: m.GateVehiclesPage })) },
        ],
      },

      /* Zone */
      {
        path: '/zone',
        element: <RoleGuard roles={['zone_volunteer', 'admin']} redirectTo="/login" />,
        children: [
          { index: true, lazy: () => import('@/features/zone/ZoneHomePage').then((m) => ({ Component: m.ZoneHomePage })) },
          { path: 'visit/:id', lazy: () => import('@/features/zone/ZoneVisitPage').then((m) => ({ Component: m.ZoneVisitPage })) },
        ],
      },

      /* Admin */
      {
        path: '/admin',
        element: <RoleGuard roles={['admin']} redirectTo="/login" />,
        children: [
          {
            lazy: () => import('@/features/admin/layout/AdminShell').then((m) => ({ Component: m.AdminShell })),
            children: [
              {
                index: true,
                handle: admin('adminNav.dashboard'),
                lazy: () => import('@/features/admin/dashboard/DashboardPage').then((m) => ({ Component: m.DashboardPage })),
              },
              {
                path: 'live',
                handle: admin('adminNav.live', true),
                lazy: () => import('@/features/admin/live/LiveMapPage').then((m) => ({ Component: m.LiveMapPage })),
              },
              {
                path: 'vehicles',
                handle: admin('adminNav.vehicles'),
                lazy: () => import('@/features/admin/visits/VehiclesPage').then((m) => ({ Component: m.VehiclesPage })),
              },
              {
                path: 'alerts',
                handle: admin('adminNav.alerts'),
                lazy: () => import('@/features/admin/alerts/AlertsPage').then((m) => ({ Component: m.AlertsPage })),
              },
              {
                path: 'map-editor',
                handle: admin('adminNav.mapEditor', true),
                lazy: () => import('@/features/admin/map-editor/EditorPage').then((m) => ({ Component: m.EditorPage })),
              },
              {
                path: 'zones',
                handle: admin('adminNav.zones'),
                lazy: () => import('@/features/admin/zones/ZonesPage').then((m) => ({ Component: m.ZonesPage })),
              },
              {
                path: 'staff',
                handle: admin('adminNav.staff'),
                lazy: () => import('@/features/admin/staff/StaffPage').then((m) => ({ Component: m.StaffPage })),
              },
              {
                path: 'reports',
                handle: admin('adminNav.reports'),
                lazy: () => import('@/features/admin/reports/ReportsPage').then((m) => ({ Component: m.ReportsPage })),
              },
              {
                path: 'assistant',
                handle: admin('adminNav.assistant'),
                lazy: () => import('@/features/admin/assistant/AssistantPage').then((m) => ({ Component: m.AssistantPage })),
              },
              {
                path: 'events',
                handle: admin('adminNav.events'),
                lazy: () => import('@/features/admin/events/EventsPage').then((m) => ({ Component: m.EventsPage })),
              },
              {
                path: 'settings',
                handle: admin('adminNav.settings'),
                lazy: () => import('@/features/admin/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })),
              },
            ],
          },
        ],
      },

      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
