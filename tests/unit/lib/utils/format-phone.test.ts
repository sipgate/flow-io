import { describe, it, expect } from 'vitest'

import { formatPhoneNumber } from '@/lib/utils/format-phone'

describe('formatPhoneNumber', () => {
  describe('empty inputs', () => {
    it('returns "Unknown" for null', () => {
      expect(formatPhoneNumber(null)).toBe('Unknown')
    })

    it('returns "Unknown" for undefined', () => {
      expect(formatPhoneNumber(undefined)).toBe('Unknown')
    })

    it('returns "Unknown" for an empty string', () => {
      expect(formatPhoneNumber('')).toBe('Unknown')
    })
  })

  describe('+ prefix handling', () => {
    it('formats E.164 numbers with leading +', () => {
      expect(formatPhoneNumber('+492041348770')).toBe('+49 2041 348770')
    })

    it('adds a missing + before parsing', () => {
      expect(formatPhoneNumber('492041348770')).toBe('+49 2041 348770')
    })

    it('trims surrounding whitespace before parsing', () => {
      expect(formatPhoneNumber('  +492041348770  ')).toBe('+49 2041 348770')
    })
  })

  describe('invalid input', () => {
    it('returns the original string for non-parseable values', () => {
      expect(formatPhoneNumber('not-a-number')).toBe('not-a-number')
    })

    it('returns the original string when the number is too short', () => {
      // "+1" is parseable as a country prefix but not a valid number
      expect(formatPhoneNumber('+1')).toBe('+1')
    })
  })

  describe('multiple countries', () => {
    it.each([
      ['+12025551234',   '+1 202 555 1234'],   // US
      ['+442079460958',  '+44 20 7946 0958'],  // UK
      ['+43512123456',   '+43 512 123456'],    // AT
      ['+33145678901',   '+33 1 45 67 89 01'], // FR
      ['+4915155512345', '+49 1515 5512345'],  // DE mobile
    ])('formats %s into international format', (input, expected) => {
      expect(formatPhoneNumber(input)).toBe(expected)
    })

    it('also formats numbers without + prefix correctly (US example)', () => {
      expect(formatPhoneNumber('12025551234')).toBe('+1 202 555 1234')
    })
  })
})
