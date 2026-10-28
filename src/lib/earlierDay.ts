import type { AppState, Profile } from '../types'
import { isLocalDate, toLocalDate } from './date'

/**
 * Writing for a day that has passed: "Add an entry for an earlier day".
 *
 * A gap in the journal used to stay a gap, because only today could be
 * written. Now a missed day can be filled in, clearly marked as written
 * later. It describes that day, so the timeline and the weather calendar
 * show it there; but the act of care happened today, so it earns no Sunlight
 * and does not make that day a cared-for one.
 */

/** What can be written for an earlier day. */
export type EarlierEntryKind = 'check-in' | 'reflection'

/**
 * Why a day cannot take an entry written later:
 * - `not-a-day`: not a real calendar date;
 * - `not-yet-past`: today or later, which Today itself is for;
 * - `before-garden`: before the garden was planted, or the garden's first
 *   day cannot be read;
 * - `already-written`: the journal keeps one check-in and one reflection a
 *   day, and that day has one.
 */
export type EarlierDayProblem = 'not-a-day' | 'not-yet-past' | 'before-garden' | 'already-written'

/**
 * The garden's first day by the gardener's own clock, or undefined when its
 * creation time cannot be read. Stored as an instant, so it is turned into a
 * local date here rather than cut out of the ISO text, which is UTC.
 */
export function gardenStartDate(profile: Pick<Profile, 'createdAt'> | undefined): string | undefined {
  if (!profile) return undefined
  const time = Date.parse(profile.createdAt)
  return Number.isFinite(time) ? toLocalDate(new Date(time)) : undefined
}

/**
 * Whether `localDate` can take an entry of this kind written today, and if
 * not, why. The Journal's form explains each answer, and the reducers ask the
 * same question, so a date typed past the field's limits is refused too.
 */
export function earlierDayProblem(
  state: Pick<AppState, 'profile' | 'moods' | 'reflections'>,
  localDate: string,
  kind: EarlierEntryKind,
  today: string,
): EarlierDayProblem | undefined {
  if (!isLocalDate(localDate)) return 'not-a-day'
  if (localDate >= today) return 'not-yet-past'
  const start = gardenStartDate(state.profile)
  if (start === undefined || localDate < start) return 'before-garden'
  const entries = kind === 'check-in' ? state.moods : state.reflections
  if (entries.some((entry) => entry.localDate === localDate)) return 'already-written'
  return undefined
}
