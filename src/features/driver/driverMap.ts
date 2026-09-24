import { distance as turfDistance, pointToPolygonDistance, point as turfPoint, polygon as turfPolygon } from '@turf/turf'
import type { DriverVisit, LngLat } from '@/types/domain'
import { bboxOfPoints, bufferBbox, type Bbox } from '@/features/map/style/layers'
import type { LocationFix } from './useLiveLocation'

/** Straight-line metres from the fix to the slot centre. */
export function distanceToSlot(visit: DriverVisit, fix: LocationFix | null): number | null {
  if (!fix || !visit.slot) return null
  return turfDistance([fix.lng, fix.lat], visit.slot.center, { units: 'meters' })
}

/** Metres from the fix to the slot polygon (0 when inside). */
export function distanceToSlotShape(visit: DriverVisit, fix: LocationFix): number | null {
  if (!visit.slot) return null
  const d = pointToPolygonDistance(turfPoint([fix.lng, fix.lat]), turfPolygon(visit.slot.shape.coordinates), { units: 'meters' })
  return Math.max(0, d)
}

/** Camera box for the driver home: the slot plus the user (when close) or the entry gate. */
export function driverFitBox(visit: DriverVisit, fix: LocationFix | null): Bbox | null {
  if (!visit.slot) return null
  const pts: LngLat[] = [visit.slot.center]
  const d = distanceToSlot(visit, fix)
  if (fix && d !== null && d < 2000) pts.push([fix.lng, fix.lat])
  else if (visit.gate) pts.push(visit.gate.location)
  const box = bboxOfPoints(pts)
  return box ? bufferBbox(box, 40) : null
}
