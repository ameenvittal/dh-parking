import * as turf from '@turf/turf'
import { AppError } from '@/lib/errors'
import { maskPhone } from '@/lib/phone'
import { ACTIVE_VISIT_STATUSES, VEHICLE_TYPES } from '@/types/domain'
import type {
  ActivityItem,
  AlertRow,
  AlertStatus,
  AlertType,
  AlertView,
  DashboardSummary,
  DriverVisit,
  EventMapData,
  EventRow,
  EventStatus,
  GateOverview,
  Language,
  LiveVehicle,
  LngLat,
  PaymentMethod,
  SlotStatusRow,
  StaffView,
  SuggestSlotsResult,
  SlotSuggestion,
  VehicleType,
  VisitDetail,
  VisitRow,
  VisitSummary,
  WaMessageRow,
  ZoneVisit,
} from '@/types/domain'
import {
  centroidOf,
  checkSlotForAssign,
  currentZoneIds,
  distM,
  distToLineM,
  distToPolygonM,
  effectiveType,
  eventById,
  insertAlert,
  isActive,
  liveEvent,
  logVisitEvent,
  newId,
  normalizePlateSql,
  releaseSlot,
  requireRole,
  resolveVisitAlerts,
  sameTypeGroup,
  setSlotStatus,
  slotById,
  toVisitSummary,
  visitById,
  type Caller,
} from './core'
import { mutate, nextSeq, nowIso, readDb, type DemoDb } from './db'
import type {
  AlertFilters,
  ConfirmParkedInput,
  ConfirmParkedResult,
  EventInput,
  EventListItem,
  MarkExitResult,
  MarkParkedInput,
  MarkParkedResult,
  RecordPositionInput,
  ReportWrongParkingInput,
  RoadTrafficRow,
  SearchVisitsInput,
  SuggestSlotsInput,
  VisitListFilters,
  ZonesSlotsData,
} from './types'

const STAFF = ['admin', 'gate_volunteer', 'zone_volunteer'] as const
const ALL = ['admin', 'gate_volunteer', 'zone_volunteer', 'driver'] as const

/* ================================================================= map */

export function getLiveEvent(): EventRow | null {
  return liveEvent(readDb())
}

export function getEvent(id: string): EventRow {
  const db = readDb()
  const caller = requireRole(db, [...ALL])
  if (caller.session.role === 'driver' && caller.session.eventId !== id) throw new AppError('FORBIDDEN')
  return eventById(db, id)
}

