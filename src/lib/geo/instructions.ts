import { bearing, distance, lineString, nearestPointOnLine, point, simplify } from '@turf/turf'
import type { LngLat } from '@/types/domain'

/** docs/05 section 7. */
export type StepType =
  | 'start'
  | 'straight'
  | 'slight_left'
  | 'slight_right'
  | 'left'
  | 'right'
  | 'sharp_left'
  | 'sharp_right'
  | 'uturn'
  | 'arrive'

export type Step = {
  type: StepType
  /** Metres driven or walked from the previous step to this one. */
  distanceM: number
  roadName: string | null
  at: [number, number]
  /** Metres from the start of the route to `at` (for "in 40 m" from live progress). */
  alongM: number
  /** Arrive only: which side of the road the slot is on. */
  side?: 'left' | 'right'
}

/** A named part of the route line, in order. Used to name the road after each turn. */
export type RoutePiece = { coords: number[][]; name: string | null }

export function normalizeAngle(deg: number): number {
  let d = ((deg + 180) % 360 + 360) % 360 - 180
  if (d === -180) d = 180
  return d
}

/** |delta| < 25 straight, 25 to 45 slight, 45 to 135 turn, 135 to 170 sharp, over 170 U-turn. Negative is left. */
export function classifyTurn(delta: number): StepType {
  const a = Math.abs(delta)
  const left = delta < 0
  if (a < 25) return 'straight'
  if (a < 45) return left ? 'slight_left' : 'slight_right'
  if (a < 135) return left ? 'left' : 'right'
  if (a <= 170) return left ? 'sharp_left' : 'sharp_right'
  return 'uturn'
}

/** Displayed distance: under 20 m is "Now" (null), under 100 m to the nearest 10 m, else to the nearest 50 m. */
export function roundStepDistance(meters: number): number | null {
  if (meters < 20) return null
  if (meters < 100) return Math.round(meters / 10) * 10
  return Math.round(meters / 50) * 50
}

function pathLength(coords: number[][]): number {
  let sum = 0
  for (let i = 1; i < coords.length; i++) sum += distance(coords[i - 1], coords[i], { units: 'meters' })
  return sum
}

function dedupe(coords: number[][]): number[][] {
  const out: number[][] = []
  for (const c of coords) {
    const last = out[out.length - 1]
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c)
  }
  return out
}

type BuildStepsInput = {
  /** On-road route line coordinates. */
  coords: number[][]
  /** Slot centre (or walk target). */
  destination: LngLat
  /** Dashed last leg from the end of the road to the destination, in metres. */
  lastLegM: number
  /** Named pieces of the line, for road names. Optional. */
  pieces?: RoutePiece[]
}

/** Turn-by-turn steps for a route line (docs/05 section 7). */
export function buildSteps({ coords: raw, destination, lastLegM, pieces }: BuildStepsInput): Step[] {
  const original = dedupe(raw)
  if (original.length < 2) {
    const at = (original[0] ?? destination) as [number, number]
    return [
      { type: 'start', distanceM: 0, roadName: pieces?.[0]?.name ?? null, at, alongM: 0 },
      { type: 'arrive', distanceM: lastLegM, roadName: null, at, alongM: 0 },
    ]
  }

  const line = lineString(original)
  const simplified = dedupe(simplify(line, { tolerance: 0.000005, highQuality: true }).geometry.coordinates)
  const coords = simplified.length >= 2 ? simplified : original

  // Cumulative piece boundaries for road names.
  const bounds: { start: number; end: number; name: string | null }[] = []
  if (pieces?.length) {
    let acc = 0
    for (const p of pieces) {
      const len = pathLength(p.coords)
      bounds.push({ start: acc, end: acc + len, name: p.name })
      acc += len
    }
  }
  const nameAfter = (alongM: number): string | null => {
    if (!bounds.length) return null
    const hit = bounds.find((b) => alongM + 0.5 >= b.start && alongM + 0.5 < b.end)
    return (hit ?? bounds[bounds.length - 1]).name
  }
  const alongOf = (c: number[]): number =>
    nearestPointOnLine(line, point(c), { units: 'meters' }).properties.location ?? 0

  const steps: Step[] = [{ type: 'start', distanceM: 0, roadName: nameAfter(0), at: coords[0] as [number, number], alongM: 0 }]
  let lastAlong = 0

  for (let i = 1; i < coords.length - 1; i++) {
    const bIn = bearing(coords[i - 1], coords[i])
    const bOut = bearing(coords[i], coords[i + 1])
    const type = classifyTurn(normalizeAngle(bOut - bIn))
    if (type === 'straight') continue
    const along = alongOf(coords[i])
    steps.push({
      type,
      distanceM: Math.max(0, along - lastAlong),
      roadName: nameAfter(along),
      at: coords[i] as [number, number],
      alongM: along,
    })
    lastAlong = along
  }

  const total = pathLength(original)
  const end = coords[coords.length - 1]
  const lastBearing = bearing(coords[coords.length - 2], end)
  const toDest = distance(end, destination, { units: 'meters' }) < 0.5 ? lastBearing : bearing(end, destination)
  const side: 'left' | 'right' = normalizeAngle(toDest - lastBearing) < 0 ? 'left' : 'right'

  steps.push({
    type: 'arrive',
    distanceM: Math.max(0, total - lastAlong) + lastLegM,
    roadName: null,
    at: end as [number, number],
    alongM: total,
    side,
  })
  return steps
}
