import type { MoodChoice } from '../types'
import type { JournalDays } from './journalSearch'
import { moodChoiceOf } from './mood'

/**
 * "On this day": a day from exactly a month or a year ago, offered back at
 * the top of the Journal, so a journal kept for a long time gives something
 * back.
 *
 * Only an exact calendar match counts, because the card says "today". A date
 * with no twin a month back (the 31st after a 30-day month, the 29th to the
 * 31st of March most years) has no "month ago". In the same way, 29 February
 * has no "year ago": last year had no 29 February, and showing the 28th or
 * 1 March under "A year ago today" would not be true. A leap day's own entry
 * still comes back a month later, on 29 March.
 */

/** How far back the day is. */
export type OnThisDaySpan = 'year' | 'month'

export interface OnThisDay {
  span: OnThisDaySpan
  localDate: string
  /** That day's check-in weather, or failing that its evening one; absent if neither. */
  weather?: MoodChoice
  /** The first line of that day's words, shortened when long; absent with no words. */
  firstLine?: string
}

/** The most characters of a first line the card shows before shortening it. */
export const FIRST_LINE_LENGTH = 140

const LINE_BREAKS = /\r\n|\r|\n/

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

/**
 * The local date `months` months from this one, keeping the day of the month;
 * when that day does not exist there, `clamp` takes the month's last day and
 * otherwise there is no such date. Calendar arithmetic only: no clock, so no
 * time zone or daylight-saving change can move it.
 */
function shiftByMonths(localDate: string, months: number, clamp: boolean): string | undefined {
  const [year, month, day] = localDate.split('-').map(Number)
  const index = year * 12 + month - 1 + months
  const shiftedYear = Math.floor(index / 12)
  const shiftedMonth = index - shiftedYear * 12
  const length = daysInMonth(shiftedYear, shiftedMonth)
  if (day > length && !clamp) return undefined
  return `${pad(shiftedYear, 4)}-${pad(shiftedMonth + 1)}-${pad(Math.min(day, length))}`
}

/** The same date `months` months earlier, or undefined when it does not exist. */
export function sameDateBack(localDate: string, months: number): string | undefined {
  return shiftByMonths(localDate, -months, false)
}

/**
 * The day a garden planted on `start` is a month old: the same date a month
 * on, or the last day of that month when the date does not exist there.
 */
function monthAfter(start: string): string {
  return shiftByMonths(start, 1, true) as string
}

/** A line as the card shows it: whole when short, cut at a word with an ellipsis when not. */
function shortened(line: string): string {
  // By code point, so an emoji is never cut in half.
  const characters = Array.from(line)
  if (characters.length <= FIRST_LINE_LENGTH) return line
  const cut = characters.slice(0, FIRST_LINE_LENGTH).join('')
  const space = cut.lastIndexOf(' ')
  return `${(space > FIRST_LINE_LENGTH / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** The first line with words in it, in the order the timeline shows a day. */
function firstLineOf(days: JournalDays, localDate: string): string | undefined {
  const recap = days.recapByDate.get(localDate)
  const texts = [
    days.moodByDate.get(localDate)?.note,
    days.reflectionByDate.get(localDate)?.body,
    recap?.wentWell,
    recap?.settingDown,
    recap?.forTomorrow,
  ]
  for (const text of texts) {
    if (!text) continue
    const line = text
      .split(LINE_BREAKS)
      .map((each) => each.trim())
      .find((each) => each !== '')
    if (line) return shortened(line)
  }
  return undefined
}

function hasEntry(days: JournalDays, localDate: string): boolean {
  return (
    days.moodByDate.has(localDate) ||
    days.reflectionByDate.has(localDate) ||
    days.recapByDate.has(localDate)
  )
}

/**
 * The day to offer back today, if any: a year ago when there is an entry
 * then, otherwise a month ago. Nothing while the garden is in its first
 * month (counted from `gardenStart`, its first local day, when known), and
 * nothing for a day with no check-in, reflection or recap.
 */
export function onThisDay(
  days: JournalDays,
  today: string,
  gardenStart?: string,
): OnThisDay | undefined {
  if (gardenStart !== undefined && today < monthAfter(gardenStart)) return undefined
  const candidates: Array<[OnThisDaySpan, string | undefined]> = [
    ['year', sameDateBack(today, 12)],
    ['month', sameDateBack(today, 1)],
  ]
  for (const [span, localDate] of candidates) {
    if (localDate === undefined || !hasEntry(days, localDate)) continue
    const mood = days.moodByDate.get(localDate)
    const eveningLevel = days.recapByDate.get(localDate)?.level
    const weather: MoodChoice | undefined = mood ? moodChoiceOf(mood) : eveningLevel
    const firstLine = firstLineOf(days, localDate)
    return {
      span,
      localDate,
      ...(weather === undefined ? {} : { weather }),
      ...(firstLine === undefined ? {} : { firstLine }),
    }
  }
  return undefined
}
