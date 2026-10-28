import type { MoodEntry } from '../types'
import { localDateToNoon, monthDates } from './date'
import { moodChoiceOf, moodName } from './mood'

/**
 * The weather calendar: a month, or a year in pixels, coloured by the inner
 * weather of each day.
 *
 * Purely descriptive by design. Nothing here averages, scores, counts or
 * predicts; it only says which weather a day was given, the way the journal
 * itself does.
 */

/** A calendar month: the year, and the month counted from 0 as Date does. */
export interface CalendarMonth {
  year: number
  monthIndex: number
}

/** The day a week is drawn from: 0 for Sunday, 1 for Monday. */
export type WeekStart = 0 | 1

/** What a day is called when it has entries but no check-in. */
const NO_CHECK_IN = 'no check-in'

/** How a day's name marks a check-in written for it afterwards. */
const WRITTEN_LATER = 'written later'

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

type FormatKind = 'month' | 'monthShort' | 'year' | 'day' | 'weekdayShort' | 'weekdayLong'

const FORMAT_OPTIONS: Record<FormatKind, Intl.DateTimeFormatOptions> = {
  month: { month: 'long', year: 'numeric' },
  monthShort: { month: 'short' },
  year: { year: 'numeric' },
  day: { weekday: 'long', month: 'long', day: 'numeric' },
  weekdayShort: { weekday: 'short' },
  weekdayLong: { weekday: 'long' },
}

/**
 * Formatters are kept, not rebuilt. A year view names every day that has an
 * entry, and constructing a formatter costs far more than formatting with one
 * (see journalDateFormat in date.ts). Keyed by locale as well, so a test that
 * asks for another locale cannot change what the app shows.
 */
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(kind: FormatKind, locale: string | undefined): Intl.DateTimeFormat {
  const key = `${kind}|${locale ?? ''}`
  let format = formatters.get(key)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, FORMAT_OPTIONS[kind])
    formatters.set(key, format)
  }
  return format
}

/** The week as Intl.Locale describes it, under either name it has shipped as. */
interface LocaleWeek {
  getWeekInfo?: () => { firstDay: number }
  weekInfo?: { firstDay: number }
}

/**
 * The day the gardener's week starts on, from their locale.
 *
 * Engines have offered this as a `weekInfo` getter and, more recently, as
 * `getWeekInfo()`; either is read. Where neither exists, or the locale cannot
 * be read, the week starts on Sunday rather than being guessed from the
 * language: a guess would be wrong for someone, and Sunday is at least the
 * calendar this app has always drawn.
 */
export function firstDayOfWeek(locale?: string): WeekStart {
  try {
    const tag = locale ?? new Intl.DateTimeFormat().resolvedOptions().locale
    const resolved = new Intl.Locale(tag) as Intl.Locale & LocaleWeek
    const week =
      typeof resolved.getWeekInfo === 'function' ? resolved.getWeekInfo() : resolved.weekInfo
    // firstDay counts Monday as 1 and Sunday as 7. The grid starts on one of
    // those two, so a week that starts on a Saturday or a Friday is drawn
    // from Sunday, the nearer of them.
    return week?.firstDay === 1 ? 1 : 0
  } catch {
    // An engine without Intl.Locale, or a locale tag it does not accept.
    return 0
  }
}

/**
 * A month as weeks of seven local dates, padded with `undefined` before the
 * first day and after the last so every week is whole.
 *
 * Dates come from monthDates, built from local calendar fields, so a
 * daylight-saving change inside the month cannot skip or repeat a day.
 */
export function monthWeeks(
  year: number,
  monthIndex: number,
  weekStartsOn: WeekStart,
): Array<Array<string | undefined>> {
  const dates = monthDates(year, monthIndex)
  const leading = (localDateToNoon(dates[0]).getDay() - weekStartsOn + 7) % 7
  const cells: Array<string | undefined> = [
    ...Array.from({ length: leading }, () => undefined),
    ...dates,
  ]
  while (cells.length % 7 !== 0) cells.push(undefined)
  const weeks: Array<Array<string | undefined>> = []
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7))
  }
  return weeks
}

