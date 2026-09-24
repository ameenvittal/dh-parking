import * as turf from '@turf/turf'
import { AppError } from '@/lib/errors'
import type { GateRow, LandmarkRow, LngLat, PolygonGeometry, SlotRow, ZoneRow } from '@/types/domain'
import { centroidOf, distM, isActive, lineLengthM, newId, requireRole, setSlotStatus } from './core'
import { mutate, nowIso, readDb, type DemoDb } from './db'
import type {
  OverlayRow,
  RoadNetworkInput,
  SetSlotsStatusResult,
  SlotInput,
  SlotPropsPatch,
  UpsertGateInput,
  UpsertLandmarkInput,
  UpsertOverlayInput,
  UpsertZoneInput,
} from './types'

/**
 * admin_* map editor RPCs (docs/04 section 3) with the same validation as the
 * server: ST_IsValid, within zone (0.5 m buffer), overlap over 10 percent, active visits.
 * Every successful save bumps map_version and notifies the 'map' realtime table.
 */

function bump(db: DemoDb, touch: (...t: ('map' | 'slots')[]) => void, slots = false): void {
  db.map_version += 1
  touch('map')
  if (slots) touch('slots')
}

function isLngLat(c: unknown): c is number[] {
  return Array.isArray(c) && c.length >= 2 && c.every((n) => typeof n === 'number' && Number.isFinite(n))
}

export function validPolygon(p: PolygonGeometry | null | undefined): boolean {
  if (!p || p.type !== 'Polygon' || !Array.isArray(p.coordinates) || p.coordinates.length === 0) return false
  const ring = p.coordinates[0]
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(isLngLat)) return false
  const [f, l] = [ring[0], ring[ring.length - 1]]
  if (f[0] !== l[0] || f[1] !== l[1]) return false
  try {
    return turf.kinks(turf.polygon(p.coordinates)).features.length === 0
  } catch {
    return false
  }
}

function point(p: { type: 'Point'; coordinates: number[] }): LngLat {
  if (!p || p.type !== 'Point' || !isLngLat(p.coordinates)) throw new AppError('GEOMETRY_INVALID')
  return [p.coordinates[0], p.coordinates[1]]
}

function areaM2(p: PolygonGeometry): number {
  return turf.area(turf.polygon(p.coordinates))
}

function slotWithinZone(slot: PolygonGeometry, zone: PolygonGeometry): boolean {
  const buffered = turf.buffer(turf.polygon(zone.coordinates), 0.5, { units: 'meters' })
  if (!buffered) return false
  return turf.booleanWithin(turf.polygon(slot.coordinates), buffered)
}

function overlapRatio(a: PolygonGeometry, b: PolygonGeometry): number {
  try {
    const inter = turf.intersect(turf.featureCollection([turf.polygon(a.coordinates), turf.polygon(b.coordinates)]))
    if (!inter) return 0
    return turf.area(inter) / areaM2(a)
  } catch {
    return 0
  }
}

function activePlate(db: DemoDb, slotId: string): string | null {
  return db.visits.find((v) => v.slot_id === slotId && isActive(v.status))?.plate ?? null
}

function labelFor(code: string, n: number): string {
  return `${code}-${String(n).padStart(3, '0')}`
}

/* ------------------------------------------------------------- gates */

export function adminUpsertGate(input: UpsertGateInput): GateRow {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    if (!input.name.trim()) throw new AppError('BAD_REQUEST')
    const location = point(input.point)
    let row = input.id ? db.gates.find((g) => g.id === input.id) : undefined
    if (input.id && !row) throw new AppError('NOT_FOUND')
    if (!row) {
      row = {
        id: newId(),
        event_id: input.eventId,
        name: '',
        name_ml: null,
        kind: 'both',
        location,
        is_active: true,
        sort_order: db.gates.filter((g) => g.event_id === input.eventId).length,
      }
      db.gates.push(row)
    }
    row.name = input.name.trim()
    row.name_ml = input.name_ml?.trim() || null
    row.kind = input.kind
    row.location = location
    bump(db, touch)
    return row
  })
}

