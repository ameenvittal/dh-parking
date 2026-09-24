import * as turf from '@turf/turf'
import type {
  EventRow,
  GateRow,
  LandmarkRow,
  LngLat,
  PolygonGeometry,
  ProfileRow,
  RoadNodeRow,
  RoadSegmentRow,
  SlotRow,
  VehicleType,
  ZoneRow,
} from '@/types/domain'
import { emptyDb, type DemoDb } from './db'
import { centroidOf, lineLengthM, newId } from './core'

/**
 * Demo campus (docs/03 section 11, T-1.12, demo mode additions).
 * Local metres (x east, y north) around CENTER are converted to lng/lat.
 * The campus is about 220 m by 260 m so it reads well at zoom 17 to 18.
 */

export const DARUL_HUDA_CENTER: LngLat = [75.9075, 11.0504]
export const CENTER: LngLat = DARUL_HUDA_CENTER
const M_PER_DEG_LAT = 110_574
const M_PER_DEG_LNG = 111_320 * Math.cos((CENTER[1] * Math.PI) / 180)

export function toLngLat(x: number, y: number): LngLat {
  return [
    Math.round((CENTER[0] + x / M_PER_DEG_LNG) * 1e8) / 1e8,
    Math.round((CENTER[1] + y / M_PER_DEG_LAT) * 1e8) / 1e8,
  ]
}

function rect(x0: number, y0: number, x1: number, y1: number): PolygonGeometry {
  return {
    type: 'Polygon',
    coordinates: [[toLngLat(x0, y0), toLngLat(x1, y0), toLngLat(x1, y1), toLngLat(x0, y1), toLngLat(x0, y0)]],
  }
}

type RowSpec = {
  /** Front-left corner of the first slot, local metres. */
  x: number
  y: number
  count: number
  width: number
  depth: number
  start: number
  type: VehicleType
}

/**
 * Slot row on a west-to-east baseline with slots extending south, built with turf.destination
 * like lib/geo/slotGenerator (90 degree angle, right side, no gap).
 */
function slotRow(spec: RowSpec): { number: number; shape: PolygonGeometry; type: VehicleType }[] {
  const a = turf.point(toLngLat(spec.x, spec.y))
  const out: { number: number; shape: PolygonGeometry; type: VehicleType }[] = []
  for (let i = 0; i < spec.count; i += 1) {
    const p0 = turf.destination(a, i * spec.width, 90, { units: 'meters' })
    const p1 = turf.destination(p0, spec.width, 90, { units: 'meters' })
    const p2 = turf.destination(p1, spec.depth, 180, { units: 'meters' })
    const p3 = turf.destination(p0, spec.depth, 180, { units: 'meters' })
    const ring = [p0, p1, p2, p3, p0].map((p) => {
      const [lng, lat] = p.geometry.coordinates
      return [Math.round(lng * 1e8) / 1e8, Math.round(lat * 1e8) / 1e8]
    })
    out.push({ number: spec.start + i, shape: { type: 'Polygon', coordinates: [ring] }, type: spec.type })
  }
  return out
}

export type SeedIds = {
  eventId: string
  mainGateId: string
  northGateId: string
  zoneIds: Record<'A' | 'B' | 'C' | 'D', string>
  adminId: string
  gateUserId: string
  zoneUserId: string
}

/** Fixed ids so staff sessions and saved gate choices survive a demo reset. */
export const SEED_IDS = {
  event: '0e5e0000-0000-4000-8000-000000000001',
  mainGate: '0e5e0000-0000-4000-8000-0000000000a1',
  northGate: '0e5e0000-0000-4000-8000-0000000000a2',
  zoneA: '0e5e0000-0000-4000-8000-0000000000b1',
  zoneB: '0e5e0000-0000-4000-8000-0000000000b2',
  zoneC: '0e5e0000-0000-4000-8000-0000000000b3',
  zoneD: '0e5e0000-0000-4000-8000-0000000000b4',
  admin: '0e5e0000-0000-4000-8000-0000000000c1',
  gate1: '0e5e0000-0000-4000-8000-0000000000c2',
  zoneA_user: '0e5e0000-0000-4000-8000-0000000000c3',
} as const

