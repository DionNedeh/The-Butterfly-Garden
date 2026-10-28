import { describe, expect, it } from 'vitest'
import type { MoodEntry } from '../types'
import { moodChoiceOf, moodFields, moodName, withMoodChoice } from './mood'

const entry = (overrides: Partial<MoodEntry> = {}): MoodEntry => ({
  id: 'm',
  localDate: '2026-10-26',
  level: 4,
  note: 'Calm',
  createdAt: '',
  updatedAt: '',
  ...overrides,
})

describe('a check-in answer', () => {
  it('reads "not sure" from its flag, and a level otherwise', () => {
    expect(moodChoiceOf(entry())).toBe(4)
    expect(moodChoiceOf(entry({ level: 3, unsure: true }))).toBe('unsure')
  })

  it('names each answer', () => {
    expect(moodName(1)).toBe('Stormy')
    expect(moodName(5)).toBe('Radiant')
    expect(moodName('unsure')).toBe('Not sure')
  })

  it('stores "not sure" at the middle level, so older builds read a neutral day', () => {
    expect(moodFields('unsure')).toEqual({ level: 3, unsure: true })
    expect(moodFields(2)).toEqual({ level: 2 })
  })

  it('rewrites an entry either way without a stale flag', () => {
    const unsure = withMoodChoice(entry(), 'unsure')
    expect(unsure).toMatchObject({ level: 3, unsure: true, note: 'Calm' })
    const sure = withMoodChoice(unsure, 5)
    expect(sure.level).toBe(5)
    expect('unsure' in sure).toBe(false)
  })
})
