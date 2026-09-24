import { distance, lineString, nearestPointOnLine, point } from '@turf/turf'
import type { LngLat } from '@/types/domain'

/** docs/05 section 5.1: vertices within 3 m of a road vertex or line snap to it. */
export const SNAP_TOLERANCE_M = 3

export type SnapResult = { coord: LngLat; kind: 'vertex' | 'line' | null }

/** Snap one point to the nearest existing road vertex (preferred) or road line within `toleranceM`. */
export function snapPoint(at: LngLat, roads: number[][][], toleranceM: number = SNAP_TOLERANCE_M): SnapResult {
  let vertex: { coord: LngLat; d: number } | null = null
  for (const road of roads) {
    for (const c of road) {
      const d = distance(at, c, { units: 'meters' })
      if (d <= toleranceM && (!vertex || d < vertex.d)) vertex = { coord: [c[0], c[1]], d }
    }
  }
  if (vertex) return { coord: vertex.coord, kind: 'vertex' }

  let online: { coord: LngLat; d: number } | null = null
  for (const road of roads) {
    if (road.length < 2) continue
    const hit = nearestPointOnLine(lineString(road), point(at), { units: 'meters' })
    const d = hit.properties.dist ?? Infinity
    if (d <= toleranceM && (!online || d < online.d)) {
      const [lng, lat] = hit.geometry.coordinates
      online = { coord: [lng, lat], d }
    }
  }
  if (online) return { coord: online.coord, kind: 'line' }
  return { coord: at, kind: null }
}

/** Snap every vertex of a road being drawn against the other roads. */
export function snapLine(coords: number[][], otherRoads: number[][][], toleranceM: number = SNAP_TOLERANCE_M): number[][] {
  return coords.map((c) => snapPoint([c[0], c[1]], otherRoads, toleranceM).coord)
}
