import { beforeEach, describe, expect, it } from 'vitest'
import { readDb } from '@/lib/demo/db'
import { driverMarkParked, runMaintenance, suggestSlots } from '@/lib/demo/rpc'
import type { SeedIds } from '@/lib/demo/seed'
import type { VehicleType, VisitorCategory } from '@/types/domain'
import { asDriver, checkin, edit, setupDemo, signIn, slotId } from './demo-setup'

let ids: SeedIds
beforeEach(() => {
  ids = setupDemo()
  signIn('gate1')
})

const suggest = (vehicleType: VehicleType, category: VisitorCategory, needsAccessible = false, limit = 5) =>
  suggestSlots({ eventId: ids.eventId, gateId: ids.mainGateId, vehicleType, category, needsAccessible, limit })

const blockZone = (code: string) =>
  edit((db) => {
    const zone = db.zones.find((z) => z.code === code)!
    db.slots.forEach((s) => {
      if (s.zone_id === zone.id) {
        s.status = 'blocked'
        s.blocked_reason = 'test'
      }
    })
  })

describe('suggest_slots', () => {
  it('filters by vehicle type', () => {
    const r = suggest('bike', 'student', false, 50)
    expect(r.suggestions.length).toBe(24)
    expect(r.suggestions.every((s) => s.zone_code === 'B' && s.vehicle_type === 'bike')).toBe(true)
    expect(suggest('ev', 'general').suggestions.map((s) => s.label).sort()).toEqual(['A-029', 'A-030'])
    expect(suggest('bus', 'general').suggestions).toEqual([])
  })

  it('prefers the exact category zone, then priority', () => {
    expect(suggest('car', 'guest').suggestions[0].zone_code).toBe('C')
    const general = suggest('car', 'general', false, 50)
    expect(new Set(general.suggestions.map((s) => s.zone_code))).toEqual(new Set(['A']))
    expect(general.fallback_used).toBe('none')
  })

  it('keeps accessible slots for people who need them', () => {
    const normal = suggest('car', 'general', false, 50)
    expect(normal.suggestions.some((s) => s.is_accessible)).toBe(false)
    const acc = suggest('car', 'general', true)
    expect(acc.suggestions[0].is_accessible).toBe(true)
    expect(acc.fallback_used).toBe('none')
  })

  it('falls back to accessible any, overflow and any category', () => {
    edit((db) => db.slots.forEach((s) => (s.is_accessible = false)))
    expect(suggest('car', 'general', true).fallback_used).toBe('accessible')

    blockZone('A')
    const overflow = suggest('car', 'general')
    expect(overflow.fallback_used).toBe('overflow')
    expect(overflow.suggestions.every((s) => s.zone_code === 'D' && s.is_overflow)).toBe(true)

    blockZone('D')
    const any = suggest('car', 'general')
    expect(any.fallback_used).toBe('category_any')
    expect(any.suggestions[0].zone_code).toBe('C')
  })

  it('orders by distance from the gate within a zone', () => {
    const r = suggest('bike', 'student', false, 24)
    const d = r.suggestions.map((s) => s.distance_m)
    expect([...d].sort((a, b) => a - b)).toEqual(d)
  })

  it('reports free counts and excludes taken slots', async () => {
    const first = suggest('car', 'general').suggestions[0]
    await checkin(ids, first.slot_id)
    const r = suggest('car', 'general')
    expect(r.suggestions.some((s) => s.slot_id === first.slot_id)).toBe(false)
    const a = r.zone_free_counts.find((z) => z.code === 'A')!
    expect(a.total).toBe(28)
    expect(a.free).toBe(26) // one blocked, one assigned
  })

  it('zone filter restricts to one zone', () => {
    const r = suggestSlots({
      eventId: ids.eventId,
      gateId: ids.mainGateId,
      vehicleType: 'car',
      category: 'general',
      needsAccessible: false,
      zoneId: ids.zoneIds.D,
    })
    expect(r.suggestions.every((s) => s.zone_code === 'D')).toBe(true)
  })
})

describe('run_maintenance', () => {
  const age = (visitId: string, field: 'assigned_at' | 'driver_parked_at', minutes: number) =>
    edit((db) => {
      const v = db.visits.find((x) => x.id === visitId)!
      v[field] = new Date(Date.now() - minutes * 60_000).toISOString()
    })
  const alerts = (type: string) => readDb().alerts.filter((a) => a.type === type)

  it('creates not_arrived once and auto-resolves it', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-003'))
    runMaintenance()
    expect(alerts('not_arrived')).toHaveLength(0)
    age(r.visit_id, 'assigned_at', 25)
    expect(runMaintenance().created).toBe(1)
    expect(runMaintenance().created).toBe(0)
    expect(alerts('not_arrived')).toHaveLength(1)

    await asDriver(r)
    driverMarkParked({ lng: null, lat: null, accuracy_m: null })
    runMaintenance()
    expect(alerts('not_arrived')[0]).toMatchObject({ status: 'resolved', resolution_note: 'auto' })
  })

  it('creates confirm_pending after the confirm timeout', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-004'))
    await asDriver(r)
    driverMarkParked({ lng: null, lat: null, accuracy_m: null })
    age(r.visit_id, 'driver_parked_at', 11)
    runMaintenance()
    runMaintenance()
    expect(alerts('confirm_pending')).toHaveLength(1)
    expect(alerts('confirm_pending')[0].status).toBe('open')
  })

  it('creates overstay after the event end', async () => {
    await checkin(ids, slotId(readDb(), 'A-005'))
    const ends = new Date(readDb().events[0].ends_at).getTime()
    runMaintenance(ends + 61 * 60_000)
    runMaintenance(ends + 62 * 60_000)
    expect(alerts('overstay')).toHaveLength(1)
  })
})