export function getEventMap(eventId: string): EventMapData {
  const db = readDb()
  const caller = requireRole(db, [...ALL])
  if (caller.session.role === 'driver' && caller.session.eventId !== eventId) throw new AppError('FORBIDDEN')
  const ev = eventById(db, eventId)
  const of = <T extends { event_id: string }>(rows: T[]) => rows.filter((r) => r.event_id === eventId)
  return {
    event: {
      id: ev.id,
      name: ev.name,
      center: ev.center,
      default_zoom: ev.default_zoom,
      base_map: ev.base_map,
      arrival_radius_m: ev.arrival_radius_m,
      emergency_phone: ev.emergency_phone,
    },
    gates: {
      type: 'FeatureCollection',
      features: of(db.gates)
        .filter((g) => g.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((g) => ({
          type: 'Feature',
          id: g.id,
          geometry: { type: 'Point', coordinates: g.location },
          properties: { name: g.name, name_ml: g.name_ml, kind: g.kind },
        })),
    },
    zones: {
      type: 'FeatureCollection',
      features: of(db.zones)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((z) => ({
          type: 'Feature',
          id: z.id,
          geometry: z.area,
          properties: {
            code: z.code,
            name: z.name,
            name_ml: z.name_ml,
            color: z.color,
            vehicle_types: z.vehicle_types,
            categories: z.categories,
            is_overflow: z.is_overflow,
            priority: z.priority,
          },
        })),
    },
    slots: {
      type: 'FeatureCollection',
      features: of(db.slots).map((s) => ({
        type: 'Feature',
        id: s.id,
        geometry: s.shape,
        properties: {
          label: s.label,
          number: s.number,
          zone_id: s.zone_id,
          vehicle_type: s.vehicle_type,
          is_accessible: s.is_accessible,
          has_ev_charger: s.has_ev_charger,
        },
      })),
    },
    roads: {
      nodes: of(db.road_nodes).map((n) => ({ id: n.id, coord: n.coord })),
      segments: of(db.road_segments).map((s) => ({
        id: s.id,
        from: s.from,
        to: s.to,
        coords: s.coords,
        direction: s.direction,
        name: s.name,
        length_m: s.length_m,
        walk_only: s.walk_only,
      })),
    },
    landmarks: {
      type: 'FeatureCollection',
      features: of(db.landmarks).map((l) => ({
        type: 'Feature',
        id: l.id,
        geometry: { type: 'Point', coordinates: l.location },
        properties: { name: l.name, name_ml: l.name_ml, kind: l.kind },
      })),
    },
    version: db.map_version,
  }
}

export function getSlotStatuses(eventId: string): SlotStatusRow[] {
  const db = readDb()
  const caller = requireRole(db, [...ALL])
  if (caller.session.role === 'driver') {
    const v = driverVisit(db, caller)
    const slot = v?.slot_id ? db.slots.find((s) => s.id === v.slot_id) : undefined
    return slot ? [{ id: slot.id, status: slot.status, current_visit_id: slot.current_visit_id }] : []
  }
  return db.slots
    .filter((s) => s.event_id === eventId)
    .map((s) => ({ id: s.id, status: s.status, current_visit_id: s.current_visit_id }))
}

/* ================================================================= gate */

export function suggestSlots(input: SuggestSlotsInput): SuggestSlotsResult {
  const db = readDb()
  requireRole(db, ['gate_volunteer', 'admin'])
  const gate = db.gates.find((g) => g.id === input.gateId)
  if (!gate) throw new AppError('NOT_FOUND')
  const limit = input.limit ?? 5
  const type = effectiveType(db, input.eventId, input.vehicleType)
  const zones = db.zones.filter((z) => z.event_id === input.eventId && z.vehicle_types.includes(type))
  const zoneById = new Map(zones.map((z) => [z.id, z]))

  const base = db.slots.filter(
    (s) =>
      s.event_id === input.eventId &&
      s.status === 'available' &&
      s.vehicle_type === type &&
      zoneById.has(s.zone_id) &&
      (!input.zoneId || s.zone_id === input.zoneId),
  )
  const catMatch = (zoneId: string) => {
    const z = zoneById.get(zoneId)
    return !!z && (z.categories.length === 0 || z.categories.includes(input.category))
  }
  const isOverflow = (zoneId: string) => zoneById.get(zoneId)?.is_overflow ?? false

  let fallback: SuggestSlotsResult['fallback_used'] = 'none'
  let cands = base.filter((s) => catMatch(s.zone_id))
  if (cands.length === 0 && base.length > 0) {
    cands = base
    fallback = 'category_any'
  }
  const nonOverflow = cands.filter((s) => !isOverflow(s.zone_id))
  if (nonOverflow.length > 0) cands = nonOverflow
  else if (cands.length > 0 && fallback === 'none') fallback = 'overflow'

  if (input.needsAccessible) {
    if (!cands.some((s) => s.is_accessible) && cands.length > 0 && fallback === 'none') fallback = 'accessible'
  } else {
    const nonAcc = cands.filter((s) => !s.is_accessible)
    if (nonAcc.length > 0) cands = nonAcc
  }

  const rows = cands.map((s) => {
    const z = zoneById.get(s.zone_id)!
    return {
      s,
      z,
      accMatch: s.is_accessible === input.needsAccessible ? 1 : 0,
      exactCat: z.categories.includes(input.category) ? 1 : 0,
      d: distM(s.center, gate.location),
    }
  })
  rows.sort(
    (a, b) =>
      b.accMatch - a.accMatch ||
      b.exactCat - a.exactCat ||
      a.z.priority - b.z.priority ||
      a.d - b.d ||
      a.s.number - b.s.number,
  )
  const suggestions: SlotSuggestion[] = rows.slice(0, limit).map(({ s, z, d }) => ({
    slot_id: s.id,
    label: s.label,
    zone_id: z.id,
    zone_code: z.code,
    zone_name: z.name,
    zone_name_ml: z.name_ml,
    vehicle_type: s.vehicle_type,
    is_accessible: s.is_accessible,
    has_ev_charger: s.has_ev_charger,
    distance_m: Math.round(d),
    is_overflow: z.is_overflow,
  }))

  const zone_free_counts = zones
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((z) => {
      const slots = db.slots.filter((s) => s.zone_id === z.id && s.vehicle_type === type)
      return {
        zone_id: z.id,
        code: z.code,
        name: z.name,
        name_ml: z.name_ml,
        free: slots.filter((s) => s.status === 'available').length,
        total: slots.length,
      }
    })

  return { suggestions, zone_free_counts, fallback_used: suggestions.length > 0 ? fallback : 'none' }
}

export function findActiveVisitByPlate(eventId: string, plate: string): VisitSummary | null {
  const db = readDb()
  const caller = requireRole(db, ['gate_volunteer', 'admin', 'zone_volunteer'])
  const p = normalizePlateSql(plate)
  if (!p) return null
  const v = db.visits.find((x) => x.event_id === eventId && x.plate === p && isActive(x.status))
  if (!v) return null
  if (caller.session.role === 'zone_volunteer' && !currentZoneIds(caller).includes(v.zone_id ?? '')) return null
  return toVisitSummary(db, v, caller.session.role !== 'zone_volunteer')
}

export type AssignArgs = {
  event_id: string
  driver_id: string
  actor: Caller['actor']
  gate_id: string | null
  slot_id: string
  plate_raw: string
  vehicle_type: VehicleType
  vehicle_color: string | null
  vehicle_make: string | null
  category: VisitRow['category']
  pass_number: string | null
  pass_holder_name: string | null
  needs_accessible: boolean
  photo_path: string | null
  ai_result: unknown
  ai_plate_confidence: number | null
  ai_edited: boolean
  fee_amount: number
  payment_method: PaymentMethod
  allow_duplicate: boolean
  checkin_duration_ms: number | null
}

/** assign_new_visit (service role only). Runs inside the caller's mutation. */
export function assignNewVisit(db: DemoDb, a: AssignArgs): VisitRow {
  const ev = eventById(db, a.event_id)
  if (ev.status !== 'live') throw new AppError('NO_LIVE_EVENT')
  const plate = normalizePlateSql(a.plate_raw)
  if (!plate) throw new AppError('BAD_REQUEST')
  const dup = db.visits.find((v) => v.event_id === a.event_id && v.plate === plate && isActive(v.status))
  if (dup && !a.allow_duplicate) {
    const slot = dup.slot_id ? db.slots.find((s) => s.id === dup.slot_id) : undefined
    throw new AppError('PLATE_ACTIVE', slot?.label ?? null)
  }
  const slot = slotById(db, a.slot_id)
  if (slot.event_id !== a.event_id) throw new AppError('NOT_FOUND')
  checkSlotForAssign(db, slot, a.vehicle_type)

  const now = nowIso()
  const visit: VisitRow = {
    id: newId(),
    event_id: a.event_id,
    driver_id: a.driver_id,
    plate_raw: a.plate_raw,
    plate,
    vehicle_type: a.vehicle_type,
    vehicle_color: a.vehicle_color,
    vehicle_make: a.vehicle_make,
    category: a.category,
    pass_number: a.pass_number,
    pass_holder_name: a.pass_holder_name,
    needs_accessible: a.needs_accessible,
    photo_path: a.photo_path,
    ai_result: a.ai_result ?? null,
    ai_plate_confidence: a.ai_plate_confidence,
    ai_edited: a.ai_edited,
    entry_gate_id: a.gate_id,
    checked_in_by: a.actor.id,
    checked_in_at: now,
    zone_id: slot.zone_id,
    slot_id: slot.id,
    status: 'assigned',
    assigned_at: now,
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
    checkin_duration_ms: a.checkin_duration_ms,
    fee_amount: a.fee_amount,
    payment_method: a.payment_method,
    last_position: null,
    last_position_at: null,
  }
  db.visits.push(visit)
  setSlotStatus(slot, 'assigned', visit.id)
  logVisitEvent(db, visit, 'checked_in', { gate: a.gate_id, ai_edited: a.ai_edited }, a.actor)
  logVisitEvent(db, visit, 'assigned', { slot_id: slot.id, label: slot.label }, a.actor)
  return visit
}

/** reassign_visit (service role only). Runs inside the caller's mutation. */
export function reassignVisitCore(db: DemoDb, visitId: string, newSlotId: string, caller: Caller): VisitRow {
  const v = visitById(db, visitId)
  if (!isActive(v.status)) throw new AppError('INVALID_STATE')
  if (v.status === 'confirmed' && caller.session.role !== 'admin') throw new AppError('INVALID_STATE')
  const slot = slotById(db, newSlotId)
  if (slot.event_id !== v.event_id) throw new AppError('NOT_FOUND')
  if (slot.id === v.slot_id) throw new AppError('SLOT_TAKEN', slot.label)
  checkSlotForAssign(db, slot, v.vehicle_type)
  const oldLabel = v.slot_id ? (db.slots.find((s) => s.id === v.slot_id)?.label ?? null) : null
  releaseSlot(db, v.slot_id, v.id)
  setSlotStatus(slot, 'assigned', v.id)
  v.slot_id = slot.id
  v.zone_id = slot.zone_id
  v.status = 'assigned'
  v.assigned_at = nowIso()
  v.driver_parked_at = null
  v.driver_parked_location = null
  v.driver_parked_distance_m = null
  v.confirmed_at = null
  v.confirmed_by = null
  resolveVisitAlerts(db, v.id, ['not_arrived', 'confirm_pending', 'location_mismatch'], 'reassigned', caller.actor.id)
  logVisitEvent(db, v, 'reassigned', { from: oldLabel, to: slot.label }, caller.actor)
  return v
}

export function getGateOverview(eventId: string, gateId: string): GateOverview {
  const db = readDb()
  requireRole(db, ['gate_volunteer', 'admin'])
  const free_by_type = Object.fromEntries(VEHICLE_TYPES.map((t) => [t, 0])) as Record<VehicleType, number>
  db.slots.forEach((s) => {
    if (s.event_id === eventId && s.status === 'available') free_by_type[s.vehicle_type] += 1
  })
  const recent = db.visits
    .filter((v) => v.event_id === eventId && v.entry_gate_id === gateId)
    .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))
    .slice(0, 5)
    .map((v) => ({
      visit_id: v.id,
      plate: v.plate,
      slot_label: v.slot_id ? (db.slots.find((s) => s.id === v.slot_id)?.label ?? null) : null,
      status: v.status,
      checked_in_at: v.checked_in_at,
    }))
  return { free_by_type, recent }
}

