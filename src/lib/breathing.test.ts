import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance, SunlightAward } from '../types'
import { breathOutcome, isBreathingGoal, pacerFor } from './breathing'
import { breathSource, completeGoal, finishBreathing, saveMood } from './gardenActions'
import { createInitialState, DAILY_SUNLIGHT_CAP, NECTAR_PER_SUNLIGHT, sunlightForDate } from './progression'

const NOW = new Date(2026, 9, 27, 10)
const TODAY = '2026-10-27'

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Robin', 'Breath', NOW), ...overrides }
}

function award(source: string, localDate = TODAY): SunlightAward {
  return { id: source, localDate, source, awardedAt: NOW.toISOString() }
}

/** A garden that has already earned all of today's Sunlight elsewhere. */
function fullDay(): AppState {
  return garden({
    sunlight: Array.from({ length: DAILY_SUNLIGHT_CAP }, (_, index) => award(`goal:${index}`)),
  })
}

describe('finishing a breathing session', () => {
  it('counts as care once a day: one Sunlight, through the usual award', () => {
    const before = garden()
    const after = finishBreathing(before, NOW)
    expect(after.sunlight).toHaveLength(1)
    expect(after.sunlight[0]).toMatchObject({ source: `breath:${TODAY}`, localDate: TODAY })
    expect(sunlightForDate(after, TODAY)).toBe(1)
    // The usual award: Nectar, a plant grown a step, the day's first seed.
    expect(after.nectar).toBe(before.nectar + NECTAR_PER_SUNLIGHT)
    expect(after.plants[0].growth).toBe(before.plants[0].growth + 1)
    expect(after.seeds).toBe(before.seeds + 1)
  })

  it('earns nothing more the same day, and hands the garden back as it was', () => {
    const once = finishBreathing(garden(), NOW)
    const later = new Date(2026, 9, 27, 21)
    expect(finishBreathing(once, later)).toBe(once)
  })

  it('counts again the next day', () => {
    const once = finishBreathing(garden(), NOW)
    const tomorrow = finishBreathing(once, new Date(2026, 9, 28, 9))
    expect(tomorrow.sunlight.map((item) => item.source)).toEqual([
      'breath:2026-10-27',
      'breath:2026-10-28',
    ])
  })

  it('stays within the daily cap, beside every other act of care', () => {
    const full = fullDay()
    expect(finishBreathing(full, NOW)).toBe(full)
    // Counted first, it takes its place in the cap like any other.
    const breathed = finishBreathing(garden({ goals: [] }), NOW)
    const checkedIn = saveMood(breathed, 3, '', NOW)
    expect(sunlightForDate(checkedIn, TODAY)).toBe(2)
  })

  it('is its own act of care, apart from a goal done the same day', () => {
    const withGoal = garden({
      goals: [
        {
          id: 'g',
          title: 'Take three slow breaths',
          schedule: 'daily',
          weekdays: [],
          createdDate: TODAY,
          archived: false,
        },
      ],
    })
    const both = finishBreathing(completeGoal(withGoal, 'g', NOW), NOW)
    expect(both.sunlight.map((item) => item.source)).toEqual([`goal:g:${TODAY}`, `breath:${TODAY}`])
  })

  it('names its Sunlight by the day', () => {
    expect(breathSource(TODAY)).toBe('breath:2026-10-27')
  })
})

describe('what finishing says', () => {
  it('counts when nothing has been counted for breathing today', () => {
    expect(breathOutcome(garden(), TODAY)).toBe('counts')
  })

  it('says it was already counted once a session has been, today', () => {
    const once = finishBreathing(garden(), NOW)
    expect(breathOutcome(once, TODAY)).toBe('counted')
    // Yesterday's does not count for today.
    expect(breathOutcome(garden({ sunlight: [award('breath:2026-10-26', '2026-10-26')] }), TODAY)).toBe(
      'counts',
    )
  })

  it('says when today’s Sunlight is already full', () => {
    expect(breathOutcome(fullDay(), TODAY)).toBe('full')
  })
})

describe('who breathes with the gardener', () => {
  const butterfly = (overrides: Partial<CreatureInstance> = {}): CreatureInstance => ({
    ...garden().creatures[0],
    id: 'b',
    name: 'Wren',
    speciesId: 'red-admiral',
    stage: 'butterfly',
    ...overrides,
  })

  it('is the active companion once it has wings', () => {
    const state = garden({ creatures: [butterfly()] })
    const withActive = { ...state, profile: { ...state.profile!, activeCompanionId: 'b' } }
    expect(pacerFor(withActive)).toEqual({ name: 'Wren', speciesId: 'red-admiral' })
  })

  it('is Marigold while the companion is still growing, or none is chosen', () => {
    const growing = garden({ creatures: [butterfly({ stage: 'chrysalis' })] })
    const chosen = { ...growing, profile: { ...growing.profile!, activeCompanionId: 'b' } }
    expect(pacerFor(chosen)).toEqual({ name: 'Marigold', speciesId: 'monarch' })
    expect(pacerFor(garden({ creatures: [butterfly()] }))).toEqual({
      name: 'Marigold',
      speciesId: 'monarch',
    })
    expect(pacerFor({ creatures: [], profile: undefined }).name).toBe('Marigold')
  })
})

describe('a breathing goal', () => {
  it('is "Take three slow breaths", however it was typed', () => {
    for (const title of [
      'Take three slow breaths',
      'take three slow breaths.',
      '  Take  three slow   breaths! ',
    ])
      expect(isBreathingGoal({ title })).toBe(true)
  })

  it('is no other goal', () => {
    for (const title of ['Take three sips', 'Take three slow breaths and stretch', 'Breathe'])
      expect(isBreathingGoal({ title })).toBe(false)
  })
})
