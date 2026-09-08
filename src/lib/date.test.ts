import { describe, expect, it } from 'vitest'
import type { Goal } from '../types'
import {
  addDaysToLocalDate,
  completionKey,
  isGoalDue,
  isGoalPlannedOn,
  isGoalSkipped,
  localDateToNoon,
  monthDates,
  recapWindow,
  retiredOnceGoalIds,
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

describe('retiring one-time goals', () => {
  it('retires a one-time goal completed on an earlier day', () => {
    const retired = retiredOnceGoalIds(
      [
        { goalId: 'tidy', localDate: '2026-09-01' },
        { goalId: 'water', localDate: '2026-09-05' },
      ],
      '2026-09-05',
    )
    // Completed yesterday: done with, and off Today.
    expect(retired.has('tidy')).toBe(true)
    // Completed today: still shown, so the day reads as finished rather than
    // having the goal vanish the moment it is ticked.
    expect(retired.has('water')).toBe(false)
  })

  it('builds a stable key for a goal on a day', () => {
    expect(completionKey('tidy', '2026-09-05')).toBe('tidy:2026-09-05')
  })
})

describe('the Moonlight recap window', () => {
  // Every case is built from local calendar fields, and the suite pins TZ to a
  // zone that observes daylight saving. An hour gate cannot be tested in UTC.
  const at = (
    year: number,
    monthIndex: number,
    day: number,
    hour: number,
    minute = 0,
  ) => recapWindow(new Date(year, monthIndex, day, hour, minute))

  it('stays shut before six in the evening', () => {
    expect(at(2026, 8, 8, 17, 59)).toEqual({ open: false, state: 'waiting' })
    expect(at(2026, 8, 8, 4)).toEqual({ open: false, state: 'waiting' })
    expect(at(2026, 8, 8, 11)).toEqual({ open: false, state: 'waiting' })
  })

  it('opens at six on the day being closed', () => {
    expect(at(2026, 8, 8, 18)).toEqual({
      open: true,
      targetDate: '2026-09-08',
      state: 'evening',
    })
    expect(at(2026, 8, 8, 23, 59)).toEqual({
      open: true,
      targetDate: '2026-09-08',
      state: 'evening',
    })
  })

  it('closes out yesterday during the after-midnight grace window', () => {
    // The point of the grace window: someone rounding out Tuesday at 1:15am is
    // on Wednesday by the calendar, and would otherwise spend Wednesday's
    // Moonlight on Tuesday and be able to collect again that evening.
    expect(at(2026, 8, 9, 0)).toEqual({
      open: true,
      targetDate: '2026-09-08',
      state: 'grace',
    })
    expect(at(2026, 8, 9, 1, 15)).toEqual({
      open: true,
      targetDate: '2026-09-08',
      state: 'grace',
    })
    expect(at(2026, 8, 9, 3, 59)).toEqual({
      open: true,
      targetDate: '2026-09-08',
      state: 'grace',
    })
  })

  it('steps back across month and year boundaries', () => {
    expect(at(2026, 2, 1, 0, 30).targetDate).toBe('2026-02-28')
    expect(at(2026, 0, 1, 0, 30).targetDate).toBe('2025-12-31')
    expect(at(2028, 2, 1, 0, 30).targetDate).toBe('2028-02-29')
  })

  it('survives both daylight-saving transitions', () => {
    // Spring forward: 2am-3am never happens, so the grace window is simply
    // shorter that night. The half of it that exists still closes yesterday.
    expect(at(2026, 2, 8, 1, 30)).toEqual({
      open: true,
      targetDate: '2026-03-07',
      state: 'grace',
    })
    expect(at(2026, 2, 8, 3, 30)).toEqual({
      open: true,
      targetDate: '2026-03-07',
      state: 'grace',
    })
    expect(at(2026, 2, 8, 18).targetDate).toBe('2026-03-08')

    // Fall back: 1am-2am happens twice. Both are inside the window and both
    // resolve to the same day, so the ledger cannot be claimed twice.
    expect(at(2026, 10, 1, 1, 30)).toEqual({
      open: true,
      targetDate: '2026-10-31',
      state: 'grace',
    })
    expect(at(2026, 10, 1, 18).targetDate).toBe('2026-11-01')
  })

  it('reports no target day while it is shut', () => {
    expect(at(2026, 8, 8, 12).targetDate).toBeUndefined()
  })
})
