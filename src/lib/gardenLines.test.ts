import { describe, expect, it } from 'vitest'
import { species } from '../data/content'
import { observations } from '../data/observations'
import { nightLines } from '../data/nightLines'
import { marigoldLines, seasonLines } from '../data/seasons'
import { DAY_WORDS } from '../test/nightWords'
import type { RegionId } from '../types'
import { addDaysToLocalDate, getDailyPromptIndex } from './date'
import {
  dayLine,
  gardenLine,
  isSeasonDay,
  marigoldLine,
  nightLine,
  seasonLine,
  seasonLinesFor,
} from './gardenLines'
import type { Season } from './seasons'

/** The next day, from this one on, that is (or is not) a season day. */
function firstDay(from: string, seasonDay: boolean): string {
  let day = from
  while (isSeasonDay(day) !== seasonDay) day = addDaysToLocalDate(day, 1)
  return day
}

const lineTexts = (region: RegionId, season: Season) =>
  seasonLines.filter((line) => line.region === region && line.season === season).map((line) => line.text)

const nightTexts = (speciesId: string | undefined) =>
  nightLines.filter(([id]) => id === 'all' || id === speciesId).map(([, text]) => text)

describe('the night’s line', () => {
  it('comes from the night’s own words for every butterfly, and for a garden with none flying', () => {
    // No butterfly flying: a companion still an egg, a caterpillar or a
    // chrysalis, whose garden says the lines any garden says.
    const gardens = [...species.map((item) => item.id), undefined]
    for (const speciesId of gardens) {
      for (let offset = 0; offset < 12; offset += 1) {
        const day = addDaysToLocalDate('2026-07-01', offset)
        const line = nightLine(speciesId, day)
        expect(nightTexts(speciesId), `${speciesId} ${day}`).toContain(line)
        expect(line).not.toMatch(DAY_WORDS)
      }
    }
  })

  it('shows each butterfly’s own lines in time, as the day does', () => {
    for (const butterfly of species) {
      const seen = new Set(
        Array.from({ length: 40 }, (_, offset) =>
          nightLine(butterfly.id, addDaysToLocalDate('2026-01-01', offset)),
        ),
      )
      const own = nightLines.filter(([id]) => id === butterfly.id).map(([, text]) => text)
      for (const text of own) expect(seen.has(text), text).toBe(true)
    }
  })

  it('holds still all night, and moves on with the next day', () => {
    expect(nightLine('monarch', '2026-07-01')).toBe(nightLine('monarch', '2026-07-01'))
    const week = Array.from({ length: 7 }, (_, offset) =>
      nightLine(undefined, addDaysToLocalDate('2026-07-01', offset)),
    )
    expect(new Set(week).size).toBeGreaterThan(1)
  })
})

describe('the season’s lines, by region and half of the world', () => {
  it('give a region its own season’s lines, and Marigold’s in autumn and spring', () => {
    expect(seasonLinesFor('north-america', '2026-10-15')).toEqual([
      ...lineTexts('north-america', 'autumn'),
      marigoldLines.north.autumn,
    ])
    expect(seasonLinesFor('europe', '2026-01-20')).toEqual(lineTexts('europe', 'winter'))
    expect(seasonLinesFor('europe', '2026-07-20')).toEqual(lineTexts('europe', 'summer'))
    expect(seasonLinesFor('north-america', '2026-04-02')).toEqual([
      ...lineTexts('north-america', 'spring'),
      marigoldLines.north.spring,
    ])
  })

  it('follow the south’s seasons in Australia and New Zealand', () => {
    // October is spring there, and July winter.
    expect(seasonLinesFor('australasia', '2026-10-15')).toEqual([
      ...lineTexts('australasia', 'spring'),
      marigoldLines.south.spring,
    ])
    expect(seasonLinesFor('australasia', '2026-07-15')).toEqual(lineTexts('australasia', 'winter'))
    expect(seasonLinesFor('australasia', '2026-04-15')).toEqual([
      ...lineTexts('australasia', 'autumn'),
      marigoldLines.south.autumn,
    ])
  })

  it('without a region, or for Elsewhere, give every region’s lines in its own season', () => {
    for (const region of [undefined, 'elsewhere'] as const) {
      expect(seasonLinesFor(region, '2026-10-15')).toEqual([
        ...lineTexts('north-america', 'autumn'),
        ...lineTexts('europe', 'autumn'),
        ...lineTexts('australasia', 'spring'),
        marigoldLines.north.autumn,
      ])
      expect(seasonLinesFor(region, '2026-01-15')).toEqual([
        ...lineTexts('north-america', 'winter'),
        ...lineTexts('europe', 'winter'),
        ...lineTexts('australasia', 'summer'),
      ])
    }
  })

  it('every line naming its place, so none says the gardener’s own season as fact', () => {
    for (const region of [undefined, 'elsewhere'] as const) {
      for (const month of ['01', '04', '07', '10']) {
        for (const text of seasonLinesFor(region, `2026-${month}-15`)) {
          expect(text, text).toMatch(/^(In |Marigold )/)
        }
      }
    }
  })

  it('moves on to the next line with each season day, through every one', () => {
    const start = firstDay('2026-10-01', true)
    const choices = seasonLinesFor('north-america', start)
    const shown = Array.from({ length: choices.length }, (_, turn) =>
      seasonLine('north-america', addDaysToLocalDate(start, turn * 3)),
    )
    expect(new Set(shown)).toEqual(new Set(choices))
  })
})

