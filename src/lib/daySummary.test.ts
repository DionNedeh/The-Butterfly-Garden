import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance } from '../types'
import { describeDay } from './daySummary'
import { countedInWords, listed } from './plural'
import { createInitialState } from './progression'

const DAY = '2026-10-26'

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Robin', 'Words'), creatures: [], ...overrides }
}

function companion(name: string, careDates: string[]): CreatureInstance {
  return {
    ...createInitialState('Robin', 'Words').creatures[0],
    id: name,
    name,
    careDates: { caterpillar: careDates },
  }
}

const completion = (goalId: string) => ({
  id: `${goalId}:${DAY}`,
  goalId,
  localDate: DAY,
  completedAt: '',
})

describe('a day in words', () => {
  it('says what happened, in the order a day goes', () => {
    const state = garden({
      moods: [{ id: 'm', localDate: DAY, level: 3, note: '', createdAt: '', updatedAt: '' }],
      completions: [completion('a'), completion('b')],
      creatures: [companion('Sol', [DAY]), companion('Pip', ['2026-10-25'])],
    })
    expect(describeDay(state, DAY)).toBe('You checked in, finished two goals and cared for Sol.')
  })

  it('says when a breathing session was run to its end', () => {
    const award = { id: 'b', localDate: DAY, source: `breath:${DAY}`, awardedAt: '' }
    const state = garden({
      moods: [{ id: 'm', localDate: DAY, level: 3, note: '', createdAt: '', updatedAt: '' }],
      sunlight: [award],
    })
    expect(describeDay(state, DAY)).toBe('You checked in and took time to breathe.')
    // Yesterday's breathing is not today's.
    expect(describeDay(garden({ sunlight: [{ ...award, localDate: '2026-10-25', source: 'breath:2026-10-25' }] }), DAY)).toBe(
      'You made it to the end of the day, and that counts.',
    )
  })

  it('names two companions, and counts more', () => {
    const two = garden({ creatures: [companion('Sol', [DAY]), companion('Pip', [DAY])] })
    expect(describeDay(two, DAY)).toBe('You cared for Sol and Pip.')
    const three = garden({
      creatures: [companion('Sol', [DAY]), companion('Pip', [DAY]), companion('Fern', [DAY])],
    })
    expect(describeDay(three, DAY)).toBe('You cared for three companions.')
  })

  it('counts a reflection and a single goal', () => {
    const state = garden({
      reflections: [{ id: 'r', localDate: DAY, promptId: 'p', body: 'x', createdAt: '', updatedAt: '' }],
      completions: [completion('a')],
    })
    expect(describeDay(state, DAY)).toBe('You wrote a reflection and finished one goal.')
  })

  it('still counts a day with nothing in it', () => {
    expect(describeDay(garden(), DAY)).toBe('You made it to the end of the day, and that counts.')
  })
})

describe('counting in words', () => {
  it('uses words up to ten and digits after', () => {
    expect(countedInWords(0, 'goal', 'goals')).toBe('no goals')
    expect(countedInWords(1, 'goal', 'goals')).toBe('one goal')
    expect(countedInWords(10, 'goal', 'goals')).toBe('ten goals')
    expect(countedInWords(12, 'goal', 'goals')).toBe('12 goals')
  })

  it('joins a list the way a sentence does', () => {
    expect(listed([])).toBe('')
    expect(listed(['a'])).toBe('a')
    expect(listed(['a', 'b'])).toBe('a and b')
    expect(listed(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

describe('an entry written later for the day', () => {
  it('is not something done that day, so the day is not said to have it', () => {
    const later = { createdAt: '', updatedAt: '', writtenLater: true as const }
    const state = garden({
      moods: [{ ...later, id: 'm', localDate: DAY, level: 3, note: '' }],
      reflections: [{ ...later, id: 'r', localDate: DAY, promptId: 'free', body: 'Words' }],
    })
    expect(describeDay(state, DAY)).toBe('You made it to the end of the day, and that counts.')
  })
})
