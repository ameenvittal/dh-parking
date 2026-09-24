import { distance, length, lineSliceAlong, lineString, nearestPointOnLine, point } from '@turf/turf'
import createGraph, { type Graph, type Link } from 'ngraph.graph'
import { aStar } from 'ngraph.path'
import type { LineGeometry, LngLat, RoadNetwork } from '@/types/domain'
import { buildSteps, type RoutePiece, type Step } from './instructions'

/** docs/05 section 6. */
export type RouteMode = 'drive' | 'walk'

export type LinkData = { segmentId: string; coords: number[][]; length: number; reversed: boolean; name: string | null }
export type RoadGraph = Graph<LngLat, LinkData>

export type LineFeature = { type: 'Feature'; geometry: LineGeometry; properties: Record<string, never> }

export type Route = {
  /** On-road part. */
  line: LineFeature
  /** Snapped end point to the slot centre (dashed). */
  lastLeg: LineFeature
  /** Current position to the snapped start (dashed), when over 5 m. */
  firstLeg: LineFeature | null
  /** Total, legs included. */
  distanceM: number
  steps: Step[]
}

/** Start further than this from any usable road means "not on campus yet". */
export const MAX_SNAP_M = 150
const FIRST_LEG_MIN_M = 5
const START = '__route_start'
const END = '__route_end'

type Segment = RoadNetwork['segments'][number]

function usable(seg: Segment, mode: RouteMode): boolean {
  return mode === 'walk' || !seg.walk_only
}

function oneWay(seg: Segment, mode: RouteMode): boolean {
  return mode === 'drive' && seg.direction === 'one_way'
}

function lineFeature(coords: number[][]): LineFeature {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} }
}

function reversed(coords: number[][]): number[][] {
  return [...coords].reverse()
}

function metres(coords: number[][]): number {
  if (coords.length < 2) return 0
  return length(lineString(coords), { units: 'meters' })
}

/** Directed graph: drive skips footpaths and respects one-way, walk treats everything as two-way. */
export function createRoadGraph(net: RoadNetwork, mode: RouteMode): RoadGraph {
  const graph = createGraph<LngLat, LinkData>({ multigraph: true })
  for (const n of net.nodes) graph.addNode(n.id, n.coord)
  for (const seg of net.segments) {
    if (!usable(seg, mode)) continue
    if (!graph.hasNode(seg.from) || !graph.hasNode(seg.to)) continue
    const len = seg.length_m > 0 ? seg.length_m : metres(seg.coords)
    graph.addLink(seg.from, seg.to, { segmentId: seg.id, coords: seg.coords, length: len, reversed: false, name: seg.name })
    if (!oneWay(seg, mode)) {
      graph.addLink(seg.to, seg.from, { segmentId: seg.id, coords: reversed(seg.coords), length: len, reversed: true, name: seg.name })
    }
  }
  return graph
}

/** The name used in docs/05 section 6.1. */
export { createRoadGraph as createGraph }

const cache = new Map<string, RoadGraph>()

/** Graph cached per `(cacheKey, mode)`, for example `${eventId}:${eventMap.version}`. */
export function cachedGraph(net: RoadNetwork, mode: RouteMode, cacheKey: string): RoadGraph {
  const key = `${cacheKey}:${mode}`
  let g = cache.get(key)
  if (!g) {
    g = createRoadGraph(net, mode)
    cache.set(key, g)
    if (cache.size > 8) {
      const first = cache.keys().next().value
      if (first !== undefined) cache.delete(first)
    }
  }
  return g
}

type Snap = { segment: Segment; point: LngLat; location: number; distanceM: number; lengthM: number }

function snapTo(net: RoadNetwork, at: LngLat, mode: RouteMode): Snap | null {
  let best: Snap | null = null
  const p = point(at)
  for (const seg of net.segments) {
    if (!usable(seg, mode) || seg.coords.length < 2) continue
    const line = lineString(seg.coords)
    const hit = nearestPointOnLine(line, p, { units: 'meters' })
    const d = hit.properties.dist ?? Infinity
    if (!best || d < best.distanceM) {
      best = {
        segment: seg,
        point: hit.geometry.coordinates as LngLat,
        location: hit.properties.location ?? 0,
        distanceM: d,
        lengthM: length(line, { units: 'meters' }),
      }
    }
  }
  return best
}

/** Metres from `at` to the nearest road usable in `mode`, or null when there are no roads. */
export function nearestNetworkDistance(net: RoadNetwork, at: LngLat, mode: RouteMode): number | null {
  const s = snapTo(net, at, mode)
  return s ? s.distanceM : null
}

function slice(seg: Segment, fromM: number, toM: number): number[][] {
  const a = Math.max(0, Math.min(fromM, toM))
  const b = Math.max(a, Math.max(fromM, toM))
  if (b - a < 0.01) {
    const c = lineSliceAlong(lineString(seg.coords), a, a + 0.01, { units: 'meters' }).geometry.coordinates
    return [c[0], c[0]]
  }
  return lineSliceAlong(lineString(seg.coords), a, b, { units: 'meters' }).geometry.coordinates
}

