/**
 * Storage adapters for the demo backend. In the browser the database lives in
 * localStorage (shared by all tabs) and the session in sessionStorage (one per tab).
 * Tests call `installMemoryStorage()` so everything runs under node.
 */

export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function createMemoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

function browserStorage(kind: 'localStorage' | 'sessionStorage'): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined') return null
    const s = window[kind]
    const probe = '__eventpark_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

let shared: KeyValueStorage | null = null
let perTab: KeyValueStorage | null = null

/** Database storage: shared by all tabs. */
export function sharedStorage(): KeyValueStorage {
  if (!shared) shared = browserStorage('localStorage') ?? createMemoryStorage()
  return shared
}

/** Session storage: one per tab, so each tab acts as a separate device. */
export function tabStorage(): KeyValueStorage {
  if (!perTab) perTab = browserStorage('sessionStorage') ?? createMemoryStorage()
  return perTab
}

/** Test helper: swap both storages for fresh in-memory maps. */
export function installMemoryStorage(): void {
  shared = createMemoryStorage()
  perTab = createMemoryStorage()
}

export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
