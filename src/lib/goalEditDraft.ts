import type { GoalSchedule } from '../types'

/*
 * The goal open in Today's editor, and what has been typed in it, kept as a
 * draft (lib/drafts) under 'goal-edit', so the editor comes back as it was
 * after a lock, a reload or another page (components/TodayView).
 */

/** The draft's key. */
export const GOAL_EDIT_DRAFT = 'goal-edit'

/** What is typed in the editor, field by field, as a draft keeps it. */
export interface GoalEditFields {
  title: string
  tinyTitle: string
  schedule: GoalSchedule
  weekdays: number[]
  plannedFor: string
}

const SCHEDULES: readonly string[] = ['once', 'daily', 'weekdays'] satisfies GoalSchedule[]

/**
 * The goal a draft holds open to edit (TodayView), and the fields typed in
 * it; or undefined for a draft that names none. A field that is not one the
 * editor could hold is left out, so the goal's own is shown instead.
 */
export function goalEditFrom(
  draft: string,
): ({ id: string } & Partial<GoalEditFields>) | undefined {
  let value: unknown
  try {
    value = JSON.parse(draft)
  } catch {
    // No draft (''), or a broken one: nothing is open.
    return undefined
  }
  if (typeof value !== 'object' || value === null) return undefined
  const { id, title, tinyTitle, schedule, weekdays, plannedFor } = value as Record<string, unknown>
  if (typeof id !== 'string' || !id) return undefined
  const days =
    Array.isArray(weekdays) &&
    weekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      ? (weekdays as number[])
      : undefined
  return {
    id,
    ...(typeof title === 'string' ? { title } : {}),
    ...(typeof tinyTitle === 'string' ? { tinyTitle } : {}),
    ...(typeof schedule === 'string' && SCHEDULES.includes(schedule)
      ? { schedule: schedule as GoalSchedule }
      : {}),
    ...(days ? { weekdays: days } : {}),
    ...(typeof plannedFor === 'string' ? { plannedFor } : {}),
  }
}
