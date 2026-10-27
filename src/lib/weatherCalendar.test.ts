import { afterEach, describe, expect, it } from 'vitest'
import type { MoodEntry } from '../types'
import {
  clampMonth,
  compareMonths,
  dayWeatherLabel,
  earliestMonth,
  firstDayOfWeek,
  monthLabel,
  monthOf,
  monthShortLabel,
  monthWeeks,
  shiftMonth,
  weatherClassOf,
  weekdayLabels,
  yearLabel,
} from './weatherCalendar'

/**
 * Intl.Locale's week has shipped as a `weekInfo` getter and as
 * `getWeekInfo()`, and the engine running these tests may have either. Each
 * test that cares installs exactly the shape it means, and the originals are
 * put back afterwards.
 */
const localeProto = Intl.Locale.prototype as object
const WEEK_KEYS = ['getWeekInfo', 'weekInfo'] as const
const originals = new Map(
  WEEK_KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(localeProto, key)]),
)

function useWeekApi(api: {
  getWeekInfo?: () => { firstDay: number }
  weekInfo?: { firstDay: number }
}) {
  for (const key of WEEK_KEYS) {
    if (key in api) {
      Object.defineProperty(localeProto, key, {
        configurable: true,
        ...(key === 'weekInfo' ? { get: () => api.weekInfo } : { value: api.getWeekInfo }),
      })
    } else {
      Reflect.deleteProperty(localeProto, key)
    }
  }
}

afterEach(() => {
  for (const key of WEEK_KEYS) {
    const original = originals.get(key)
    if (original) Object.defineProperty(localeProto, key, original)
    else Reflect.deleteProperty(localeProto, key)
  }
})

function mood(localDate: string, level: MoodEntry['level'], unsure?: true): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level,
    ...(unsure ? { unsure } : {}),
    note: '',
    createdAt: `${localDate}T09:00:00.000Z`,
    updatedAt: `${localDate}T09:00:00.000Z`,
  }
}

describe('monthWeeks', () => {
  it('pads a month into whole weeks that start on Sunday', () => {
    // 1 October 2026 is a Thursday.
    const weeks = monthWeeks(2026, 9, 0)
    expect(weeks).toHaveLength(5)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ])
    expect(weeks[4]).toEqual([
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
    ])
  })

  it('starts the same month on Monday when asked', () => {
    const weeks = monthWeeks(2026, 9, 1)
    expect(weeks[0]).toEqual([
      undefined,
      undefined,
      undefined,
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    expect(weeks.at(-1)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      undefined,
    ])
  })

  it('needs no padding for a February that starts on the first day of the week', () => {
    // 1 February 2026 is a Sunday, and the month is exactly four weeks.
    const sundayFirst = monthWeeks(2026, 1, 0)
    expect(sundayFirst).toHaveLength(4)
    expect(sundayFirst.flat()).not.toContain(undefined)

    // The same month from Monday needs six blank days before it.
    const mondayFirst = monthWeeks(2026, 1, 1)
    expect(mondayFirst).toHaveLength(5)
    expect(mondayFirst[0].slice(0, 6)).toEqual(Array.from({ length: 6 }, () => undefined))
    expect(mondayFirst[0][6]).toBe('2026-02-01')
  })

  it('keeps every day of a month with a daylight-saving change, once each, in order', () => {
    // New York springs forward on 8 March 2026 and falls back on 1 November.
    for (const monthIndex of [2, 10]) {
      const days = monthWeeks(2026, monthIndex, 0)
        .flat()
        .filter((date): date is string => date !== undefined)
      const count = monthIndex === 2 ? 31 : 30
      expect(days).toHaveLength(count)
      expect(new Set(days).size).toBe(count)
      expect(days).toEqual([...days].sort())
      expect(days[0].endsWith('-01')).toBe(true)
    }
  })
})

