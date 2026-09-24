import { beforeEach, describe, expect, it } from 'vitest'
import { readDb } from '@/lib/demo/db'
import { raiseSos } from '@/lib/demo/functions'
import {
  cancelVisit,
  driverMarkParked,
  driverStartNavigation,
  markExit,
  zoneConfirmParked,
} from '@/lib/demo/rpc'
import type { SeedIds } from '@/lib/demo/seed'
import { asDriver, checkin, edit, expectCode, setupDemo, signIn, slotId } from './demo-setup'

let ids: SeedIds
beforeEach(() => {
  ids = setupDemo()
  signIn('gate1')
})

const slot = (label: string) => readDb().slots.find((s) => s.label === label)!
const visit = (id: string) => readDb().visits.find((v) => v.id === id)!

describe('assign (gate-checkin)', () => {
  it('assigns a free slot and queues WhatsApp', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-003'))
    expect(r.slot.label).toBe('A-003')
    expect(slot('A-003').status).toBe('assigned')
    expect(visit(r.visit_id).status).toBe('assigned')
    expect(r.whatsapp.status).toBe('queued')
    expect(r.link).toMatch(/\/d\/[A-Za-z0-9_-]{40,}$/)
    const types = readDb().visit_events.filter((e) => e.visit_id === r.visit_id).map((e) => e.type)
    expect(types).toEqual(['checked_in', 'assigned'])
  })

  it('SLOT_TAKEN on a second assign to the same slot', async () => {
    const id = slotId(readDb(), 'A-003')
    await checkin(ids, id)
    await expectCode(checkin(ids, id), 'SLOT_TAKEN')
  })

  it('SLOT_BLOCKED for a blocked slot', async () => {
    await expectCode(checkin(ids, slotId(readDb(), 'A-015')), 'SLOT_BLOCKED')
  })

  it('SLOT_TYPE_MISMATCH for a bike slot', async () => {
    await expectCode(checkin(ids, slotId(readDb(), 'B-001')), 'SLOT_TYPE_MISMATCH')
  })

  it('PLATE_ACTIVE for a duplicate plate, allowed only for admin', async () => {
    await checkin(ids, slotId(readDb(), 'A-003'), { plate_raw: 'KL-01-X-1' })
    await expectCode(checkin(ids, slotId(readDb(), 'A-004'), { plate_raw: 'kl01x1' }), 'PLATE_ACTIVE')
    await expectCode(
      checkin(ids, slotId(readDb(), 'A-004'), { plate_raw: 'KL01X1', allow_duplicate: true }),
      'PLATE_ACTIVE',
    )
    signIn('admin')
    const r = await checkin(ids, slotId(readDb(), 'A-004'), { plate_raw: 'KL01X1', allow_duplicate: true })
    expect(r.slot.label).toBe('A-004')
  })

  it('INVALID_PHONE and forced free fee for exempt categories', async () => {
    await expectCode(checkin(ids, slotId(readDb(), 'A-003'), { phone: '12345' }), 'INVALID_PHONE')
    const r = await checkin(ids, slotId(readDb(), 'A-003'), { category: 'faculty' })
    expect(visit(r.visit_id).fee_amount).toBe(0)
    expect(visit(r.visit_id).payment_method).toBe('free')
  })

  it('zone volunteers cannot check in', async () => {
    signIn('zonea')
    await expectCode(checkin(ids, slotId(readDb(), 'A-003')), 'FORBIDDEN')
  })
})

describe('transitions', () => {
  it('assigned, en_route, driver_parked, confirmed, exited with slot following', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-005'))
    await asDriver(r)
    driverStartNavigation()
    expect(visit(r.visit_id).status).toBe('en_route')
    const c = slot('A-005').center
    const res = driverMarkParked({ lng: c[0], lat: c[1], accuracy_m: 8 })
    expect(res).toMatchObject({ status: 'driver_parked', mismatch: false })
    expect(slot('A-005').status).toBe('occupied')
    // mark parked again returns current state without error
    expect(driverMarkParked({ lng: c[0], lat: c[1], accuracy_m: 8 }).status).toBe('driver_parked')

    signIn('zonea')
    expect(zoneConfirmParked({ visitId: r.visit_id })).toEqual({ status: 'confirmed', slot_label: 'A-005' })
    expect(zoneConfirmParked({ visitId: r.visit_id }).status).toBe('confirmed')
    expect(markExit(r.visit_id, null).status).toBe('exited')
    expect(slot('A-005')).toMatchObject({ status: 'available', current_visit_id: null })
    expect(() => markExit(r.visit_id, null)).toThrow('INVALID_STATE')
    expect(() => zoneConfirmParked({ visitId: r.visit_id })).toThrow('INVALID_STATE')
  })

  it('zone volunteer can confirm without the driver marking parked', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-006'))
    signIn('zonea')
    zoneConfirmParked({ visitId: r.visit_id })
    expect(visit(r.visit_id).status).toBe('confirmed')
    expect(slot('A-006').status).toBe('occupied')
  })

  it('cancel only from assigned or en_route, and revokes the driver link', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-007'))
    cancelVisit(r.visit_id, 'Wrong entry')
    expect(visit(r.visit_id).status).toBe('cancelled')
    expect(slot('A-007').status).toBe('available')
    await expectCode(asDriver(r), 'TOKEN_INVALID')

    const r2 = await checkin(ids, slotId(readDb(), 'A-008'))
    signIn('zonea')
    zoneConfirmParked({ visitId: r2.visit_id })
    signIn('gate1')
    expect(() => cancelVisit(r2.visit_id, 'x')).toThrow('INVALID_STATE')
  })

  it('driver cannot mark parked after exit; zone volunteer outside zone is forbidden', async () => {
    const r = await checkin(ids, slotId(readDb(), 'C-003'), { category: 'guest' })
    signIn('zonea')
    expect(() => zoneConfirmParked({ visitId: r.visit_id })).toThrow('FORBIDDEN')
    signIn('gate1')
    markExit(r.visit_id, ids.mainGateId)
    await asDriver(r).catch(() => undefined)
  })

  it('driver mark parked after exit is INVALID_STATE', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-009'))
    await asDriver(r)
    signIn('gate1')
    markExit(r.visit_id, null)
    await asDriver(r)
    expect(() => driverMarkParked({ lng: null, lat: null, accuracy_m: null })).toThrow('INVALID_STATE')
  })

  it('SOS returns the open one instead of creating another', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-010'))
    await asDriver(r)
    const a = raiseSos({ reason: 'medical', message: null, lng: null, lat: null })
    const b = raiseSos({ reason: 'lost', message: null, lng: null, lat: null })
    expect(b.alert_id).toBe(a.alert_id)
    const db = readDb()
    expect(db.alerts.filter((x) => x.type === 'sos')).toHaveLength(1)
    expect(db.whatsapp_messages.some((m) => m.template === 'sos_admin_alert')).toBe(true)
  })
})

