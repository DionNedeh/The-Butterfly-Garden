import { describe, expect, it } from 'vitest'
import type {
  AppState,
  CreatureInstance,
  DailyCompletion,
  MoodEntry,
  RecapEntry,
  ReflectionEntry,
} from '../types'
import { FIRST_LINE_LENGTH } from './onThisDay'
import { createInitialState } from './progression'
import { formatWeek, summariseWeek, weekEndingOn, weeklyLetter } from './summaries'

// The tests run in New York (vite.config.ts), where the clocks go back on
// Sunday 1 November 2026 and went forward on Sunday 8 March 2026.

/** The week of Monday 19 to Sunday 25 October 2026. */
const SUNDAY = '2026-10-25'

function garden(extra: Partial<AppState> = {}): AppState {
  // Planted long before, with its starter companion welcomed then.
  return { ...createInitialState('Robin', 'Letters', new Date(2026, 8, 1, 9)), ...extra }
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

function done(goalId: string, localDate: string): DailyCompletion {
  return { id: `${goalId}-${localDate}`, goalId, localDate, completedAt: `${localDate}T15:00:00.000Z` }
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
    discoveredAt: new Date(2026, 8, 1, 9).toISOString(),
    ...extra,
  }
}

/** A busy week, with entries either side of it that must not count. */
function busyWeek(extra: Partial<AppState> = {}): AppState {
  return garden({
    moods: [
      mood('2026-10-18'),
      mood('2026-10-19'),
      mood('2026-10-21'),
      // Written later for a day of this week: it belongs here.
      mood('2026-10-22', { writtenLater: true, createdAt: '2026-10-28T12:00:00.000Z' }),
      mood('2026-10-25'),
      mood('2026-10-26'),
    ],
    reflections: [reflection('2026-10-20'), reflection('2026-10-25'), reflection('2026-10-26')],
    completions: [
      done('water', '2026-10-19'),
      done('walk', '2026-10-19'),
      done('call', '2026-10-19'),
      done('water', '2026-10-24'),
      done('walk', '2026-10-24'),
      done('water', '2026-10-26'),
    ],
    moonlight: [
      { id: 'm-18', localDate: '2026-10-18', awardedAt: '2026-10-18T23:00:00.000Z' },
      { id: 'm-19', localDate: '2026-10-19', awardedAt: '2026-10-19T23:00:00.000Z' },
      { id: 'm-23', localDate: '2026-10-23', awardedAt: '2026-10-23T23:00:00.000Z' },
    ],
    recaps: [recap('2026-10-23'), recap('2026-10-25')],
    creatures: [
      creature('Sol', { stage: 'caterpillar', careDates: { caterpillar: ['2026-10-20'] } }),
      creature('Wren', { stage: 'caterpillar', careDates: { caterpillar: ['2026-10-26'] } }),
    ],
    ...extra,
  })
}

describe('the week', () => {
  it('runs from Monday to the Sunday it ends on', () => {
    expect(weekEndingOn(SUNDAY)).toEqual({ monday: '2026-10-19', sunday: SUNDAY })
    expect(weekEndingOn('2026-11-01')).toEqual({ monday: '2026-10-26', sunday: '2026-11-01' })
    expect(weekEndingOn('2026-03-01')).toEqual({ monday: '2026-02-23', sunday: '2026-03-01' })
  })

  it('is named the way the gardener’s locale writes a range', () => {
    expect(formatWeek(weekEndingOn(SUNDAY))).toMatch(/^October 19\s–\s25$/)
    expect(formatWeek(weekEndingOn('2026-11-01'))).toMatch(/^October 26\s–\sNovember 1$/)
  })
})

