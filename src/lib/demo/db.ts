import type {
  AlertRow,
  AssistantMessageRow,
  DriverRow,
  EventRow,
  GateRow,
  LandmarkRow,
  PositionRow,
  Position,
  ProfileRow,
  RoadNodeRow,
  RoadSegmentRow,
  SlotRow,
  TokenRow,
  VisitEventRow,
  VisitRow,
  WaMessageRow,
  ZoneRow,
} from '@/types/domain'
import { sharedStorage } from './storage'
import type { DemoTable, OverlayRow } from './types'

/**
 * The whole simulated database as one JSON object in localStorage.
 * Every mutation reads the latest copy, applies the change, saves, and then
 * notifies this tab (emitter) and other tabs (BroadcastChannel).
 */

export const DB_KEY = 'eventpark.demo.db.v1'
const CHANNEL = 'eventpark.demo'
const MAX_POSITIONS = 4000
const MAX_VISIT_EVENTS = 6000

/** Free-form chat text (not a template): inbound from a driver, or the webhook's auto-reply. */
export type ChatText = {
  id: string
  phone: string
  direction: 'in' | 'out'
  body: string
  language: 'en' | 'ml'
  created_at: string
}

export type DemoDb = {
  version: 1
  seq: number
  map_version: number
  events: EventRow[]
  profiles: ProfileRow[]
  gates: GateRow[]
  zones: ZoneRow[]
  slots: SlotRow[]
  road_nodes: RoadNodeRow[]
  road_segments: RoadSegmentRow[]
  landmarks: LandmarkRow[]
  overlays: OverlayRow[]
  drivers: DriverRow[]
  driver_access_tokens: TokenRow[]
  visits: VisitRow[]
  visit_events: VisitEventRow[]
  vehicle_positions: PositionRow[]
  alerts: AlertRow[]
  whatsapp_messages: WaMessageRow[]
  wa_texts: ChatText[]
  /** Phone numbers (E.164) whose chat was opened in the simulator, with the time. */
  wa_read_marks: Record<string, string>
  assistant_messages: AssistantMessageRow[]
  rate_limits: Record<string, { window_start: number; count: number }>
}

export function emptyDb(): DemoDb {
  return {
    version: 1,
    seq: 0,
    map_version: 1,
    events: [],
    profiles: [],
    gates: [],
    zones: [],
    slots: [],
    road_nodes: [],
    road_segments: [],
    landmarks: [],
    overlays: [],
    drivers: [],
    driver_access_tokens: [],
    visits: [],
    visit_events: [],
    vehicle_positions: [],
    alerts: [],
    whatsapp_messages: [],
    wa_texts: [],
    wa_read_marks: {},
    assistant_messages: [],
    rate_limits: {},
  }
}

/* ------------------------------------------------------------ events */

export type ChangeMessage = { kind: 'change'; tables: DemoTable[] }
export type PositionMessage = { kind: 'position'; position: Position }
type BusMessage = ChangeMessage | PositionMessage

type ChangeListener = (tables: DemoTable[]) => void
type PositionListener = (p: Position) => void

const changeListeners = new Set<ChangeListener>()
const positionListeners = new Set<PositionListener>()

let channel: BroadcastChannel | null = null
function getChannel(): BroadcastChannel | null {
  if (channel) return channel
  if (typeof BroadcastChannel === 'undefined' || typeof window === 'undefined') return null
  channel = new BroadcastChannel(CHANNEL)
  channel.onmessage = (ev: MessageEvent<BusMessage>) => {
    const msg = ev.data
    if (msg.kind === 'change') {
      cache = null
      changeListeners.forEach((l) => l(msg.tables))
    } else if (msg.kind === 'position') {
      positionListeners.forEach((l) => l(msg.position))
    }
  }
  return channel
}

export function onTablesChange(listener: ChangeListener): () => void {
  getChannel()
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
  }
}

export function onPosition(listener: PositionListener): () => void {
  getChannel()
  positionListeners.add(listener)
  return () => {
    positionListeners.delete(listener)
  }
}

export function publishPosition(position: Position): void {
  positionListeners.forEach((l) => l(position))
  getChannel()?.postMessage({ kind: 'position', position } satisfies PositionMessage)
}

function publishChange(tables: DemoTable[]): void {
  if (tables.length === 0) return
  changeListeners.forEach((l) => l(tables))
  getChannel()?.postMessage({ kind: 'change', tables } satisfies ChangeMessage)
}

/* ------------------------------------------------------------ read/write */

let cache: { raw: string; db: DemoDb } | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY) cache = null
  })
}

function parse(raw: string | null): DemoDb | null {
  if (!raw) return null
  try {
    const db = JSON.parse(raw) as DemoDb
    if (db && db.version === 1) return { ...emptyDb(), ...db }
  } catch {
    /* corrupted: treat as missing */
  }
  return null
}

/** Current database for reads. Cached per tab until another tab or this tab writes. */
export function readDb(): DemoDb {
  const raw = sharedStorage().getItem(DB_KEY)
  if (cache && raw === cache.raw) return cache.db
  const db = parse(raw) ?? emptyDb()
  cache = { raw: raw ?? '', db }
  return db
}

export function hasDb(): boolean {
  return parse(sharedStorage().getItem(DB_KEY)) !== null
}

function save(db: DemoDb): void {
  if (db.vehicle_positions.length > MAX_POSITIONS) db.vehicle_positions = db.vehicle_positions.slice(-MAX_POSITIONS)
  if (db.visit_events.length > MAX_VISIT_EVENTS) db.visit_events = db.visit_events.slice(-MAX_VISIT_EVENTS)
  const raw = JSON.stringify(db)
  sharedStorage().setItem(DB_KEY, raw)
  cache = { raw, db }
}

/**
 * Apply a change. `fn` receives a fresh copy and returns the result plus the tables it touched.
 * Throwing inside `fn` aborts without saving, like a rolled back transaction.
 */
export function mutate<T>(fn: (db: DemoDb, touch: (...tables: DemoTable[]) => void) => T): T {
  const fresh = parse(sharedStorage().getItem(DB_KEY)) ?? emptyDb()
  const touched = new Set<DemoTable>()
  const result = fn(fresh, (...tables) => tables.forEach((t) => touched.add(t)))
  save(fresh)
  publishChange([...touched])
  return result
}

/** Replace the whole database (seed, reset). Notifies every table. */
export function replaceDb(db: DemoDb): void {
  save(db)
  publishChange(['events', 'map', 'profiles', 'visits', 'slots', 'alerts', 'whatsapp_messages'])
}

export function nextSeq(db: DemoDb): number {
  db.seq += 1
  return db.seq
}

export function nowIso(): string {
  return new Date().toISOString()
}
