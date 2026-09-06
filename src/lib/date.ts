import type { DailyCompletion, Goal } from '../types'

export function toLocalDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function localDateToNoon(localDate: string): Date {
  const [year, month, day] = localDate.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

export function isGoalDue(goal: Goal, localDate: string): boolean {
  if (goal.archived || localDate < goal.createdDate) return false
  if (goal.snoozedUntil && localDate < goal.snoozedUntil) return false
  if (goal.schedule === 'once') {
    // Planned goals wait for their day, then stay due until completed.
    return !goal.scheduledDate || localDate >= goal.scheduledDate
  }
  if (goal.schedule === 'daily') return true
  return goal.weekdays.includes(localDateToNoon(localDate).getDay())
}

/** Whether the goal lands on this calendar day (for the month planner). */
export function isGoalPlannedOn(goal: Goal, localDate: string): boolean {
  if (goal.archived) return false
  if (goal.schedule === 'once') {
    return (goal.scheduledDate ?? goal.createdDate) === localDate
  }
  if (localDate < goal.createdDate) return false
  if (goal.schedule === 'daily') return true
  return goal.weekdays.includes(localDateToNoon(localDate).getDay())
}

export function isGoalSkipped(goal: Goal, localDate: string): boolean {
  return goal.skippedDates?.includes(localDate) ?? false
}

export function addDaysToLocalDate(localDate: string, days: number): string {
  const noon = localDateToNoon(localDate)
  noon.setDate(noon.getDate() + days)
  return toLocalDate(noon)
}

/** Every local date in the given month (0-indexed monthIndex). */
export function monthDates(year: number, monthIndex: number): string[] {
  const count = new Date(year, monthIndex + 1, 0).getDate()
  return Array.from({ length: count }, (_, index) =>
    toLocalDate(new Date(year, monthIndex, index + 1)),
  )
}

/**
 * Built once, not per call. Constructing an Intl formatter resolves a locale
 * and builds a format pattern; reusing the instance to format is ~160x
 * cheaper, and this is called once per row of a journal timeline that grows
 * for as long as the garden is kept. The locale is read at module load, which
 * is fine because the app has no way to change it without a reload.
 */
const journalDateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export function formatJournalDate(localDate: string): string {
  return journalDateFormat.format(localDateToNoon(localDate))
}

export function getDailyPromptIndex(localDate: string, count: number): number {
  const [year, month, day] = localDate.split('-').map(Number)
  const stableDay = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  return stableDay % count
}

/**
 * One-time goals that were completed on an earlier day have served their
 * purpose and should stop appearing on Today. They stay in the month planner
 * and the journal, so the day they were done is never lost.
 */
export function retiredOnceGoalIds(
  completions: ReadonlyArray<Pick<DailyCompletion, 'goalId' | 'localDate'>>,
  today: string,
): Set<string> {
  const retired = new Set<string>()
  for (const completion of completions) {
    if (completion.localDate < today) retired.add(completion.goalId)
  }
  return retired
}

/** Key used to look up whether a goal was completed on a given day. */
export function completionKey(goalId: string, localDate: string): string {
  return `${goalId}:${localDate}`
}
