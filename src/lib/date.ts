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
  if (goal.schedule === 'daily') return true
  if (goal.schedule === 'once') return true
  return goal.weekdays.includes(localDateToNoon(localDate).getDay())
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