export function setVisitFee(visitId: string, amount: number, method: PaymentMethod): void {
  mutate((db, touch) => {
    requireRole(db, ['gate_volunteer', 'admin'])
    const v = visitById(db, visitId)
    if (v.status === 'cancelled') throw new AppError('INVALID_STATE')
    if (!(amount >= 0)) throw new AppError('BAD_REQUEST')
    v.payment_method = method
    v.fee_amount = method === 'free' ? 0 : Math.round(amount * 100) / 100
    touch('visits')
  })
}

function matchesQuery(db: DemoDb, v: VisitRow, q: string): boolean {
  const raw = q.trim()
  if (!raw) return true
  const plateQ = normalizePlateSql(raw)
  const digits = raw.replace(/\D/g, '')
  if (plateQ && v.plate.includes(plateQ)) return true
  if (digits.length === 4) {
    if (v.plate.replace(/\D/g, '').endsWith(digits)) return true
    const phone = db.drivers.find((d) => d.id === v.driver_id)?.phone_e164 ?? ''
    if (phone.endsWith(digits)) return true
  }
  if (v.pass_number && normalizePlateSql(v.pass_number).includes(plateQ) && plateQ.length >= 2) return true
  return false
}

export function searchVisits(input: SearchVisitsInput): VisitSummary[] {
  const db = readDb()
  requireRole(db, ['gate_volunteer', 'admin'])
  const statuses = input.status && input.status.length > 0 ? input.status : null
  return db.visits
    .filter((v) => v.event_id === input.eventId)
    .filter((v) => !statuses || statuses.includes(v.status))
    .filter((v) => matchesQuery(db, v, input.query))
    .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))
    .slice(0, input.limit ?? 20)
    .map((v) => toVisitSummary(db, v, true))
}

export function listVisits(f: VisitListFilters): VisitSummary[] {
  const db = readDb()
  requireRole(db, ['admin'])
  const failed = f.waFailed ? new Set(db.whatsapp_messages.filter((m) => m.status === 'failed').map((m) => m.visit_id)) : null
  return db.visits
    .filter((v) => v.event_id === f.eventId)
    .filter((v) => !f.statuses?.length || f.statuses.includes(v.status))
    .filter((v) => !f.zoneIds?.length || f.zoneIds.includes(v.zone_id ?? ''))
    .filter((v) => !f.vehicleTypes?.length || f.vehicleTypes.includes(v.vehicle_type))
    .filter((v) => !f.categories?.length || f.categories.includes(v.category))
    .filter((v) => !f.gateId || v.entry_gate_id === f.gateId)
    .filter((v) => !f.from || v.checked_in_at >= new Date(f.from).toISOString())
    .filter((v) => !f.to || v.checked_in_at <= new Date(f.to).toISOString())
    .filter((v) => !failed || failed.has(v.id))
    .filter((v) => matchesQuery(db, v, f.query ?? ''))
    .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))
    .map((v) => toVisitSummary(db, v, true))
}

