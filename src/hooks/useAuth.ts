import { createContext, useContext } from 'react'
import type { AppRole, Session } from '@/types/domain'

export type AuthValue = {
  session: Session | null
  role: AppRole | null
  isLoading: boolean
  signOut: () => Promise<void>
  /** Re-read the session from storage (after sign in). */
  refresh: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

/** Contract 2: `{ session, role, isLoading, signOut }`. Must be used inside AuthProvider. */
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** Where each role lands after sign in (docs 02 section 11). */
export function homePathFor(role: AppRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'gate_volunteer':
      return '/gate'
    case 'zone_volunteer':
      return '/zone'
    case 'driver':
      return '/driver'
    default:
      return '/login'
  }
}