export function adminDeleteGate(id: string): void {
  mutate((db, touch) => {
    requireRole(db, ['admin'])
    db.gates = db.gates.filter((g) => g.id !== id)
    db.visits.forEach((v) => {
      if (v.entry_gate_id === id) v.entry_gate_id = null
      if (v.exit_gate_id === id) v.exit_gate_id = null
    })
    db.profiles.forEach((p) => {
      p.gate_ids = p.gate_ids.filter((g) => g !== id)
    })
    bump(db, touch)
  })
}

/* ------------------------------------------------------------- zones */

export function adminUpsertZone(input: UpsertZoneInput): ZoneRow {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    const code = input.code.trim().toUpperCase()
    if (!/^[A-Z0-9]{1,4}$/.test(code) || !input.name.trim()) throw new AppError('BAD_REQUEST')
    if (!validPolygon(input.polygon)) throw new AppError('GEOMETRY_INVALID')
    const a = areaM2(input.polygon)
    if (a < 50 || a > 200_000) throw new AppError('GEOMETRY_INVALID')
    if (input.vehicle_types.length === 0) throw new AppError('BAD_REQUEST')
    if (db.zones.some((z) => z.event_id === input.eventId && z.code === code && z.id !== input.id))
      throw new AppError('BAD_REQUEST', code)

    let row = input.id ? db.zones.find((z) => z.id === input.id) : undefined
    if (input.id && !row) throw new AppError('NOT_FOUND')
    const slots = row ? db.slots.filter((s) => s.zone_id === row!.id) : []
    if (row) {
      const outside = slots.filter((s) => !slotWithinZone(s.shape, input.polygon)).map((s) => s.label)
      if (outside.length > 0) throw new AppError('OUTSIDE_ZONE', outside.slice(0, 5).join(', '))
    } else {
      row = {
        id: newId(),
        event_id: input.eventId,
        code,
        name: '',
        name_ml: null,
        color: input.color,
        area: input.polygon,
        vehicle_types: [],
        categories: [],
        is_overflow: false,
        priority: 100,
        notes: null,
        sort_order: db.zones.filter((z) => z.event_id === input.eventId).length,
      }
      db.zones.push(row)
    }
    const codeChanged = row.code !== code
    Object.assign(row, {
      code,
      name: input.name.trim(),
      name_ml: input.name_ml?.trim() || null,
      color: input.color,
      area: input.polygon,
      vehicle_types: input.vehicle_types,
      categories: input.categories,
      is_overflow: input.is_overflow,
      priority: Math.round(input.priority),
      notes: input.notes?.trim() || null,
    })
    if (codeChanged) slots.forEach((s) => (s.label = labelFor(code, s.number)))
    bump(db, touch, codeChanged)
    return row
  })
}

export function adminDeleteZone(id: string): void {
  mutate((db, touch) => {
    requireRole(db, ['admin'])
    const slots = db.slots.filter((s) => s.zone_id === id)
    const plates = slots.map((s) => activePlate(db, s.id)).filter((p): p is string => !!p)
    if (plates.length > 0) throw new AppError('HAS_ACTIVE_VISIT', plates.slice(0, 5).join(', '))
    const ids = new Set(slots.map((s) => s.id))
    db.slots = db.slots.filter((s) => !ids.has(s.id))
    db.zones = db.zones.filter((z) => z.id !== id)
    db.profiles.forEach((p) => {
      p.zone_ids = p.zone_ids.filter((z) => z !== id)
    })
    bump(db, touch, true)
  })
}

/* ------------------------------------------------------------- slots */

