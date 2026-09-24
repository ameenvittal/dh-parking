import * as turf from '@turf/turf'
import { AppError } from '@/lib/errors'
import { maskPhone } from '@/lib/phone'
import { ACTIVE_VISIT_STATUSES } from '@/types/domain'
import type {
  AlertRow,
  AlertType,
  AppRole,
  EventRow,
  LngLat,
  PolygonGeometry,
  ProfileRow,
  Session,
  SlotRow,
  VehicleType,
  VisitEventType,
  VisitRow,
  VisitStatus,
  VisitSummary,
} from '@/types/domain'
import { nextSeq, nowIso, type DemoDb } from './db'
import { getSession } from './session'
import type { ActorInfo } from './types'

/* ------------------------------------------------------------- ids */

export function newId(): string {
  return crypto.randomUUID()
}

/* ------------------------------------------------------------- auth */

export type Caller = { session: Session; profile: ProfileRow | null; actor: ActorInfo }

/** Role check done first in every RPC. Staff must be active; drivers must hold a valid token. */
export function requireRole(db: DemoDb, roles: AppRole[]): Caller {
  const session = getSession()
  if (!session) throw new AppError('FORBIDDEN')
  if (!roles.includes(session.role)) throw new AppError('FORBIDDEN')
  if (session.role === 'driver') {
    const now = Date.now()
    const ok = db.driver_access_tokens.some(
      (t) => t.driver_id === session.driverId && !t.revoked_at && new Date(t.expires_at).getTime() > now,
    )
    if (!ok) throw new AppError('FORBIDDEN')
    return { session, profile: null, actor: { role: 'driver', id: session.driverId } }
  }
  const profile = db.profiles.find((p) => p.id === session.userId)
  if (!profile || !profile.is_active || profile.role !== session.role) throw new AppError('FORBIDDEN')
  return { session, profile, actor: { role: profile.role, id: profile.id } }
}

/** Zone ids read from the profile, not the session, so admin changes apply at once. */
export function currentZoneIds(caller: Caller): string[] {
  return caller.profile?.zone_ids ?? []
}

/* ------------------------------------------------------------- lookups */

export function liveEvent(db: DemoDb): EventRow | null {
  return db.events.find((e) => e.status === 'live') ?? null
}

export function requireLiveEvent(db: DemoDb): EventRow {
  const ev = liveEvent(db)
  if (!ev) throw new AppError('NO_LIVE_EVENT')
  return ev
}

export function eventById(db: DemoDb, id: string): EventRow {
  const ev = db.events.find((e) => e.id === id)
  if (!ev) throw new AppError('NOT_FOUND')
  return ev
}

export function visitById(db: DemoDb, id: string): VisitRow {
  const v = db.visits.find((x) => x.id === id)
  if (!v) throw new AppError('NOT_FOUND')
  return v
}

export function slotById(db: DemoDb, id: string): SlotRow {
  const s = db.slots.find((x) => x.id === id)
  if (!s) throw new AppError('NOT_FOUND')
  return s
}

export function isActive(status: VisitStatus): boolean {
  return ACTIVE_VISIT_STATUSES.includes(status)
}

