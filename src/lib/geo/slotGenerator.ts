import { bearing, destination, length, lineString, point } from '@turf/turf'
import type { LngLat, PolygonGeometry, VehicleType } from '@/types/domain'

/** docs/05 section 4. */
export type SlotAngle = 90 | 60 | 45
export type SlotSide = 'left' | 'right'
export type SlotRowVehicleType = Exclude<VehicleType, 'other'>

export type SlotRowInput = {
  a: LngLat
  b: LngLat
  vehicleType: SlotRowVehicleType
  width: number
  depth: number
  angle: SlotAngle
  side: SlotSide
  gap: number
  /** Used when `fit` is false. */
  count: number
  fit: boolean
  startNumber: number
  accessible: boolean
  ev: boolean
}

export type GeneratedSlot = {
  type: 'Feature'
  geometry: PolygonGeometry
  properties: { number: number; vehicle_type: SlotRowVehicleType; is_accessible: boolean; has_ev_charger: boolean }
}

export const SLOT_DEFAULTS: Record<SlotRowVehicleType, { width: number; depth: number }> = {
  bike: { width: 1.0, depth: 2.0 },
  car: { width: 2.5, depth: 5.0 },
  ev: { width: 2.7, depth: 5.0 },
  bus: { width: 3.5, depth: 12.0 },
}

export const SLOT_LIMITS = {
  width: { min: 0.8, max: 5 },
  depth: { min: 1.5, max: 15 },
  gap: { min: 0, max: 2 },
  count: { min: 1, max: 200 },
  startNumber: { min: 1, max: 999 },
} as const

const M = { units: 'meters' } as const
const rad = (deg: number) => (deg * Math.PI) / 180

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/** Distance along the baseline taken by one slot plus its gap. */
export function slotPitch(width: number, angle: SlotAngle, gap: number): number {
  return width / Math.sin(rad(angle)) + gap
}

export function baselineLength(a: LngLat, b: LngLat): number {
  return length(lineString([a, b]), M)
}

/** Most slots that fit on the baseline. */
export function fitCount(input: Pick<SlotRowInput, 'a' | 'b' | 'width' | 'angle' | 'gap'>): number {
  const pitch = slotPitch(input.width, input.angle, input.gap)
  if (pitch <= 0) return 0
  return Math.max(0, Math.min(SLOT_LIMITS.count.max, Math.floor((baselineLength(input.a, input.b) + input.gap) / pitch)))
}

export function generateSlotRow(input: SlotRowInput): GeneratedSlot[] {
  const brg = bearing(point(input.a), point(input.b))
  const along = input.width / Math.sin(rad(input.angle))
  const pitch = along + input.gap
  const count = input.fit ? fitCount(input) : clamp(Math.round(input.count), SLOT_LIMITS.count.min, SLOT_LIMITS.count.max)
  const depthBearing = brg + (input.side === 'left' ? -1 : 1) * input.angle

  const slots: GeneratedSlot[] = []
  for (let i = 0; i < count; i++) {
    const p0 = destination(point(input.a), i * pitch, brg, M).geometry.coordinates
    const p1 = destination(point(p0), along, brg, M).geometry.coordinates
    const p2 = destination(point(p1), input.depth, depthBearing, M).geometry.coordinates
    const p3 = destination(point(p0), input.depth, depthBearing, M).geometry.coordinates
    slots.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[p0, p1, p2, p3, p0]] },
      properties: {
        number: input.startNumber + i,
        vehicle_type: input.vehicleType,
        is_accessible: input.accessible,
        has_ev_charger: input.ev,
      },
    })
  }
  return slots
}

/** Slot label as stored: `A-012`. */
export function slotLabel(zoneCode: string, n: number): string {
  return `${zoneCode}-${String(n).padStart(3, '0')}`
}
