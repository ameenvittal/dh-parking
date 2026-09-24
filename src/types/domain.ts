/**
 * Hand-written domain types. Enums mirror docs/03-DATABASE.md section 2.
 * Row shapes mirror the tables; RPC result shapes mirror docs/04-BACKEND-SERVICES.md.
 */

export const APP_ROLES = ['admin', 'gate_volunteer', 'zone_volunteer', 'driver'] as const
export type AppRole = (typeof APP_ROLES)[number]
export type StaffRole = Exclude<AppRole, 'driver'>

export const EVENT_STATUSES = ['draft', 'live', 'closed'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]

export const VEHICLE_TYPES = ['bike', 'car', 'ev', 'bus', 'other'] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const VISITOR_CATEGORIES = [
  'vip',
  'guest',
  'faculty',
  'student',
  'staff',
  'volunteer',
  'performer',
  'general',
] as const
export type VisitorCategory = (typeof VISITOR_CATEGORIES)[number]

export const SLOT_STATUSES = ['available', 'assigned', 'occupied', 'blocked'] as const
export type SlotStatus = (typeof SLOT_STATUSES)[number]

export const VISIT_STATUSES = ['assigned', 'en_route', 'driver_parked', 'confirmed', 'exited', 'cancelled'] as const
export type VisitStatus = (typeof VISIT_STATUSES)[number]

export const ACTIVE_VISIT_STATUSES: readonly VisitStatus[] = ['assigned', 'en_route', 'driver_parked', 'confirmed']
export function isActiveStatus(status: VisitStatus): boolean {
  return ACTIVE_VISIT_STATUSES.includes(status)
}

export const GATE_KINDS = ['entry', 'exit', 'both'] as const
export type GateKind = (typeof GATE_KINDS)[number]

export const ROAD_DIRECTIONS = ['two_way', 'one_way'] as const
export type RoadDirection = (typeof ROAD_DIRECTIONS)[number]

export const LANDMARK_KINDS = ['venue', 'entrance', 'help_desk', 'first_aid', 'toilet', 'food', 'other'] as const
export type LandmarkKind = (typeof LANDMARK_KINDS)[number]

export const ALERT_TYPES = [
  'sos',
  'wrong_slot',
  'location_mismatch',
  'wrong_parking',
  'not_arrived',
  'confirm_pending',
  'overstay',
] as const
export type AlertType = (typeof ALERT_TYPES)[number]

export const ALERT_STATUSES = ['open', 'acknowledged', 'resolved'] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]

export const SOS_REASONS = ['medical', 'breakdown', 'safety', 'lost', 'other'] as const
export type SosReason = (typeof SOS_REASONS)[number]

