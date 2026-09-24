import { describe, expect, it } from 'vitest'
import { formatClock, formatDistance, formatInr, formatPlate, formatRelative, localName } from '@/lib/format'

describe('formatPlate', () => {
  it('spaces standard plates', () => {
    expect(formatPlate('KL02AB1234')).toBe('KL 02 AB 1234')
    expect(formatPlate('kl7c1234')).toBe('KL 7 C 1234')
    expect(formatPlate('KL011234')).toBe('KL 01 1234')
  })
  it('spaces BH series', () => {
    expect(formatPlate('22BH1234AA')).toBe('22 BH 1234 AA')
  })
  it('leaves unknown formats as typed, uppercased', () => {
    expect(formatPlate('temp 123')).toBe('TEMP123')
  })
})

describe('formatDistance', () => {
  it('rounds to 10 m under 100 m, 50 m above, km from 1000 m', () => {
    expect(formatDistance(43)).toBe('40 m')
    expect(formatDistance(96)).toBe('100 m')
    expect(formatDistance(349)).toBe('350 m')
    expect(formatDistance(1240)).toBe('1.2 km')
    expect(formatDistance(-5)).toBe('0 m')
  })
})

describe('time', () => {
  const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${String(o.count)}` : key)
  it('shows IST clock time', () => {
    expect(formatClock('2026-09-24T05:12:00Z')).toBe('10:42 am')
  })
  it('is relative under one hour', () => {
    const now = Date.parse('2026-09-24T05:12:00Z')
    expect(formatRelative('2026-09-24T05:11:50Z', t, now)).toBe('common.justNow')
    expect(formatRelative('2026-09-24T05:06:00Z', t, now)).toBe('common.minAgo:6')
    expect(formatRelative('2026-09-24T03:00:00Z', t, now)).toBe('8:30 am')
  })
})

describe('misc', () => {
  it('formats rupees', () => {
    expect(formatInr(1500)).toBe('₹1,500')
  })
  it('picks the Malayalam name when present', () => {
    expect(localName({ name: 'North lawn', name_ml: 'വടക്ക്' }, 'ml')).toBe('വടക്ക്')
    expect(localName({ name: 'North lawn', name_ml: '' }, 'ml')).toBe('North lawn')
    expect(localName({ name: 'North lawn', name_ml: 'വടക്ക്' }, 'en')).toBe('North lawn')
  })
})
