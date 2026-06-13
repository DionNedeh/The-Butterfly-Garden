import { describe, expect, it } from 'vitest'
import type { Goal } from '../types'
import { isGoalDue, localDateToNoon, toLocalDate } from './date'

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
})
