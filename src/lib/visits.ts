import type { AppState, Profile } from '../types'
import { daysBetweenLocalDates } from './date'

/**
 * The day the garden was last opened, and a return after a few days away.
 *
 * Coming back after a gap is a moment the garden can make kind: it has one
 * small thing to show (components/garden/WelcomeBack), never a count of the
 * days and never a word about anything missed. Nothing here is a reward and
 * nothing else in the garden changes; all it keeps is the day of the last
 * visit, and the day of a return while its reveal is still out.
 */

/** Local calendar days away before a return has something to show. */
export const DAYS_AWAY_FOR_A_WELCOME = 3

/**
 * Whole local calendar days from one visit to the next: 3 from a Monday to a
 * Thursday whatever the hours, and unbothered by a clock change between.
 */
export function daysAway(lastVisitOn: string, today: string): number {
  return daysBetweenLocalDates(lastVisitOn, today)
}

/**
 * Note that the garden was opened today, and whether that is a return.
 *
 * Hands back the garden it was given on a day already noted, so the save
 * that follows writes nothing: at most one write a day, however often the
 * garden is opened. A garden with no visit on record (an older one, before
 * this was kept) starts its record here with nothing to welcome back from.
 * A last visit in the future, after the device's clock went back, is simply
 * moved to today.
 */
export function noteVisit(state: AppState, today: string): AppState {
  const profile = state.profile
  if (!profile || profile.lastVisitOn === today) return state
  const returned =
    profile.lastVisitOn !== undefined &&
    daysAway(profile.lastVisitOn, today) >= DAYS_AWAY_FOR_A_WELCOME
  const next: Profile = { ...profile, lastVisitOn: today }
  // A reveal left out on an earlier day is over now, put away or not.
  if (returned) next.welcomeBackOn = today
  else delete next.welcomeBackOn
  return { ...state, profile: next }
}

/** Whether the garden has its welcome-back reveal out today. */
export function welcomeBackToday(
  profile: Pick<Profile, 'welcomeBackOn'> | undefined,
  today: string,
): boolean {
  return profile?.welcomeBackOn === today
}

/** Put the reveal away. It is not offered again until the next return. */
export function putAwayWelcomeBack(state: AppState): AppState {
  if (!state.profile?.welcomeBackOn) return state
  const profile = { ...state.profile }
  delete profile.welcomeBackOn
  return { ...state, profile }
}