export function adminUpsertSlots(zoneId: string, input: SlotInput[]): SlotRow[] {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    const zone = db.zones.find((z) => z.id === zoneId)
    if (!zone) throw new AppError('NOT_FOUND')
    const batchIds = new Set(input.map((s) => s.id).filter((x): x is string => !!x))
    const numbers = new Set<number>()
    const outside: string[] = []
    const overlaps: string[] = []

    input.forEach((s) => {
      const label = labelFor(zone.code, s.number)
      if (!Number.isInteger(s.number) || s.number < 1 || s.number > 999 || numbers.has(s.number))
        throw new AppError('BAD_REQUEST', label)
      numbers.add(s.number)
      const clash = db.slots.find((x) => x.zone_id === zoneId && x.number === s.number && x.id !== s.id)
      if (clash && !batchIds.has(clash.id)) throw new AppError('BAD_REQUEST', label)
      if (!validPolygon(s.polygon)) throw new AppError('GEOMETRY_INVALID', label)
      const a = areaM2(s.polygon)
      if (a < 0.8 || a > 60) throw new AppError('GEOMETRY_INVALID', label)
      if (!slotWithinZone(s.polygon, zone.area)) outside.push(label)
    })
    if (outside.length > 0) throw new AppError('OUTSIDE_ZONE', outside.slice(0, 5).join(', '))

    const others = db.slots.filter((x) => x.event_id === zone.event_id && !batchIds.has(x.id))
    const shapes = [...others.map((o) => ({ label: o.label, shape: o.shape, c: o.center }))]
    input.forEach((s, i) => {
      const c = centroidOf(s.polygon)
      const label = labelFor(zone.code, s.number)
      const near = shapes.filter((o) => distM(o.c, c) < 40)
      input.forEach((t, j) => {
        if (j !== i) near.push({ label: labelFor(zone.code, t.number), shape: t.polygon, c: centroidOf(t.polygon) })
      })
      if (near.some((o) => distM(o.c, c) < 40 && overlapRatio(s.polygon, o.shape) > 0.1)) overlaps.push(label)
    })
    if (overlaps.length > 0) throw new AppError('OVERLAP', overlaps.slice(0, 5).join(', '))

    const saved: SlotRow[] = []
    input.forEach((s) => {
      let row = s.id ? db.slots.find((x) => x.id === s.id) : undefined
      if (s.id && !row) throw new AppError('NOT_FOUND')
      if (row && row.vehicle_type !== s.vehicle_type && activePlate(db, row.id))
        throw new AppError('HAS_ACTIVE_VISIT', activePlate(db, row.id))
      if (!row) {
        row = {
          id: newId(),
          event_id: zone.event_id,
          zone_id: zone.id,
          label: '',
          number: s.number,
          shape: s.polygon,
          center: centroidOf(s.polygon),
          vehicle_type: s.vehicle_type,
          is_accessible: false,
          has_ev_charger: false,
          status: 'available',
          blocked_reason: null,
          current_visit_id: null,
          status_changed_at: nowIso(),
        }
        db.slots.push(row)
      }
      Object.assign(row, {
        zone_id: zone.id,
        number: s.number,
        label: labelFor(zone.code, s.number),
        shape: s.polygon,
        center: centroidOf(s.polygon),
        vehicle_type: s.vehicle_type,
        is_accessible: s.is_accessible,
        has_ev_charger: s.has_ev_charger,
      })
      saved.push(row)
    })
    bump(db, touch, true)
    return saved
  })
}

export function adminDeleteSlots(ids: string[]): void {
  mutate((db, touch) => {
    requireRole(db, ['admin'])
    const plates = ids.map((id) => activePlate(db, id)).filter((p): p is string => !!p)
    if (plates.length > 0) throw new AppError('HAS_ACTIVE_VISIT', plates.slice(0, 5).join(', '))
    const set = new Set(ids)
    db.slots = db.slots.filter((s) => !set.has(s.id))
    bump(db, touch, true)
  })
}

export function adminSetSlotsStatus(
  ids: string[],
  status: 'available' | 'blocked',
  reason: string | null,
): SetSlotsStatusResult {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    if (status === 'blocked' && !reason?.trim()) throw new AppError('BAD_REQUEST')
    let updated = 0
    const skipped: string[] = []
    ids.forEach((id) => {
      const s = db.slots.find((x) => x.id === id)
      if (!s) return
      const from = status === 'blocked' ? 'available' : 'blocked'
      if (s.status !== from) {
        skipped.push(s.label)
        return
      }
      setSlotStatus(s, status, null)
      s.blocked_reason = status === 'blocked' ? reason!.trim() : null
      updated += 1
    })
    touch('slots')
    return { updated, skipped }
  })
}

export function adminSetSlotsProps(ids: string[], patch: SlotPropsPatch): { updated: number } {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    const targets = db.slots.filter((s) => ids.includes(s.id))
    if (patch.vehicle_type) {
      const busy = targets
        .filter((s) => s.vehicle_type !== patch.vehicle_type)
        .map((s) => activePlate(db, s.id))
        .filter((p): p is string => !!p)
      if (busy.length > 0) throw new AppError('HAS_ACTIVE_VISIT', busy.slice(0, 5).join(', '))
    }
    targets.forEach((s) => {
      if (patch.vehicle_type != null) s.vehicle_type = patch.vehicle_type
      if (patch.is_accessible != null) s.is_accessible = patch.is_accessible
      if (patch.has_ev_charger != null) s.has_ev_charger = patch.has_ev_charger
    })
    bump(db, touch, true)
    return { updated: targets.length }
  })
}

