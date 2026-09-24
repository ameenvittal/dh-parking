/**
 * Types for the simulated backend that are not in src/types/domain.ts.
 * Feature api.ts files re-export the ones their screens need.
 */
import type {
  AlertStatus,
  AlertType,
  AppRole,
  CheckinResult,
  EventRow,
  ExtractResult,
  GateKind,
  Language,
  LandmarkKind,
  LngLat,
  PaymentMethod,
  PolygonGeometry,
  SlotRow,
  StaffRole,
  VehicleType,
  VisitStatus,
  VisitorCategory,
  WaStatus,
  WaTemplate,
  ZoneRow,
} from '@/types/domain'

/** Tables (and pseudo tables) that emit change notifications. */
export type DemoTable = 'visits' | 'slots' | 'alerts' | 'whatsapp_messages' | 'events' | 'map' | 'profiles'

/* ------------------------------------------------------------ gate */

export type ExtractResponse = {
  result: ExtractResult | null
  error: { code: 'AI_FAILED' } | null
  model: string | null
  ms: number
  /** True when the dev proxy had no Gemini key and a plausible result was made up. */
  simulated: boolean
}

export type PhotoUpload = {
  /** Storage-like path, for example `vehicle-photos/<event>/<date>/<uuid>.jpg`. */
  path: string
  /** Object URL or data URL for an immediate preview in this tab. */
  url: string
}

export type SuggestSlotsInput = {
  eventId: string
  gateId: string
  vehicleType: VehicleType
  category: VisitorCategory
  needsAccessible: boolean
  limit?: number
  /** Optional: restrict suggestions to one zone (zone chips on the slot step). */
  zoneId?: string | null
}

export type SearchVisitsInput = {
  eventId: string
  query: string
  status?: VisitStatus[] | null
  limit?: number
}

export type ReassignInput = { visitId: string; newSlotId: string; notify: boolean }
export type ReassignResult = { slot: CheckinResult['slot']; whatsapp: CheckinResult['whatsapp'] }
export type ResendResult = { ok: true; message_id: string | null; status: WaStatus | null }
export type MarkExitResult = { status: 'exited' }

/* ---------------------------------------------------------- driver */

export type MarkParkedInput = { lng: number | null; lat: number | null; accuracy_m: number | null }
export type MarkParkedResult = { status: VisitStatus; distance_m: number | null; mismatch: boolean }
export type RecordPositionInput = {
  lng: number
  lat: number
  accuracy_m: number | null
  heading: number | null
  speed_mps: number | null
}
export type RaiseSosInput = {
  reason: 'medical' | 'breakdown' | 'safety' | 'lost' | 'other'
  message: string | null
  lng: number | null
  lat: number | null
}
export type SosResult = { alert_id: string; emergency_phone: string | null }
export type DriverTokenResult = { event_id: string; language: Language }

/* ------------------------------------------------------------ zone */

export type ConfirmParkedInput = { visitId: string; actualSlotId?: string | null; note?: string | null }
export type ConfirmParkedResult = { status: 'confirmed'; slot_label: string }
export type ReportWrongParkingInput = {
  lng: number
  lat: number
  message: string | null
  photoPath: string | null
  plate?: string | null
}

/* ----------------------------------------------------------- admin */

export type RoadTrafficRow = { segment_id: string; vehicles: number }

export type VisitListFilters = {
  eventId: string
  query?: string
  statuses?: VisitStatus[]
  zoneIds?: string[]
  vehicleTypes?: VehicleType[]
  categories?: VisitorCategory[]
  gateId?: string | null
  /** ISO range on checked_in_at. */
  from?: string | null
  to?: string | null
  /** Only visits whose latest WhatsApp message failed. */
  waFailed?: boolean
}

export type AlertFilters = {
  eventId: string
  status?: AlertStatus | null
  types?: AlertType[]
  zoneIds?: string[]
}

export type ZoneWithCounts = ZoneRow & {
  total: number
  available: number
  assigned: number
  occupied: number
  blocked: number
  accessible: number
}

export type SlotWithVisit = SlotRow & {
  plate: string | null
  visit_status: VisitStatus | null
}

export type ZonesSlotsData = { zones: ZoneWithCounts[]; slots: SlotWithVisit[] }

export type SetSlotsStatusResult = { updated: number; skipped: string[] }

export type EventListItem = EventRow & { zones: number; slots: number; vehicles: number }

export type EventInput = Partial<Omit<EventRow, 'id' | 'created_at' | 'updated_at' | 'status'>> & {
  id?: string | null
}

export type StaffActionInput =
  | {
      action: 'create'
      username: string
      full_name: string
      role: StaffRole
      phone: string | null
      zone_ids: string[]
      gate_ids: string[]
      password: string
    }
  | {
      action: 'update'
      id: string
      full_name: string
      role: StaffRole
      phone: string | null
      zone_ids: string[]
      gate_ids: string[]
      preferred_language: Language
    }
  | { action: 'deactivate'; id: string }
  | { action: 'activate'; id: string }
  | { action: 'reset_password'; id: string; password: string }

export type StaffActionResult = { ok: true; id: string }

export type TestMessageInput = { phone: string; template: WaTemplate; language: Language }
export type TestMessageResult = { message_id: string; status: WaStatus; error: string | null }

/* -------------------------------------------------------- map editor */

export type UpsertGateInput = {
  id?: string | null
  eventId: string
  name: string
  name_ml: string | null
  kind: GateKind
  point: { type: 'Point'; coordinates: number[] }
}

