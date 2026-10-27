import { describe, expect, it } from 'vitest'
import type { MoodEntry, RecapEntry, ReflectionEntry } from '../types'
import type { JournalDays } from './journalSearch'
import { FIRST_LINE_LENGTH, onThisDay, sameDateBack } from './onThisDay'

function mood(localDate: string, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 4,
    note: '',
    createdAt: `${localDate}T09:00:00.000Z`,
    updatedAt: `${localDate}T09:00:00.000Z`,
    ...overrides,
  }
}

function reflection(localDate: string, body: string): ReflectionEntry {
  return {
    id: `reflection-${localDate}`,
    localDate,
    promptId: 'notice',
    body,
    createdAt: `${localDate}T21:00:00.000Z`,
    updatedAt: `${localDate}T21:00:00.000Z`,
  }
}

function recap(localDate: string, overrides: Partial<RecapEntry> = {}): RecapEntry {
  return {
    id: `recap-${localDate}`,
    localDate,
    wentWell: '',
    settingDown: '',
    forTomorrow: '',
    createdAt: `${localDate}T22:00:00.000Z`,
    updatedAt: `${localDate}T22:00:00.000Z`,
    ...overrides,
  }
}

function journal({
  moods = [],
  reflections = [],
  recaps = [],
}: {
  moods?: MoodEntry[]
  reflections?: ReflectionEntry[]
  recaps?: RecapEntry[]
}): JournalDays {
  return {
    moodByDate: new Map(moods.map((entry) => [entry.localDate, entry])),
    reflectionByDate: new Map(reflections.map((entry) => [entry.localDate, entry])),
    recapByDate: new Map(recaps.map((entry) => [entry.localDate, entry])),
  }
}

const OLD_GARDEN = '2020-01-01'

describe('the same date, back in time', () => {
  it('steps back by calendar months, across a year', () => {
    expect(sameDateBack('2026-10-27', 1)).toBe('2026-09-27')
    expect(sameDateBack('2026-01-15', 1)).toBe('2025-12-15')
    expect(sameDateBack('2026-10-27', 12)).toBe('2025-10-27')
  })

  it('has no month ago for a date the month before does not have', () => {
    expect(sameDateBack('2026-10-31', 1)).toBeUndefined()
    expect(sameDateBack('2026-03-29', 1)).toBeUndefined()
    expect(sameDateBack('2026-03-31', 1)).toBeUndefined()
    // A leap year's February has the 29th.
    expect(sameDateBack('2028-03-29', 1)).toBe('2028-02-29')
    expect(sameDateBack('2028-03-30', 1)).toBeUndefined()
  })

  it('has no year ago for 29 February, since last year had none', () => {
    expect(sameDateBack('2028-02-29', 12)).toBeUndefined()
    // …and a leap day four years on finds its twin.
    expect(sameDateBack('2028-02-29', 48)).toBe('2024-02-29')
  })
})