export function getVisitDetail(visitId: string): VisitDetail {
  const db = readDb()
  const caller = requireRole(db, [...STAFF])
  const v = visitById(db, visitId)
  const role = caller.session.role
  if (role === 'zone_volunteer' && !currentZoneIds(caller).includes(v.zone_id ?? '')) throw new AppError('FORBIDDEN')
  const driver = db.drivers.find((d) => d.id === v.driver_id)
  const slot = v.slot_id ? db.slots.find((s) => s.id === v.slot_id) : undefined
  const zone = v.zone_id ? db.zones.find((z) => z.id === v.zone_id) : undefined
  const gate = (id: string | null) => {
    const g = id ? db.gates.find((x) => x.id === id) : undefined
    return g ? { id: g.id, name: g.name } : null
  }
  const full = role !== 'zone_volunteer'
  return {
    visit: v,
    driver: driver
      ? {
          name: full ? driver.name : null,
          phone: full ? driver.phone_e164 : maskPhone(driver.phone_e164),
          phone_masked: maskPhone(driver.phone_e164),
          preferred_language: driver.preferred_language,
        }
      : null,
    slot: slot ? { id: slot.id, label: slot.label, zone_id: slot.zone_id } : null,
    zone: zone ? { id: zone.id, code: zone.code, name: zone.name, name_ml: zone.name_ml } : null,
    entry_gate: gate(v.entry_gate_id),
    exit_gate: gate(v.exit_gate_id),
    events: db.visit_events.filter((e) => e.visit_id === v.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    alerts: db.alerts.filter((a) => a.visit_id === v.id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    messages: full
      ? db.whatsapp_messages.filter((m) => m.visit_id === v.id).sort((a, b) => a.created_at.localeCompare(b.created_at))
      : [],
    trail:
      role === 'admin'
        ? db.vehicle_positions
            .filter((p) => p.visit_id === v.id)
            .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
            .slice(-200)
            .map((p) => p.location)
        : [],
  }
}

export function getWaMessage(id: string): WaMessageRow | null {
  const db = readDb()
  requireRole(db, ['gate_volunteer', 'admin'])
  return db.whatsapp_messages.find((m) => m.id === id) ?? null
}

export function markExit(visitId: string, exitGateId: string | null): MarkExitResult {
  return mutate((db, touch) => {
    const caller = requireRole(db, [...STAFF])
    const v = visitById(db, visitId)
    if (caller.session.role === 'zone_volunteer' && !currentZoneIds(caller).includes(v.zone_id ?? ''))
      throw new AppError('FORBIDDEN')
    if (!isActive(v.status)) throw new AppError('INVALID_STATE')
    v.status = 'exited'
    v.exited_at = nowIso()
    v.exited_by = caller.actor.id
    v.exit_gate_id = exitGateId
    releaseSlot(db, v.slot_id, v.id)
    resolveVisitAlerts(db, v.id, 'all_but_sos', 'exited', caller.actor.id)
    logVisitEvent(db, v, 'exited', { gate: exitGateId }, caller.actor)
    touch('visits', 'slots', 'alerts')
    return { status: 'exited' as const }
  })
}

export function cancelVisit(visitId: string, reason: string): void {
  mutate((db, touch) => {
    const caller = requireRole(db, ['gate_volunteer', 'admin'])
    const v = visitById(db, visitId)
    if (v.status !== 'assigned' && v.status !== 'en_route') throw new AppError('INVALID_STATE')
    v.status = 'cancelled'
    v.cancelled_at = nowIso()
    v.cancel_reason = reason.trim() || null
    releaseSlot(db, v.slot_id, v.id)
    resolveVisitAlerts(db, v.id, 'all_but_sos', 'cancelled', caller.actor.id)
    const otherActive = db.visits.some((x) => x.driver_id === v.driver_id && x.id !== v.id && isActive(x.status))
    if (!otherActive) {
      db.driver_access_tokens.forEach((t) => {
        if (t.driver_id === v.driver_id && !t.revoked_at) t.revoked_at = nowIso()
      })
    }
    logVisitEvent(db, v, 'cancelled', { reason: v.cancel_reason }, caller.actor)
    touch('visits', 'slots', 'alerts')
  })
}

/* ================================================================= driver */

/** Latest visit of the signed-in driver: active first, else the most recent. */
function driverVisit(db: DemoDb, caller: Caller): VisitRow | null {
  const mine = db.visits
    .filter((v) => v.driver_id === caller.session.driverId && v.event_id === caller.session.eventId)
    .sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at))
  return mine.find((v) => isActive(v.status)) ?? mine[0] ?? null
}

function activeDriverVisit(db: DemoDb, caller: Caller): VisitRow {
  const v = driverVisit(db, caller)
  if (!v || !isActive(v.status)) throw new AppError('INVALID_STATE')
  return v
}

export function driverAcceptLocationConsent(): void {
  mutate((db, touch) => {
    const caller = requireRole(db, ['driver'])
    const d = db.drivers.find((x) => x.id === caller.session.driverId)
    if (!d) throw new AppError('NOT_FOUND')
    d.location_consent_at = nowIso()
    touch('visits')
  })
}

export function setMyLanguage(language: Language): void {
  mutate((db, touch) => {
    const caller = requireRole(db, [...ALL])
    if (caller.session.role === 'driver') {
      const d = db.drivers.find((x) => x.id === caller.session.driverId)
      if (d) d.preferred_language = language
    } else if (caller.profile) {
      caller.profile.preferred_language = language
      touch('profiles')
    }
  })
}

export function driverGetMyVisit(): DriverVisit | null {
  const db = readDb()
  const caller = requireRole(db, ['driver'])
  const v = driverVisit(db, caller)
  const driver = db.drivers.find((d) => d.id === caller.session.driverId)
  const ev = db.events.find((e) => e.id === caller.session.eventId)
  if (!v || !driver || !ev) return null
  const slot = v.slot_id ? db.slots.find((s) => s.id === v.slot_id) : undefined
  const zone = v.zone_id ? db.zones.find((z) => z.id === v.zone_id) : undefined
  const gate = v.entry_gate_id ? db.gates.find((g) => g.id === v.entry_gate_id) : undefined
  let landmark: DriverVisit['landmark'] = null
  if (slot) {
    for (const l of db.landmarks) {
      if (l.event_id !== ev.id) continue
      const d = distM(l.location, slot.center)
      if (d <= 300 && (!landmark || d < landmark.distance_m))
        landmark = { name: l.name, name_ml: l.name_ml, kind: l.kind, distance_m: Math.round(d) }
    }
  }
  return {
    visit: {
      id: v.id,
      plate: v.plate,
      vehicle_type: v.vehicle_type,
      status: v.status,
      assigned_at: v.assigned_at,
      driver_parked_at: v.driver_parked_at,
      confirmed_at: v.confirmed_at,
    },
    slot: slot
      ? {
          id: slot.id,
          label: slot.label,
          shape: slot.shape,
          center: slot.center,
          vehicle_type: slot.vehicle_type,
          is_accessible: slot.is_accessible,
        }
      : null,
    zone: zone ? { id: zone.id, code: zone.code, name: zone.name, name_ml: zone.name_ml, color: zone.color } : null,
    gate: gate ? { id: gate.id, name: gate.name, name_ml: gate.name_ml, location: gate.location } : null,
    landmark,
    driver: { name: driver.name, location_consent_at: driver.location_consent_at, language: driver.preferred_language },
    event: {
      id: ev.id,
      name: ev.name,
      emergency_phone: ev.emergency_phone,
      arrival_radius_m: ev.arrival_radius_m,
      ends_at: ev.ends_at,
    },
    open_sos: db.alerts.some((a) => a.type === 'sos' && a.raised_by_driver === driver.id && a.status !== 'resolved'),
  }
}

export function driverStartNavigation(): void {
  mutate((db, touch) => {
    const caller = requireRole(db, ['driver'])
    const v = activeDriverVisit(db, caller)
    if (v.status !== 'assigned' && v.status !== 'en_route') return
    const first = !v.navigation_started_at
    if (v.status === 'assigned') v.status = 'en_route'
    if (first) v.navigation_started_at = nowIso()
    if (first || v.status === 'en_route') logVisitEvent(db, v, 'navigation_started', {}, caller.actor)
    touch('visits')
  })
}

