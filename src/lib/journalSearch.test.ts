import { describe, expect, it, vi } from 'vitest'
import type { MoodEntry, RecapEntry, ReflectionEntry } from '../types'
import {
  EMPTY_FILTER,
  filterJournalDates,
  indexJournalText,
  isFilterActive,
  JOURNAL_KINDS,
  type JournalDays,
  type JournalFilter,
} from './journalSearch'
import { normaliseForSearch } from './searchText'

function mood(localDate: string, note: string, overrides: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 4,
    note,
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
}): { days: JournalDays; dates: string[] } {
  const days: JournalDays = {
    moodByDate: new Map(moods.map((entry) => [entry.localDate, entry])),
    reflectionByDate: new Map(reflections.map((entry) => [entry.localDate, entry])),
    recapByDate: new Map(recaps.map((entry) => [entry.localDate, entry])),
  }
  // Newest first, the way the timeline orders them.
  const dates = Array.from(
    new Set([...days.moodByDate.keys(), ...days.reflectionByDate.keys(), ...days.recapByDate.keys()]),
  ).sort((a, b) => b.localeCompare(a))
  return { days, dates }
}

function filter(overrides: Partial<JournalFilter>): JournalFilter {
  return { ...EMPTY_FILTER, ...overrides }
}

/** Runs a filter both ways, with and without the index, and checks they agree. */
function find(garden: { days: JournalDays; dates: string[] }, search: JournalFilter): string[] {
  const plain = filterJournalDates(garden.dates, garden.days, search)
  const indexed = filterJournalDates(garden.dates, garden.days, search, indexJournalText(garden.days))
  expect(indexed).toEqual(plain)
  return plain
}

const garden = journal({
  moods: [
    mood('2026-03-01', 'Walked by the river'),
    mood('2026-03-02', 'Tired but okay', { level: 2 }),
    mood('2026-03-03', 'Not sure what today is', { level: 3, unsure: true }),
    mood('2026-03-04', 'A middling sort of day', { level: 3 }),
  ],
  reflections: [
    reflection('2026-03-02', 'The river was loud after the rain.'),
    reflection('2026-03-05', 'Wrote to my sister.'),
  ],
  recaps: [
    recap('2026-03-01', { wentWell: 'Lunch outside', settingDown: 'The email', forTomorrow: 'Call the dentist' }),
    recap('2026-03-06', { forTomorrow: 'Water the basil\nBook the train' }),
  ],
})

describe('normaliseForSearch', () => {
  it('lower-cases and takes accents off', () => {
    expect(normaliseForSearch('Café CRÈME brûlée')).toBe('cafe creme brulee')
    expect(normaliseForSearch('Ångström Øre naïve')).toBe('angstrom øre naive')
  })

  it('folds compatibility forms into ordinary letters', () => {
    expect(normaliseForSearch('ﬁne ＡＢＣ')).toBe('fine abc')
  })

  it('reads curly quotes as straight ones', () => {
    expect(normaliseForSearch('Don’t “worry”')).toBe('don\'t "worry"')
  })

  it('collapses and trims whitespace, line breaks included', () => {
    expect(normaliseForSearch('  one\n\ttwo   three  ')).toBe('one two three')
    expect(normaliseForSearch('   ')).toBe('')
  })
})

describe('isFilterActive', () => {
  it('is off for the empty filter and a blank query', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
    expect(isFilterActive(filter({ query: '   ' }))).toBe(false)
  })

  it('is on for words, a kind, or a weather', () => {
    expect(isFilterActive(filter({ query: 'river' }))).toBe(true)
    expect(isFilterActive(filter({ kinds: ['recap'] }))).toBe(true)
    expect(isFilterActive(filter({ weather: 'unsure' }))).toBe(true)
  })
})