describe('what the week holds', () => {
  it('counts each kind of care inside the week and nothing outside it', () => {
    expect(summariseWeek(busyWeek(), SUNDAY).counts).toEqual({
      checkIns: 4,
      reflections: 2,
      goals: 5,
      evenings: 3,
      caredFor: ['Sol'],
    })
  })

  it('counts an evening closed once, whether it shows as Moonlight, a recap or both', () => {
    const only = garden({
      moonlight: [{ id: 'm', localDate: '2026-10-21', awardedAt: '' }],
      recaps: [recap('2026-10-21'), recap('2026-10-22')],
    })
    expect(summariseWeek(only, SUNDAY).counts.evenings).toBe(2)
  })

  it('names its new beginnings, earliest first, from the days each companion’s story keeps', () => {
    const fern = creature('Fern', {
      stage: 'caterpillar',
      hatchedAt: new Date(2026, 9, 21, 8).toISOString(),
    })
    const sol = creature('Sol', { discoveredAt: new Date(2026, 9, 23, 19).toISOString() })
    const ivy = creature('Ivy', {
      speciesId: 'american-lady',
      stage: 'butterfly',
      chrysalisStartedAt: new Date(2026, 9, 19, 9).toISOString(),
      emergedAt: new Date(2026, 9, 24, 9).toISOString(),
    })
    const summary = summariseWeek(garden({ creatures: [sol, fern, ivy] }), SUNDAY)
    expect(summary.arrivals.map(({ kind, name, localDate }) => [kind, name, localDate])).toEqual([
      ['chrysalis', 'Ivy', '2026-10-19'],
      ['hatched', 'Fern', '2026-10-21'],
      ['welcomed', 'Sol', '2026-10-23'],
      ['emerged', 'Ivy', '2026-10-24'],
    ])
    expect(weeklyLetter(garden({ creatures: [sol, fern, ivy] }), SUNDAY).paragraphs).toContain(
      'Ivy became a chrysalis; Fern hatched; Sol, a Red Admiral, was welcomed; Ivy emerged as a butterfly.',
    )
  })

  it('leaves out a beginning the garden never kept a day for, and a damaged date', () => {
    // An older companion with no hatching recorded and too few egg days to know it.
    const older = creature('Moss', { stage: 'caterpillar', careDates: { egg: ['2026-10-20'] } })
    const damaged = creature('Pip', { discoveredAt: new Date(0).toISOString() })
    expect(summariseWeek(garden({ creatures: [older, damaged] }), SUNDAY).arrivals).toEqual([])
  })
})

describe('the week’s edges, in the gardener’s own time', () => {
  // The week of 26 October to 1 November ends on the Sunday the clocks go back.
  const welcomed = (name: string, at: Date) => creature(name, { discoveredAt: at.toISOString() })
  const creatures = [
    welcomed('Late', new Date(2026, 9, 25, 23, 45)),
    welcomed('Early', new Date(2026, 9, 26, 0, 15)),
    // 23:30 on the long Sunday is already Monday in UTC.
    welcomed('Last', new Date(2026, 10, 1, 23, 30)),
    welcomed('Next', new Date(2026, 10, 2, 0, 30)),
  ]

  it('starts at local midnight on Monday and ends at local midnight after Sunday', () => {
    const names = summariseWeek(garden({ creatures }), '2026-11-01').arrivals.map((a) => a.name)
    expect(names).toEqual(['Early', 'Last'])
    expect(summariseWeek(garden({ creatures }), SUNDAY).arrivals.map((a) => a.name)).toEqual(['Late'])
    expect(summariseWeek(garden({ creatures }), '2026-11-08').arrivals.map((a) => a.name)).toEqual([
      'Next',
    ])
  })

  it('holds across the spring change too', () => {
    const spring = [
      welcomed('Before', new Date(2026, 2, 1, 23, 30)),
      welcomed('Lost hour', new Date(2026, 2, 8, 3, 30)),
      welcomed('Sunday night', new Date(2026, 2, 8, 23, 59)),
    ]
    expect(
      summariseWeek(garden({ creatures: spring }), '2026-03-08').arrivals.map((a) => a.name),
    ).toEqual(['Lost hour', 'Sunday night'])
  })
})