export function driverMarkParked(input: MarkParkedInput): MarkParkedResult {
  return mutate((db, touch) => {
    const caller = requireRole(db, ['driver'])
    const v = driverVisit(db, caller)
    if (!v) throw new AppError('INVALID_STATE')
    if (v.status === 'driver_parked' || v.status === 'confirmed')
      return { status: v.status, distance_m: v.driver_parked_distance_m, mismatch: false }
    if (v.status !== 'assigned' && v.status !== 'en_route') throw new AppError('INVALID_STATE')
    const ev = eventById(db, v.event_id)
    const slot = v.slot_id ? db.slots.find((s) => s.id === v.slot_id) : undefined
    const point: LngLat | null = input.lng != null && input.lat != null ? [input.lng, input.lat] : null
    const distance = point && slot ? Math.round(distToPolygonM(point, slot.shape) * 10) / 10 : null
    v.status = 'driver_parked'
    v.driver_parked_at = nowIso()
    v.driver_parked_location = point
    v.driver_parked_distance_m = distance
    if (slot && slot.status === 'assigned' && slot.current_visit_id === v.id) setSlotStatus(slot, 'occupied', v.id)
    const tolerance = ev.location_tolerance_m + Math.min(input.accuracy_m ?? 50, 50)
    const mismatch = distance != null && distance > tolerance
    if (mismatch) {
      insertAlert(db, {
        event_id: v.event_id,
        type: 'location_mismatch',
        visit_id: v.id,
        slot_id: v.slot_id,
        zone_id: v.zone_id,
        location: point,
        message: `${Math.round(distance)} m from slot`,
        raised_by_system: true,
        dedupe_key: `location_mismatch:${v.id}`,
      })
      logVisitEvent(db, v, 'location_mismatch', { distance_m: distance }, caller.actor)
    }
    logVisitEvent(db, v, 'driver_parked', { distance_m: distance }, caller.actor)
    touch('visits', 'slots', 'alerts')
    return { status: 'driver_parked' as const, distance_m: distance, mismatch }
  })
}

export function recordPosition(input: RecordPositionInput): void {
  if (input.accuracy_m != null && input.accuracy_m > 200) {
    requireRole(readDb(), ['driver'])
    return
  }
  mutate((db, touch) => {
    const caller = requireRole(db, ['driver'])
    const v = driverVisit(db, caller)
    if (!v || !['assigned', 'en_route', 'driver_parked'].includes(v.status)) return
    const at = nowIso()
    v.last_position = [input.lng, input.lat]
    v.last_position_at = at
    let last: string | null = null
    for (const p of db.vehicle_positions) if (p.visit_id === v.id && (!last || p.recorded_at > last)) last = p.recorded_at
    if (!last || Date.now() - new Date(last).getTime() >= 15_000) {
      db.vehicle_positions.push({
        id: nextSeq(db),
        visit_id: v.id,
        event_id: v.event_id,
        location: [input.lng, input.lat],
        accuracy_m: input.accuracy_m,
        heading: input.heading,
        speed_mps: input.speed_mps,
        recorded_at: at,
      })
    }
    touch('visits')
  })
}

/** raise_sos without the dispatch (functions.ts sends the WhatsApp alerts). */
export function raiseSosCore(
  db: DemoDb,
  caller: Caller,
  input: { reason: AlertRow['sos_reason']; message: string | null; lng: number | null; lat: number | null },
): { alert: AlertRow; created: boolean; emergency_phone: string | null } {
  const driverId = caller.session.driverId
  const ev = eventById(db, caller.session.eventId ?? '')
  const open = db.alerts.find((a) => a.type === 'sos' && a.raised_by_driver === driverId && a.status !== 'resolved')
  if (open) return { alert: open, created: false, emergency_phone: ev.emergency_phone }
  const v = driverVisit(db, caller)
  const active = v && isActive(v.status) ? v : null
  const location: LngLat | null = input.lng != null && input.lat != null ? [input.lng, input.lat] : null
  const { alert } = insertAlert(db, {
    event_id: ev.id,
    type: 'sos',
    visit_id: active?.id ?? null,
    slot_id: active?.slot_id ?? null,
    zone_id: active?.zone_id ?? null,
    sos_reason: input.reason,
    message: input.message?.trim() || null,
    location,
    raised_by_driver: driverId,
  })
  if (active) logVisitEvent(db, active, 'sos', { alert_id: alert.id, reason: input.reason }, caller.actor)
  return { alert, created: true, emergency_phone: ev.emergency_phone }
}

/* ================================================================= zone */

export function getZoneVisits(zoneIds: string[] | null): ZoneVisit[] {
  const db = readDb()
  const caller = requireRole(db, ['zone_volunteer', 'admin'])
  let zones: string[]
  if (caller.session.role === 'zone_volunteer') {
    const own = currentZoneIds(caller)
    if (zoneIds && zoneIds.some((z) => !own.includes(z))) throw new AppError('FORBIDDEN')
    zones = zoneIds && zoneIds.length > 0 ? zoneIds : own
  } else {
    zones = zoneIds && zoneIds.length > 0 ? zoneIds : db.zones.map((z) => z.id)
  }
  const cutoff = Date.now() - 30 * 60_000
  return db.visits
    .filter((v) => v.zone_id && zones.includes(v.zone_id))
    .filter(
      (v) => isActive(v.status) || (v.status === 'exited' && v.exited_at && new Date(v.exited_at).getTime() >= cutoff),
    )
    .map((v) => {
      const slot = v.slot_id ? db.slots.find((s) => s.id === v.slot_id) : undefined
      const zone = db.zones.find((z) => z.id === v.zone_id)
      const phone = db.drivers.find((d) => d.id === v.driver_id)?.phone_e164 ?? ''
      return {
        id: v.id,
        plate: v.plate,
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
        assigned_at: v.assigned_at,
        driver_parked_at: v.driver_parked_at,
        confirmed_at: v.confirmed_at,
        exited_at: v.exited_at,
        driver_parked_distance_m: v.driver_parked_distance_m,
        phone_masked: phone ? maskPhone(phone) : '',
        photo_path: v.photo_path,
        last_position: v.last_position,
        last_position_at: v.last_position_at,
        open_alert_types: [
          ...new Set(
            db.alerts.filter((a) => a.visit_id === v.id && a.status !== 'resolved').map((a) => a.type as AlertType),
          ),
        ],
      }
    })
}

