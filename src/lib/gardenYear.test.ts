import { describe, expect, it } from 'vitest'
import type {
  AppState,
  CreatureInstance,
  MoodEntry,
  RecapEntry,
  ReflectionEntry,
  SunlightAward,
} from '../types'
import {
  gardenYear,
  postcardButterflies,
  POSTCARD_BUTTERFLIES,
  turningYear,
  YEAR_LINES,
  yearInWords,
  yearRange,
  yearsToLookBack,
  type GardenYear,
} from './gardenYear'
import { createInitialState } from './progression'

// The tests run in New York (vite.config.ts), five hours behind Greenwich in
// winter: late on 31 December there is already 1 January in UTC.

/** A garden begun in March 2025, with its starter caterpillar welcomed then. */
function garden(extra: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Robin', 'Quiet Corner', new Date(2025, 2, 1, 9)), ...extra }
}

function mood(localDate: string, extra: Partial<MoodEntry> = {}): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 3,
    note: '',
    createdAt: `${localDate}T16:00:00.000Z`,
    updatedAt: `${localDate}T16:00:00.000Z`,
    ...extra,
  }
}

function reflection(localDate: string, extra: Partial<ReflectionEntry> = {}): ReflectionEntry {
  return {
    id: `reflection-${localDate}`,
    localDate,
    promptId: 'notice',
    body: 'Something noticed',
    createdAt: `${localDate}T21:00:00.000Z`,
    updatedAt: `${localDate}T21:00:00.000Z`,
    ...extra,
  }
}

function recap(localDate: string): RecapEntry {
  return {
    id: `recap-${localDate}`,
    localDate,
    wentWell: '',
    settingDown: '',
    forTomorrow: '',
    createdAt: `${localDate}T23:00:00.000Z`,
    updatedAt: `${localDate}T23:00:00.000Z`,
  }
}

function sunlight(localDate: string, source = 'mood'): SunlightAward {
  return { id: `${source}-${localDate}`, localDate, source, awardedAt: `${localDate}T15:00:00.000Z` }
}

function creature(name: string, extra: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: `creature-${name}`,
    speciesId: 'red-admiral',
    name,
    stage: 'egg',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: new Date(2025, 4, 1, 9).toISOString(),
    ...extra,
  }
}

/** Nothing in it at all. */
const EMPTY: GardenYear = {
  year: 2026,
  checkIns: 0,
  reflections: 0,
  evenings: 0,
  daysCaredFor: 0,
  speciesWelcomed: [],
  emerged: [],
  lines: [],
}

describe('the year’s days', () => {
  it('run from 1 January to 31 December of a year gone', () => {
    expect(yearRange(2025, '2026-10-27')).toEqual({ first: '2025-01-01', last: '2025-12-31' })
  })

  it('run only as far as today in the year under way', () => {
    expect(yearRange(2026, '2026-10-27')).toEqual({ first: '2026-01-01', last: '2026-10-27' })
  })
})