export type UpsertZoneInput = {
  id?: string | null
  eventId: string
  code: string
  name: string
  name_ml: string | null
  color: string
  polygon: PolygonGeometry
  vehicle_types: VehicleType[]
  categories: VisitorCategory[]
  is_overflow: boolean
  priority: number
  notes: string | null
}

export type SlotInput = {
  id?: string | null
  number: number
  polygon: PolygonGeometry
  vehicle_type: VehicleType
  is_accessible: boolean
  has_ev_charger: boolean
}

export type SlotPropsPatch = {
  vehicle_type?: VehicleType | null
  is_accessible?: boolean | null
  has_ev_charger?: boolean | null
}

export type RoadNetworkInput = {
  eventId: string
  nodes: { id: string; coord: LngLat }[]
  segments: {
    id: string
    from: string
    to: string
    coords: number[][]
    direction: 'two_way' | 'one_way'
    name: string | null
    walk_only: boolean
  }[]
}

export type UpsertLandmarkInput = {
  id?: string | null
  eventId: string
  name: string
  name_ml: string | null
  kind: LandmarkKind
  point: { type: 'Point'; coordinates: number[] }
}

export type OverlayRow = {
  id: string
  event_id: string
  /** Data URL of the image in demo mode. */
  url: string
  corners: LngLat[]
  opacity: number
  is_visible: boolean
}

export type UpsertOverlayInput = {
  id?: string | null
  eventId: string
  url: string
  corners: LngLat[]
  opacity: number
  is_visible: boolean
}

/* ---------------------------------------------------------- reports */

export type ReportInterval = 15 | 30 | 60

export type ReportFilters = {
  eventId: string
  from?: string | null
  to?: string | null
  zoneIds?: string[] | null
  intervalMin?: ReportInterval
}

export type ReportZoneInfo = { zone_id: string; code: string; name: string; color: string; capacity: number }

export type OccupancyReport = {
  interval_min: number
  from: string
  to: string
  zones: ReportZoneInfo[]
  series: {
    t: string
    values: Record<string, { parked: number; holding: number; pct: number }>
    total: { parked: number; holding: number; pct: number }
  }[]
  peaks: { zone_id: string; max_pct: number; at: string | null }[]
}

export type PeakHoursReport = {
  interval_min: number
  series: { t: string; arrivals: number; exits: number }[]
  by_gate: { gate_id: string; name: string; arrivals: number[]; exits: number[] }[]
  busiest_arrival: { t: string; count: number } | null
  busiest_exit: { t: string; count: number } | null
  median_checkin_seconds: number | null
  median_time_to_confirm_minutes: number | null
}

export type RevenueReport = {
  paid_parking: boolean
  total: number
  count_paid: number
  count_free: number
  by_zone: { zone_id: string; code: string; name: string; amount: number; count: number }[]
  by_day: { date: string; amount: number; count: number }[]
  by_method: { method: PaymentMethod; amount: number; count: number }[]
  by_vehicle_type: { type: VehicleType; amount: number; count: number }[]
}

export type VehicleCountsReport = {
  total: number
  by_category: { category: VisitorCategory; count: number }[]
  by_type: { type: VehicleType; count: number }[]
  matrix: ({ category: VisitorCategory; total: number } & Record<VehicleType, number>)[]
  by_zone: { zone_id: string; code: string; name: string; count: number }[]
  accessible: number
  ai: { photos: number; plate_edited: number; accuracy_pct: number | null }
  whatsapp: { sent: number; failed: number }
  confirmation: { confirmed: number; wrong_slot: number; location_mismatch: number }
}

export type ExportVisitRow = {
  plate: string
  vehicle_type: VehicleType
  vehicle_color: string | null
  vehicle_make: string | null
  category: VisitorCategory
  pass_number: string | null
  pass_holder_name: string | null
  needs_accessible: boolean
  phone: string
  driver_name: string | null
  entry_gate: string | null
  checked_in_at: string
  slot: string | null
  zone: string | null
  status: VisitStatus
  link_opened_at: string | null
  driver_parked_at: string | null
  driver_parked_distance_m: number | null
  confirmed_at: string | null
  confirmed_by: string | null
  exited_at: string | null
  exit_gate: string | null
  fee_amount: number
  payment_method: PaymentMethod
  ai_plate_confidence: number | null
  ai_edited: boolean
  wa_status: WaStatus | null
}

export type ExportAlertRow = {
  type: AlertType
  status: AlertStatus
  plate: string | null
  zone: string | null
  raised_by: string
  created_at: string
  resolved_at: string | null
  note: string | null
}

/* -------------------------------------------------------- assistant */

export type AssistantToolUse = { name: string; args: Record<string, unknown>; ms: number }
export type AssistantReply = { reply: string; tools_used: AssistantToolUse[] }
export type AssistantInput = { sessionId: string; message: string; language: Language }

/* -------------------------------------------------------- simulator */

export type SimChat = {
  phone: string
  name: string | null
  last_body: string
  last_at: string
  last_status: WaStatus
  unread: number
}

export type SimMessage = {
  id: string
  direction: 'out' | 'in'
  body: string
  language: Language
  status: WaStatus
  error_code: string | null
  error_title: string | null
  button_label: string | null
  button_url: string | null
  created_at: string
}

export type ActorInfo = { role: AppRole; id: string | null }
