import type { Profile } from '../types'
import { addDaysToLocalDate, recapHoursOf, toLocalDate } from './date'

/**
 * When Marigold's letters arrive (lib/letters): each Sunday, as the
 * gardener's evening starts, the hour the Moonlight recap opens, about the
 * week from Monday to that Sunday. Loaded with the garden's letter card and
 * the Journal, never with the garden's first load.
 */

/** How many weeks of letters the Journal keeps within reach, the newest included. */
export const LETTER_WEEKS = 4

/**
 * The Sunday of the newest letter there is at `now`: today, from the evening
 * hour of a Sunday, and otherwise the Sunday before. Undefined until the
 * garden has seen a Sunday after its first day, so a garden planted on a
 * Sunday is not sent a letter about the hour it has existed.
 */
export function latestLetterSunday(
  now: Date,
  opensHour: number,
  gardenStart?: string,
): string | undefined {
  const today = toLocalDate(now)
  const weekday = now.getDay()
  const sunday =
    weekday === 0 && now.getHours() >= opensHour
      ? today
      : addDaysToLocalDate(today, -(weekday === 0 ? 7 : weekday))
  return gardenStart === undefined || sunday > gardenStart ? sunday : undefined
}

/**
 * The next moment a letter arrives after `now`: a Sunday at the evening hour,
 * on the gardener's own clock, whatever a change of the clocks did between.
 */
export function nextLetterAt(now: Date, opensHour: number): Date {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + ((7 - now.getDay()) % 7),
    opensHour,
  )
  if (next <= now) next.setDate(next.getDate() + 7)
  return next
}

/** The newest letter's Sunday for this garden at `now`, at its own evening hour. */
export function latestLetterFor(
  profile: Pick<Profile, 'createdAt' | 'recapOpensHour'> | undefined,
  now: Date,
): string | undefined {
  if (!profile) return undefined
  const planted = Date.parse(profile.createdAt)
  return latestLetterSunday(now, recapHoursOf(profile).opensHour, Number.isFinite(planted) ? toLocalDate(new Date(planted)) : undefined)
}

/** Whether the letter for the week ending `latest` is still waiting to be read. */
export function isLetterWaiting(
  profile: Pick<Profile, 'lastLetterRead'> | undefined,
  latest: string | undefined,
): latest is string {
  if (latest === undefined) return false
  const read = profile?.lastLetterRead
  return read === undefined || read < latest
}

/**
 * The Sundays of the letters within reach, newest first: at most `weeks` of
 * them, and none for a week that ended before the garden's first day.
 */
export function letterSundays(
  latest: string,
  gardenStart: string | undefined,
  weeks = LETTER_WEEKS,
): string[] {
  const sundays: string[] = []
  let sunday = latest
  while (sundays.length < weeks && (gardenStart === undefined || sunday > gardenStart)) {
    sundays.push(sunday)
    sunday = addDaysToLocalDate(sunday, -7)
  }
  return sundays
}