describe('what a year held', () => {
  it('counts the year’s days by the gardener’s own calendar, and none either side', () => {
    const state = garden({
      moods: [
        mood('2025-12-31'),
        mood('2026-01-01'),
        mood('2026-03-04'),
        // Written later for a day of the year: it belongs to that day.
        mood('2026-03-05', { writtenLater: true, createdAt: '2027-01-02T12:00:00.000Z' }),
        mood('2026-12-31'),
        mood('2027-01-01'),
      ],
      reflections: [reflection('2025-12-31'), reflection('2026-06-01'), reflection('2027-01-01')],
      // One evening closed twice over (a recap and its Moonlight) is one evening.
      recaps: [recap('2026-02-02'), recap('2026-02-03')],
      moonlight: [
        { id: 'm1', localDate: '2026-02-02', awardedAt: '2026-02-02T23:00:00.000Z' },
        { id: 'm2', localDate: '2027-01-01', awardedAt: '2027-01-01T23:00:00.000Z' },
      ],
    })
    expect(gardenYear(state, 2026, '2027-01-15')).toMatchObject({
      year: 2026,
      checkIns: 4,
      reflections: 1,
      evenings: 2,
    })
  })

  it('counts days cared for as the rhythm does: a day with any Sunlight, once', () => {
    const state = garden({
      sunlight: [
        sunlight('2025-12-31'),
        sunlight('2026-01-01'),
        sunlight('2026-01-01', 'goal'),
        sunlight('2026-08-08', 'breath'),
        sunlight('2027-01-01'),
      ],
    })
    expect(gardenYear(state, 2026, '2027-01-15').daysCaredFor).toBe(2)
  })

  it('leaves out anything dated after today in the year under way', () => {
    const state = garden({ moods: [mood('2026-10-27'), mood('2026-11-30')] })
    expect(gardenYear(state, 2026, '2026-10-27').checkIns).toBe(1)
  })

  it('names each species welcomed once, and who emerged, by their local day', () => {
    const state = garden({
      creatures: [
        // Late on New Year's Eve here, already 1 January in Greenwich.
        creature('Fern', { discoveredAt: new Date(2026, 11, 31, 23, 30).toISOString() }),
        creature('Wren', { discoveredAt: new Date(2026, 5, 1, 9).toISOString() }),
        creature('Ivy', {
          speciesId: 'painted-lady',
          discoveredAt: new Date(2026, 6, 1, 9).toISOString(),
        }),
        // Just after midnight: the next year's.
        creature('Moss', {
          speciesId: 'cabbage-white',
          discoveredAt: new Date(2027, 0, 1, 0, 30).toISOString(),
        }),
        creature('Sol', {
          speciesId: 'monarch',
          stage: 'butterfly',
          emergedAt: new Date(2026, 11, 31, 22).toISOString(),
        }),
        creature('Ash', {
          stage: 'butterfly',
          emergedAt: new Date(2027, 0, 1, 1).toISOString(),
        }),
      ],
    })
    const year = gardenYear(state, 2026, '2027-01-15')
    expect(year.speciesWelcomed).toEqual(['Red Admiral', 'Painted Lady'])
    expect(year.emerged).toEqual([{ name: 'Sol', speciesName: 'Monarch' }])
    const next = gardenYear(state, 2027, '2027-01-15')
    expect(next.speciesWelcomed).toEqual(['Cabbage White'])
    expect(next.emerged).toEqual([{ name: 'Ash', speciesName: 'Red Admiral' }])
  })

  it('is empty, and says so kindly, for a year with nothing in it', () => {
    const year = gardenYear(garden({ creatures: [] }), 2026, '2026-10-27')
    expect(year).toEqual(EMPTY)
    expect(yearInWords(year, true)).toEqual({
      journal:
        'A quiet year in the journal. Nothing was asked of it, and the garden kept your place.',
      garden: ['No new arrivals this year. Marigold kept the garden company.'],
    })
  })
})

describe('the gardener’s own lines', () => {
  const state = garden({
    moods: [
      mood('2026-01-02', { note: 'A short one', starred: true }),
      mood('2026-02-03', { note: 'Not starred, though it is the longest line of all here' }),
      mood('2026-04-05', { note: 'The light on the river after work', starred: true }),
      mood('2025-12-30', { note: 'Starred, but in the year before this one', starred: true }),
    ],
    reflections: [
      reflection('2026-03-04', { body: 'Tea with Ana in the garden\nand more', starred: true }),
      reflection('2026-05-06', { body: 'Long walk, slow morning, good bread', starred: true }),
    ],
  })

  it('keeps a few starred lines by the letter’s rule, in the order they were written', () => {
    const lines = gardenYear(state, 2026, '2026-10-27').lines
    expect(lines).toHaveLength(YEAR_LINES)
    expect(lines).toEqual([
      { text: 'Tea with Ana in the garden', localDate: '2026-03-04', kind: 'reflection' },
      { text: 'The light on the river after work', localDate: '2026-04-05', kind: 'check-in' },
      { text: 'Long walk, slow morning, good bread', localDate: '2026-05-06', kind: 'reflection' },
    ])
  })

  it('never quotes a line that was not starred', () => {
    const texts = gardenYear(state, 2026, '2026-10-27').lines.map((line) => line.text)
    expect(texts.join(' ')).not.toMatch(/Not starred/)
  })

  it('quotes nothing when the gardener chose never to be quoted', () => {
    const never = { ...state, profile: { ...state.profile!, letterQuotes: 'never' as const } }
    expect(gardenYear(never, 2026, '2026-10-27').lines).toEqual([])
    expect(gardenYear(state, 2026, '2026-10-27', 'never').lines).toEqual([])
  })
})

describe('the years on offer', () => {
  it('is this year alone for a garden with nothing written before it', () => {
    expect(yearsToLookBack(garden(), '2026-10-27')).toEqual([2026])
  })

  it('adds every earlier year with something in it, newest first', () => {
    const state = garden({
      moods: [mood('2024-05-05'), mood('2026-01-01')],
      reflections: [reflection('2025-02-02')],
      // A date ahead of the clock offers no year to come.
      recaps: [recap('2027-03-03')],
      sunlight: [sunlight('2023-07-07'), { ...sunlight('x'), localDate: 'not a date' }],
    })
    expect(yearsToLookBack(state, '2026-10-27')).toEqual([2026, 2025, 2024, 2023])
  })
})

