import { describe, expect, it } from 'vitest'
import { buildRoadNetwork, validateConnectivity, type RoadLine } from '@/lib/geo/roadGraph'
import { at } from './helpers'

const road = (coords: number[][], extra: Partial<RoadLine> = {}): RoadLine => ({
  coords,
  direction: 'two_way',
  name: null,
  walk_only: false,
  ...extra,
})

describe('buildRoadNetwork', () => {
  it('splits crossing lines into four segments around one shared node', () => {
    const net = buildRoadNetwork([road([at(-50, 0), at(50, 0)]), road([at(0, -50), at(0, 50)])])
    expect(net.segments).toHaveLength(4)
    expect(net.nodes).toHaveLength(5)
    const counts = new Map<string, number>()
    for (const s of net.segments) for (const n of [s.from, s.to]) counts.set(n, (counts.get(n) ?? 0) + 1)
    expect([...counts.values()].sort()).toEqual([1, 1, 1, 1, 4])
  })

  it('splits at a T-junction where an end point touches another line', () => {
    const net = buildRoadNetwork([road([at(-50, 0), at(50, 0)]), road([at(10, 0), at(10, 40)])])
    expect(net.segments).toHaveLength(3)
    expect(net.nodes).toHaveLength(4)
  })

  it('forces piece ends onto node coordinates and inherits line properties', () => {
    const net = buildRoadNetwork([
      road([at(0, 0), at(100, 0)], { direction: 'one_way', name: 'Main road' }),
      road([at(50, -20), at(50, 20)], { walk_only: true }),
    ])
    const byId = new Map(net.nodes.map((n) => [n.id, n.coord]))
    for (const s of net.segments) {
      expect(s.coords[0]).toEqual(byId.get(s.from))
      expect(s.coords[s.coords.length - 1]).toEqual(byId.get(s.to))
    }
    const main = net.segments.filter((s) => s.name === 'Main road')
    expect(main).toHaveLength(2)
    expect(main.every((s) => s.direction === 'one_way')).toBe(true)
    expect(net.segments.filter((s) => s.walk_only)).toHaveLength(2)
  })

  it('clusters end points within 1.5 m and drops pieces under 1 m', () => {
    const net = buildRoadNetwork([road([at(0, 0), at(30, 0)]), road([at(30.8, 0.5), at(30.8, 30)]), road([at(60, 0), at(60.5, 0)])])
    expect(net.nodes).toHaveLength(3)
    expect(net.segments).toHaveLength(2)
  })

  it('reuses previous node ids within 1.5 m', () => {
    const first = buildRoadNetwork([road([at(0, 0), at(40, 0)])])
    const again = buildRoadNetwork([road([at(0.5, 0), at(40, 0.4)])], first.nodes)
    expect(new Set(again.nodes.map((n) => n.id))).toEqual(new Set(first.nodes.map((n) => n.id)))
  })
})

describe('validateConnectivity', () => {
  const net = buildRoadNetwork([road([at(0, 0), at(100, 0)])])
  it('warns about gates and zones further than 30 m', () => {
    const square = (e: number, n: number) => ({
      type: 'Polygon' as const,
      coordinates: [[at(e, n), at(e + 10, n), at(e + 10, n + 10), at(e, n + 10), at(e, n)]],
    })
    const warnings = validateConnectivity(
      net,
      [
        { id: 'g1', name: 'Main gate', location: at(0, 10) },
        { id: 'g2', name: 'Far gate', location: at(0, 80) },
      ],
      [
        { id: 'z1', code: 'A', name: 'Near', area: square(20, 5) },
        { id: 'z2', code: 'B', name: 'Far', area: square(20, 60) },
      ],
    )
    expect(warnings.map((w) => w.id)).toEqual(['g2', 'z2'])
  })
})
