import { describe, expect, it } from 'vitest'
import { buildRoadNetwork, type RoadLine } from '@/lib/geo/roadGraph'
import { cachedGraph, createGraph, findRoute, nearestNetworkDistance, routeProgress } from '@/lib/geo/routing'
import type { RoadNetwork } from '@/types/domain'
import { at } from './helpers'

const road = (coords: number[][], extra: Partial<RoadLine> = {}): RoadLine => ({
  coords,
  direction: 'two_way',
  name: null,
  walk_only: false,
  ...extra,
})

/**
 * A 100 m square loop. The south side is one-way eastward, the rest two-way.
 *   NW ---- NE
 *   |        |
 *   SW ---> SE
 */
function loop(southOneWay = true): RoadNetwork {
  return buildRoadNetwork([
    road([at(0, 0), at(100, 0)], { direction: southOneWay ? 'one_way' : 'two_way', name: 'South road' }),
    road([at(100, 0), at(100, 100)], { name: 'East road' }),
    road([at(100, 100), at(0, 100)], { name: 'North road' }),
    road([at(0, 100), at(0, 0)], { name: 'West road' }),
  ])
}

describe('findRoute', () => {
  it('drives along a one-way road in its direction', () => {
    const net = loop()
    const r = findRoute(createGraph(net, 'drive'), net, at(10, 0), at(90, 3), 'drive')
    expect(r).not.toBeNull()
    expect(r!.distanceM).toBeGreaterThan(80)
    expect(r!.distanceM).toBeLessThan(90)
  })

  it('goes around the loop instead of against a one-way road', () => {
    const net = loop()
    const r = findRoute(createGraph(net, 'drive'), net, at(90, 0), at(10, 3), 'drive')
    expect(r).not.toBeNull()
    // East, north and west sides plus 10 m on each end of the south side.
    expect(r!.distanceM).toBeGreaterThan(300)
  })

  it('takes the short way when the same road is two-way', () => {
    const net = loop(false)
    const r = findRoute(createGraph(net, 'drive'), net, at(90, 0), at(10, 3), 'drive')
    expect(r!.distanceM).toBeLessThan(90)
  })

  it('ignores one-way rules when walking', () => {
    const net = loop()
    const r = findRoute(createGraph(net, 'walk'), net, at(90, 0), at(10, 3), 'walk')
    expect(r!.distanceM).toBeLessThan(90)
  })

  it('does not drive on footpaths but walks on them', () => {
    const net = buildRoadNetwork([road([at(0, 0), at(100, 0)], { walk_only: true })])
    expect(findRoute(createGraph(net, 'drive'), net, at(5, 0), at(95, 0), 'drive')).toBeNull()
    expect(findRoute(createGraph(net, 'walk'), net, at(5, 0), at(95, 0), 'walk')).not.toBeNull()
  })

  it('returns null when there is no path', () => {
    const net = buildRoadNetwork([road([at(0, 0), at(50, 0)]), road([at(0, 100), at(50, 100)])])
    expect(findRoute(createGraph(net, 'drive'), net, at(5, 0), at(40, 101), 'drive')).toBeNull()
  })

  it('returns null when the start is off campus (over 150 m from any road)', () => {
    const net = loop()
    expect(findRoute(createGraph(net, 'drive'), net, at(50, -400), at(90, 3), 'drive')).toBeNull()
    expect(nearestNetworkDistance(net, at(50, -400), 'drive')).toBeGreaterThan(150)
  })

  it('adds a first leg over 5 m and a last leg to the slot', () => {
    const net = loop()
    const r = findRoute(createGraph(net, 'drive'), net, at(10, -20), at(90, 8), 'drive')!
    expect(r.firstLeg).not.toBeNull()
    expect(r.lastLeg.geometry.coordinates).toHaveLength(2)
    expect(r.steps[r.steps.length - 1].type).toBe('arrive')
    expect(r.steps[r.steps.length - 1].side).toBe('left')
  })

  it('leaves the cached graph unchanged after routing', () => {
    const net = loop()
    const g = cachedGraph(net, 'drive', 'test:1')
    const before = g.getNodesCount()
    findRoute(g, net, at(10, 0), at(90, 3), 'drive')
    expect(g.getNodesCount()).toBe(before)
    expect(cachedGraph(net, 'drive', 'test:1')).toBe(g)
  })

  it('reports progress along the route', () => {
    const net = loop()
    const r = findRoute(createGraph(net, 'drive'), net, at(0, 0), at(100, 50), 'drive')!
    const p = routeProgress(r.line, at(50, 2))
    expect(p.offRouteM).toBeCloseTo(2, 0)
    expect(p.alongM).toBeGreaterThan(45)
    expect(p.remainingM).toBeGreaterThan(90)
  })
})
