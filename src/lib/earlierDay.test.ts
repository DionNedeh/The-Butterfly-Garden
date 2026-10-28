import { describe, expect, it } from 'vitest'
import type { AppState } from '../types'
import { earlierDayProblem, gardenStartDate } from './earlierDay'
import { createInitialState } from './progression'

// Tests run in New York (vite.config.ts): this is the evening of 1 October
// there, though it is already 2 October in UTC.
const PLANTED = new Date('2026-10-02T01:30:00.000Z')
const TODAY = '2026-10-27'

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Tester', 'Earlier', PLANTED), ...overrides }
}

const entry = (localDate: string) => ({
  id: localDate,
  localDate,
  createdAt: '',
  updatedAt: '',
})

describe('the garden’s first day', () => {
  it('is the local calendar day it was planted, not the UTC one', () => {
    expect(gardenStartDate(garden().profile)).toBe('2026-10-01')
  })

  it('is unknown without a garden, or with a date that cannot be read', () => {
    expect(gardenStartDate(undefined)).toBeUndefined()
    expect(gardenStartDate({ createdAt: 'sometime' })).toBeUndefined()
  })
})

describe('which days can take an entry written later', () => {
  it('takes any day from the garden’s first to yesterday', () => {
    expect(earlierDayProblem(garden(), '2026-10-01', 'check-in', TODAY)).toBeUndefined()
    expect(earlierDayProblem(garden(), '2026-10-26', 'reflection', TODAY)).toBeUndefined()
  })

  it('never today, nor a day still to come', () => {
    expect(earlierDayProblem(garden(), TODAY, 'check-in', TODAY)).toBe('not-yet-past')
    expect(earlierDayProblem(garden(), '2026-11-02', 'check-in', TODAY)).toBe('not-yet-past')
  })

  it('never before the garden began, nor when its first day is unknown', () => {
    expect(earlierDayProblem(garden(), '2026-09-30', 'check-in', TODAY)).toBe('before-garden')
    const unknown = garden()
    unknown.profile = { ...unknown.profile!, createdAt: 'sometime' }
    expect(earlierDayProblem(unknown, '2026-10-20', 'check-in', TODAY)).toBe('before-garden')
  })

  it('only a real calendar day', () => {
    expect(earlierDayProblem(garden(), '2026-02-30', 'check-in', TODAY)).toBe('not-a-day')
    expect(earlierDayProblem(garden(), '', 'reflection', TODAY)).toBe('not-a-day')
    expect(earlierDayProblem(garden(), '20261020', 'reflection', TODAY)).toBe('not-a-day')
  })

  it('one check-in and one reflection a day, each counted on its own', () => {
    const state = garden({
      moods: [{ ...entry('2026-10-20'), level: 3, note: '' }],
      reflections: [{ ...entry('2026-10-21'), promptId: 'free', body: 'Words' }],
    })
    expect(earlierDayProblem(state, '2026-10-20', 'check-in', TODAY)).toBe('already-written')
    expect(earlierDayProblem(state, '2026-10-20', 'reflection', TODAY)).toBeUndefined()
    expect(earlierDayProblem(state, '2026-10-21', 'reflection', TODAY)).toBe('already-written')
    expect(earlierDayProblem(state, '2026-10-21', 'check-in', TODAY)).toBeUndefined()
  })
})
