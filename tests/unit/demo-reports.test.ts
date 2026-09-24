import { beforeEach, describe, expect, it } from 'vitest'
import { readDb } from '@/lib/demo/db'
import { binStart, reportOccupancy, reportPeakHours, reportRevenue, reportVehicleCounts } from '@/lib/demo/reports'
import type { SeedIds } from '@/lib/demo/seed'
import type { VisitRow } from '@/types/domain'
import { edit, setupDemo, signIn } from './demo-setup'

let ids: SeedIds
// 2026-09-10 10:00 IST = 04:30 UTC
const T0 = Date.UTC(2026, 8, 10, 4, 30)
const at = (min: number) => new Date(T0 + min * 60_000).toISOString()

function visit(p: Partial<VisitRow> & { id: string; zone_id: string; checked_in_at: string }): VisitRow {
  return {
    event_id: ids.eventId,
    driver_id: 'd',
    plate_raw: p.id,
    plate: p.id,
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
    entry_gate_id: ids.mainGateId,
    checked_in_by: null,
    slot_id: null,
    status: 'exited',
    assigned_at: p.checked_in_at,
    link_opened_at: null,
    navigation_started_at: null,
    driver_parked_at: null,
    driver_parked_location: null,
    driver_parked_distance_m: null,
    confirmed_at: null,
    confirmed_by: null,
    exited_at: null,
    exited_by: null,
    exit_gate_id: null,
    cancelled_at: null,
    cancel_reason: null,
    checkin_duration_ms: null,
    fee_amount: 0,
    payment_method: 'free',
    last_position: null,
    last_position_at: null,
    ...p,
  }
}

beforeEach(() => {
  ids = setupDemo()
  signIn('admin')
  edit((db) => {
    db.visits.push(
      // parked 10:05 to 10:40
      visit({ id: 'V1', zone_id: ids.zoneIds.A, checked_in_at: at(2), driver_parked_at: at(5), confirmed_at: at(8), exited_at: at(40), exit_gate_id: ids.mainGateId, fee_amount: 30, payment_method: 'cash', checkin_duration_ms: 30000 }),
      // confirmed only at 10:20, still parked
      visit({ id: 'V2', zone_id: ids.zoneIds.A, checked_in_at: at(14), confirmed_at: at(20), status: 'confirmed', fee_amount: 30, payment_method: 'upi', checkin_duration_ms: 50000 }),
      // never parked, cancelled
      visit({ id: 'V3', zone_id: ids.zoneIds.A, checked_in_at: at(16), cancelled_at: at(25), status: 'cancelled', fee_amount: 30, payment_method: 'cash' }),
      // bike in zone B
      visit({ id: 'V4', zone_id: ids.zoneIds.B, vehicle_type: 'bike', category: 'student', checked_in_at: at(31), driver_parked_at: at(33), exited_at: at(50), exit_gate_id: ids.mainGateId, fee_amount: 10, payment_method: 'cash' }),
    )
  })
})

const filters = () => ({ eventId: ids.eventId, from: at(0), to: at(59), intervalMin: 15 as const })

describe('reports', () => {
  it('bins in IST', () => {
    const t = Date.UTC(2026, 8, 10, 4, 44) // 10:14 IST
    expect(new Date(binStart(t, 15 * 60_000)).toISOString()).toBe(new Date(T0).toISOString())
    expect(new Date(binStart(t, 60 * 60_000)).toISOString()).toBe(new Date(T0).toISOString())
  })

  it('occupancy counts parked and holding at each bucket time', () => {
    const r = reportOccupancy(filters())
    expect(r.series.map((s) => s.t)).toEqual([
      '2026-09-10T10:00:00+05:30',
      '2026-09-10T10:15:00+05:30',
      '2026-09-10T10:30:00+05:30',
      '2026-09-10T10:45:00+05:30',
    ])
    const a = ids.zoneIds.A
    const b = ids.zoneIds.B
    expect(r.series.map((s) => s.values[a].parked)).toEqual([0, 1, 2, 1])
    expect(r.series.map((s) => s.values[a].holding)).toEqual([0, 2, 2, 1])
    expect(r.series.map((s) => s.values[b].parked)).toEqual([0, 0, 0, 1])
    const capA = r.zones.find((z) => z.zone_id === a)!.capacity
    expect(capA).toBe(29) // 30 slots, one blocked
    expect(r.series[2].values[a].pct).toBe(Math.round((1000 * 2) / 29) / 10)
    expect(r.peaks.find((p) => p.zone_id === a)?.at).toBe('2026-09-10T10:30:00+05:30')
  })

  it('peak hours counts arrivals and exits per bucket, excluding cancelled', () => {
    const r = reportPeakHours(filters())
    expect(r.series.map((s) => s.arrivals)).toEqual([2, 0, 1, 0])
    expect(r.series.map((s) => s.exits)).toEqual([0, 0, 1, 1])
    expect(r.busiest_arrival).toEqual({ t: '2026-09-10T10:00:00+05:30', count: 2 })
    expect(r.median_checkin_seconds).toBe(40)
    expect(r.median_time_to_confirm_minutes).toBe(6)
    expect(r.by_gate.find((g) => g.gate_id === ids.mainGateId)?.arrivals).toEqual([2, 0, 1, 0])
  })

  it('revenue sums non-cancelled visits', () => {
    const r = reportRevenue(filters())
    expect(r.total).toBe(70)
    expect(r.count_paid).toBe(3)
    expect(r.by_method.find((m) => m.method === 'cash')).toEqual({ method: 'cash', amount: 40, count: 2 })
    expect(r.by_zone.find((z) => z.zone_id === ids.zoneIds.A)?.amount).toBe(60)
    expect(r.by_day).toEqual([{ date: '2026-09-10', amount: 70, count: 3 }])
  })

  it('vehicle counts reconcile with the visits', () => {
    const r = reportVehicleCounts(filters())
    expect(r.total).toBe(3)
    expect(r.by_type).toEqual([
      { type: 'car', count: 2 },
      { type: 'bike', count: 1 },
    ])
    expect(r.matrix.find((m) => m.category === 'student')).toMatchObject({ bike: 1, car: 0, total: 1 })
    expect(readDb().visits.length).toBe(4)
  })

  it('zone filter narrows every report', () => {
    const r = reportVehicleCounts({ ...filters(), zoneIds: [ids.zoneIds.B] })
    expect(r.total).toBe(1)
  })
})