describe('the quote', () => {
  const quoteOf = (state: AppState, sunday = SUNDAY) => summariseWeek(state, sunday).quote

  it('is never a line the gardener did not star', () => {
    const state = garden({
      moods: [mood('2026-10-21', { note: 'A long and very quotable line about a heavy day' })],
      reflections: [reflection('2026-10-22', { body: 'Another line nobody chose' })],
    })
    expect(quoteOf(state)).toBeUndefined()
    expect(weeklyLetter(state, SUNDAY).quote).toBeUndefined()
  })

  it('is the first line of a starred note or reflection from the week', () => {
    const state = garden({
      moods: [
        mood('2026-10-21', { note: '\n  the light on the river after work  \nand then rain', starred: true }),
      ],
    })
    expect(quoteOf(state)).toEqual({
      text: 'the light on the river after work',
      localDate: '2026-10-21',
      kind: 'check-in',
    })
  })

  it('never comes from another week, whenever it was written', () => {
    const state = garden({
      moods: [
        mood('2026-10-26', { note: 'Next week’s line', starred: true }),
        // Written during this week, for a day of an earlier one.
        mood('2026-10-12', {
          note: 'Written later for another week',
          starred: true,
          writtenLater: true,
          createdAt: '2026-10-21T12:00:00.000Z',
        }),
      ],
    })
    expect(quoteOf(state)).toBeUndefined()
  })

  it('takes a line written later for this week only when it is starred', () => {
    const later = { writtenLater: true as const, createdAt: '2026-10-30T12:00:00.000Z' }
    const unstarred = garden({ moods: [mood('2026-10-20', { ...later, note: 'Filled in after' })] })
    expect(quoteOf(unstarred)).toBeUndefined()
    const starred = garden({
      moods: [mood('2026-10-20', { ...later, note: 'Filled in after', starred: true })],
    })
    expect(quoteOf(starred)?.text).toBe('Filled in after')
  })

  it('is never anything when the gardener chose never', () => {
    const state = garden({
      moods: [mood('2026-10-21', { note: 'A starred line', starred: true })],
    })
    const never = { ...state, profile: { ...state.profile!, letterQuotes: 'never' as const } }
    expect(quoteOf(never)).toBeUndefined()
    expect(weeklyLetter(never, SUNDAY).quote).toBeUndefined()
    expect(summariseWeek(state, SUNDAY, 'never').quote).toBeUndefined()
  })

  it('is the longest of several, then the later day, then a reflection over a note', () => {
    const longest = garden({
      moods: [mood('2026-10-24', { note: 'Short', starred: true })],
      reflections: [reflection('2026-10-19', { body: 'The longest of the lines', starred: true })],
    })
    expect(quoteOf(longest)?.text).toBe('The longest of the lines')
    const later = garden({
      moods: [mood('2026-10-19', { note: 'Same length', starred: true })],
      reflections: [reflection('2026-10-24', { body: 'Same span!!', starred: true })],
    })
    expect(quoteOf(later)).toMatchObject({ localDate: '2026-10-24', kind: 'reflection' })
    const sameDay = garden({
      moods: [mood('2026-10-22', { note: 'Equal words', starred: true })],
      reflections: [reflection('2026-10-22', { body: 'Equal lines', starred: true })],
    })
    expect(quoteOf(sameDay)?.kind).toBe('reflection')
  })

  it('is shortened like the journal’s own card, and skipped when a starred note is empty', () => {
    const long = 'word '.repeat(60).trim()
    const state = garden({
      moods: [mood('2026-10-21', { note: '', starred: true })],
      reflections: [reflection('2026-10-22', { body: long, starred: true })],
    })
    const quote = quoteOf(state)!
    expect(quote.kind).toBe('reflection')
    expect(quote.text.endsWith('…')).toBe(true)
    expect(Array.from(quote.text).length).toBeLessThanOrEqual(FIRST_LINE_LENGTH + 1)
  })
})

