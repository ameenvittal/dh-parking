import { DB_KEY, mutate, readDb, replaceDb } from './db'
import { runMaintenance } from './rpc'
import { buildSeed } from './seed'
import { isBrowser, sharedStorage } from './storage'
import { tickWhatsApp } from './whatsapp'

/**
 * Boots the simulated backend: seeds the database on first use, keeps the demo event
 * live by shifting its times when it has ended, and starts the timers every open tab runs
 * (maintenance every 30 s like pg_cron, WhatsApp status ticker every 0.5 s).
 */

let timersStarted = false
let shiftChecked = false

function keepEventLive(): void {
  const db = readDb()
  const ev = db.events.find((e) => e.status === 'live')
  if (!ev) return
  const now = Date.now()
  const endsAt = new Date(ev.ends_at).getTime()
  if (endsAt > now + 30 * 60_000) return
  const delta = now + 6 * 3600_000 - endsAt
  mutate((m, touch) => {
    const e = m.events.find((x) => x.id === ev.id)
    if (!e) return
    e.starts_at = new Date(new Date(e.starts_at).getTime() + delta).toISOString()
    e.ends_at = new Date(new Date(e.ends_at).getTime() + delta).toISOString()
    const drivers = new Set(m.drivers.filter((d) => d.event_id === e.id).map((d) => d.id))
    m.driver_access_tokens.forEach((t) => {
      if (drivers.has(t.driver_id) && !t.revoked_at)
        t.expires_at = new Date(new Date(e.ends_at).getTime() + 6 * 3600_000).toISOString()
    })
    touch('events')
  })
}

function safe(fn: () => unknown): void {
  try {
    fn()
  } catch (err) {
    console.warn('[demo backend]', err)
  }
}

export function ensureBooted(): void {
  const stored = sharedStorage().getItem(DB_KEY)
  if (stored === null) {
    replaceDb(buildSeed().db)
  } else {
    try {
      const parsed = JSON.parse(stored)
      const ev = parsed.events?.[0]
      if (ev && Math.abs(ev.center[0] - 76.6) < 0.05 && Math.abs(ev.center[1] - 8.88) < 0.05) {
        replaceDb(buildSeed().db)
      }
    } catch {
      replaceDb(buildSeed().db)
    }
  }
  if (!shiftChecked) {
    shiftChecked = true
    keepEventLive()
  }
  if (!timersStarted && isBrowser) {
    timersStarted = true
    safe(() => runMaintenance())
    window.setInterval(() => safe(() => runMaintenance()), 30_000)
    window.setInterval(() => safe(() => tickWhatsApp()), 500)
    window.setInterval(() => safe(keepEventLive), 10 * 60_000)
  }
}

/** Test helper: forget boot state so a fresh in-memory storage is seeded again. */
export function resetBootState(): void {
  shiftChecked = false
}