export function buildSeed(now: number = Date.now()): { db: DemoDb; ids: SeedIds } {
  const db = emptyDb()
  const stamp = new Date(now).toISOString()
  const eventId = SEED_IDS.event

  const event: EventRow = {
    id: eventId,
    name: 'Darul Huda Fest',
    venue_name: 'Darul Huda Islamic University, Chemmad',
    starts_at: new Date(now - 2 * 3600_000).toISOString(),
    ends_at: new Date(now + 6 * 3600_000).toISOString(),
    timezone: 'Asia/Kolkata',
    status: 'live',
    center: toLngLat(0, 0),
    default_zoom: 17.5,
    paid_parking: false,
    fee_rules: { bike: 0, car: 0, ev: 0, bus: 0, other: 0 },
    fee_exempt_categories: ['vip', 'faculty', 'staff', 'volunteer', 'performer'],
    emergency_phone: '+919400000112',
    admin_alert_phones: ['+919400000001'],
    default_language: 'en',
    arrival_timeout_min: 20,
    confirm_timeout_min: 10,
    overstay_after_end_min: 60,
    location_tolerance_m: 40,
    arrival_radius_m: 20,
    base_map: 'street',
    created_at: stamp,
    updated_at: stamp,
  }
  db.events.push(event)

  /* gates */
  const mainGate: GateRow = {
    id: SEED_IDS.mainGate,
    event_id: eventId,
    name: 'Main gate',
    name_ml: 'പ്രധാന ഗേറ്റ്',
    kind: 'both',
    location: toLngLat(0, -130),
    is_active: true,
    sort_order: 0,
  }
  const northGate: GateRow = {
    id: SEED_IDS.northGate,
    event_id: eventId,
    name: 'North gate',
    name_ml: 'വടക്കേ ഗേറ്റ്',
    kind: 'entry',
    location: toLngLat(-60, 130),
    is_active: true,
    sort_order: 1,
  }
  db.gates.push(mainGate, northGate)

  /* zones */
  const zoneDefs: {
    code: 'A' | 'B' | 'C' | 'D'
    name: string
    name_ml: string
    color: string
    area: PolygonGeometry
    types: VehicleType[]
    categories: ZoneRow['categories']
    overflow: boolean
    priority: number
    notes: string | null
  }[] = [
    {
      code: 'A',
      name: 'North lawn',
      name_ml: 'വടക്കേ പുൽത്തകിടി',
      color: 'zone-1',
      area: rect(-100, 25, -15, 92),
      types: ['car', 'ev'],
      categories: [],
      overflow: false,
      priority: 100,
      notes: null,
    },
    {
      code: 'B',
      name: 'Bike park',
      name_ml: 'ബൈക്ക് പാർക്ക്',
      color: 'zone-2',
      area: rect(-100, -92, -30, -35),
      types: ['bike'],
      categories: [],
      overflow: false,
      priority: 100,
      notes: null,
    },
    {
      code: 'C',
      name: 'VIP lot',
      name_ml: 'വിഐപി പാർക്കിംഗ്',
      color: 'zone-3',
      area: rect(20, 35, 100, 92),
      types: ['car'],
      categories: ['vip', 'guest'],
      overflow: false,
      priority: 50,
      notes: 'Near the main auditorium',
    },
    {
      code: 'D',
      name: 'Overflow ground',
      name_ml: 'അധിക പാർക്കിംഗ് ഗ്രൗണ്ട്',
      color: 'zone-4',
      area: rect(20, -92, 100, -35),
      types: ['car'],
      categories: [],
      overflow: true,
      priority: 200,
      notes: 'Used when the main zones are full',
    },
  ]
  const zoneIds = {} as Record<'A' | 'B' | 'C' | 'D', string>
  const fixedZoneIds = { A: SEED_IDS.zoneA, B: SEED_IDS.zoneB, C: SEED_IDS.zoneC, D: SEED_IDS.zoneD }
  zoneDefs.forEach((z, i) => {
    const id = fixedZoneIds[z.code]
    zoneIds[z.code] = id
    db.zones.push({
      id,
      event_id: eventId,
      code: z.code,
      name: z.name,
      name_ml: z.name_ml,
      color: z.color,
      area: z.area,
      vehicle_types: z.types,
      categories: z.categories,
      is_overflow: z.overflow,
      priority: z.priority,
      notes: z.notes,
      sort_order: i,
    })
  })

  /* slots */
  const rows: Record<'A' | 'B' | 'C' | 'D', RowSpec[]> = {
    A: [
      { x: -92, y: 85, count: 15, width: 2.5, depth: 5, start: 1, type: 'car' },
      { x: -92, y: 55, count: 13, width: 2.5, depth: 5, start: 16, type: 'car' },
      { x: -59.5, y: 55, count: 2, width: 2.7, depth: 5, start: 29, type: 'ev' },
    ],
    B: [
      { x: -90, y: -45, count: 12, width: 1, depth: 2, start: 1, type: 'bike' },
      { x: -90, y: -65, count: 12, width: 1, depth: 2, start: 13, type: 'bike' },
    ],
    C: [{ x: 30, y: 80, count: 10, width: 2.5, depth: 5, start: 1, type: 'car' }],
    D: [
      { x: 40, y: -45, count: 6, width: 2.5, depth: 5, start: 1, type: 'car' },
      { x: 40, y: -70, count: 6, width: 2.5, depth: 5, start: 7, type: 'car' },
    ],
  }
  const accessible: Record<string, boolean> = { 'A-1': true, 'A-2': true, 'C-1': true, 'D-1': true }
  ;(Object.keys(rows) as ('A' | 'B' | 'C' | 'D')[]).forEach((code) => {
    rows[code].forEach((spec) => {
      slotRow(spec).forEach((s) => {
        const slot: SlotRow = {
          id: newId(),
          event_id: eventId,
          zone_id: zoneIds[code],
          label: `${code}-${String(s.number).padStart(3, '0')}`,
          number: s.number,
          shape: s.shape,
          center: centroidOf(s.shape),
          vehicle_type: s.type,
          is_accessible: accessible[`${code}-${s.number}`] ?? false,
          has_ev_charger: s.type === 'ev',
          status: 'available',
          blocked_reason: null,
          current_visit_id: null,
          status_changed_at: stamp,
        }
        db.slots.push(slot)
      })
    })
  })
  // One blocked slot so the blocked style is visible.
  const blocked = db.slots.find((s) => s.label === 'A-015')
  if (blocked) {
    blocked.status = 'blocked'
    blocked.blocked_reason = 'Tree branch on the slot'
  }

  /* road network: outer loop (east side one way, northbound), a cross, gate spurs and a footpath */
  const nodeAt: Record<string, RoadNodeRow> = {}
  const node = (key: string, x: number, y: number) => {
    const n: RoadNodeRow = { id: newId(), event_id: eventId, coord: toLngLat(x, y) }
    nodeAt[key] = n
    db.road_nodes.push(n)
  }
  node('sw', -110, -100)
  node('s0', 0, -100)
  node('se', 110, -100)
  node('e0', 110, 0)
  node('ne', 110, 100)
  node('n0', 0, 100)
  node('nwg', -60, 100)
  node('nw', -110, 100)
  node('w0', -110, 0)
  node('c', 0, 0)
  node('audr', 55, 0)
  node('aud', 55, 18)
  node('gm', 0, -130)
  node('gn', -60, 130)

  const seg = (
    from: string,
    to: string,
    name: string | null,
    direction: 'two_way' | 'one_way' = 'two_way',
    walkOnly = false,
  ) => {
    const coords = [nodeAt[from].coord, nodeAt[to].coord]
    const s: RoadSegmentRow = {
      id: newId(),
      event_id: eventId,
      from: nodeAt[from].id,
      to: nodeAt[to].id,
      coords,
      direction,
      name,
      length_m: Math.round(lineLengthM(coords) * 10) / 10,
      walk_only: walkOnly,
    }
    db.road_segments.push(s)
  }
  seg('gm', 's0', 'Main gate road')
  seg('sw', 's0', 'South road')
  seg('s0', 'se', 'South road')
  seg('se', 'e0', 'East road', 'one_way')
  seg('e0', 'ne', 'East road', 'one_way')
  seg('ne', 'n0', 'North road')
  seg('n0', 'nwg', 'North road')
  seg('nwg', 'nw', 'North road')
  seg('gn', 'nwg', 'North gate road')
  seg('nw', 'w0', 'West road')
  seg('w0', 'sw', 'West road')
  seg('s0', 'c', 'College avenue')
  seg('c', 'n0', 'College avenue')
  seg('w0', 'c', 'Library road')
  seg('c', 'audr', 'Library road')
  seg('audr', 'e0', 'Library road')
  seg('audr', 'aud', null, 'two_way', true)

  /* landmarks */
  const landmarks: Omit<LandmarkRow, 'id' | 'event_id'>[] = [
    { name: 'Main auditorium', name_ml: 'പ്രധാന ഓഡിറ്റോറിയം', kind: 'venue', location: toLngLat(55, 22) },
    { name: 'Help desk', name_ml: 'ഹെൽപ്പ് ഡെസ്ക്', kind: 'help_desk', location: toLngLat(14, -112) },
    { name: 'First aid', name_ml: 'പ്രഥമ ശുശ്രൂഷ', kind: 'first_aid', location: toLngLat(-20, 10) },
    { name: 'Food court', name_ml: 'ഫുഡ് കോർട്ട്', kind: 'food', location: toLngLat(-55, 10) },
  ]
  landmarks.forEach((l) => db.landmarks.push({ id: newId(), event_id: eventId, ...l }))

  /* staff */
  const profile = (
    id: string,
    p: Omit<ProfileRow, 'id' | 'created_at' | 'last_seen_at' | 'preferred_language' | 'is_active'>,
  ) => {
    const row: ProfileRow = {
      id,
      created_at: stamp,
      last_seen_at: null,
      preferred_language: 'en',
      is_active: true,
      ...p,
    }
    db.profiles.push(row)
    return row
  }
  const admin = profile(SEED_IDS.admin, {
    role: 'admin',
    full_name: 'Event admin',
    username: 'admin',
    password: 'admin12345',
    phone: '+919400000001',
    zone_ids: [],
    gate_ids: [],
  })
  const gateUser = profile(SEED_IDS.gate1, {
    role: 'gate_volunteer',
    full_name: 'Gate volunteer',
    username: 'gate1',
    password: 'test12345',
    phone: '+919400000002',
    zone_ids: [],
    gate_ids: [mainGate.id],
  })
  const zoneUser = profile(SEED_IDS.zoneA_user, {
    role: 'zone_volunteer',
    full_name: 'Zone A volunteer',
    username: 'zonea',
    password: 'test12345',
    phone: '+919400000003',
    zone_ids: [zoneIds.A],
    gate_ids: [],
  })

  return {
    db,
    ids: {
      eventId,
      mainGateId: mainGate.id,
      northGateId: northGate.id,
      zoneIds,
      adminId: admin.id,
      gateUserId: gateUser.id,
      zoneUserId: zoneUser.id,
    },
  }
}
