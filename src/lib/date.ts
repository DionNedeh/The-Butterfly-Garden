import type { Goal } from '../types'

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

export function formatJournalDate(localDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(localDateToNoon(localDate))
}

export function getDailyPromptIndex(localDate: string, count: number): number {
  const [year, month, day] = localDate.split('-').map(Number)
  const stableDay = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  return stableDay % count
}
