import type { SunlightAward } from '../types'
import { addDaysToLocalDate } from './date'

/**
 * How often the gardener has cared for themselves, told without a reset.
 *
 * This replaced a streak that dropped to zero after one missed day, the
 * moment that makes people blame themselves and quit, and that broke the
 * onboarding promise that nothing wilts while you are away. Every number
 * here only ever describes days that happened: none of them can show a
 * broken state. A day counts when it earned at least one Sunlight, so only
 * an act of care moves it; closing the day with Moonlight does not.
 */
export interface CareRhythm {
  /** Cared-for days among the last seven, today included. */
  lastSeven: number
  /** Cared-for days so far this calendar month. */
  thisMonth: number
  /** The most days in a row ever cared for. */
  longestRun: number
}

export function careRhythm(
  awards: readonly Pick<SunlightAward, 'localDate'>[],
  today: string,
): CareRhythm {
  const days = new Set(
    awards.map((award) => award.localDate).filter((date) => date <= today),
  )
  const weekStart = addDaysToLocalDate(today, -6)
  const month = today.slice(0, 7)
  let lastSeven = 0
  let thisMonth = 0
  let longestRun = 0
  for (const day of days) {
    if (day >= weekStart) lastSeven += 1
    if (day.startsWith(month)) thisMonth += 1
    // Only the first day of each run walks forward, so this stays linear.
    if (days.has(addDaysToLocalDate(day, -1))) continue
    let run = 1
    while (days.has(addDaysToLocalDate(day, run))) run += 1
    longestRun = Math.max(longestRun, run)
  }
  return { lastSeven, thisMonth, longestRun }
}
