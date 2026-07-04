import { describe, expect, it } from 'vitest'
import type { Goal } from '../types'
import {
  addDaysToLocalDate,
  isGoalDue,
  isGoalPlannedOn,
  isGoalSkipped,
  localDateToNoon,
  monthDates,
  toLocalDate,
} from './date'

const goal: Goal = {
  id: 'goal',
  title: 'Take a breath',
  schedule: 'weekdays',
  weekdays: [1, 3, 5],
  createdDate: '2026-03-01',
  archived: false,
}

describe('local calendar handling', () => {
  it('formats dates from local calendar fields', () => {
    expect(toLocalDate(new Date(2026, 2, 8, 0, 30))).toBe('2026-03-08')
  })

  it('parses a local date at noon to avoid DST midnight edge cases', () => {
    const parsed = localDateToNoon('2026-03-08')
    expect(parsed.getHours()).toBe(12)
    expect(toLocalDate(parsed)).toBe('2026-03-08')
  })

  it('runs selected-day goals only on their local weekdays', () => {
    expect(isGoalDue(goal, '2026-03-09')).toBe(true)
    expect(isGoalDue(goal, '2026-03-10')).toBe(false)
    expect(isGoalDue({ ...goal, archived: true }, '2026-03-09')).toBe(false)
  })

  it('hides snoozed goals until their wake date', () => {
    const snoozed = { ...goal, snoozedUntil: '2026-03-11' }
    expect(isGoalDue(snoozed, '2026-03-09')).toBe(false)
    expect(isGoalDue(snoozed, '2026-03-11')).toBe(true)
    expect(isGoalDue(snoozed, '2026-03-13')).toBe(true)
  })

  it('keeps planned one-time goals waiting for their day, then due until done', () => {
    const planned: Goal = {
      ...goal,
      schedule: 'once',
      weekdays: [],
      scheduledDate: '2026-03-20',
    }
    expect(isGoalDue(planned, '2026-03-10')).toBe(false)
    expect(isGoalDue(planned, '2026-03-20')).toBe(true)
    expect(isGoalDue(planned, '2026-03-22')).toBe(true)
    expect(isGoalPlannedOn(planned, '2026-03-20')).toBe(true)
    expect(isGoalPlannedOn(planned, '2026-03-21')).toBe(false)
  })

  it('tracks skipped days without affecting other dates', () => {
    const skipped = { ...goal, skippedDates: ['2026-03-09'] }
    expect(isGoalSkipped(skipped, '2026-03-09')).toBe(true)
    expect(isGoalSkipped(skipped, '2026-03-11')).toBe(false)
  })

  it('adds days across month boundaries in local time', () => {
    expect(addDaysToLocalDate('2026-03-31', 1)).toBe('2026-04-01')
    expect(addDaysToLocalDate('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('lists every date of a month', () => {
    const days = monthDates(2026, 1)
    expect(days).toHaveLength(28)
    expect(days[0]).toBe('2026-02-01')
    expect(days.at(-1)).toBe('2026-02-28')
  })
})