export function zoneConfirmParked(input: ConfirmParkedInput): ConfirmParkedResult {
  return mutate((db, touch) => {
    const caller = requireRole(db, ['zone_volunteer', 'admin'])
    const isZone = caller.session.role === 'zone_volunteer'
    const own = currentZoneIds(caller)
    const v = visitById(db, input.visitId)
    if (isZone && !own.includes(v.zone_id ?? '')) throw new AppError('FORBIDDEN')
    const currentLabel = () => (v.slot_id ? (db.slots.find((s) => s.id === v.slot_id)?.label ?? '') : '')
    if (v.status === 'confirmed') return { status: 'confirmed' as const, slot_label: currentLabel() }
    if (!['assigned', 'en_route', 'driver_parked'].includes(v.status)) throw new AppError('INVALID_STATE')
    const now = nowIso()

    if (!input.actualSlotId || input.actualSlotId === v.slot_id) {
      const slot = v.slot_id ? db.slots.find((s) => s.id === v.slot_id) : undefined
      if (slot) setSlotStatus(slot, 'occupied', v.id)
      v.status = 'confirmed'
      v.confirmed_at = now
      v.confirmed_by = caller.actor.id
      resolveVisitAlerts(db, v.id, ['not_arrived', 'confirm_pending', 'location_mismatch'], 'confirmed', caller.actor.id)
      logVisitEvent(db, v, 'confirmed', { note: input.note ?? null }, caller.actor)
      touch('visits', 'slots', 'alerts')
      return { status: 'confirmed' as const, slot_label: slot?.label ?? '' }
    }

    const actual = slotById(db, input.actualSlotId)
    if (actual.event_id !== v.event_id) throw new AppError('NOT_FOUND')
    if (isZone && !own.includes(actual.zone_id)) throw new AppError('FORBIDDEN')
    if (actual.status !== 'available') throw new AppError('SLOT_TAKEN', actual.label)
    if (!sameTypeGroup(actual.vehicle_type, v.vehicle_type)) throw new AppError('SLOT_TYPE_MISMATCH', actual.label)
    const oldLabel = currentLabel()
    releaseSlot(db, v.slot_id, v.id)
    setSlotStatus(actual, 'occupied', v.id)
    v.slot_id = actual.id
    v.zone_id = actual.zone_id
    v.status = 'confirmed'
    v.confirmed_at = now
    v.confirmed_by = caller.actor.id
    resolveVisitAlerts(db, v.id, ['not_arrived', 'confirm_pending', 'location_mismatch'], 'confirmed', caller.actor.id)
    insertAlert(db, {
      event_id: v.event_id,
      type: 'wrong_slot',
      visit_id: v.id,
      slot_id: actual.id,
      zone_id: actual.zone_id,
      message: `Assigned ${oldLabel}, parked in ${actual.label}`,
      location: actual.center,
      raised_by_profile: caller.profile?.id ?? null,
    })
    logVisitEvent(db, v, 'wrong_slot_corrected', { from: oldLabel, to: actual.label }, caller.actor)
    logVisitEvent(db, v, 'confirmed', { note: input.note ?? null }, caller.actor)
    touch('visits', 'slots', 'alerts')
    return { status: 'confirmed' as const, slot_label: actual.label }
  })
}

export function zoneFlagNotHere(visitId: string): void {
  mutate((db, touch) => {
    const caller = requireRole(db, ['zone_volunteer', 'admin'])
    const v = visitById(db, visitId)
    if (caller.session.role === 'zone_volunteer' && !currentZoneIds(caller).includes(v.zone_id ?? ''))
      throw new AppError('FORBIDDEN')
    const { alert, created } = insertAlert(db, {
      event_id: v.event_id,
      type: 'not_arrived',
      visit_id: v.id,
      slot_id: v.slot_id,
      zone_id: v.zone_id,
      raised_by_profile: caller.profile?.id ?? null,
      message: 'Flagged by zone volunteer',
      dedupe_key: `not_arrived:${v.id}`,
    })
    if (!created && alert.status === 'acknowledged') {
      alert.status = 'open'
      alert.acknowledged_at = null
      alert.acknowledged_by = null
    }
    touch('alerts')
  })
}

export function reportWrongParking(input: ReportWrongParkingInput): { alert_id: string } {
  return mutate((db, touch) => {
    const caller = requireRole(db, ['zone_volunteer', 'admin'])
    const ev = liveEvent(db)
    if (!ev) throw new AppError('NO_LIVE_EVENT')
    const pt = turf.point([input.lng, input.lat])
    const zone = db.zones.find(
      (z) => z.event_id === ev.id && turf.booleanPointInPolygon(pt, turf.polygon(z.area.coordinates)),
    )
    const plate = input.plate ? normalizePlateSql(input.plate) : ''
    const visit = plate ? db.visits.find((v) => v.event_id === ev.id && v.plate === plate && isActive(v.status)) : undefined
    const { alert } = insertAlert(db, {
      event_id: ev.id,
      type: 'wrong_parking',
      visit_id: visit?.id ?? null,
      slot_id: visit?.slot_id ?? null,
      zone_id: zone?.id ?? currentZoneIds(caller)[0] ?? null,
      message: input.message?.trim() || null,
      location: [input.lng, input.lat],
      photo_path: input.photoPath,
      raised_by_profile: caller.profile?.id ?? null,
    })
    touch('alerts')
    return { alert_id: alert.id }
  })
}

/* ================================================================= alerts */

export function updateAlert(alertId: string, status: AlertStatus, note: string | null): void {
  mutate((db, touch) => {
    const caller = requireRole(db, ['admin', 'zone_volunteer'])
    const a = db.alerts.find((x) => x.id === alertId)
    if (!a) throw new AppError('NOT_FOUND')
    if (caller.session.role === 'zone_volunteer' && (a.type === 'sos' || !currentZoneIds(caller).includes(a.zone_id ?? '')))
      throw new AppError('FORBIDDEN')
    const ok =
      (a.status === 'open' && (status === 'acknowledged' || status === 'resolved')) ||
      (a.status === 'acknowledged' && status === 'resolved')
    if (!ok) throw new AppError('INVALID_STATE')
    const now = nowIso()
    if (status === 'acknowledged') {
      a.acknowledged_at = now
      a.acknowledged_by = caller.actor.id
    } else {
      a.resolved_at = now
      a.resolved_by = caller.actor.id
      a.resolution_note = note?.trim() || null
    }
    a.status = status
    touch('alerts')
  })
}

function toAlertView(db: DemoDb, a: AlertRow): AlertView {
  const visit = a.visit_id ? db.visits.find((v) => v.id === a.visit_id) : undefined
  const slot = a.slot_id ? db.slots.find((s) => s.id === a.slot_id) : undefined
  const zone = a.zone_id ? db.zones.find((z) => z.id === a.zone_id) : undefined
  const driverId = a.raised_by_driver ?? visit?.driver_id ?? null
  const driver = driverId ? db.drivers.find((d) => d.id === driverId) : undefined
  const profile = a.raised_by_profile ? db.profiles.find((p) => p.id === a.raised_by_profile) : undefined
  return {
    ...a,
    plate: visit?.plate ?? null,
    slot_label: slot?.label ?? null,
    zone_code: zone?.code ?? null,
    raised_by_label: a.raised_by_driver ? 'Driver' : profile ? profile.full_name : 'System',
    driver_phone: driver?.phone_e164 ?? null,
  }
}

function alertVisible(caller: Caller, a: AlertRow): boolean {
  const role = caller.session.role
  if (role === 'admin') return true
  if (role === 'gate_volunteer') return a.type === 'sos' || a.type === 'wrong_parking'
  if (role === 'zone_volunteer') return currentZoneIds(caller).includes(a.zone_id ?? '')
  return false
}