describe('firstDayOfWeek', () => {
  it('reads getWeekInfo() where the engine offers it', () => {
    useWeekApi({ getWeekInfo: () => ({ firstDay: 1 }) })
    expect(firstDayOfWeek('en-GB')).toBe(1)
    useWeekApi({ getWeekInfo: () => ({ firstDay: 7 }) })
    expect(firstDayOfWeek('en-US')).toBe(0)
  })

  it('reads the older weekInfo getter where that is all there is', () => {
    useWeekApi({ weekInfo: { firstDay: 1 } })
    expect(firstDayOfWeek('fr-FR')).toBe(1)
    useWeekApi({ weekInfo: { firstDay: 7 } })
    expect(firstDayOfWeek('en-US')).toBe(0)
  })

  it('draws a week that starts on Saturday from Sunday', () => {
    useWeekApi({ getWeekInfo: () => ({ firstDay: 6 }) })
    expect(firstDayOfWeek('ar-EG')).toBe(0)
  })

  it('starts on Sunday when the engine says nothing about the week', () => {
    // Not a guess from the language: a Monday-first locale gets Sunday too.
    useWeekApi({})
    expect(firstDayOfWeek('en-GB')).toBe(0)
    expect(firstDayOfWeek('de-DE')).toBe(0)
  })

  it('starts on Sunday when the locale cannot be read', () => {
    expect(firstDayOfWeek('not a locale!')).toBe(0)
  })

  it("uses the device's own locale when none is given", () => {
    let asked: string | undefined
    useWeekApi({
      getWeekInfo(this: Intl.Locale) {
        asked = this.baseName
        return { firstDay: 1 }
      },
    })
    expect(firstDayOfWeek()).toBe(1)
    expect(asked).toBe(new Intl.DateTimeFormat().resolvedOptions().locale)
  })

  it("agrees with this engine's own week data", () => {
    // No stubs: whichever shape this engine ships, a British week starts on
    // Monday and an American one on Sunday.
    expect(firstDayOfWeek('en-GB')).toBe(1)
    expect(firstDayOfWeek('en-US')).toBe(0)
  })
})

describe('labels', () => {
  it('names a month, a short month and a year in the given locale', () => {
    expect(monthLabel(2026, 9, 'en-US')).toBe('October 2026')
    expect(monthLabel(2026, 9, 'fr-FR')).toBe('octobre 2026')
    expect(monthShortLabel(0, 'en-US')).toBe('Jan')
    expect(yearLabel(2026, 'en-US')).toBe('2026')
  })

  it('names the weekdays in grid order, from either start', () => {
    const sunday = weekdayLabels(0, 'en-US')
    expect(sunday.map((day) => day.short)).toEqual([
      'Sun',
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
    ])
    expect(sunday[0].long).toBe('Sunday')

    const monday = weekdayLabels(1, 'en-US')
    expect(monday[0]).toEqual({ short: 'Mon', long: 'Monday' })
    expect(monday[6]).toEqual({ short: 'Sun', long: 'Sunday' })
  })

  it('names a day by its date and its weather', () => {
    expect(dayWeatherLabel('2026-10-06', mood('2026-10-06', 4), 'en-US')).toBe(
      'Tuesday, October 6: Bright',
    )
    expect(dayWeatherLabel('2026-10-01', mood('2026-10-01', 1), 'en-US')).toBe(
      'Thursday, October 1: Stormy',
    )
  })

  it('names a "Not sure" check-in as such, not as the middle weather it is stored as', () => {
    expect(dayWeatherLabel('2026-10-06', mood('2026-10-06', 3, true), 'en-US')).toBe(
      'Tuesday, October 6: Not sure',
    )
  })

  it('names a check-in written later as such, keeping its weather', () => {
    expect(
      dayWeatherLabel('2026-10-06', { ...mood('2026-10-06', 2), writtenLater: true }, 'en-US'),
    ).toBe('Tuesday, October 6: Rainy, written later')
  })

  it('says when a day has entries but no check-in', () => {
    expect(dayWeatherLabel('2026-10-06', undefined, 'en-US')).toBe(
      'Tuesday, October 6: no check-in',
    )
  })

  it('reuses one formatter per locale, so another locale does not leak into the default', () => {
    const defaultLabel = monthLabel(2026, 9)
    monthLabel(2026, 9, 'de-DE')
    expect(monthLabel(2026, 9)).toBe(defaultLabel)
  })
})

