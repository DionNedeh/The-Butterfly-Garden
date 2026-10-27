import { describe, expect, it } from 'vitest'
import {
  isLetterWaiting,
  LETTER_WEEKS,
  latestLetterFor,
  latestLetterSunday,
  letterSundays,
  nextLetterAt,
} from './letterTiming'

// The tests run in New York (vite.config.ts), where the clocks went forward
// on Sunday 8 March 2026 and go back on Sunday 1 November 2026.

describe('the newest letter', () => {
  it('arrives on Sunday at the evening hour, about the week ending that day', () => {
    expect(latestLetterSunday(new Date(2026, 9, 25, 17, 59), 18)).toBe('2026-10-18')
    expect(latestLetterSunday(new Date(2026, 9, 25, 18, 0), 18)).toBe('2026-10-25')
    expect(latestLetterSunday(new Date(2026, 9, 25, 23, 59), 18)).toBe('2026-10-25')
  })

  it('stays the same letter all week, until the next Sunday evening', () => {
    for (const day of [26, 27, 28, 29, 30, 31]) {
      expect(latestLetterSunday(new Date(2026, 9, day, 0, 1), 18)).toBe('2026-10-25')
      expect(latestLetterSunday(new Date(2026, 9, day, 23, 0), 18)).toBe('2026-10-25')
    }
    expect(latestLetterSunday(new Date(2026, 10, 1, 9), 18)).toBe('2026-10-25')
  })

  it('follows the gardener’s own evening', () => {
    expect(latestLetterSunday(new Date(2026, 9, 25, 13), 12)).toBe('2026-10-25')
    expect(latestLetterSunday(new Date(2026, 9, 25, 22), 23)).toBe('2026-10-18')
  })

  it('arrives on time on the Sundays the clocks change', () => {
    // 1 November has 25 hours; 8 March has 23.
    expect(latestLetterSunday(new Date(2026, 10, 1, 1, 30), 18)).toBe('2026-10-25')
    expect(latestLetterSunday(new Date(2026, 10, 1, 17, 59), 18)).toBe('2026-10-25')
    expect(latestLetterSunday(new Date(2026, 10, 1, 18), 18)).toBe('2026-11-01')
    expect(latestLetterSunday(new Date(2026, 2, 8, 17, 59), 18)).toBe('2026-03-01')
    expect(latestLetterSunday(new Date(2026, 2, 8, 18), 18)).toBe('2026-03-08')
  })

  it('waits for a Sunday after the garden’s first day', () => {
    // Planted on the Sunday itself: nothing that evening.
    expect(latestLetterSunday(new Date(2026, 9, 25, 20), 18, '2026-10-25')).toBeUndefined()
    expect(latestLetterSunday(new Date(2026, 9, 28, 12), 18, '2026-10-25')).toBeUndefined()
    // Planted on the Saturday: a letter about its first two days.
    expect(latestLetterSunday(new Date(2026, 9, 25, 20), 18, '2026-10-24')).toBe('2026-10-25')
    expect(latestLetterSunday(new Date(2026, 10, 1, 18), 18, '2026-10-25')).toBe('2026-11-01')
  })

  it('reads the garden’s own first day and evening hour', () => {
    const profile = {
      createdAt: new Date(2026, 9, 20, 9).toISOString(),
      recapOpensHour: 20,
    }
    expect(latestLetterFor(profile, new Date(2026, 9, 25, 19))).toBeUndefined()
    expect(latestLetterFor(profile, new Date(2026, 9, 25, 20))).toBe('2026-10-25')
    // A creation time that cannot be read sets no lower bound.
    expect(latestLetterFor({ createdAt: 'long ago' }, new Date(2026, 9, 25, 18))).toBe('2026-10-25')
    expect(latestLetterFor(undefined, new Date(2026, 9, 25, 18))).toBeUndefined()
  })
})

describe('the next letter', () => {
  it('is this Sunday’s evening, or next Sunday’s once this one has come', () => {
    expect(nextLetterAt(new Date(2026, 9, 21, 9), 18)).toEqual(new Date(2026, 9, 25, 18))
    expect(nextLetterAt(new Date(2026, 9, 25, 17, 59), 18)).toEqual(new Date(2026, 9, 25, 18))
    expect(nextLetterAt(new Date(2026, 9, 25, 18), 18)).toEqual(new Date(2026, 10, 1, 18))
    expect(nextLetterAt(new Date(2026, 9, 25, 23), 18)).toEqual(new Date(2026, 10, 1, 18))
  })

  it('keeps to the wall clock across a change of the clocks', () => {
    const autumn = nextLetterAt(new Date(2026, 9, 25, 18), 18)
    expect(autumn.getHours()).toBe(18)
    expect(autumn.getDay()).toBe(0)
    // A week and an hour, since 1 November is 25 hours long.
    expect((autumn.getTime() - new Date(2026, 9, 25, 18).getTime()) / 3_600_000).toBe(169)
    const spring = nextLetterAt(new Date(2026, 2, 1, 18), 18)
    expect(spring).toEqual(new Date(2026, 2, 8, 18))
    expect((spring.getTime() - new Date(2026, 2, 1, 18).getTime()) / 3_600_000).toBe(167)
  })
})

describe('a letter waiting', () => {
  it('waits until its week, or a later one, has been read', () => {
    expect(isLetterWaiting({}, '2026-10-25')).toBe(true)
    expect(isLetterWaiting(undefined, '2026-10-25')).toBe(true)
    expect(isLetterWaiting({ lastLetterRead: '2026-10-18' }, '2026-10-25')).toBe(true)
    expect(isLetterWaiting({ lastLetterRead: '2026-10-25' }, '2026-10-25')).toBe(false)
    expect(isLetterWaiting({ lastLetterRead: '2026-11-01' }, '2026-10-25')).toBe(false)
    expect(isLetterWaiting({}, undefined)).toBe(false)
  })
})

describe('the letters within reach', () => {
  it('are the last few weeks, newest first', () => {
    expect(letterSundays('2026-11-01', undefined)).toEqual([
      '2026-11-01',
      '2026-10-25',
      '2026-10-18',
      '2026-10-11',
    ])
    expect(letterSundays('2026-11-01', undefined)).toHaveLength(LETTER_WEEKS)
  })

  it('go back no further than the garden’s first week', () => {
    expect(letterSundays('2026-11-01', '2026-10-20')).toEqual(['2026-11-01', '2026-10-25'])
    expect(letterSundays('2026-11-01', '2026-10-25')).toEqual(['2026-11-01'])
    expect(letterSundays('2026-03-15', '2025-01-01', 2)).toEqual(['2026-03-15', '2026-03-08'])
  })
})