export function listAlerts(f: AlertFilters): AlertView[] {
  const db = readDb()
  const caller = requireRole(db, [...STAFF])
  return db.alerts
    .filter((a) => a.event_id === f.eventId && alertVisible(caller, a))
    .filter((a) => !f.status || a.status === f.status)
    .filter((a) => !f.types?.length || f.types.includes(a.type))
    .filter((a) => !f.zoneIds?.length || f.zoneIds.includes(a.zone_id ?? ''))
    .sort((a, b) => (a.type === 'sos' ? 0 : 1) - (b.type === 'sos' ? 0 : 1) || b.created_at.localeCompare(a.created_at))
    .map((a) => toAlertView(db, a))
}

export function getAlert(alertId: string): AlertView {
  const db = readDb()
  const caller = requireRole(db, [...STAFF])
  const a = db.alerts.find((x) => x.id === alertId)
  if (!a || !alertVisible(caller, a)) throw new AppError('NOT_FOUND')
  return toAlertView(db, a)
}

/* ================================================================= dashboard */

export function getDashboardSummary(eventId: string): DashboardSummary {
  const db = readDb()
  requireRole(db, ['admin'])
  const slots = db.slots.filter((s) => s.event_id === eventId)
  const count = (list: typeof slots, st: string) => list.filter((s) => s.status === st).length
  const visits = db.visits.filter((v) => v.event_id === eventId)
  const alerts = db.alerts.filter((a) => a.event_id === eventId && a.status !== 'resolved')
  const since = Date.now() - 15 * 60_000
  const wa = db.whatsapp_messages.filter((m) => m.event_id === eventId && m.driver_id)
  return {
    slots: {
      total: slots.length,
      available: count(slots, 'available'),
      assigned: count(slots, 'assigned'),
      occupied: count(slots, 'occupied'),
      blocked: count(slots, 'blocked'),
    },
    visits: {
      active: visits.filter((v) => isActive(v.status)).length,
      en_route: visits.filter((v) => v.status === 'assigned' || v.status === 'en_route').length,
      awaiting_confirm: visits.filter((v) => v.status === 'driver_parked').length,
      confirmed: visits.filter((v) => v.status === 'confirmed').length,
      exited: visits.filter((v) => v.status === 'exited').length,
      checked_in_total: visits.filter((v) => v.status !== 'cancelled').length,
    },
    alerts: { open: alerts.length, sos_open: alerts.filter((a) => a.type === 'sos').length },
    zones: db.zones
      .filter((z) => z.event_id === eventId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((z) => {
        const zs = slots.filter((s) => s.zone_id === z.id)
        const total = zs.length
        const assigned = count(zs, 'assigned')
        const occupied = count(zs, 'occupied')
        const blocked = count(zs, 'blocked')
        const usable = total - blocked
        return {
          id: z.id,
          code: z.code,
          name: z.name,
          name_ml: z.name_ml,
          color: z.color,
          vehicle_types: z.vehicle_types,
          categories: z.categories,
          total,
          available: count(zs, 'available'),
          assigned,
          occupied,
          blocked,
          occupancy_pct: usable > 0 ? Math.round((1000 * (assigned + occupied)) / usable) / 10 : 0,
        }
      }),
    gates: db.gates
      .filter((g) => g.event_id === eventId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((g) => ({
        id: g.id,
        name: g.name,
        checkins_15m: visits.filter((v) => v.entry_gate_id === g.id && new Date(v.checked_in_at).getTime() >= since)
          .length,
        exits_15m: visits.filter(
          (v) => v.exit_gate_id === g.id && v.exited_at && new Date(v.exited_at).getTime() >= since,
        ).length,
      })),
    wa: {
      sent: wa.filter((m) => m.status !== 'queued' && m.status !== 'failed').length,
      delivered: wa.filter((m) => m.status === 'delivered' || m.status === 'read').length,
      read: wa.filter((m) => m.status === 'read').length,
      failed: wa.filter((m) => m.status === 'failed').length,
    },
    last_updated: nowIso(),
  }
}

export function getRecentActivity(eventId: string, limit: number): ActivityItem[] {
  const db = readDb()
  requireRole(db, ['admin'])
  const out: ActivityItem[] = []
  for (let i = db.visit_events.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const e = db.visit_events[i]
    if (e.event_id !== eventId) continue
    const v = db.visits.find((x) => x.id === e.visit_id)
    if (!v) continue
    const label =
      typeof e.data.label === 'string'
        ? e.data.label
        : typeof e.data.to === 'string'
          ? e.data.to
          : v.slot_id
            ? (db.slots.find((s) => s.id === v.slot_id)?.label ?? null)
            : null
    out.push({ id: e.id, visit_id: v.id, type: e.type, plate: v.plate, slot_label: label, created_at: e.created_at })
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
}

export function getLiveVehicles(eventId: string): LiveVehicle[] {
  const db = readDb()
  requireRole(db, ['admin'])
  const cutoff = Date.now() - 5 * 60_000
  return db.visits
    .filter(
      (v) =>
        v.event_id === eventId &&
        isActive(v.status) &&
        v.last_position &&
        v.last_position_at &&
        new Date(v.last_position_at).getTime() >= cutoff,
    )
    .map((v) => ({
      visit_id: v.id,
      plate: v.plate,
      status: v.status,
      vehicle_type: v.vehicle_type,
      slot_label: v.slot_id ? (db.slots.find((s) => s.id === v.slot_id)?.label ?? null) : null,
      lng: v.last_position![0],
      lat: v.last_position![1],
      at: v.last_position_at!,
    }))
}

export function getRoadTraffic(eventId: string): RoadTrafficRow[] {
  const db = readDb()
  requireRole(db, ['admin'])
  const cutoff = Date.now() - 60_000
  const moving = db.visits.filter(
    (v) =>
      v.event_id === eventId &&
      (v.status === 'assigned' || v.status === 'en_route') &&
      v.last_position &&
      v.last_position_at &&
      new Date(v.last_position_at).getTime() >= cutoff,
  )
  return db.road_segments
    .filter((s) => s.event_id === eventId)
    .map((s) => ({
      segment_id: s.id,
      vehicles: moving.filter((v) => distToLineM(v.last_position!, s.coords) <= 15).length,
    }))
}

/* ================================================================= maintenance */

/** run_maintenance(): not_arrived, confirm_pending, overstay alerts and auto-resolve. Live event only. */
export function runMaintenance(now: number = Date.now()): { created: number; resolved: number } {
  return mutate((db, touch) => {
    const ev = liveEvent(db)
    if (!ev) return { created: 0, resolved: 0 }
    let created = 0
    let resolved = 0
    const visits = db.visits.filter((v) => v.event_id === ev.id)
    const add = (v: VisitRow, type: AlertType, message: string) => {
      const r = insertAlert(db, {
        event_id: ev.id,
        type,
        visit_id: v.id,
        slot_id: v.slot_id,
        zone_id: v.zone_id,
        message,
        raised_by_system: true,
        dedupe_key: `${type}:${v.id}`,
      })
      if (r.created) created += 1
    }
    const overstay = now > new Date(ev.ends_at).getTime() + ev.overstay_after_end_min * 60_000
    for (const v of visits) {
      if (
        (v.status === 'assigned' || v.status === 'en_route') &&
        new Date(v.assigned_at).getTime() < now - ev.arrival_timeout_min * 60_000
      )
        add(v, 'not_arrived', `Not arrived after ${ev.arrival_timeout_min} min`)
      if (
        v.status === 'driver_parked' &&
        v.driver_parked_at &&
        new Date(v.driver_parked_at).getTime() < now - ev.confirm_timeout_min * 60_000
      )
        add(v, 'confirm_pending', `Waiting for confirmation over ${ev.confirm_timeout_min} min`)
      if (overstay && isActive(v.status) && !db.alerts.some((a) => a.dedupe_key === `overstay:${v.id}`))
        add(v, 'overstay', 'Still parked after the event ended')
    }
    for (const a of db.alerts) {
      if (a.event_id !== ev.id || a.status === 'resolved' || !a.raised_by_system || !a.visit_id) continue
      if (a.type !== 'not_arrived' && a.type !== 'confirm_pending') continue
      const v = db.visits.find((x) => x.id === a.visit_id)
      const still =
        v &&
        (a.type === 'not_arrived' ? v.status === 'assigned' || v.status === 'en_route' : v.status === 'driver_parked')
      if (!still) {
        a.status = 'resolved'
        a.resolved_at = new Date(now).toISOString()
        a.resolution_note = 'auto'
        resolved += 1
      }
    }
    if (created + resolved > 0) touch('alerts')
    return { created, resolved }
  })
}

/* ================================================================= events */

export function listEvents(): EventListItem[] {
  const db = readDb()
  requireRole(db, ['admin'])
  return db.events
    .slice()
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .map((e) => ({
      ...e,
      zones: db.zones.filter((z) => z.event_id === e.id).length,
      slots: db.slots.filter((s) => s.event_id === e.id).length,
      vehicles: db.visits.filter((v) => v.event_id === e.id && v.status !== 'cancelled').length,
    }))
}

export function upsertEvent(input: EventInput): EventRow {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    const now = nowIso()
    const existing = input.id ? db.events.find((e) => e.id === input.id) : undefined
    if (input.id && !existing) throw new AppError('NOT_FOUND')
    const base: EventRow = existing ?? {
      id: newId(),
      name: '',
      venue_name: null,
      starts_at: now,
      ends_at: now,
      timezone: 'Asia/Kolkata',
      status: 'draft',
      center: liveEvent(db)?.center ?? [76.6, 8.88],
      default_zoom: 17,
      paid_parking: false,
      fee_rules: { bike: 0, car: 0, ev: 0, bus: 0, other: 0 },
      fee_exempt_categories: ['vip', 'faculty', 'staff', 'volunteer', 'performer'],
      emergency_phone: null,
      admin_alert_phones: [],
      default_language: 'en',
      arrival_timeout_min: 20,
      confirm_timeout_min: 10,
      overstay_after_end_min: 60,
      location_tolerance_m: 40,
      arrival_radius_m: 20,
      base_map: 'street',
      created_at: now,
      updated_at: now,
    }
    const { id: _ignored, ...patch } = input
    void _ignored
    const next: EventRow = { ...base, ...stripUndefined(patch), id: base.id, status: base.status, updated_at: now }
    if (!next.name.trim()) throw new AppError('BAD_REQUEST')
    if (new Date(next.ends_at).getTime() <= new Date(next.starts_at).getTime()) throw new AppError('BAD_REQUEST')
    const ints = [
      next.arrival_timeout_min,
      next.confirm_timeout_min,
      next.overstay_after_end_min,
      next.location_tolerance_m,
      next.arrival_radius_m,
    ]
    if (ints.some((n) => !Number.isFinite(n) || n < 0)) throw new AppError('BAD_REQUEST')
    if (Object.values(next.fee_rules).some((n) => !Number.isFinite(n) || n < 0)) throw new AppError('BAD_REQUEST')
    if (existing) Object.assign(existing, next)
    else db.events.push(next)
    touch('events')
    return next
  })
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

export function setEventStatus(eventId: string, status: EventStatus): EventRow {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    const ev = eventById(db, eventId)
    const other = db.events.find((e) => e.status === 'live' && e.id !== eventId)
    const allowed =
      (ev.status === 'draft' && status === 'live') ||
      (ev.status === 'live' && status === 'closed') ||
      (ev.status === 'closed' && status === 'live' && new Date(ev.ends_at).getTime() > Date.now())
    if (!allowed) throw new AppError('INVALID_STATE')
    if (status === 'live' && other) throw new AppError('INVALID_STATE', other.name)
    ev.status = status
    ev.updated_at = nowIso()
    if (status === 'closed') {
      const drivers = new Set(db.drivers.filter((d) => d.event_id === ev.id).map((d) => d.id))
      db.driver_access_tokens.forEach((t) => {
        if (drivers.has(t.driver_id) && !t.revoked_at) t.revoked_at = nowIso()
      })
    }
    touch('events', 'visits')
    return ev
  })
}