describe('filterJournalDates', () => {
  it('keeps every day, in the order given, when nothing is asked', () => {
    expect(find(garden, EMPTY_FILTER)).toEqual(garden.dates)
    const oldestFirst = [...garden.dates].reverse()
    expect(filterJournalDates(oldestFirst, garden.days, EMPTY_FILTER)).toEqual(oldestFirst)
  })

  it('drops a date that has no entry at all', () => {
    expect(filterJournalDates(['2026-01-01', '2026-03-05'], garden.days, EMPTY_FILTER)).toEqual([
      '2026-03-05',
    ])
  })

  it('finds words wherever they are, ignoring case and accents', () => {
    expect(find(garden, filter({ query: 'RIVER' }))).toEqual(['2026-03-02', '2026-03-01'])
    const accented = journal({ moods: [mood('2026-04-01', 'Coffee at the café')] })
    expect(find(accented, filter({ query: 'cafe' }))).toEqual(['2026-04-01'])
    expect(find(accented, filter({ query: 'CAFÉ' }))).toEqual(['2026-04-01'])
  })

  it('needs every word, but lets them sit in different entries of the day', () => {
    // "river" is in the check-in note, "dentist" in the recap.
    expect(find(garden, filter({ query: 'river dentist' }))).toEqual(['2026-03-01'])
    expect(find(garden, filter({ query: '  dentist   river ' }))).toEqual(['2026-03-01'])
    expect(find(garden, filter({ query: 'river sister' }))).toEqual([])
  })

  it('matches part of a word', () => {
    expect(find(garden, filter({ query: 'dent' }))).toEqual(['2026-03-01'])
  })

  it('searches every recap answer, and every line of tomorrow', () => {
    expect(find(garden, filter({ query: 'lunch' }))).toEqual(['2026-03-01'])
    expect(find(garden, filter({ query: 'email' }))).toEqual(['2026-03-01'])
    expect(find(garden, filter({ query: 'train' }))).toEqual(['2026-03-06'])
  })

  it('does not let a word run from one recap answer into the next', () => {
    const split = journal({ recaps: [recap('2026-04-01', { wentWell: 'sun', settingDown: 'flower' })] })
    expect(find(split, filter({ query: 'sunflower' }))).toEqual([])
  })

  it('treats a blank query as no words', () => {
    expect(find(garden, filter({ query: ' \n ' }))).toEqual(garden.dates)
  })

  it('keeps only days with an entry of a chosen kind', () => {
    expect(find(garden, filter({ kinds: ['reflection'] }))).toEqual(['2026-03-05', '2026-03-02'])
    expect(find(garden, filter({ kinds: ['recap'] }))).toEqual(['2026-03-06', '2026-03-01'])
    expect(find(garden, filter({ kinds: ['check-in'] }))).toEqual([
      '2026-03-04',
      '2026-03-03',
      '2026-03-02',
      '2026-03-01',
    ])
    expect(find(garden, filter({ kinds: ['reflection', 'recap'] }))).toEqual([
      '2026-03-06',
      '2026-03-05',
      '2026-03-02',
      '2026-03-01',
    ])
    expect(find(garden, filter({ kinds: [...JOURNAL_KINDS] }))).toEqual(garden.dates)
  })

  it('looks for words only in the kinds chosen', () => {
    // "river" is in the 1st's check-in and the 2nd's reflection.
    expect(find(garden, filter({ query: 'river', kinds: ['reflection'] }))).toEqual(['2026-03-02'])
    expect(find(garden, filter({ query: 'river', kinds: ['check-in'] }))).toEqual(['2026-03-01'])
    expect(find(garden, filter({ query: 'river', kinds: ['recap'] }))).toEqual([])
    // Both words have to be in the chosen kinds, not just somewhere that day.
    expect(find(garden, filter({ query: 'river dentist', kinds: ['check-in'] }))).toEqual([])
    expect(find(garden, filter({ query: 'river dentist', kinds: ['check-in', 'recap'] }))).toEqual([
      '2026-03-01',
    ])
  })

  it("filters by the day's check-in weather", () => {
    expect(find(garden, filter({ weather: 4 }))).toEqual(['2026-03-01'])
    expect(find(garden, filter({ weather: 2 }))).toEqual(['2026-03-02'])
    expect(find(garden, filter({ weather: 5 }))).toEqual([])
    // A day without a check-in has no weather to match.
    expect(find(garden, filter({ weather: 4, kinds: ['reflection'] }))).toEqual([])
    expect(find(garden, filter({ weather: 2, kinds: ['reflection'] }))).toEqual(['2026-03-02'])
  })

  it('keeps "Not sure" apart from the middle weather it is stored with', () => {
    expect(find(garden, filter({ weather: 'unsure' }))).toEqual(['2026-03-03'])
    expect(find(garden, filter({ weather: 3 }))).toEqual(['2026-03-04'])
  })

  it('combines words, kinds and weather', () => {
    expect(find(garden, filter({ query: 'rain', kinds: ['reflection'], weather: 2 }))).toEqual([
      '2026-03-02',
    ])
    expect(find(garden, filter({ query: 'rain', kinds: ['reflection'], weather: 4 }))).toEqual([])
  })

  it('finds a check-in by its feelings and energy, in the words the journal shows', () => {
    const tagged = journal({
      moods: [
        mood('2026-04-01', 'Long day', { level: 2, feelings: ['hopeful', 'tired'], energy: 'low' }),
        mood('2026-04-02', '', { feelings: ['calm'] }),
        mood('2026-04-03', 'Hopeful about the weekend'),
      ],
      reflections: [reflection('2026-04-04', 'Felt hopeful')],
    })
    expect(find(tagged, filter({ query: 'hopeful' }))).toEqual([
      '2026-04-04',
      '2026-04-03',
      '2026-04-01',
    ])
    expect(find(tagged, filter({ query: 'energy low' }))).toEqual(['2026-04-01'])
    expect(find(tagged, filter({ query: 'calm' }))).toEqual(['2026-04-02'])
    // The filters work as they did: feelings belong to the check-in.
    expect(find(tagged, filter({ query: 'hopeful', kinds: ['check-in'] }))).toEqual([
      '2026-04-03',
      '2026-04-01',
    ])
    expect(find(tagged, filter({ query: 'hopeful', weather: 2 }))).toEqual(['2026-04-01'])
    expect(find(tagged, filter({ query: 'tired', kinds: ['reflection'] }))).toEqual([])
  })

  it('does not let a word run from a note into its feelings', () => {
    const tagged = journal({ moods: [mood('2026-04-01', 'Felt', { feelings: ['tired'] })] })
    expect(find(tagged, filter({ query: 'feltfeeling' }))).toEqual([])
  })

  it('searches an empty note without trouble', () => {
    const quiet = journal({ moods: [mood('2026-04-01', '')] })
    expect(find(quiet, filter({ query: 'anything' }))).toEqual([])
    expect(find(quiet, filter({ weather: 4 }))).toEqual(['2026-04-01'])
  })

  it('falls back to the entries for a day the index has not caught up with', () => {
    const before = journal({ moods: [mood('2026-04-01', 'Old words')] })
    const index = indexJournalText(before.days)
    const after = journal({
      moods: [mood('2026-04-01', 'Old words'), mood('2026-04-02', 'New words')],
    })
    expect(filterJournalDates(after.dates, after.days, filter({ query: 'new' }), index)).toEqual([
      '2026-04-02',
    ])
  })

  it('normalises each day once per search, however many words', () => {
    const normalize = vi.spyOn(String.prototype, 'normalize')
    try {
      filterJournalDates(garden.dates, garden.days, filter({ query: 'the river was loud' }))
      // One for the query, then one per entry: four check-ins, two
      // reflections and two recaps. Not one per entry per word.
      expect(normalize).toHaveBeenCalledTimes(1 + 8)

      normalize.mockClear()
      filterJournalDates(garden.dates, garden.days, filter({ query: 'river loud', kinds: ['reflection'] }))
      // Only the kinds asked for are normalised.
      expect(normalize).toHaveBeenCalledTimes(1 + 2)
    } finally {
      normalize.mockRestore()
    }
  })

  it('normalises only the query while typing over an index', () => {
    const moods: MoodEntry[] = []
    const reflections: ReflectionEntry[] = []
    const start = Date.UTC(2020, 0, 1)
    for (let day = 0; day < 3650; day += 1) {
      const localDate = new Date(start + day * 86_400_000).toISOString().slice(0, 10)
      moods.push(mood(localDate, `Morning ${day} by the window, feeling steady`))
      reflections.push(reflection(localDate, `Evening ${day}: about the day`))
    }
    const years = journal({ moods, reflections })
    const index = indexJournalText(years.days)
    expect(index.size).toBe(3650)

    const normalize = vi.spyOn(String.prototype, 'normalize')
    try {
      const keystrokes = ['w', 'wi', 'win', 'wind', 'windo', 'window 1234']
      let found: string[] = []
      for (const query of keystrokes) {
        found = filterJournalDates(years.dates, years.days, filter({ query }), index)
      }
      expect(normalize).toHaveBeenCalledTimes(keystrokes.length)
      expect(found.map((date) => years.days.moodByDate.get(date)?.note)).toEqual([
        'Morning 1234 by the window, feeling steady',
      ])
    } finally {
      normalize.mockRestore()
    }
  })
})

