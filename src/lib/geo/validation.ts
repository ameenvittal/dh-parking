import { area, booleanWithin, buffer, intersect, featureCollection, kinks, length, lineString, polygon } from '@turf/turf'
import type { PolygonGeometry } from '@/types/domain'

/** docs/05 section 3.3. The server repeats these checks. */
export const ZONE_AREA_M2 = { min: 50, max: 200_000 } as const
export const SLOT_AREA_M2 = { min: 0.8, max: 60 } as const
export const MIN_ROAD_M = 1
export const OVERLAP_RATIO = 0.1

export type GeometryError = 'GEOMETRY_INVALID' | 'OUTSIDE_ZONE' | 'OVERLAP'

function closed(ring: number[][]): boolean {
  if (ring.length < 4) return false
  const a = ring[0]
  const b = ring[ring.length - 1]
  return a[0] === b[0] && a[1] === b[1]
}

/** At least 4 coordinates, closed, no self-intersections. */
export function isValidPolygon(p: PolygonGeometry): boolean {
  const ring = p.coordinates[0]
  if (!ring || !closed(ring)) return false
  try {
    return kinks(polygon(p.coordinates)).features.length === 0
  } catch {
    return false
  }
}

export function areaM2(p: PolygonGeometry): number {
  return area(polygon(p.coordinates))
}

export function zoneAreaOk(p: PolygonGeometry): boolean {
  const a = areaM2(p)
  return a >= ZONE_AREA_M2.min && a <= ZONE_AREA_M2.max
}

export function slotSizeOk(p: PolygonGeometry): boolean {
  const a = areaM2(p)
  return a >= SLOT_AREA_M2.min && a <= SLOT_AREA_M2.max
}

/** Slot within its zone buffered by 0.5 m. */
export function slotInsideZone(slot: PolygonGeometry, zone: PolygonGeometry): boolean {
  const buffered = buffer(polygon(zone.coordinates), 0.5, { units: 'meters' })
  if (!buffered) return false
  return booleanWithin(polygon(slot.coordinates), buffered)
}

/** True when the intersection with any other slot is more than 10% of this slot's area. */
export function slotOverlaps(slot: PolygonGeometry, others: PolygonGeometry[]): boolean {
  const s = polygon(slot.coordinates)
  const own = area(s)
  if (own <= 0) return true
  for (const o of others) {
    const hit = intersect(featureCollection([s, polygon(o.coordinates)]))
    if (hit && area(hit) > OVERLAP_RATIO * own) return true
  }
  return false
}

export function roadLengthOk(coords: number[][]): boolean {
  return coords.length >= 2 && length(lineString(coords), { units: 'meters' }) >= MIN_ROAD_M
}

/** First failing check for a slot, as an error code for `errors.<CODE>`, or null when valid. */
export function validateSlot(slot: PolygonGeometry, zone: PolygonGeometry, others: PolygonGeometry[]): GeometryError | null {
  if (!isValidPolygon(slot) || !slotSizeOk(slot)) return 'GEOMETRY_INVALID'
  if (!slotInsideZone(slot, zone)) return 'OUTSIDE_ZONE'
  if (slotOverlaps(slot, others)) return 'OVERLAP'
  return null
}

/** First failing check for a zone polygon, or null. */
export function validateZone(zone: PolygonGeometry): GeometryError | null {
  if (!isValidPolygon(zone) || !zoneAreaOk(zone)) return 'GEOMETRY_INVALID'
  return null
}