/* ------------------------------------------------------------- roads */

export function adminSaveRoadNetwork(input: RoadNetworkInput): { nodes: number; segments: number } {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    const nodes = new Map(input.nodes.map((n) => [n.id, n]))
    input.nodes.forEach((n) => {
      if (!isLngLat(n.coord)) throw new AppError('GEOMETRY_INVALID')
    })
    const segments = input.segments.map((s) => {
      const from = nodes.get(s.from)
      const to = nodes.get(s.to)
      if (!from || !to || s.coords.length < 2 || !s.coords.every(isLngLat)) throw new AppError('GEOMETRY_INVALID')
      const first = s.coords[0] as LngLat
      const last = s.coords[s.coords.length - 1] as LngLat
      if (distM(first, from.coord) > 1.5 || distM(last, to.coord) > 1.5) throw new AppError('GEOMETRY_INVALID')
      const length = lineLengthM(s.coords)
      if (length < 1) throw new AppError('GEOMETRY_INVALID')
      return {
        id: s.id || newId(),
        event_id: input.eventId,
        from: s.from,
        to: s.to,
        coords: s.coords,
        direction: s.direction,
        name: s.name?.trim() || null,
        length_m: Math.round(length * 10) / 10,
        walk_only: s.walk_only,
      }
    })
    db.road_segments = db.road_segments.filter((s) => s.event_id !== input.eventId).concat(segments)
    db.road_nodes = db.road_nodes
      .filter((n) => n.event_id !== input.eventId)
      .concat(input.nodes.map((n) => ({ id: n.id, event_id: input.eventId, coord: n.coord })))
    bump(db, touch)
    return { nodes: input.nodes.length, segments: segments.length }
  })
}

/* ------------------------------------------------------------- landmarks */

export function adminUpsertLandmark(input: UpsertLandmarkInput): LandmarkRow {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    if (!input.name.trim()) throw new AppError('BAD_REQUEST')
    const location = point(input.point)
    let row = input.id ? db.landmarks.find((l) => l.id === input.id) : undefined
    if (input.id && !row) throw new AppError('NOT_FOUND')
    if (!row) {
      row = { id: newId(), event_id: input.eventId, name: '', name_ml: null, kind: input.kind, location }
      db.landmarks.push(row)
    }
    Object.assign(row, { name: input.name.trim(), name_ml: input.name_ml?.trim() || null, kind: input.kind, location })
    bump(db, touch)
    return row
  })
}

export function adminDeleteLandmark(id: string): void {
  mutate((db, touch) => {
    requireRole(db, ['admin'])
    db.landmarks = db.landmarks.filter((l) => l.id !== id)
    bump(db, touch)
  })
}

/* ------------------------------------------------------------- overlays */

export function listOverlays(eventId: string): OverlayRow[] {
  const db = readDb()
  requireRole(db, ['admin', 'gate_volunteer', 'zone_volunteer', 'driver'])
  return db.overlays.filter((o) => o.event_id === eventId)
}

export function adminUpsertOverlay(input: UpsertOverlayInput): OverlayRow {
  return mutate((db, touch) => {
    requireRole(db, ['admin'])
    if (input.corners.length !== 4 || !input.corners.every(isLngLat)) throw new AppError('GEOMETRY_INVALID')
    if (!input.url) throw new AppError('BAD_REQUEST')
    let row = input.id ? db.overlays.find((o) => o.id === input.id) : undefined
    if (!row) {
      row = { id: newId(), event_id: input.eventId, url: '', corners: [], opacity: 0.85, is_visible: true }
      db.overlays.push(row)
    }
    Object.assign(row, {
      url: input.url,
      corners: input.corners,
      opacity: Math.min(1, Math.max(0, input.opacity)),
      is_visible: input.is_visible,
    })
    bump(db, touch)
    return row
  })
}

export function adminDeleteOverlay(id: string): void {
  mutate((db, touch) => {
    requireRole(db, ['admin'])
    db.overlays = db.overlays.filter((o) => o.id !== id)
    bump(db, touch)
  })
}
