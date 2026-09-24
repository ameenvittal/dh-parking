import {
  booleanIntersects,
  distance,
  length,
  lineIntersect,
  lineSliceAlong,
  lineString,
  nearestPointOnLine,
  point,
  pointToLineDistance,
  pointToPolygonDistance,
  polygon,
} from '@turf/turf'
import type { LngLat, PolygonGeometry, RoadDirection, RoadNetwork } from '@/types/domain'

/** docs/05 section 5.2. */
export type RoadLine = {
  coords: number[][]
  direction: RoadDirection
  name: string | null
  walk_only: boolean
}

export type RoadNode = RoadNetwork['nodes'][number]
export type RoadSegment = RoadNetwork['segments'][number]

export const NODE_CLUSTER_M = 1.5
export const MIN_SEGMENT_M = 1
export const CONNECT_RADIUS_M = 30

function newId(): string {
  return crypto.randomUUID()
}

function addSplit(list: number[], at: number) {
  if (!list.some((d) => Math.abs(d - at) < 0.25)) list.push(at)
}

/**
 * Split every drawn line at its ends and at every crossing or touching point,
 * cluster split points within 1.5 m into nodes (reusing old node ids), and return
 * one segment per piece. Pieces shorter than 1 m are dropped.
 */
export function buildRoadNetwork(lines: RoadLine[], previousNodes: RoadNode[] = []): { nodes: RoadNode[]; segments: RoadSegment[] } {
  const valid = lines.filter((l) => l.coords.length >= 2)
  const geoms = valid.map((l) => lineString(l.coords))
  const lengths = geoms.map((g) => length(g, { units: 'meters' }))
  const splits: number[][] = lengths.map((len) => [0, len])

  for (let i = 0; i < geoms.length; i++) {
    for (let j = i + 1; j < geoms.length; j++) {
      for (const p of lineIntersect(geoms[i], geoms[j]).features) {
        addSplit(splits[i], nearestPointOnLine(geoms[i], p, { units: 'meters' }).properties.location ?? 0)
        addSplit(splits[j], nearestPointOnLine(geoms[j], p, { units: 'meters' }).properties.location ?? 0)
      }
    }
  }

  // T-junctions: an end point lying on (or within 1.5 m of) another line splits that line.
  for (let i = 0; i < geoms.length; i++) {
    const ends = [valid[i].coords[0], valid[i].coords[valid[i].coords.length - 1]]
    for (let j = 0; j < geoms.length; j++) {
      if (i === j) continue
      for (const e of ends) {
        const hit = nearestPointOnLine(geoms[j], point(e), { units: 'meters' })
        if ((hit.properties.dist ?? Infinity) <= NODE_CLUSTER_M) addSplit(splits[j], hit.properties.location ?? 0)
      }
    }
  }

  const nodes: RoadNode[] = []
  const nodeFor = (c: number[]): RoadNode => {
    const near = nodes.find((n) => distance(n.coord, c, { units: 'meters' }) <= NODE_CLUSTER_M)
    if (near) return near
    const old = previousNodes.find((n) => distance(n.coord, c, { units: 'meters' }) <= NODE_CLUSTER_M)
    const reuse = old && !nodes.some((n) => n.id === old.id)
    const node: RoadNode = { id: reuse ? old.id : newId(), coord: [c[0], c[1]] as LngLat }
    nodes.push(node)
    return node
  }

  const segments: RoadSegment[] = []
  valid.forEach((l, i) => {
    const cuts = [...splits[i]].sort((a, b) => a - b)
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = cuts[k]
      const b = Math.min(cuts[k + 1], lengths[i])
      if (b - a < MIN_SEGMENT_M) continue
      const coords = lineSliceAlong(geoms[i], a, b, { units: 'meters' }).geometry.coordinates
      const from = nodeFor(coords[0])
      const to = nodeFor(coords[coords.length - 1])
      coords[0] = from.coord
      coords[coords.length - 1] = to.coord
      const len = length(lineString(coords), { units: 'meters' })
      if (len < MIN_SEGMENT_M) continue
      segments.push({
        id: newId(),
        from: from.id,
        to: to.id,
        coords,
        direction: l.direction,
        name: l.name,
        length_m: Math.round(len * 10) / 10,
        walk_only: l.walk_only,
      })
    }
  })

  const used = new Set(segments.flatMap((s) => [s.from, s.to]))
  return { nodes: nodes.filter((n) => used.has(n.id)), segments }
}

export type ConnectivityWarning =
  | { kind: 'gate'; id: string; name: string; distanceM: number | null }
  | { kind: 'zone'; id: string; code: string; name: string; distanceM: number | null }

type GateInput = { id: string; name: string; location: LngLat }
type ZoneInput = { id: string; code: string; name: string; area: PolygonGeometry }

function distanceToZone(net: RoadNetwork, area: PolygonGeometry): number | null {
  if (!net.segments.length) return null
  const poly = polygon(area.coordinates)
  let best = Infinity
  for (const seg of net.segments) {
    if (seg.coords.length < 2) continue
    const line = lineString(seg.coords)
    if (booleanIntersects(line, poly)) return 0
    for (const c of seg.coords) best = Math.min(best, Math.abs(pointToPolygonDistance(point(c), poly, { units: 'meters' })))
    for (const c of area.coordinates[0]) best = Math.min(best, pointToLineDistance(point(c), line, { units: 'meters' }))
  }
  return best
}

/** Every gate within 30 m of the network and every zone with a network point within 30 m (warnings only). */
export function validateConnectivity(net: RoadNetwork, gates: GateInput[], zones: ZoneInput[]): ConnectivityWarning[] {
  const warnings: ConnectivityWarning[] = []
  for (const g of gates) {
    let best: number | null = null
    for (const seg of net.segments) {
      if (seg.coords.length < 2) continue
      const d = pointToLineDistance(point(g.location), lineString(seg.coords), { units: 'meters' })
      best = best === null ? d : Math.min(best, d)
    }
    if (best === null || best > CONNECT_RADIUS_M) warnings.push({ kind: 'gate', id: g.id, name: g.name, distanceM: best })
  }
  for (const z of zones) {
    const d = distanceToZone(net, z.area)
    if (d === null || d > CONNECT_RADIUS_M) warnings.push({ kind: 'zone', id: z.id, code: z.code, name: z.name, distanceM: d })
  }
  return warnings
}
