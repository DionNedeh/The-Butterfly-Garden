import { describe, expect, it } from 'vitest'
import type { AppState, SunlightAward } from '../types'
import { gardenYear, yearInWords, type GardenYear } from './gardenYear'
import { createInitialState } from './progression'
import { careRhythm, longestRunIn } from './rhythm'

/*
 * 6.8: the most days in a row cared for within a year, on the year's page,
 * in words, and only while Settings shows day counts. It speaks only of days
 * that happened: nothing in it can be broken.
 */
function sunlight(localDate: string, source = 'mood'): SunlightAward {
  return { id: `${source}-${localDate}`, localDate, source, awardedAt: `${localDate}T15:00:00.000Z` }
}

function garden(days: string[]): AppState {
  return {
    ...createInitialState('Robin', 'Quiet Corner', new Date(2025, 2, 1, 9)),
    creatures: [],
    sunlight: days.map((day) => sunlight(day)),
  }
}

const EMPTY: GardenYear = {
  year: 2026,
  checkIns: 0,
  reflections: 0,
  evenings: 0,
  daysCaredFor: 0,
  speciesWelcomed: [],
  emerged: [],
  lines: [],
}

describe('6.8 the most days in a row', () => {
  it('is counted as the rhythm counts it', () => {
    expect(longestRunIn(new Set())).toBe(0)
    expect(longestRunIn(new Set(['2026-03-01']))).toBe(1)
    expect(longestRunIn(new Set(['2026-03-01', '2026-03-02', '2026-03-04']))).toBe(2)
    // Across the end of a month, and of February in a leap year.
    expect(longestRunIn(new Set(['2028-02-28', '2028-02-29', '2028-03-01']))).toBe(3)
    expect(careRhythm([sunlight('2026-01-01'), sunlight('2026-01-02')], '2026-01-05').longestRun).toBe(2)
  })

  it('counts only the year’s own days, a run across New Year being cut at it', () => {
    const state = garden([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-05-10',
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
      '2026-05-14',
      '2026-08-08',
    ])
    expect(gardenYear(state, 2026, '2026-10-27').longestRun).toBe(5)
    expect(gardenYear(state, 2025, '2026-10-27').longestRun).toBe(3)
  })

  it('counts a day with several Sunlight awards once', () => {
    const state = garden(['2026-04-01', '2026-04-02'])
    state.sunlight.push(sunlight('2026-04-02', 'goal'), sunlight('2026-04-03', 'breath'))
    expect(gardenYear(state, 2026, '2026-10-27').longestRun).toBe(3)
  })

  it('leaves out days ahead of the device’s clock', () => {
    const state = garden(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'])
    expect(gardenYear(state, 2026, '2026-10-27').longestRun).toBe(2)
  })

  it('is not there for a year with no two days in a row, so a quiet year is as it was', () => {
    expect(gardenYear(garden([]), 2026, '2026-10-27')).toEqual(EMPTY)
    expect(gardenYear(garden(['2026-02-01', '2026-02-03']), 2026, '2026-10-27')).not.toHaveProperty(
      'longestRun',
    )
  })

  it('is said in words beside the days cared for', () => {
    const words = yearInWords({ ...EMPTY, daysCaredFor: 20, longestRun: 5 }, true)
    expect(words.care).toBe('Days you cared for yourself: 20.')
    expect(words.run).toBe('Your longest run of days cared for was five days.')
    expect(yearInWords({ ...EMPTY, daysCaredFor: 40, longestRun: 12 }, true).run).toBe(
      'Your longest run of days cared for was 12 days.',
    )
  })

  it('says nothing of runs when Settings hides day counts', () => {
    const words = yearInWords({ ...EMPTY, daysCaredFor: 20, longestRun: 5 }, false)
    expect(words).not.toHaveProperty('run')
    expect(JSON.stringify(words)).not.toMatch(/run|row|five|\b5\b/i)
  })

  it('never speaks of a streak, or of one broken', () => {
    const words = yearInWords({ ...EMPTY, daysCaredFor: 20, longestRun: 5 }, true)
    expect(`${words.care} ${words.run}`).not.toMatch(/streak|broke|lost|missed|again|only/i)
  })
})