describe('the turning of the year', () => {
  it('offers this year through December', () => {
    expect(turningYear('2026-12-01')).toBe(2026)
    expect(turningYear('2026-12-31')).toBe(2026)
  })

  it('offers the year just gone through January', () => {
    expect(turningYear('2027-01-01')).toBe(2026)
    expect(turningYear('2027-01-31')).toBe(2026)
  })

  it('offers nothing for the rest of the year', () => {
    expect(turningYear('2026-11-30')).toBeUndefined()
    expect(turningYear('2027-02-01')).toBeUndefined()
    expect(turningYear('2026-10-27')).toBeUndefined()
  })
})

describe('the year in words', () => {
  const busy: GardenYear = {
    ...EMPTY,
    checkIns: 120,
    reflections: 40,
    evenings: 80,
    daysCaredFor: 142,
    speciesWelcomed: ['Monarch', 'American Lady'],
    emerged: [
      { name: 'Sol', speciesName: 'Monarch' },
      { name: 'Fern', speciesName: 'Red Admiral' },
    ],
  }

  it('says what happened, plainly, with the counts', () => {
    expect(yearInWords(busy, true)).toEqual({
      journal: 'In 2026 you checked in on 120 days, wrote 40 reflections and closed 80 evenings.',
      care: 'Days you cared for yourself: 142.',
      garden: ['You welcomed a Monarch and an American Lady.', 'Sol and Fern emerged as butterflies.'],
    })
  })

  it('says the same acts without a number when Settings hides day counts', () => {
    const words = yearInWords(busy, false)
    expect(words.journal).toBe('In 2026 you checked in, wrote reflections and closed evenings.')
    expect(words.care).toBe(
      'Day counts are hidden, as you chose. Every act of care still grew your garden.',
    )
    expect(`${words.journal} ${words.care}`).not.toMatch(/\b(120|40|80|142)\b/)
  })

  it('speaks of one of each in the singular', () => {
    const one = {
      ...EMPTY,
      checkIns: 1,
      reflections: 1,
      evenings: 1,
      daysCaredFor: 1,
      emerged: [{ name: 'Sol', speciesName: 'Monarch' }],
    }
    expect(yearInWords(one, true)).toEqual({
      journal: 'In 2026 you checked in on one day, wrote a reflection and closed an evening.',
      care: 'Days you cared for yourself: 1.',
      garden: ['Sol emerged as a butterfly.'],
    })
    expect(yearInWords(one, false).journal).toBe(
      'In 2026 you checked in, wrote a reflection and closed an evening.',
    )
  })

  it('names a handful of arrivals and sums up the rest', () => {
    const many = {
      ...EMPTY,
      speciesWelcomed: [
        'Monarch',
        'Queen',
        'Viceroy',
        'Atala',
        'Glasswing',
        'Blue Morpho',
        'Painted Lady',
        'Zebra Longwing',
      ],
      emerged: Array.from({ length: 9 }, (_, index) => ({
        name: `Name${index + 1}`,
        speciesName: 'Monarch',
      })),
    }
    expect(yearInWords(many, true).garden).toEqual([
      'You welcomed a Monarch, a Queen, a Viceroy, an Atala, a Glasswing, a Blue Morpho and two other species.',
      'Name1, Name2, Name3, Name4, Name5, Name6 and three others emerged as butterflies.',
    ])
  })

  it('never keeps a score, compares or advises', () => {
    const all = [yearInWords(busy, true), yearInWords(EMPTY, true), yearInWords(busy, false)]
      .flatMap((words) => [words.journal, words.care ?? '', ...words.garden])
      .join(' ')
    expect(all).not.toMatch(/streak|score|last year|more than|less than|better|worse|should|try to/i)
  })
})

describe('a postcard’s butterflies', () => {
  const flying = (name: string, speciesId: string, emergedAt?: Date) =>
    creature(name, {
      speciesId,
      stage: 'butterfly',
      emergedAt: (emergedAt ?? new Date(2025, 6, 1, 9)).toISOString(),
    })

  it('is Marigold for a garden with no butterfly yet', () => {
    expect(postcardButterflies(garden(), 2026, '2026-10-27')).toEqual([
      { speciesId: 'monarch', name: 'Marigold', speciesName: 'Monarch' },
    ])
  })

  it('puts the year’s new butterflies first, each species once before any twice, a handful at most', () => {
    const state = garden({
      creatures: [
        flying('Old', 'monarch'),
        flying('Twin', 'monarch'),
        creature('Egg'),
        flying('New', 'painted-lady', new Date(2026, 4, 1, 9)),
        flying('Red', 'red-admiral'),
        flying('Blue', 'spring-azure'),
        flying('White', 'cabbage-white'),
        flying('Again', 'painted-lady', new Date(2026, 5, 1, 9)),
      ],
    })
    const chosen = postcardButterflies(state, 2026, '2026-10-27')
    expect(chosen).toHaveLength(POSTCARD_BUTTERFLIES)
    expect(chosen.map((butterfly) => butterfly.name)).toEqual(['New', 'Old', 'Red', 'Blue', 'White'])
  })
})
