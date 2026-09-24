import { setLatency } from '@/lib/demo/client'
import { mutate, replaceDb, type DemoDb } from '@/lib/demo/db'
import { resetBootState } from '@/lib/demo/boot'
import { gateCheckin, staffSignIn, driverLogin } from '@/lib/demo/functions'
import { buildSeed, type SeedIds } from '@/lib/demo/seed'
import { installMemoryStorage } from '@/lib/demo/storage'
import type { CheckinInput, CheckinResult } from '@/types/domain'

/** Fresh in-memory demo database with the seed, no latency. */
export function setupDemo(): SeedIds {
  installMemoryStorage()
  setLatency(0, 0)
  resetBootState()
  const { db, ids } = buildSeed()
  replaceDb(db)
  return ids
}

export function signIn(username: 'admin' | 'gate1' | 'zonea'): void {
  staffSignIn(username, username === 'admin' ? 'admin12345' : 'test12345')
}

export function slotId(db: DemoDb, label: string): string {
  const s = db.slots.find((x) => x.label === label)
  if (!s) throw new Error(`no slot ${label}`)
  return s.id
}

export function edit(fn: (db: DemoDb) => void): void {
  mutate((db) => fn(db))
}

let plateSeq = 1000

export async function checkin(ids: SeedIds, slot: string, patch: Partial<CheckinInput> = {}): Promise<CheckinResult> {
  plateSeq += 1
  return gateCheckin({
    event_id: ids.eventId,
    gate_id: ids.mainGateId,
    slot_id: slot,
    phone: '9876543210',
    driver_name: null,
    language: 'en',
    plate_raw: `KL 07 AB ${plateSeq}`,
    vehicle_type: 'car',
    vehicle_color: null,
    vehicle_make: null,
    category: 'general',
    pass_number: null,
    pass_holder_name: null,
    needs_accessible: false,
    photo_path: null,
    ai_result: null,
    ai_plate_confidence: null,
    ai_edited: false,
    fee_amount: 30,
    payment_method: 'cash',
    allow_duplicate: false,
    checkin_duration_ms: 30000,
    ...patch,
  })
}

/** Signs this "tab" in as the driver of a check-in result. */
export async function asDriver(result: CheckinResult): Promise<void> {
  await driverLogin(result.link.split('/d/')[1])
}

export async function expectCode(p: Promise<unknown> | (() => unknown), code: string): Promise<void> {
  try {
    await (typeof p === 'function' ? p() : p)
  } catch (err) {
    if (err instanceof Error && err.message === code) return
    throw new Error(`expected ${code}, got ${err instanceof Error ? err.message : String(err)}`)
  }
  throw new Error(`expected ${code}, but it succeeded`)
}
