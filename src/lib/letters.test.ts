import { describe, expect, it } from 'vitest'
import type { AppState, MoodEntry, ReflectionEntry } from '../types'
import {
  isSunday,
  letterQuotesOf,
  readLetter,
  setLetterQuotes,
  setStarred,
} from './letters'
import { createInitialState } from './progression'

function garden(extra: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Robin', 'Letters', new Date(2026, 8, 1, 9)), ...extra }
}

const mood: MoodEntry = {
  id: 'mood-1',
  localDate: '2026-10-21',
  level: 4,
  note: 'The light on the river after work',
  createdAt: '2026-10-21T18:00:00.000Z',
  updatedAt: '2026-10-21T18:00:00.000Z',
}

const reflection: ReflectionEntry = {
  id: 'reflection-1',
  localDate: '2026-10-22',
  promptId: 'notice',
  body: 'A kind word from a stranger',
  createdAt: '2026-10-22T21:00:00.000Z',
  updatedAt: '2026-10-22T21:00:00.000Z',
}

describe('isSunday', () => {
  it('knows a Sunday from any other day, and a date from anything else', () => {
    expect(isSunday('2026-10-25')).toBe(true)
    expect(isSunday('2026-11-01')).toBe(true)
    expect(isSunday('2026-10-26')).toBe(false)
    expect(isSunday('2026-10-24')).toBe(false)
    expect(isSunday('2026-02-30')).toBe(false)
    expect(isSunday(20261025)).toBe(false)
    expect(isSunday(undefined)).toBe(false)
  })
})

describe('reading a letter', () => {
  it('keeps the Sunday of the newest letter read', () => {
    const read = readLetter(garden(), '2026-10-25')
    expect(read.profile?.lastLetterRead).toBe('2026-10-25')
  })

  it('never moves back, and hands back the same garden when nothing changes', () => {
    const read = readLetter(garden(), '2026-10-25')
    expect(readLetter(read, '2026-10-25')).toBe(read)
    // An older letter read again changes nothing.
    expect(readLetter(read, '2026-10-18')).toBe(read)
    expect(readLetter(read, '2026-11-01').profile?.lastLetterRead).toBe('2026-11-01')
  })

  it('ignores a day that is not a Sunday, and a garden with no profile', () => {
    const before = garden()
    expect(readLetter(before, '2026-10-24')).toBe(before)
    expect(readLetter(before, 'soon')).toBe(before)
    const empty = { ...before, profile: undefined }
    expect(readLetter(empty, '2026-10-25')).toBe(empty)
  })

  it('does not change the garden it was given', () => {
    const before = garden()
    readLetter(before, '2026-10-25')
    expect(before.profile?.lastLetterRead).toBeUndefined()
  })
})

describe('quoting in letters', () => {
  it('quotes starred lines unless the gardener chose never', () => {
    expect(letterQuotesOf(undefined)).toBe('starred')
    expect(letterQuotesOf(garden().profile)).toBe('starred')
    expect(letterQuotesOf({ letterQuotes: 'never' })).toBe('never')
  })

  it('stores only never, and the default as nothing at all', () => {
    const never = setLetterQuotes(garden(), 'never')
    expect(never.profile?.letterQuotes).toBe('never')
    expect(setLetterQuotes(never, 'never')).toBe(never)
    const back = setLetterQuotes(never, 'starred')
    expect(back.profile).not.toHaveProperty('letterQuotes')
    expect(setLetterQuotes(back, 'starred')).toBe(back)
    const empty = { ...garden(), profile: undefined }
    expect(setLetterQuotes(empty, 'never')).toBe(empty)
  })
})

describe('starring a line', () => {
  it('stars a check-in and a reflection, leaving their words and times alone', () => {
    const before = garden({ moods: [mood], reflections: [reflection] })
    const starred = setStarred(
      setStarred(before, 'check-in', 'mood-1', true),
      'reflection',
      'reflection-1',
      true,
    )
    expect(starred.moods[0]).toEqual({ ...mood, starred: true })
    expect(starred.reflections[0]).toEqual({ ...reflection, starred: true })
    // Nothing else is replaced.
    expect(starred.goals).toBe(before.goals)
    expect(before.moods[0]).not.toHaveProperty('starred')
  })

  it('takes a star away by leaving no field behind', () => {
    const starred = garden({ moods: [{ ...mood, starred: true }] })
    const unstarred = setStarred(starred, 'check-in', 'mood-1', false)
    expect(unstarred.moods[0]).toEqual(mood)
    expect(unstarred.moods[0]).not.toHaveProperty('starred')
  })

  it('hands back the same garden when nothing changes or there is no such entry', () => {
    const before = garden({ moods: [{ ...mood, starred: true }], reflections: [reflection] })
    expect(setStarred(before, 'check-in', 'mood-1', true)).toBe(before)
    expect(setStarred(before, 'reflection', 'reflection-1', false)).toBe(before)
    expect(setStarred(before, 'check-in', 'nobody', true)).toBe(before)
    // A check-in's id is not a reflection's.
    expect(setStarred(before, 'reflection', 'mood-1', true)).toBe(before)
  })
})
