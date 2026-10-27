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

/**
 * Calendar days from one local date to another: 1 from Monday to Tuesday,
 * whatever the hours, and unbothered by a daylight-saving change between.
 */
export function daysBetweenLocalDates(from: string, to: string): number {
  const utc = (localDate: string) => {
    const [year, month, day] = localDate.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / 86_400_000)
}

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * A real calendar day written as YYYY-MM-DD, the app's only date shape. A
 * date field can be typed with a five-digit year, which would then compare
 * wrongly as text, so every date the gardener enters is checked with this.
 */
export function isLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !LOCAL_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** The latest a date field offers, so a five-digit year cannot be typed. */
export const LATEST_LOCAL_DATE = '9999-12-31'

/** The hour the Moonlight recap becomes available, in local time, by default. */
export const RECAP_OPENS_HOUR = 18

const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })

/** An hour as the gardener's clock shows it: "6 PM", or "18" in 24-hour locales. */
export function formatHour(hour: number, locale?: string): string {
  // Settings lists two dozen hours on every render, so the gardener's own
  // locale uses one formatter built once, like the others in this file.
  const format = locale ? new Intl.DateTimeFormat(locale, { hour: 'numeric' }) : hourFormat
  return format.format(new Date(2000, 0, 1, hour))
}

/** The hour the recap opens, as the gardener's clock shows it. */
export function recapOpensAt(hour = RECAP_OPENS_HOUR, locale?: string): string {
  return formatHour(hour, locale)
}

/**
 * The hour the after-midnight grace window closes, in local time.
 *
 * Someone rounding out Tuesday at 1:15am is on Wednesday as far as the
 * calendar is concerned. Without this they would spend Wednesday's Moonlight
 * closing Tuesday, then collect again twenty hours later -- a double claim
 * through no fault of their own.
 */
export const RECAP_GRACE_ENDS_HOUR = 4

/**
 * When a gardener's evening starts and their late night ends. A shift worker
 * or a night owl can move both (Settings → Your rhythm). The two ranges never
 * meet, so an hour is always either evening, grace, or neither.
 */
export interface RecapHours {
  opensHour: number
  graceEndsHour: number
}

export const DEFAULT_RECAP_HOURS: RecapHours = {
  opensHour: RECAP_OPENS_HOUR,
  graceEndsHour: RECAP_GRACE_ENDS_HOUR,
}

/** Evenings that can be chosen: from noon to 11pm. */
export const RECAP_OPENS_CHOICES: readonly number[] = Array.from({ length: 12 }, (_, i) => 12 + i)

/** Late nights that can be chosen: the recap keeps offering yesterday until midnight…10am. */
export const RECAP_GRACE_CHOICES: readonly number[] = Array.from({ length: 11 }, (_, i) => i)

/** The gardener's own hours where they chose them, the defaults otherwise. */
export function recapHoursOf(
  profile: { recapOpensHour?: number; recapGraceEndsHour?: number } | undefined,
): RecapHours {
  const opensHour = profile?.recapOpensHour
  const graceEndsHour = profile?.recapGraceEndsHour
  return {
    opensHour:
      opensHour !== undefined && RECAP_OPENS_CHOICES.includes(opensHour)
        ? opensHour
        : RECAP_OPENS_HOUR,
    graceEndsHour:
      graceEndsHour !== undefined && RECAP_GRACE_CHOICES.includes(graceEndsHour)
        ? graceEndsHour
        : RECAP_GRACE_ENDS_HOUR,
  }
}

export type RecapWindowState = 'evening' | 'grace' | 'waiting'

export interface RecapWindow {
  open: boolean
  /** The day this recap would close out. Only set while open. */
  targetDate?: string
  state: RecapWindowState
}

/**
 * Whether the day can be rounded out right now, and which day that would be.
 *
 * Local wall-clock throughout, deliberately. The device's own clock and zone
 * are the only thing that tracks where the gardener actually is, and this app
 * has nothing else to ask -- so an evening is whatever the device calls one,
 * including after a flight.
 */
export function recapWindow(
  now = new Date(),
  { opensHour, graceEndsHour }: RecapHours = DEFAULT_RECAP_HOURS,
): RecapWindow {
  const hour = now.getHours()
  if (hour >= opensHour) {
    return { open: true, targetDate: toLocalDate(now), state: 'evening' }
  }
  if (hour < graceEndsHour) {
    return {
      open: true,
      targetDate: addDaysToLocalDate(toLocalDate(now), -1),
      state: 'grace',
    }
  }
  return { open: false, state: 'waiting' }
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

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long' })

/** Just the weekday, for naming the day a recap is closing out. */
export function formatWeekday(localDate: string): string {
  return weekdayFormat.format(localDateToNoon(localDate))
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
