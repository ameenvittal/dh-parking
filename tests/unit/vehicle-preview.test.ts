import { describe, expect, it } from 'vitest'
import { bodyStyleFor } from '@/components/common/vehicle-preview/bodyStyle'
import { normalizeColorKey, paintFor } from '@/components/common/vehicle-preview/paint'

describe('bodyStyleFor', () => {
  it('returns motorcycle by default for bikes', () => {
    expect(bodyStyleFor('Royal Enfield', 'bike')).toBe('motorcycle')
    expect(bodyStyleFor('Yamaha R15', 'bike')).toBe('motorcycle')
    expect(bodyStyleFor(null, 'bike')).toBe('motorcycle')
  })

  it('returns scooter for known scooter makes', () => {
    expect(bodyStyleFor('Honda Activa 6G', 'bike')).toBe('scooter')
    expect(bodyStyleFor('TVS Jupiter', 'bike')).toBe('scooter')
    expect(bodyStyleFor('Suzuki Access 125', 'bike')).toBe('scooter')
    expect(bodyStyleFor('Honda Dio', 'bike')).toBe('scooter')
    expect(bodyStyleFor('Hero Pleasure', 'bike')).toBe('scooter')
    expect(bodyStyleFor('TVS Ntorq', 'bike')).toBe('scooter')
    expect(bodyStyleFor('Yamaha Fascino', 'bike')).toBe('scooter')
    expect(bodyStyleFor('Ola S1 Pro', 'bike')).toBe('scooter')
  })

  it('returns hatchback by default for cars and EVs', () => {
    expect(bodyStyleFor('Maruti Swift', 'car')).toBe('hatchback')
    expect(bodyStyleFor('Hyundai i20', 'car')).toBe('hatchback')
    expect(bodyStyleFor(null, 'car')).toBe('hatchback')
    expect(bodyStyleFor('Tata Tiago EV', 'ev')).toBe('hatchback')
  })

  it('returns sedan for known sedan makes', () => {
    expect(bodyStyleFor('Honda City', 'car')).toBe('sedan')
    expect(bodyStyleFor('Hyundai Verna', 'car')).toBe('sedan')
    expect(bodyStyleFor('Maruti Dzire', 'car')).toBe('sedan')
    expect(bodyStyleFor('Skoda Slavia', 'car')).toBe('sedan')
  })

  it('returns suv for known SUV makes', () => {
    expect(bodyStyleFor('Hyundai Creta', 'car')).toBe('suv')
    expect(bodyStyleFor('Kia Seltos', 'car')).toBe('suv')
    expect(bodyStyleFor('Mahindra Thar', 'car')).toBe('suv')
    expect(bodyStyleFor('Toyota Fortuner', 'car')).toBe('suv')
    expect(bodyStyleFor('Tata Nexon EV', 'ev')).toBe('suv')
  })

  it('returns bus for bus type', () => {
    expect(bodyStyleFor('Volvo', 'bus')).toBe('bus')
    expect(bodyStyleFor(null, 'bus')).toBe('bus')
  })

  it('returns autorickshaw for other type', () => {
    expect(bodyStyleFor('Bajaj RE', 'other')).toBe('autorickshaw')
    expect(bodyStyleFor(null, 'other')).toBe('autorickshaw')
  })
})

describe('paintFor and normalizeColorKey', () => {
  it('normalizes valid colors', () => {
    expect(normalizeColorKey('red')).toBe('red')
    expect(normalizeColorKey('WHITE')).toBe('white')
    expect(normalizeColorKey('Silver')).toBe('silver')
  })

  it('falls back to unknown for missing or unrecognized colors', () => {
    expect(normalizeColorKey(null)).toBe('unknown')
    expect(normalizeColorKey(undefined)).toBe('unknown')
    expect(normalizeColorKey('magenta')).toBe('unknown')
  })

  it('returns fallback hex strings when window computed styles are unavailable', () => {
    expect(paintFor('red')).toBe('#D32F2F')
    expect(paintFor('white')).toBe('#F5F6F8')
    expect(paintFor('black')).toBe('#20232A')
    expect(paintFor('unknown')).toBe('#C0C4CC')
    expect(paintFor(null)).toBe('#C0C4CC')
  })
})
