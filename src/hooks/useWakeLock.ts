import { useEffect } from 'react'

/**
 * Keeps the screen on while `active` (driver navigation, docs 05 section 8.3).
 * Re-requests the lock when the page becomes visible again.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void next.release()
          return
        }
        lock = next
      } catch {
        /* denied or not allowed on this page; the screen may turn off */
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (lock && !lock.released) void lock.release()
      lock = null
    }
  }, [active])
}
