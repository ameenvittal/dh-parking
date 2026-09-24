import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { signOut as apiSignOut } from '@/features/auth/api'
import { AuthContext, type AuthValue } from '@/hooks/useAuth'
import { applyPreferredLanguage } from '@/lib/i18n'
import { clearSession, getSession, onSessionChange } from '@/lib/demo/session'
import type { Session } from '@/types/domain'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSessionState] = useState<Session | null>(() => getSession())

  useEffect(() => onSessionChange(setSessionState), [])

  useEffect(() => {
    if (session) applyPreferredLanguage(session.language)
  }, [session])

  // Driver sessions end at event end plus 6 hours.
  useEffect(() => {
    if (!session?.expiresAt) return
    const ms = new Date(session.expiresAt).getTime() - Date.now()
    if (ms <= 0) {
      clearSession()
      return
    }
    const timer = window.setTimeout(() => clearSession(), Math.min(ms, 2 ** 31 - 1))
    return () => window.clearTimeout(timer)
  }, [session])

  const signOut = useCallback(async () => {
    try {
      await apiSignOut()
    } finally {
      clearSession()
      queryClient.clear()
    }
  }, [queryClient])

  const refresh = useCallback(() => setSessionState(getSession()), [])

  const value = useMemo<AuthValue>(
    () => ({ session, role: session?.role ?? null, isLoading: false, signOut, refresh }),
    [session, signOut, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