describe('wrong slot', () => {
  it('frees the old slot, occupies the actual one and raises an alert', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-011'))
    signIn('zonea')
    const res = zoneConfirmParked({ visitId: r.visit_id, actualSlotId: slotId(readDb(), 'A-020') })
    expect(res).toEqual({ status: 'confirmed', slot_label: 'A-020' })
    expect(slot('A-011')).toMatchObject({ status: 'available', current_visit_id: null })
    expect(slot('A-020')).toMatchObject({ status: 'occupied', current_visit_id: r.visit_id })
    const alert = readDb().alerts.find((a) => a.type === 'wrong_slot')!
    expect(alert.status).toBe('open')
    expect(alert.message).toBe('Assigned A-011, parked in A-020')
    const types = readDb().visit_events.filter((e) => e.visit_id === r.visit_id).map((e) => e.type)
    expect(types).toContain('wrong_slot_corrected')
  })

  it('rejects taken slots, other zones and other vehicle groups', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-011'))
    await checkin(ids, slotId(readDb(), 'A-012'))
    signIn('zonea')
    expect(() => zoneConfirmParked({ visitId: r.visit_id, actualSlotId: slotId(readDb(), 'A-012') })).toThrow('SLOT_TAKEN')
    expect(() => zoneConfirmParked({ visitId: r.visit_id, actualSlotId: slotId(readDb(), 'C-004') })).toThrow('FORBIDDEN')
    signIn('admin')
    expect(() => zoneConfirmParked({ visitId: r.visit_id, actualSlotId: slotId(readDb(), 'B-004') })).toThrow(
      'SLOT_TYPE_MISMATCH',
    )
    // ev slot is in the same group as car
    expect(zoneConfirmParked({ visitId: r.visit_id, actualSlotId: slotId(readDb(), 'A-029') }).slot_label).toBe('A-029')
  })
})

describe('mark parked location check', () => {
  it('raises location_mismatch when far, not when near, and allows no location', async () => {
    const far = await checkin(ids, slotId(readDb(), 'A-013'))
    await asDriver(far)
    const c = slot('A-013').center
    const res = driverMarkParked({ lng: c[0] + 0.001, lat: c[1], accuracy_m: 10 })
    expect(res.mismatch).toBe(true)
    expect(res.distance_m).toBeGreaterThan(90)
    expect(readDb().alerts.filter((a) => a.type === 'location_mismatch')).toHaveLength(1)

    signIn('gate1')
    const near = await checkin(ids, slotId(readDb(), 'A-014'), { phone: '9876500001' })
    await asDriver(near)
    const c2 = slot('A-014').center
    expect(driverMarkParked({ lng: c2[0] + 0.0002, lat: c2[1], accuracy_m: 10 }).mismatch).toBe(false)

    signIn('gate1')
    const none = await checkin(ids, slotId(readDb(), 'A-016'), { phone: '9876500002' })
    await asDriver(none)
    expect(driverMarkParked({ lng: null, lat: null, accuracy_m: null })).toEqual({
      status: 'driver_parked',
      distance_m: null,
      mismatch: false,
    })
    expect(readDb().alerts.filter((a) => a.type === 'location_mismatch')).toHaveLength(1)
  })

  it('reassign clears parking and resolves the mismatch alert', async () => {
    const r = await checkin(ids, slotId(readDb(), 'A-013'))
    await asDriver(r)
    const c = slot('A-013').center
    driverMarkParked({ lng: c[0] + 0.001, lat: c[1], accuracy_m: 10 })
    signIn('gate1')
    const { visitReassign } = await import('@/lib/demo/functions')
    const res = await visitReassign({ visitId: r.visit_id, newSlotId: slotId(readDb(), 'A-017'), notify: true })
    expect(res.slot.label).toBe('A-017')
    expect(visit(r.visit_id)).toMatchObject({ status: 'assigned', driver_parked_at: null })
    expect(slot('A-013').status).toBe('available')
    expect(readDb().alerts.find((a) => a.type === 'location_mismatch')?.status).toBe('resolved')
  })
})

describe('edit helper', () => {
  it('writes through mutate', () => {
    edit((db) => {
      db.events[0].name = 'Changed'
    })
    expect(readDb().events[0].name).toBe('Changed')
  })
})
