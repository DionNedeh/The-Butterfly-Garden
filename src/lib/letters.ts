import type { AppState, Profile } from '../types'
import { isLocalDate, localDateToNoon } from './date'

/**
 * Marigold's weekly letter: the little the garden keeps for it, and the
 * gardener's choices about it.
 *
 * A letter is about a week from Monday to Sunday by the gardener's own
 * calendar, and arrives that Sunday as their evening starts
 * (lib/letterTiming). Its words are worked out from the garden whenever it is
 * read (lib/summaries), so nothing of a letter is ever stored: only the
 * Sunday of the newest one read, so the garden knows when to stop saying one
 * is waiting, whether letters may quote the gardener, and which lines they
 * starred for quoting. These reducers load with the garden, so they stay
 * small; everything else about letters loads when one is shown.
 */

/** Whether to quote the gardener's words: only lines they starred, or never. */
export type LetterQuotes = 'starred' | 'never'

/** What a line can be starred on: a check-in's note, or a reflection. */
export type StarredKind = 'check-in' | 'reflection'

/** Whether this is a real local date, and a Sunday. */
export function isSunday(localDate: unknown): localDate is string {
  return isLocalDate(localDate) && localDateToNoon(localDate).getDay() === 0
}

/**
 * Note that the letter for the week ending `sunday` was read, or put away.
 * Never moves back: reading an older letter again changes nothing, and the
 * garden comes back as it was, so nothing is written.
 */
export function readLetter(state: AppState, sunday: string): AppState {
  const profile = state.profile
  if (!profile || !isSunday(sunday) || (profile.lastLetterRead ?? '') >= sunday) return state
  return { ...state, profile: { ...profile, lastLetterRead: sunday } }
}

/** Whether letters may quote starred lines, or never quote at all. */
export function letterQuotesOf(profile: Pick<Profile, 'letterQuotes'> | undefined): LetterQuotes {
  return profile?.letterQuotes === 'never' ? 'never' : 'starred'
}

/**
 * Quote starred lines, the default, which stores nothing; or never quote.
 * Either way every star stays where the gardener put it.
 */
export function setLetterQuotes(state: AppState, quotes: LetterQuotes): AppState {
  const profile = state.profile
  if (!profile || letterQuotesOf(profile) === quotes) return state
  const next = { ...profile }
  if (quotes === 'never') next.letterQuotes = 'never'
  else delete next.letterQuotes
  return { ...state, profile: next }
}

/**
 * Star a check-in's note or a reflection, so a letter may quote it, or take
 * the star away. Stored only as true, and the entry's words and times are
 * untouched: a star is not an edit. Hands back the same garden when there is
 * no such entry or nothing changes.
 */
export function setStarred(
  state: AppState,
  kind: StarredKind,
  id: string,
  starred: boolean,
): AppState {
  const field = kind === 'check-in' ? 'moods' : 'reflections'
  const entries: Array<{ id: string; starred?: true }> = state[field]
  const index = entries.findIndex((entry) => entry.id === id)
  if (index === -1 || (entries[index].starred === true) === starred) return state
  const entry = { ...entries[index] }
  if (starred) entry.starred = true
  else delete entry.starred
  return { ...state, [field]: entries.map((each, at) => (at === index ? entry : each)) }
}
