import { describe, expect, it } from 'vitest'
import { isValidIndianPlate, normalizePlate } from '@/lib/plate'

describe('normalizePlate', () => {
  it('uppercases and strips spaces and dashes', () => {
    expect(normalizePlate('kl 02-ab 1234')).toBe('KL02AB1234')
    expect(normalizePlate(' 22 bh 1234 aa ')).toBe('22BH1234AA')
  })
})

describe('isValidIndianPlate', () => {
  it.each(['KL02AB1234', 'KL 7 C 1234', 'MH12DE1433', 'DL3CAB1234', '22BH1234AA', 'KL01A1'])('accepts %s', (p) => {
    expect(isValidIndianPlate(p)).toBe(true)
  })
  it.each(['', '1234', 'KLAB1234', 'KL02AB12345', '22BH123AA', 'K02AB1234'])('rejects %s', (p) => {
    expect(isValidIndianPlate(p)).toBe(false)
  })
})
