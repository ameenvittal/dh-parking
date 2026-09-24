import { describe, expect, it } from 'vitest'
import { buildSteps, classifyTurn, normalizeAngle, roundStepDistance } from '@/lib/geo/instructions'
import { at } from './helpers'

describe('classifyTurn', () => {
  it.each([
    [0, 'straight'],
    [24, 'straight'],
    [-30, 'slight_left'],
    [40, 'slight_right'],
    [-90, 'left'],
    [90, 'right'],
    [-150, 'sharp_left'],
    [160, 'sharp_right'],
    [175, 'uturn'],
    [-179, 'uturn'],
  ] as const)('%s° is %s', (delta, type) => {
    expect(classifyTurn(delta)).toBe(type)
  })

  it('normalises angles to -180..180', () => {
    expect(normalizeAngle(270)).toBe(-90)
    expect(normalizeAngle(-270)).toBe(90)
    expect(normalizeAngle(360)).toBe(0)
  })
})

describe('roundStepDistance', () => {
  it('is null (Now) under 20 m, 10 m steps under 100 m, then 50 m steps', () => {
    expect(roundStepDistance(12)).toBeNull()
    expect(roundStepDistance(44)).toBe(40)
    expect(roundStepDistance(96)).toBe(100)
    expect(roundStepDistance(130)).toBe(150)
  })
})

describe('buildSteps', () => {
  it('finds a left then a right turn with distances between them', () => {
    // North 100 m, west 60 m (left), north 40 m (right).
    const coords = [at(0, 0), at(0, 100), at(-60, 100), at(-60, 140)]
    const steps = buildSteps({
      coords,
      destination: at(-55, 140),
      lastLegM: 5,
      pieces: [
        { coords: [at(0, 0), at(0, 100)], name: 'College road' },
        { coords: [at(0, 100), at(-60, 100)], name: 'Library lane' },
        { coords: [at(-60, 100), at(-60, 140)], name: null },
      ],
    })
    expect(steps.map((s) => s.type)).toEqual(['start', 'left', 'right', 'arrive'])
    expect(steps[0].roadName).toBe('College road')
    expect(steps[1].distanceM).toBeCloseTo(100, 0)
    expect(steps[1].roadName).toBe('Library lane')
    expect(steps[2].distanceM).toBeCloseTo(60, 0)
    expect(steps[3].distanceM).toBeCloseTo(45, 0)
    expect(steps[3].side).toBe('right')
  })

  it('merges small bends into straight road', () => {
    const coords = [at(0, 0), at(2, 50), at(0, 100), at(3, 150)]
    const steps = buildSteps({ coords, destination: at(-4, 150), lastLegM: 4 })
    expect(steps.map((s) => s.type)).toEqual(['start', 'arrive'])
    expect(steps[1].side).toBe('left')
  })

  it('detects a U-turn', () => {
    const coords = [at(0, 0), at(0, 50), at(1, 0)]
    expect(buildSteps({ coords, destination: at(1, 0), lastLegM: 0 }).map((s) => s.type)).toContain('uturn')
  })
})