export const PAYMENT_METHODS = ['free', 'cash', 'upi'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const WA_STATUSES = ['queued', 'sent', 'delivered', 'read', 'failed'] as const
export type WaStatus = (typeof WA_STATUSES)[number]

export type VisitEventType =
  | 'checked_in'
  | 'assigned'
  | 'link_sent'
  | 'link_opened'
  | 'navigation_started'
  | 'driver_parked'
  | 'confirmed'
  | 'wrong_slot_corrected'
  | 'reassigned'
  | 'exited'
  | 'cancelled'
  | 'location_mismatch'
  | 'sos'

export type Language = 'en' | 'ml'
export type BaseMapKind = 'street' | 'satellite'

export type LngLat = [number, number]
export type PolygonGeometry = { type: 'Polygon'; coordinates: number[][][] }
export type PointGeometry = { type: 'Point'; coordinates: number[] }
export type LineGeometry = { type: 'LineString'; coordinates: number[][] }

/* ---------------------------------------------------------------- rows */

export type FeeRules = Record<VehicleType, number>

export type EventRow = {
  id: string
  name: string
  venue_name: string | null
  starts_at: string
  ends_at: string
  timezone: string
  status: EventStatus
  center: LngLat
  default_zoom: number
  paid_parking: boolean
  fee_rules: FeeRules
  fee_exempt_categories: VisitorCategory[]
  emergency_phone: string | null
  admin_alert_phones: string[]
  default_language: Language
  arrival_timeout_min: number
  confirm_timeout_min: number
  overstay_after_end_min: number
  location_tolerance_m: number
  arrival_radius_m: number
  base_map: BaseMapKind
  created_at: string
  updated_at: string
}

export type ProfileRow = {
  id: string
  role: StaffRole
  full_name: string
  username: string
  password: string
  phone: string | null
  zone_ids: string[]
  gate_ids: string[]
  preferred_language: Language
  is_active: boolean
  last_seen_at: string | null
  created_at: string
}

export type GateRow = {
  id: string
  event_id: string
  name: string
  name_ml: string | null
  kind: GateKind
  location: LngLat
  is_active: boolean
  sort_order: number
}

export type ZoneRow = {
  id: string
  event_id: string
  code: string
  name: string
  name_ml: string | null
  color: string
  area: PolygonGeometry
  vehicle_types: VehicleType[]
  categories: VisitorCategory[]
  is_overflow: boolean
  priority: number
  notes: string | null
  sort_order: number
}

export type SlotRow = {
  id: string
  event_id: string
  zone_id: string
  label: string
  number: number
  shape: PolygonGeometry
  center: LngLat
  vehicle_type: VehicleType
  is_accessible: boolean
  has_ev_charger: boolean
  status: SlotStatus
  blocked_reason: string | null
  current_visit_id: string | null
  status_changed_at: string
}

export type RoadNodeRow = { id: string; event_id: string; coord: LngLat }

export type RoadSegmentRow = {
  id: string
  event_id: string
  from: string
  to: string
  coords: number[][]
  direction: RoadDirection
  name: string | null
  length_m: number
  walk_only: boolean
}

export type LandmarkRow = {
  id: string
  event_id: string
  name: string
  name_ml: string | null
  kind: LandmarkKind
  location: LngLat
}

export type DriverRow = {
  id: string
  event_id: string
  phone_e164: string
  name: string | null
  preferred_language: Language
  location_consent_at: string | null
  created_at: string
}

export type TokenRow = {
  id: string
  driver_id: string
  token_hash: string
  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
  use_count: number
  created_at: string
}

export type VisitRow = {
  id: string
  event_id: string
  driver_id: string
  plate_raw: string
  plate: string
  vehicle_type: VehicleType
  vehicle_color: string | null
  vehicle_make: string | null
  category: VisitorCategory
  pass_number: string | null
  pass_holder_name: string | null
  needs_accessible: boolean
  photo_path: string | null
  ai_result: unknown
  ai_plate_confidence: number | null
  ai_edited: boolean
  entry_gate_id: string | null
  checked_in_by: string | null
  checked_in_at: string
  zone_id: string | null
  slot_id: string | null
  status: VisitStatus
  assigned_at: string
  link_opened_at: string | null
  navigation_started_at: string | null
  driver_parked_at: string | null
  driver_parked_location: LngLat | null
  driver_parked_distance_m: number | null
  confirmed_at: string | null
  confirmed_by: string | null
  exited_at: string | null
  exited_by: string | null
  exit_gate_id: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  checkin_duration_ms: number | null
  fee_amount: number
  payment_method: PaymentMethod
  last_position: LngLat | null
  last_position_at: string | null
}

export type VisitEventRow = {
  id: number
  visit_id: string
  event_id: string
  type: VisitEventType
  actor_role: AppRole | null
  actor_id: string | null
  data: Record<string, unknown>
  created_at: string
}

export type PositionRow = {
  id: number
  visit_id: string
  event_id: string
  location: LngLat
  accuracy_m: number | null
  heading: number | null
  speed_mps: number | null
  recorded_at: string
}

export type AlertRow = {
  id: string
  event_id: string
  type: AlertType
  status: AlertStatus
  visit_id: string | null
  slot_id: string | null
  zone_id: string | null
  sos_reason: SosReason | null
  message: string | null
  location: LngLat | null
  photo_path: string | null
  raised_by_profile: string | null
  raised_by_driver: string | null
  raised_by_system: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  dedupe_key: string | null
  created_at: string
}

export type WaMessageRow = {
  id: string
  event_id: string
  driver_id: string | null
  visit_id: string | null
  template: WaTemplate
  language: Language
  to_phone: string
  wa_message_id: string
  status: WaStatus
  error_code: string | null
  error_title: string | null
  /** Rendered message text for the simulator inbox. */
  body: string
  button_label: string | null
  button_url: string | null
  created_at: string
  updated_at: string
}

export type WaTemplate = 'parking_slot_assigned' | 'parking_login_link' | 'parking_slot_changed' | 'sos_admin_alert'

export type AssistantMessageRow = {
  id: number
  admin_id: string
  session_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_calls: unknown
  created_at: string
}

/* --------------------------------------------------------- RPC shapes */

export type Session = {
  role: AppRole
  userId: string
  fullName: string
  username: string | null
  zoneIds: string[]
  gateIds: string[]
  driverId: string | null
  eventId: string | null
  language: Language
  /** Driver sessions expire at event end plus 6 hours. */
  expiresAt: string | null
}

export type Feature<G, P> = { type: 'Feature'; id?: string; geometry: G; properties: P }
export type FeatureCollection<G, P> = { type: 'FeatureCollection'; features: Feature<G, P>[] }

export type EventMapData = {
  event: {
    id: string
    name: string
    center: LngLat
    default_zoom: number
    base_map: BaseMapKind
    arrival_radius_m: number
    emergency_phone: string | null
  }
  gates: FeatureCollection<PointGeometry, { name: string; name_ml: string | null; kind: GateKind }>
  zones: FeatureCollection<
    PolygonGeometry,
    {
      code: string
      name: string
      name_ml: string | null
      color: string
      vehicle_types: VehicleType[]
      categories: VisitorCategory[]
      is_overflow: boolean
      priority: number
    }
  >
  slots: FeatureCollection<
    PolygonGeometry,
    {
      label: string
      number: number
      zone_id: string
      vehicle_type: VehicleType
      is_accessible: boolean
      has_ev_charger: boolean
    }
  >
  roads: RoadNetwork
  landmarks: FeatureCollection<PointGeometry, { name: string; name_ml: string | null; kind: LandmarkKind }>
  /** Bumped by every map save so route graphs can be cached per version. */
  version: number
}

export type RoadNetwork = {
  nodes: { id: string; coord: LngLat }[]
  segments: {
    id: string
    from: string
    to: string
    coords: number[][]
    direction: RoadDirection
    name: string | null
    length_m: number
    walk_only: boolean
  }[]
}

export type SlotStatusRow = { id: string; status: SlotStatus; current_visit_id: string | null }

export type SlotSuggestion = {
  slot_id: string
  label: string
  zone_id: string
  zone_code: string
  zone_name: string
  zone_name_ml: string | null
  vehicle_type: VehicleType
  is_accessible: boolean
  has_ev_charger: boolean
  distance_m: number
  is_overflow: boolean
}

export type SuggestSlotsResult = {
  suggestions: SlotSuggestion[]
  zone_free_counts: { zone_id: string; code: string; name: string; name_ml: string | null; free: number; total: number }[]
  fallback_used: 'none' | 'overflow' | 'accessible' | 'category_any'
}

export type ExtractResult = {
  plate: string | null
  plate_raw: string | null
  plate_valid: boolean
  plate_confidence: number
  vehicle_type: VehicleType | null
  vehicle_type_confidence: number
  vehicle_color: string | null
  vehicle_make: string | null
  pass_detected: boolean
  pass_category: VisitorCategory | null
  pass_number: string | null
  pass_holder_name: string | null
}

export type VisitSummary = {
  id: string
  plate: string
  plate_raw: string
  vehicle_type: VehicleType
  vehicle_color: string | null
  vehicle_make: string | null
  category: VisitorCategory
  needs_accessible: boolean
  status: VisitStatus
  slot_id: string | null
  slot_label: string | null
  zone_id: string | null
  zone_code: string | null
  zone_name: string | null
  checked_in_at: string
  assigned_at: string
  driver_parked_at: string | null
  confirmed_at: string | null
  exited_at: string | null
  phone: string | null
  phone_masked: string
  driver_name: string | null
  pass_number: string | null
  entry_gate_name: string | null
  wa_status: WaStatus | null
  fee_amount: number
  payment_method: PaymentMethod
}

export type ZoneVisit = {
  id: string
  plate: string
  vehicle_type: VehicleType
  vehicle_color: string | null
  vehicle_make: string | null
  category: VisitorCategory
  needs_accessible: boolean
  status: VisitStatus
  slot_id: string | null
  slot_label: string | null
  zone_id: string | null
  zone_code: string | null
  assigned_at: string
  driver_parked_at: string | null
  confirmed_at: string | null
  exited_at: string | null
  driver_parked_distance_m: number | null
  phone_masked: string
  photo_path: string | null
  last_position: LngLat | null
  last_position_at: string | null
  open_alert_types: AlertType[]
}

export type VisitDetail = {
  visit: VisitRow
  driver: { name: string | null; phone: string; phone_masked: string; preferred_language: Language } | null
  slot: { id: string; label: string; zone_id: string } | null
  zone: { id: string; code: string; name: string; name_ml: string | null } | null
  entry_gate: { id: string; name: string } | null
  exit_gate: { id: string; name: string } | null
  events: VisitEventRow[]
  alerts: AlertRow[]
  messages: WaMessageRow[]
  trail: LngLat[]
}

export type DriverVisit = {
  visit: {
    id: string
    plate: string
    vehicle_type: VehicleType
    status: VisitStatus
    assigned_at: string
    driver_parked_at: string | null
    confirmed_at: string | null
  }
  slot: {
    id: string
    label: string
    shape: PolygonGeometry
    center: LngLat
    vehicle_type: VehicleType
    is_accessible: boolean
  } | null
  zone: { id: string; code: string; name: string; name_ml: string | null; color: string } | null
  gate: { id: string; name: string; name_ml: string | null; location: LngLat } | null
  landmark: { name: string; name_ml: string | null; kind: LandmarkKind; distance_m: number } | null
  driver: { name: string | null; location_consent_at: string | null; language: Language }
  event: { id: string; name: string; emergency_phone: string | null; arrival_radius_m: number; ends_at: string }
  open_sos: boolean
}

export type DashboardSummary = {
  slots: { total: number; available: number; assigned: number; occupied: number; blocked: number }
  visits: {
    active: number
    en_route: number
    awaiting_confirm: number
    confirmed: number
    exited: number
    checked_in_total: number
  }
  alerts: { open: number; sos_open: number }
  zones: {
    id: string
    code: string
    name: string
    name_ml: string | null
    color: string
    vehicle_types: VehicleType[]
    categories: VisitorCategory[]
    total: number
    available: number
    assigned: number
    occupied: number
    blocked: number
    occupancy_pct: number
  }[]
  gates: { id: string; name: string; checkins_15m: number; exits_15m: number }[]
  wa: { sent: number; delivered: number; read: number; failed: number }
  last_updated: string
}

export type ActivityItem = {
  id: number
  visit_id: string
  type: VisitEventType
  plate: string
  slot_label: string | null
  created_at: string
}

export type LiveVehicle = {
  visit_id: string
  plate: string
  status: VisitStatus
  vehicle_type: VehicleType
  slot_label: string | null
  lng: number
  lat: number
  at: string
}

export type AlertView = AlertRow & {
  plate: string | null
  slot_label: string | null
  zone_code: string | null
  raised_by_label: string
  driver_phone: string | null
}

export type StaffView = Omit<ProfileRow, 'password'>

export type Position = { visit_id: string; lat: number; lng: number; acc: number | null; hdg: number | null; spd: number | null; t: number }

export type GateOverview = {
  free_by_type: Record<VehicleType, number>
  recent: { visit_id: string; plate: string; slot_label: string | null; status: VisitStatus; checked_in_at: string }[]
}

export type CheckinInput = {
  event_id: string
  gate_id: string
  slot_id: string
  phone: string
  driver_name: string | null
  language: Language
  plate_raw: string
  vehicle_type: VehicleType
  vehicle_color: string | null
  vehicle_make: string | null
  category: VisitorCategory
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

export type CheckinResult = {
  visit_id: string
  slot: { id: string; label: string; zone_code: string; zone_name: string; zone_name_ml: string | null }
  link: string
  whatsapp: { message_id: string; status: WaStatus; error: string | null }
}
