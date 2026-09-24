import { lineString, nearestPointOnLine, point } from '@turf/turf'
import type { RoadNetwork } from '@/types/domain'

/** Road congestion thresholds for the live map (docs/05 section 9). */
export const TRAFFIC_MEDIUM_MIN = 3
export const TRAFFIC_HIGH_MIN = 6
/** A vehicle counts towards a segment when it is within this distance of it. */
export const TRAFFIC_RADIUS_M = 15
/** Recompute interval for the congestion colouring. */
export const TRAFFIC_REFRESH_MS = 5_000

export type TrafficLevel = 'light' | 'medium' | 'high'

export function trafficLevel(vehicles: number): TrafficLevel {
  if (vehicles >= TRAFFIC_HIGH_MIN) return 'high'
  if (vehicles >= TRAFFIC_MEDIUM_MIN) return 'medium'
  return 'light'
}

/** Counts vehicles within TRAFFIC_RADIUS_M of each drivable segment. */
export function computeTraffic(roads: RoadNetwork, vehicles: { lng: number; lat: number }[]): Map<string, number> {
  const counts = new Map<string, number>()
  const lines = roads.segments
    .filter((s) => !s.walk_only && s.coords.length >= 2)
    .map((s) => ({ id: s.id, line: lineString(s.coords) }))
  for (const l of lines) counts.set(l.id, 0)
  if (vehicles.length === 0) return counts
  for (const v of vehicles) {
    const p = point([v.lng, v.lat])
    for (const l of lines) {
      const near = nearestPointOnLine(l.line, p, { units: 'meters' })
      const d = near.properties.dist ?? Number.POSITIVE_INFINITY
      if (d <= TRAFFIC_RADIUS_M) counts.set(l.id, (counts.get(l.id) ?? 0) + 1)
    }
  }
  return counts
}