/* ================================================================= staff and zones */

export function listStaff(): StaffView[] {
  const db = readDb()
  requireRole(db, ['admin'])
  return db.profiles
    .map(({ password: _pw, ...rest }) => {
      void _pw
      return rest
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

export function getZonesSlots(eventId: string): ZonesSlotsData {
  const db = readDb()
  requireRole(db, ['admin', 'zone_volunteer', 'gate_volunteer'])
  const slots = db.slots.filter((s) => s.event_id === eventId)
  const zones = db.zones
    .filter((z) => z.event_id === eventId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((z) => {
      const zs = slots.filter((s) => s.zone_id === z.id)
      const c = (st: string) => zs.filter((s) => s.status === st).length
      return {
        ...z,
        total: zs.length,
        available: c('available'),
        assigned: c('assigned'),
        occupied: c('occupied'),
        blocked: c('blocked'),
        accessible: zs.filter((s) => s.is_accessible).length,
      }
    })
  const visitById = new Map(db.visits.map((v) => [v.id, v]))
  return {
    zones,
    slots: slots
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((s) => {
        const v = s.current_visit_id ? visitById.get(s.current_visit_id) : undefined
        return { ...s, plate: v?.plate ?? null, visit_status: v?.status ?? null }
      }),
  }
}

/** Centroid helper re-exported for the editor. */
export { centroidOf, ACTIVE_VISIT_STATUSES }