/** The seven weekday names in grid order, short for the eye and long for a screen reader. */
export function weekdayLabels(
  weekStartsOn: WeekStart,
  locale?: string,
): Array<{ short: string; long: string }> {
  const short = formatter('weekdayShort', locale)
  const long = formatter('weekdayLong', locale)
  // 4 January 2026 was a Sunday; any week would do.
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(2026, 0, 4 + weekStartsOn + index, 12)
    return { short: short.format(day), long: long.format(day) }
  })
}

/** "October 2026". */
export function monthLabel(year: number, monthIndex: number, locale?: string): string {
  return formatter('month', locale).format(new Date(year, monthIndex, 1, 12))
}

/** "Oct", for the row labels of the year view. */
export function monthShortLabel(monthIndex: number, locale?: string): string {
  return formatter('monthShort', locale).format(new Date(2026, monthIndex, 1, 12))
}

/** "2026", as the locale writes a year. */
export function yearLabel(year: number, locale?: string): string {
  return formatter('year', locale).format(new Date(year, 0, 1, 12))
}

/**
 * A day and its weather, as a day's button is named: "Tuesday, October 6:
 * Bright", or "…: no check-in" for a day with only a reflection or a recap.
 * A check-in written later for the day still gives it its weather, and says
 * so: "…: Bright, written later".
 */
export function dayWeatherLabel(
  localDate: string,
  entry: Pick<MoodEntry, 'level' | 'unsure' | 'writtenLater'> | undefined,
  locale?: string,
): string {
  const day = formatter('day', locale).format(localDateToNoon(localDate))
  if (!entry) return `${day}: ${NO_CHECK_IN}`
  const later = entry.writtenLater === true ? `, ${WRITTEN_LATER}` : ''
  return `${day}: ${moodName(moodChoiceOf(entry))}${later}`
}

/**
 * The colour class for a day's check-in: `cal-weather-1` (Stormy) to
 * `cal-weather-5` (Radiant), `cal-weather-unsure` for "Not sure", or an empty
 * string for a day without a check-in.
 */
export function weatherClassOf(entry: Pick<MoodEntry, 'level' | 'unsure'> | undefined): string {
  if (!entry) return ''
  return `cal-weather-${moodChoiceOf(entry)}`
}

/** The month a local date falls in. */
export function monthOf(localDate: string): CalendarMonth {
  return {
    year: Number(localDate.slice(0, 4)),
    monthIndex: Number(localDate.slice(5, 7)) - 1,
  }
}

/**
 * The month of the earliest of these dates, or undefined when there are none.
 *
 * One pass, no sort: it is handed every check-in a garden has ever had. Local
 * dates compare correctly as strings, and anything that is not one is passed
 * over rather than pinning the calendar to a month that does not exist.
 */
export function earliestMonth(dates: Iterable<string>): CalendarMonth | undefined {
  let earliest: string | undefined
  for (const date of dates) {
    if (!LOCAL_DATE.test(date)) continue
    if (earliest === undefined || date < earliest) earliest = date
  }
  return earliest === undefined ? undefined : monthOf(earliest)
}

/** Negative when `a` is the earlier month, positive when it is the later one. */
export function compareMonths(a: CalendarMonth, b: CalendarMonth): number {
  return a.year * 12 + a.monthIndex - (b.year * 12 + b.monthIndex)
}

/** The month `delta` months on from this one, across years as needed. */
export function shiftMonth(month: CalendarMonth, delta: number): CalendarMonth {
  const shifted = new Date(month.year, month.monthIndex + delta, 1, 12)
  return { year: shifted.getFullYear(), monthIndex: shifted.getMonth() }
}

/** This month, held between the earliest and latest months that may be shown. */
export function clampMonth(
  month: CalendarMonth,
  earliest: CalendarMonth,
  latest: CalendarMonth,
): CalendarMonth {
  if (compareMonths(month, earliest) < 0) return earliest
  if (compareMonths(month, latest) > 0) return latest
  return month
}