function withEnds(coords: number[][], first: LngLat, last: LngLat): number[][] {
  const out = coords.slice()
  out[0] = first
  out[out.length - 1] = last
  return out
}

function addTempLinks(graph: RoadGraph, start: Snap, end: Snap, mode: RouteMode) {
  const s = start.segment
  const e = end.segment
  const link = (from: string, to: string, coords: number[][], seg: Segment, rev: boolean) =>
    graph.addLink(from, to, { segmentId: seg.id, coords, length: metres(coords), reversed: rev, name: seg.name })

  graph.addNode(START, start.point)
  graph.addNode(END, end.point)

  // Leaving the start: forward to the segment's `to` node, and back to `from` unless one-way.
  if (graph.hasNode(s.to)) {
    link(START, s.to, withEnds(slice(s, start.location, start.lengthM), start.point, graph.getNode(s.to)!.data), s, false)
  }
  if (!oneWay(s, mode) && graph.hasNode(s.from)) {
    link(START, s.from, withEnds(reversed(slice(s, 0, start.location)), start.point, graph.getNode(s.from)!.data), s, true)
  }

  // Reaching the end: from the segment's `from` node, and from `to` unless one-way.
  if (graph.hasNode(e.from)) {
    link(e.from, END, withEnds(slice(e, 0, end.location), graph.getNode(e.from)!.data, end.point), e, false)
  }
  if (!oneWay(e, mode) && graph.hasNode(e.to)) {
    link(e.to, END, withEnds(reversed(slice(e, end.location, end.lengthM)), graph.getNode(e.to)!.data, end.point), e, true)
  }

  // Start and end on the same segment.
  if (s.id === e.id) {
    if (start.location <= end.location) {
      link(START, END, withEnds(slice(s, start.location, end.location), start.point, end.point), s, false)
    } else if (!oneWay(s, mode)) {
      link(START, END, withEnds(reversed(slice(s, end.location, start.location)), start.point, end.point), s, true)
    }
  }
}

function bestLink(graph: RoadGraph, from: string, to: string): Link<LinkData> | null {
  let best: Link<LinkData> | null = null
  graph.forEachLinkedNode(
    from,
    (other, l) => {
      if (other.id === to && l.fromId === from && (!best || l.data.length < best.data.length)) best = l
    },
    true,
  )
  return best
}

/**
 * A* on the road graph from `from` to `to` (docs/05 section 6.2).
 * Returns null when the start is more than 150 m from any road, or when no path exists.
 */
export function findRoute(graph: RoadGraph, net: RoadNetwork, from: LngLat, to: LngLat, mode: RouteMode): Route | null {
  const start = snapTo(net, from, mode)
  if (!start || start.distanceM > MAX_SNAP_M) return null
  const end = snapTo(net, to, mode)
  if (!end) return null

  addTempLinks(graph, start, end, mode)
  try {
    const finder = aStar<LngLat, LinkData>(graph, {
      oriented: true,
      distance: (_a, _b, l) => l.data.length,
      heuristic: (a, b) => distance(a.data, b.data, { units: 'meters' }),
    })
    const nodes = finder.find(START, END)
    if (nodes.length < 2) return null
    const ordered = nodes[0].id === START ? nodes : [...nodes].reverse()

    const pieces: RoutePiece[] = []
    const coords: number[][] = []
    for (let i = 0; i < ordered.length - 1; i++) {
      const l = bestLink(graph, String(ordered[i].id), String(ordered[i + 1].id))
      if (!l) return null
      pieces.push({ coords: l.data.coords, name: l.data.name })
      for (const c of l.data.coords) {
        const last = coords[coords.length - 1]
        if (!last || last[0] !== c[0] || last[1] !== c[1]) coords.push(c)
      }
    }
    if (coords.length < 2) coords.push(end.point)

    const roadM = metres(coords)
    const lastLegM = distance(end.point, to, { units: 'meters' })
    const firstLegM = distance(from, start.point, { units: 'meters' })
    const firstLeg = firstLegM > FIRST_LEG_MIN_M ? lineFeature([from, start.point]) : null

    return {
      line: lineFeature(coords),
      lastLeg: lineFeature([end.point, to]),
      firstLeg,
      distanceM: roadM + lastLegM + (firstLeg ? firstLegM : 0),
      steps: buildSteps({ coords, destination: to, lastLegM, pieces }),
    }
  } finally {
    graph.removeNode(START)
    graph.removeNode(END)
  }
}

/** Metres of `line` left after the point nearest to `at`, plus how far `at` is from the line. */
export function routeProgress(line: LineFeature, at: LngLat): { alongM: number; remainingM: number; offRouteM: number } {
  const l = lineString(line.geometry.coordinates)
  const hit = nearestPointOnLine(l, point(at), { units: 'meters' })
  const total = length(l, { units: 'meters' })
  const along = hit.properties.location ?? 0
  return { alongM: along, remainingM: Math.max(0, total - along), offRouteM: hit.properties.dist ?? 0 }
}