describe('the letter', () => {
  it('says what happened, plainly', () => {
    const letter = weeklyLetter(busyWeek(), SUNDAY)
    expect(letter.greeting).toBe('Dear Robin,')
    expect(letter.week).toEqual({ monday: '2026-10-19', sunday: SUNDAY })
    expect(letter.paragraphs).toEqual([
      'This week you checked in four times, wrote two reflections, finished five goals, cared for Sol and closed three evenings.',
    ])
  })

  it('says one of each kindly', () => {
    const letter = weeklyLetter(
      garden({
        moods: [mood('2026-10-21')],
        reflections: [reflection('2026-10-21')],
        completions: [done('water', '2026-10-21')],
        moonlight: [{ id: 'm', localDate: '2026-10-21', awardedAt: '' }],
      }),
      SUNDAY,
    )
    expect(letter.paragraphs).toEqual([
      'This week you checked in once, wrote a reflection, finished a goal and closed an evening.',
    ])
  })

  it('says twice, eleven as a number, and many companions by how many', () => {
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']
    const letter = weeklyLetter(
      garden({
        moods: [mood('2026-10-19'), mood('2026-10-20')],
        completions: [
          ...days.map((day) => done('water', day)),
          ...days.slice(0, 5).map((day) => done('walk', day)),
        ],
        creatures: ['Sol', 'Wren', 'Fern'].map((name) =>
          creature(name, { careDates: { egg: ['2026-10-22'] } }),
        ),
      }),
      SUNDAY,
    )
    expect(letter.paragraphs[0]).toBe(
      'This week you checked in twice, finished 11 goals and cared for three companions.',
    )
  })

  it('leaves the numbers out for a gardener who keeps the journal free of them', () => {
    const state = busyWeek()
    const quiet = { ...state, profile: { ...state.profile!, hideDayCounts: true } }
    expect(weeklyLetter(quiet, SUNDAY).paragraphs[0]).toBe(
      'This week you checked in, wrote reflections, finished goals, cared for Sol and closed evenings.',
    )
    const many = {
      ...quiet,
      creatures: ['Sol', 'Wren', 'Fern'].map((name) =>
        creature(name, { careDates: { egg: ['2026-10-22'] } }),
      ),
    }
    expect(weeklyLetter(many, SUNDAY).paragraphs[0]).toContain('cared for your companions')
    expect(weeklyLetter(many, SUNDAY).paragraphs.join(' ')).not.toMatch(/\d|\b(two|three|four|five|six|seven)\b/)
  })

  it('gives a quiet week a kind, true letter', () => {
    expect(weeklyLetter(garden(), SUNDAY).paragraphs).toEqual([
      'A quiet week. The garden kept your place.',
    ])
    const hatched = garden({
      creatures: [
        creature('Fern', { stage: 'caterpillar', hatchedAt: new Date(2026, 9, 21, 8).toISOString() }),
      ],
    })
    expect(weeklyLetter(hatched, SUNDAY).paragraphs).toEqual(['A quiet week.', 'Fern hatched.'])
  })

  it('names four beginnings and sums up the rest', () => {
    const creatures = ['Ada', 'Bo', 'Cy', 'Di', 'Ed', 'Fay'].map((name, index) =>
      creature(name, { discoveredAt: new Date(2026, 9, 19 + index, 12).toISOString() }),
    )
    const [line] = weeklyLetter(garden({ creatures }), SUNDAY).paragraphs.slice(-1)
    expect(line).toBe(
      'Ada, a Red Admiral, was welcomed; Bo, a Red Admiral, was welcomed; Cy, a Red Admiral, was welcomed; Di, a Red Admiral, was welcomed; and two other changes among your companions.',
    )
  })

  it('carries the starred line with it', () => {
    const state = busyWeek({
      reflections: [reflection('2026-10-20', { body: 'A kind word', starred: true })],
    })
    expect(weeklyLetter(state, SUNDAY).quote).toEqual({
      text: 'A kind word',
      localDate: '2026-10-20',
      kind: 'reflection',
    })
  })

  it('greets a gardener without a name as a gardener', () => {
    const state = garden()
    const unnamed = { ...state, profile: { ...state.profile!, name: '   ' } }
    expect(weeklyLetter(unnamed, SUNDAY).greeting).toBe('Dear gardener,')
  })

  it('never scores, compares or advises, whatever the week held', () => {
    const states = [garden(), busyWeek(), busyWeek({ completions: [] })]
    for (const state of states) {
      for (const sunday of ['2026-10-18', SUNDAY, '2026-11-01']) {
        const words = weeklyLetter(state, sunday).paragraphs.join(' ')
        expect(words).not.toMatch(/last week|than|better|worse|score|should|try|%|streak|missed/i)
      }
    }
  })
})
