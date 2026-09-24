import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import type { AppRole } from '@/types/domain'

type RoleGuardProps = {
  roles: AppRole[]
  /** Where to send anyone else (docs 02 section 11). */
  redirectTo: string
}

/** Renders child routes only for the allowed roles. */
export function RoleGuard({ roles, redirectTo }: RoleGuardProps) {
  const { role, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return null
  if (!role || !roles.includes(role)) {
    return <Navigate to={redirectTo} replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
