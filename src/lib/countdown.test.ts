import { describe, expect, it } from 'vitest'
import { formatChrysalisCountdown } from './countdown'

const NOW = new Date('2026-06-13T12:00:00.000Z').getTime()

describe('formatChrysalisCountdown', () => {
  it('includes the remaining hours throughout a multi-day chrysalis', () => {
    expect(
      formatChrysalisCountdown('2026-06-16T12:00:00.000Z', NOW),
    ).toBe('3d 0h remaining')
    expect(
      formatChrysalisCountdown('2026-06-15T13:30:00.000Z', NOW),
    ).toBe('2d 1h 30m remaining')
  })

  it('includes minutes during the final day', () => {
    expect(
      formatChrysalisCountdown('2026-06-14T11:59:00.000Z', NOW),
    ).toBe('23h 59m remaining')
    expect(
      formatChrysalisCountdown('2026-06-13T12:00:01.000Z', NOW),
    ).toBe('1m remaining')
  })

  it('reports readiness without returning a negative time', () => {
    expect(
      formatChrysalisCountdown('2026-06-13T12:00:00.000Z', NOW),
    ).toBe('Ready to emerge')
    expect(formatChrysalisCountdown('not-a-date', NOW)).toBe('Time unknown')
  })
})
