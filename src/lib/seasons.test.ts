import { describe, expect, it } from 'vitest'
import { currentSeason, hemisphereOf, knownSeason, seasonOf, type Season } from './seasons'

/** The north's season by month, January first, as the meteorologists count. */
const NORTH: readonly Season[] = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
]
const SOUTH_OF: Record<Season, Season> = {
  winter: 'summer',
  spring: 'autumn',
  summer: 'winter',
  autumn: 'spring',
}

/** The last day of a month in 2026 (not a leap year) and 2028 (a leap year). */
function lastDay(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${day}`
}

describe('the season on a day', () => {
  it('turns on the first of March, June, September and December in the north', () => {
    expect(currentSeason('2026-02-28', 'north')).toBe('winter')
    expect(currentSeason('2026-03-01', 'north')).toBe('spring')
    expect(currentSeason('2026-05-31', 'north')).toBe('spring')
    expect(currentSeason('2026-06-01', 'north')).toBe('summer')
    expect(currentSeason('2026-08-31', 'north')).toBe('summer')
    expect(currentSeason('2026-09-01', 'north')).toBe('autumn')
    expect(currentSeason('2026-11-30', 'north')).toBe('autumn')
    expect(currentSeason('2026-12-01', 'north')).toBe('winter')
    expect(currentSeason('2026-12-31', 'north')).toBe('winter')
    expect(currentSeason('2027-01-01', 'north')).toBe('winter')
  })

  it('is the other way round in the south: spring is September to November', () => {
    expect(currentSeason('2026-02-28', 'south')).toBe('summer')
    expect(currentSeason('2026-03-01', 'south')).toBe('autumn')
    expect(currentSeason('2026-05-31', 'south')).toBe('autumn')
    expect(currentSeason('2026-06-01', 'south')).toBe('winter')
    expect(currentSeason('2026-08-31', 'south')).toBe('winter')
    expect(currentSeason('2026-09-01', 'south')).toBe('spring')
    expect(currentSeason('2026-11-30', 'south')).toBe('spring')
    expect(currentSeason('2026-12-01', 'south')).toBe('summer')
    expect(currentSeason('2027-01-01', 'south')).toBe('summer')
  })

  it('holds from the first to the last day of every month, leap days included, in both halves', () => {
    for (const year of [2026, 2028]) {
      for (let month = 1; month <= 12; month += 1) {
        const first = `${year}-${String(month).padStart(2, '0')}-01`
        const last = lastDay(year, month)
        const north = NORTH[month - 1]
        expect(currentSeason(first, 'north'), first).toBe(north)
        expect(currentSeason(last, 'north'), last).toBe(north)
        expect(currentSeason(first, 'south'), first).toBe(SOUTH_OF[north])
        expect(currentSeason(last, 'south'), last).toBe(SOUTH_OF[north])
        expect(seasonOf(month, 'north')).toBe(north)
        expect(seasonOf(month, 'south')).toBe(SOUTH_OF[north])
      }
    }
    expect(currentSeason('2028-02-29', 'north')).toBe('winter')
    expect(currentSeason('2028-02-29', 'south')).toBe('summer')
  })
})

describe('the gardener’s half of the world', () => {
  it('is the south for Australia and New Zealand, the north for North America and Europe', () => {
    expect(hemisphereOf('australasia')).toBe('south')
    expect(hemisphereOf('north-america')).toBe('north')
    expect(hemisphereOf('europe')).toBe('north')
  })

  it('takes the north’s when no region says otherwise', () => {
    expect(hemisphereOf(undefined)).toBe('north')
    expect(hemisphereOf('elsewhere')).toBe('north')
  })

  it('is said in words only where the region makes it known', () => {
    expect(knownSeason('australasia', '2026-07-15')).toBe('winter')
    expect(knownSeason('europe', '2026-07-15')).toBe('summer')
    expect(knownSeason('north-america', '2026-10-27')).toBe('autumn')
    expect(knownSeason(undefined, '2026-07-15')).toBeUndefined()
    expect(knownSeason('elsewhere', '2026-07-15')).toBeUndefined()
  })
})
