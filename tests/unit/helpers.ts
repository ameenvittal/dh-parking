import { destination, point } from '@turf/turf'
import type { LngLat } from '@/types/domain'

export const ORIGIN: LngLat = [76.6, 8.88]

/** A point `east` and `north` metres from ORIGIN. */
export function at(east: number, north: number): LngLat {
  const e = destination(point(ORIGIN), Math.abs(east), east >= 0 ? 90 : 270, { units: 'meters' }).geometry.coordinates
  const n = destination(point(e), Math.abs(north), north >= 0 ? 0 : 180, { units: 'meters' }).geometry.coordinates
  return [n[0], n[1]]
}
