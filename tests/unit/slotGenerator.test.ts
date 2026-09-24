import { area, distance, featureCollection, intersect, polygon } from '@turf/turf'
import { describe, expect, it } from 'vitest'
import { fitCount, generateSlotRow, slotLabel, slotPitch, type SlotRowInput } from '@/lib/geo/slotGenerator'
import { at } from './helpers'

const base: SlotRowInput = {
  a: at(0, 0),
  b: at(50, 0),
  vehicleType: 'car',
  width: 2.5,
  depth: 5,
  angle: 90,
  side: 'left',
  gap: 0,
  count: 5,
  fit: false,
  startNumber: 1,
  accessible: false,
  ev: false,
}

const polyOf = (s: ReturnType<typeof generateSlotRow>[number]) => polygon(s.geometry.coordinates)

describe('generateSlotRow', () => {
  it('makes count slots numbered from startNumber with the given size at 90°', () => {
    const slots = generateSlotRow({ ...base, startNumber: 7 })
    expect(slots).toHaveLength(5)
    expect(slots.map((s) => s.properties.number)).toEqual([7, 8, 9, 10, 11])
    for (const s of slots) expect(area(polyOf(s))).toBeCloseTo(12.5, 0)
  })

  it('fits to the line', () => {
    const slots = generateSlotRow({ ...base, fit: true })
    expect(slots).toHaveLength(20)
    expect(fitCount(base)).toBe(20)
    expect(fitCount({ ...base, gap: 0.5 })).toBe(Math.floor(50.5 / 3))
  })

  it('places left side north of an eastward baseline and right side south', () => {
    const left = generateSlotRow({ ...base, count: 1 })[0].geometry.coordinates[0]
    const right = generateSlotRow({ ...base, count: 1, side: 'right' })[0].geometry.coordinates[0]
    expect(left[2][1]).toBeGreaterThan(base.a[1])
    expect(right[2][1]).toBeLessThan(base.a[1])
  })

  it('adjacent slots touch without overlapping (90° and 45°, both sides)', () => {
    for (const angle of [90, 45] as const) {
      for (const side of ['left', 'right'] as const) {
        const slots = generateSlotRow({ ...base, angle, side, count: 4 })
        for (let i = 0; i < slots.length - 1; i++) {
          const a = slots[i].geometry.coordinates[0]
          const b = slots[i + 1].geometry.coordinates[0]
          expect(distance(a[1], b[0], { units: 'meters' })).toBeLessThan(0.01)
          const hit = intersect(featureCollection([polyOf(slots[i]), polyOf(slots[i + 1])]))
          const overlap = hit ? area(hit) : 0
          expect(overlap).toBeLessThan(0.01 * area(polyOf(slots[i])))
        }
      }
    }
  })

  it('uses a longer pitch for angled slots', () => {
    expect(slotPitch(2.5, 90, 0)).toBeCloseTo(2.5)
    expect(slotPitch(2.5, 45, 0)).toBeCloseTo(2.5 / Math.sin(Math.PI / 4))
    const slots = generateSlotRow({ ...base, angle: 45, count: 2 })
    const [s0, s1] = slots.map((s) => s.geometry.coordinates[0][0])
    expect(distance(s0, s1, { units: 'meters' })).toBeCloseTo(slotPitch(2.5, 45, 0), 1)
  })

  it('carries flags and labels', () => {
    const s = generateSlotRow({ ...base, count: 1, accessible: true, ev: true, vehicleType: 'ev' })[0]
    expect(s.properties).toMatchObject({ is_accessible: true, has_ev_charger: true, vehicle_type: 'ev' })
    expect(slotLabel('A', 12)).toBe('A-012')
  })
})
