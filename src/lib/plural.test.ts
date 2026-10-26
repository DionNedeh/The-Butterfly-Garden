import { describe, expect, it } from 'vitest'
import { counted } from './plural'

describe('counts in words', () => {
  it('agrees with the number', () => {
    expect(counted(1, 'day', 'days')).toBe('1 day')
    expect(counted(0, 'day', 'days')).toBe('0 days')
    expect(counted(4, 'butterfly', 'butterflies')).toBe('4 butterflies')
  })
})