describe('weatherClassOf', () => {
  it('gives each weather its own class', () => {
    expect(([1, 2, 3, 4, 5] as const).map((level) => weatherClassOf(mood('2026-10-06', level)))).toEqual([
      'cal-weather-1',
      'cal-weather-2',
      'cal-weather-3',
      'cal-weather-4',
      'cal-weather-5',
    ])
  })

  it('keeps "Not sure" apart from the middle weather', () => {
    expect(weatherClassOf(mood('2026-10-06', 3, true))).toBe('cal-weather-unsure')
  })

  it('gives a day without a check-in no weather class', () => {
    expect(weatherClassOf(undefined)).toBe('')
  })
})

describe('earliestMonth', () => {
  it('finds the month of the earliest date, in any order', () => {
    expect(earliestMonth(['2026-10-06', '2024-03-31', '2025-01-01'])).toEqual({
      year: 2024,
      monthIndex: 2,
    })
  })

  it('reads any iterable, such as the keys of the journal index', () => {
    const index = new Map([
      ['2026-02-14', mood('2026-02-14', 5)],
      ['2025-12-01', mood('2025-12-01', 2)],
    ])
    expect(earliestMonth(index.keys())).toEqual({ year: 2025, monthIndex: 11 })
  })

  it('is undefined when there are no dates', () => {
    expect(earliestMonth([])).toBeUndefined()
  })

  it('passes over anything that is not a local date', () => {
    expect(earliestMonth(['', 'garbage', '2026-1-1', '2026-05-09'])).toEqual({
      year: 2026,
      monthIndex: 4,
    })
    expect(earliestMonth(['', 'garbage'])).toBeUndefined()
  })
})

describe('month arithmetic', () => {
  it('reads the month of a local date', () => {
    expect(monthOf('2026-01-31')).toEqual({ year: 2026, monthIndex: 0 })
    expect(monthOf('2026-12-01')).toEqual({ year: 2026, monthIndex: 11 })
  })

  it('compares months across years', () => {
    expect(compareMonths({ year: 2025, monthIndex: 11 }, { year: 2026, monthIndex: 0 })).toBeLessThan(0)
    expect(compareMonths({ year: 2026, monthIndex: 0 }, { year: 2025, monthIndex: 11 })).toBeGreaterThan(0)
    expect(compareMonths({ year: 2026, monthIndex: 4 }, { year: 2026, monthIndex: 4 })).toBe(0)
  })

  it('shifts across the turn of a year in both directions', () => {
    expect(shiftMonth({ year: 2026, monthIndex: 11 }, 1)).toEqual({ year: 2027, monthIndex: 0 })
    expect(shiftMonth({ year: 2026, monthIndex: 0 }, -1)).toEqual({ year: 2025, monthIndex: 11 })
    expect(shiftMonth({ year: 2026, monthIndex: 5 }, -18)).toEqual({ year: 2024, monthIndex: 11 })
  })

  it('holds a month between the earliest and the latest that may be shown', () => {
    const earliest = { year: 2025, monthIndex: 3 }
    const latest = { year: 2026, monthIndex: 9 }
    const inside = { year: 2026, monthIndex: 0 }
    expect(clampMonth({ year: 2024, monthIndex: 11 }, earliest, latest)).toBe(earliest)
    expect(clampMonth({ year: 2027, monthIndex: 0 }, earliest, latest)).toBe(latest)
    expect(clampMonth(inside, earliest, latest)).toBe(inside)
  })
})