describe('Marigold’s season', () => {
  it('follows the gardener’s half of the world, and the north’s when it is not known', () => {
    expect(marigoldLine('north-america', '2026-10-15')).toBe(marigoldLines.north.autumn)
    expect(marigoldLine('europe', '2026-04-15')).toBe(marigoldLines.north.spring)
    expect(marigoldLine('australasia', '2026-10-15')).toBe(marigoldLines.south.spring)
    expect(marigoldLine('australasia', '2026-04-15')).toBe(marigoldLines.south.autumn)
    expect(marigoldLine(undefined, '2026-10-15')).toBe(marigoldLines.north.autumn)
    expect(marigoldLine('elsewhere', '2026-04-15')).toBe(marigoldLines.north.spring)
  })

  it('says nothing in summer or winter', () => {
    expect(marigoldLine('north-america', '2026-07-15')).toBeUndefined()
    expect(marigoldLine('north-america', '2026-01-15')).toBeUndefined()
    expect(marigoldLine('australasia', '2026-07-15')).toBeUndefined()
  })
})

describe('the day’s line', () => {
  it('is chosen as it always was: the active butterfly’s own lines and any garden’s, one a day', () => {
    for (const speciesId of ['monarch', 'atala', undefined]) {
      const choices = observations.filter(
        (item) => item.speciesId === 'all' || item.speciesId === speciesId,
      )
      for (let offset = 0; offset < 10; offset += 1) {
        const day = addDaysToLocalDate('2026-07-01', offset)
        expect(dayLine(speciesId, day)).toBe(
          choices[getDailyPromptIndex(day, choices.length)].text,
        )
      }
    }
  })
})

describe('the garden’s line', () => {
  it('is the day’s own on an ordinary day', () => {
    const day = firstDay('2026-07-01', false)
    expect(gardenLine({ localDate: day, speciesId: 'monarch', night: false })).toBe(
      dayLine('monarch', day),
    )
  })

  it('is the night’s line at night on an ordinary day', () => {
    const day = firstDay('2026-07-01', false)
    expect(gardenLine({ localDate: day, speciesId: 'queen', night: true })).toBe(nightLine('queen', day))
    expect(gardenLine({ localDate: day, night: true })).toBe(nightLine(undefined, day))
  })

  it('is the season’s line on a season day, by day and by night', () => {
    const day = firstDay('2026-07-01', true)
    for (const night of [false, true]) {
      expect(gardenLine({ localDate: day, night, region: 'australasia' })).toBe(
        seasonLine('australasia', day),
      )
      expect(gardenLine({ localDate: day, night })).toBe(seasonLine(undefined, day))
    }
  })

  it('never says the day’s words at night', () => {
    const day = new Set(observations.map((item) => item.text))
    for (let offset = 0; offset < 30; offset += 1) {
      const date = addDaysToLocalDate('2026-03-01', offset)
      for (const speciesId of ['monarch', 'zebra-longwing', undefined]) {
        const line = gardenLine({ localDate: date, speciesId, night: true, region: 'europe' })
        expect(day.has(line), line).toBe(false)
        expect(line).not.toMatch(DAY_WORDS)
      }
    }
  })
})

describe('the days the garden speaks of the season', () => {
  it('come every third day, across a month’s and a year’s end', () => {
    const days = Array.from({ length: 60 }, (_, offset) => addDaysToLocalDate('2026-12-10', offset))
    const seasonDays = days.filter(isSeasonDay)
    expect(seasonDays).toHaveLength(20)
    for (let index = 1; index < seasonDays.length; index += 1) {
      expect(addDaysToLocalDate(seasonDays[index - 1], 3)).toBe(seasonDays[index])
    }
  })
})