describe('on this day', () => {
  it('offers the day a year ago, with its weather and the first line of its words', () => {
    const offered = onThisDay(
      journal({ moods: [mood('2025-10-27', { level: 2, note: 'Rain all day.\nA long bath.' })] }),
      '2026-10-27',
      OLD_GARDEN,
    )
    expect(offered).toEqual({
      span: 'year',
      localDate: '2025-10-27',
      weather: 2,
      firstLine: 'Rain all day.',
    })
  })

  it('offers the day a month ago when there is nothing from a year ago', () => {
    const offered = onThisDay(
      journal({ reflections: [reflection('2026-09-27', '\n  The light on the wall.  ')] }),
      '2026-10-27',
      OLD_GARDEN,
    )
    expect(offered).toEqual({
      span: 'month',
      localDate: '2026-09-27',
      firstLine: 'The light on the wall.',
    })
  })

  it('prefers the year when both have an entry', () => {
    const days = journal({ moods: [mood('2025-10-27'), mood('2026-09-27')] })
    expect(onThisDay(days, '2026-10-27', OLD_GARDEN)?.span).toBe('year')
  })

  it('says nothing for a day with no entry a month or a year back', () => {
    const days = journal({ moods: [mood('2026-09-26'), mood('2025-10-28')] })
    expect(onThisDay(days, '2026-10-27', OLD_GARDEN)).toBeUndefined()
    expect(onThisDay(journal({}), '2026-10-27', OLD_GARDEN)).toBeUndefined()
  })

  it('has no month ago on the 31st after a 30-day month', () => {
    // 31 September does not exist; 30 September is not "a month ago today".
    const days = journal({ moods: [mood('2026-09-30'), mood('2026-10-01')] })
    expect(onThisDay(days, '2026-10-31', OLD_GARDEN)).toBeUndefined()
  })

  it('maps 29 February a year back to nothing, and offers its month instead', () => {
    const days = journal({
      moods: [mood('2027-02-28'), mood('2027-03-01'), mood('2028-01-29', { note: 'Snow.' })],
    })
    expect(onThisDay(days, '2028-02-29', OLD_GARDEN)).toEqual({
      span: 'month',
      localDate: '2028-01-29',
      weather: 4,
      firstLine: 'Snow.',
    })
  })

  it('never offers a leap day as a year ago on the 28th or the 1st', () => {
    const days = journal({ moods: [mood('2024-02-29', { note: 'Leap day.' })] })
    expect(onThisDay(days, '2025-02-28', OLD_GARDEN)).toBeUndefined()
    expect(onThisDay(days, '2025-03-01', OLD_GARDEN)).toBeUndefined()
    // It comes back a month on.
    expect(onThisDay(days, '2024-03-29', OLD_GARDEN)?.localDate).toBe('2024-02-29')
  })

  it('stays quiet through the garden’s first month', () => {
    // Entries older than the garden come only from a restored or edited
    // backup, but the first month is quiet whatever the journal holds.
    const days = journal({ moods: [mood('2026-01-27'), mood('2026-01-28')] })
    expect(onThisDay(days, '2026-02-27', '2026-01-28')).toBeUndefined()
    // A month old on the same date a month on…
    expect(onThisDay(days, '2026-02-27', '2026-01-27')?.localDate).toBe('2026-01-27')
    // …or, planted on the 31st, on the last day of a shorter month.
    expect(onThisDay(days, '2026-02-27', '2026-01-31')).toBeUndefined()
    expect(onThisDay(days, '2026-02-28', '2026-01-31')?.localDate).toBe('2026-01-28')
    // A garden whose first day is unknown is treated as an old one.
    expect(onThisDay(days, '2026-02-28')?.localDate).toBe('2026-01-28')
  })

  it('reads a recap’s evening weather and its first answer when that is all there is', () => {
    const days = journal({
      recaps: [recap('2026-09-27', { level: 5, settingDown: 'The email.', forTomorrow: 'Rest' })],
    })
    expect(onThisDay(days, '2026-10-27', OLD_GARDEN)).toEqual({
      span: 'month',
      localDate: '2026-09-27',
      weather: 5,
      firstLine: 'The email.',
    })
  })

  it('offers a day with no words, as it was', () => {
    const days = journal({ moods: [mood('2026-09-27', { level: 3, unsure: true })], recaps: [recap('2026-09-27')] })
    expect(onThisDay(days, '2026-10-27', OLD_GARDEN)).toEqual({
      span: 'month',
      localDate: '2026-09-27',
      weather: 'unsure',
    })
  })

  it('shortens a long first line at a word, and never splits an emoji', () => {
    const long = `${'word '.repeat(40)}end`
    const line = onThisDay(
      journal({ moods: [mood('2026-09-27', { note: long })] }),
      '2026-10-27',
      OLD_GARDEN,
    )?.firstLine
    expect(line?.endsWith('word…')).toBe(true)
    expect(Array.from(line ?? '').length).toBeLessThanOrEqual(FIRST_LINE_LENGTH + 1)

    const emoji = '🌼'.repeat(FIRST_LINE_LENGTH + 5)
    const flowers = onThisDay(
      journal({ moods: [mood('2026-09-27', { note: emoji })] }),
      '2026-10-27',
      OLD_GARDEN,
    )?.firstLine
    expect(flowers).toBe(`${'🌼'.repeat(FIRST_LINE_LENGTH)}…`)
  })
})