describe('indexJournalText', () => {
  it('holds each day’s writing by kind, normalised, and nothing for a missing kind', () => {
    const index = indexJournalText(garden.days)
    expect(index.size).toBe(garden.dates.length)
    expect(index.get('2026-03-01')).toEqual({
      'check-in': 'walked by the river',
      recap: 'lunch outside the email call the dentist',
    })
    expect(index.get('2026-03-05')).toEqual({ reflection: 'wrote to my sister.' })
    expect(index.get('2026-03-06')).toEqual({ recap: 'water the basil book the train' })
  })
})

describe('normalising for search, beyond Latin accents', () => {
  it('folds fancy-font capitals and the sharp s', () => {
    expect(normaliseForSearch('𝐇𝐞𝐥𝐥𝐨 ℍappy')).toBe('hello happy')
    expect(normaliseForSearch('Straße')).toBe(normaliseForSearch('STRASSE'))
  })

  it('keeps the marks that are part of a letter in other scripts', () => {
    expect(normaliseForSearch('がっこう')).not.toBe(normaliseForSearch('かっこう'))
    expect(normaliseForSearch('किला')).not.toBe(normaliseForSearch('कल'))
    // Latin accents still go.
    expect(normaliseForSearch('Café río')).toBe('cafe rio')
  })
})
