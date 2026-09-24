import { Navigate } from 'react-router'
import { homePathFor, useAuth } from '@/hooks/useAuth'

/** `/` redirects by role: admin, gate, zone, driver, or `/login`. */
export function RoleRedirect() {
  const { role, isLoading } = useAuth()
  if (isLoading) return null
  return <Navigate to={homePathFor(role)} replace />
}
