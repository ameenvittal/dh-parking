import { create } from 'zustand'
import { tabStorage } from '@/lib/demo/storage'

/**
 * Simulated GPS for demo mode. Per tab (each tab is one device).
 * useLiveLocation prefers the demo fix whenever demo GPS is enabled and a fix exists.
 */

export type DemoFix = {
  lng: number
  lat: number
  accuracy: number
  heading: number | null
  speed: number | null
  at: number
}

type DemoGpsState = {
  enabled: boolean
  position: DemoFix | null
  setEnabled: (enabled: boolean) => void
  setPosition: (fix: DemoFix | null) => void
}

const KEY = 'eventpark.demoGps'

function load(): { enabled: boolean; position: DemoFix | null } {
  try {
    const raw = tabStorage().getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { enabled?: unknown; position?: DemoFix | null }
      return { enabled: parsed.enabled === true, position: parsed.position ?? null }
    }
  } catch {
    /* ignore */
  }
  return { enabled: false, position: null }
}

function persist(enabled: boolean, position: DemoFix | null) {
  try {
    tabStorage().setItem(KEY, JSON.stringify({ enabled, position }))
  } catch {
    /* ignore */
  }
}

export const useDemoGps = create<DemoGpsState>((set, get) => ({
  ...load(),
  setEnabled: (enabled) => {
    set({ enabled })
    persist(enabled, get().position)
  },
  setPosition: (position) => {
    set({ position })
    persist(get().enabled, position)
  },
}))

/* Plain functions for code outside React. */

export function isDemoGpsActive(): boolean {
  const s = useDemoGps.getState()
  return s.enabled && s.position !== null
}

export function getDemoFix(): DemoFix | null {
  const s = useDemoGps.getState()
  return s.enabled ? s.position : null
}

/** Calls back with the active demo fix (or null when demo GPS is off). Returns an unsubscribe function. */
export function subscribeDemoGps(cb: (fix: DemoFix | null) => void): () => void {
  return useDemoGps.subscribe((s, prev) => {
    if (s.enabled !== prev.enabled || s.position !== prev.position) cb(s.enabled ? s.position : null)
  })
}

/** Push a fix. Turns demo GPS on when a fix is given. */
export function setDemoFix(fix: DemoFix | null): void {
  const s = useDemoGps.getState()
  if (fix && !s.enabled) s.setEnabled(true)
  s.setPosition(fix)
}

export function stopDemoGps(): void {
  useDemoGps.getState().setEnabled(false)
}
