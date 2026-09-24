import type { Session } from '@/types/domain'
import { tabStorage } from './storage'

/**
 * The signed-in identity of this tab. Each browser tab is one device, so the
 * session lives in sessionStorage. Contract 2: getSession, setSession, clearSession.
 */

const KEY = 'eventpark.session'

type Listener = (session: Session | null) => void
const listeners = new Set<Listener>()

function isSession(v: unknown): v is Session {
  return (
    !!v &&
    typeof v === 'object' &&
    'role' in v &&
    typeof v.role === 'string' &&
    'userId' in v &&
    typeof v.userId === 'string'
  )
}

export function getSession(): Session | null {
  const raw = tabStorage().getItem(KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isSession(parsed)) return null
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      tabStorage().removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function setSession(session: Session): void {
  tabStorage().setItem(KEY, JSON.stringify(session))
  listeners.forEach((l) => l(session))
}

export function clearSession(): void {
  tabStorage().removeItem(KEY)
  listeners.forEach((l) => l(null))
}

/** Called with the new session (or null) whenever this tab signs in or out. Returns an unsubscribe function. */
export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
