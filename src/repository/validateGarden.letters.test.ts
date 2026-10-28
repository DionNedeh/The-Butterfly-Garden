import { describe, expect, it } from 'vitest'
import { addDaysToLocalDate, toLocalDate } from '../lib/date'
import { createInitialState } from '../lib/progression'
import { validateGarden } from './validateGarden'

function garden(overrides: Record<string, unknown> = {}) {
  return { ...createInitialState('Tester', 'Test Garden'), ...overrides }
}

const seed = createInitialState('Tester', 'Test Garden')

/** The Sunday on or before a local date. */
function sundayOnOrBefore(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number)
  return addDaysToLocalDate(localDate, -new Date(year, month - 1, day, 12).getDay())
}

describe('stars on journal entries', () => {
  const check = (id: string, starred?: unknown) => ({
    id,
    localDate: '2026-10-20',
    level: 3,
    note: 'Words',
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    ...(starred === undefined ? {} : { starred }),
  })
  const reflection = (id: string, starred?: unknown) => ({
    id,
    localDate: '2026-10-20',
    promptId: 'free',
    body: 'Words',
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    ...(starred === undefined ? {} : { starred }),
  })

  it('keeps a star only when it is stored as true, and every entry with its words', () => {
    const odd = ['yes', false, 1, null, {}]
    const moods = [check('kept', true), check('plain'), ...odd.map((value, index) => check(`odd-${index}`, value))]
    const reflections = [
      reflection('kept', true),
      reflection('plain'),
      ...odd.map((value, index) => reflection(`odd-${index}`, value)),
    ]
    const result = validateGarden(garden({ moods, reflections }))
    expect(result.refused).toBeUndefined()
    // A dropped star is not damage: the entry itself is whole.
    expect(result.repaired).toBe(0)
    for (const entries of [result.state!.moods, result.state!.reflections]) {
      const [kept, ...rest] = entries
      expect(kept.starred).toBe(true)
      for (const entry of rest) expect(entry).not.toHaveProperty('starred')
      expect(entries).toHaveLength(moods.length)
    }
  })

  it('keeps a starred garden’s collections as they were, so nothing extra is written', () => {
    const clean = garden({
      moods: [check('kept', true), check('plain')],
      reflections: [reflection('kept', true)],
    })
    const result = validateGarden(clean)
    expect(result.state?.moods).toBe(clean.moods)
    expect(result.state?.reflections).toBe(clean.reflections)
  })

  it('checks a star and a written-later mark side by side', () => {
    const entry = { ...check('both', 'yes'), writtenLater: 'no' }
    const [checked] = validateGarden(garden({ moods: [entry] })).state!.moods
    expect(checked).not.toHaveProperty('starred')
    expect(checked).not.toHaveProperty('writtenLater')
    expect(checked.note).toBe('Words')
  })
})

describe('the last letter read', () => {
  const withProfile = (fields: Record<string, unknown>) =>
    validateGarden(garden({ profile: { ...seed.profile, ...fields } })).state!.profile!

  it('keeps a Sunday that has come', () => {
    const lastSunday = sundayOnOrBefore(toLocalDate())
    expect(withProfile({ lastLetterRead: '2026-10-25' }).lastLetterRead).toBe('2026-10-25')
    expect(withProfile({ lastLetterRead: lastSunday }).lastLetterRead).toBe(lastSunday)
  })

  it('drops any other day, a Sunday still to come, and anything that is not a date', () => {
    const nextSunday = addDaysToLocalDate(sundayOnOrBefore(toLocalDate()), 7)
    for (const value of ['2026-10-24', '2026-10-26', nextSunday, '2026-02-30', 'Sunday', 20261025, null, true]) {
      expect(withProfile({ lastLetterRead: value })).not.toHaveProperty('lastLetterRead')
    }
  })
})

describe('quoting in letters', () => {
  const withProfile = (fields: Record<string, unknown>) =>
    validateGarden(garden({ profile: { ...seed.profile, ...fields } })).state!.profile!

  it('keeps never, the one choice stored, and drops anything else', () => {
    expect(withProfile({ letterQuotes: 'never' }).letterQuotes).toBe('never')
    for (const value of ['starred', 'always', true, 0, null]) {
      expect(withProfile({ letterQuotes: value })).not.toHaveProperty('letterQuotes')
    }
    expect(withProfile({})).not.toHaveProperty('letterQuotes')
  })
})
