import { describe, expect, it } from 'vitest'
import { formatPhone, formatPhoneInput, maskPhone, normalizeIndianPhone, toWaNumber } from '@/lib/phone'

describe('normalizeIndianPhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['6000000000', '+916000000000'],
  ])('normalises %s', (input, out) => {
    expect(normalizeIndianPhone(input)).toBe(out)
  })
  it.each(['5876543210', '987654321', '98765432101', 'abcdefghij', ''])('rejects %s', (input) => {
    expect(normalizeIndianPhone(input)).toBeNull()
  })
})

describe('phone display', () => {
  it('masks all but the first and last two digits', () => {
    expect(maskPhone('+919876543210')).toBe('+91 98xxxxxx10')
  })
  it('formats 5 + 5', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210')
    expect(formatPhoneInput('9876543')).toBe('98765 43')
    expect(formatPhoneInput('98765432109999')).toBe('98765 43210')
  })
  it('drops the plus for WhatsApp', () => {
    expect(toWaNumber('+919876543210')).toBe('919876543210')
  })
})