export function normalizePlateSql(t: string): string {
  return t.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** `other` is matched like `car` unless a zone of the event explicitly allows `other`. */
export function effectiveType(db: DemoDb, eventId: string, t: VehicleType): VehicleType {
  if (t !== 'other') return t
  const allowsOther = db.zones.some((z) => z.event_id === eventId && z.vehicle_types.includes('other'))
  return allowsOther ? 'other' : 'car'
}

/** Wrong slot correction: car, ev and other are interchangeable; bike and bus are strict. */
export function sameTypeGroup(a: VehicleType, b: VehicleType): boolean {
  const group = (t: VehicleType) => (t === 'bike' || t === 'bus' ? t : 'car')
  return group(a) === group(b)
}

/* ------------------------------------------------------------- slot state */

export function setSlotStatus(slot: SlotRow, status: SlotRow['status'], visitId: string | null): void {
  slot.status = status
  slot.current_visit_id = visitId
  slot.status_changed_at = nowIso()
  if (status !== 'blocked') slot.blocked_reason = null
}

/** Free the slot only if it is still held by this visit. */
export function releaseSlot(db: DemoDb, slotId: string | null, visitId: string): void {
  if (!slotId) return
  const slot = db.slots.find((s) => s.id === slotId)
  if (slot && slot.current_visit_id === visitId && slot.status !== 'blocked') setSlotStatus(slot, 'available', null)
}

/** Assign-time checks on a locked slot (docs/04 assign step 3). */
export function checkSlotForAssign(db: DemoDb, slot: SlotRow, vehicleType: VehicleType): void {
  if (slot.status === 'blocked') throw new AppError('SLOT_BLOCKED', slot.label)
  if (slot.status !== 'available') throw new AppError('SLOT_TAKEN', slot.label)
  const eff = effectiveType(db, slot.event_id, vehicleType)
  if (slot.vehicle_type !== eff) throw new AppError('SLOT_TYPE_MISMATCH', slot.label)
  const activeHere = db.visits.some((v) => v.slot_id === slot.id && isActive(v.status))
  if (activeHere) throw new AppError('SLOT_TAKEN', slot.label)
}

/* ------------------------------------------------------------- audit */

export function logVisitEvent(
  db: DemoDb,
  visit: VisitRow,
  type: VisitEventType,
  data: Record<string, unknown>,
  actor: ActorInfo | null,
  at: string = nowIso(),
): void {
  db.visit_events.push({
    id: nextSeq(db),
    visit_id: visit.id,
    event_id: visit.event_id,
    type,
    actor_role: actor?.role ?? null,
    actor_id: actor?.id ?? null,
    data,
    created_at: at,
  })
}

/* ------------------------------------------------------------- alerts */

type AlertInsert = Partial<AlertRow> & { event_id: string; type: AlertType }

/** Insert an alert. With a dedupe key, an unresolved alert with the same key is returned instead (on conflict do nothing). */
export function insertAlert(db: DemoDb, a: AlertInsert): { alert: AlertRow; created: boolean } {
  if (a.dedupe_key) {
    const existing = db.alerts.find((x) => x.dedupe_key === a.dedupe_key && x.status !== 'resolved')
    if (existing) return { alert: existing, created: false }
  }
  const alert: AlertRow = {
    id: newId(),
    status: 'open',
    visit_id: null,
    slot_id: null,
    zone_id: null,
    sos_reason: null,
    message: null,
    location: null,
    photo_path: null,
    raised_by_profile: null,
    raised_by_driver: null,
    raised_by_system: false,
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_by: null,
    resolved_at: null,
    resolution_note: null,
    dedupe_key: null,
    created_at: nowIso(),
    ...a,
  }
  db.alerts.push(alert)
  return { alert, created: true }
}

export function resolveVisitAlerts(
  db: DemoDb,
  visitId: string,
  types: AlertType[] | 'all_but_sos' | 'all',
  note: string,
  by: string | null,
): number {
  let n = 0
  for (const a of db.alerts) {
    if (a.visit_id !== visitId || a.status === 'resolved') continue
    const match = types === 'all' ? true : types === 'all_but_sos' ? a.type !== 'sos' : types.includes(a.type)
    if (!match) continue
    a.status = 'resolved'
    a.resolved_at = nowIso()
    a.resolved_by = by
    a.resolution_note = note
    n += 1
  }
  return n
}

/* ------------------------------------------------------------- geometry */

export function distM(a: LngLat, b: LngLat): number {
  return turf.distance(turf.point(a), turf.point(b), { units: 'meters' })
}

export function distToPolygonM(p: LngLat, poly: PolygonGeometry): number {
  const d = turf.pointToPolygonDistance(turf.point(p), turf.polygon(poly.coordinates), { units: 'meters' })
  return Math.max(0, d)
}

export function distToLineM(p: LngLat, coords: number[][]): number {
  return turf.pointToLineDistance(turf.point(p), turf.lineString(coords), { units: 'meters' })
}

export function lineLengthM(coords: number[][]): number {
  return turf.length(turf.lineString(coords), { units: 'meters' })
}

export function centroidOf(poly: PolygonGeometry): LngLat {
  const c = turf.centroid(turf.polygon(poly.coordinates)).geometry.coordinates
  return [c[0], c[1]]
}

/* ------------------------------------------------------------- views */

export function latestWaStatus(db: DemoDb, visitId: string): VisitSummary['wa_status'] {
  let latest: { at: string; status: VisitSummary['wa_status'] } | null = null
  for (const m of db.whatsapp_messages) {
    if (m.visit_id !== visitId) continue
    if (!latest || m.created_at >= latest.at) latest = { at: m.created_at, status: m.status }
  }
  return latest?.status ?? null
}

export function toVisitSummary(db: DemoDb, v: VisitRow, showPhone: boolean): VisitSummary {
  const slot = v.slot_id ? db.slots.find((s) => s.id === v.slot_id) : undefined
  const zone = v.zone_id ? db.zones.find((z) => z.id === v.zone_id) : undefined
  const driver = db.drivers.find((d) => d.id === v.driver_id)
  const gate = v.entry_gate_id ? db.gates.find((g) => g.id === v.entry_gate_id) : undefined
  const phone = driver?.phone_e164 ?? ''
  return {
    id: v.id,
    plate: v.plate,
    plate_raw: v.plate_raw,
    vehicle_type: v.vehicle_type,
    vehicle_color: v.vehicle_color,
    vehicle_make: v.vehicle_make,
    category: v.category,
    needs_accessible: v.needs_accessible,
    status: v.status,
    slot_id: v.slot_id,
    slot_label: slot?.label ?? null,
    zone_id: v.zone_id,
    zone_code: zone?.code ?? null,
    zone_name: zone?.name ?? null,
    checked_in_at: v.checked_in_at,
    assigned_at: v.assigned_at,
    driver_parked_at: v.driver_parked_at,
    confirmed_at: v.confirmed_at,
    exited_at: v.exited_at,
    phone: showPhone ? phone : null,
    phone_masked: phone ? maskPhone(phone) : '',
    driver_name: showPhone ? (driver?.name ?? null) : null,
    pass_number: v.pass_number,
    entry_gate_name: gate?.name ?? null,
    wa_status: latestWaStatus(db, v.id),
    fee_amount: v.fee_amount,
    payment_method: v.payment_method,
  }
}
