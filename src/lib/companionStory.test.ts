import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance } from '../types'
import { companionStory } from './companionStory'
import { createEmptyState } from './progression'
import { performCare } from './lifecycle'

/** An instant on a local calendar day, as the garden records one. */
function at(year: number, month: number, day: number, hour = 9): string {
  return new Date(year, month - 1, day, hour).toISOString()
}

function creature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: 'pip',
    speciesId: 'monarch',
    name: 'Pip',
    stage: 'egg',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: at(2026, 6, 1),
    ...overrides,
  }
}

/** A garden whose diary began on 1 May 2026, before Pip arrived. */
const diary = { diarySince: at(2026, 5, 1) }

describe('a companion’s story', () => {
  it('tells a new egg’s story as just begun, and whole', () => {
    expect(companionStory(creature(), diary)).toEqual({
      arrivedAs: 'egg',
      hatchedOn: undefined,
      chrysalisOn: undefined,
      emergedOn: undefined,
      daysCaredFor: 0,
      favourite: undefined,
      outfitsWorn: [],
      grownAlongside: [],
      diary: { kind: 'whole' },
    })
  })

  it('dates each change of stage by the local day it was recorded', () => {
    const story = companionStory(
      creature({
        stage: 'butterfly',
        hatchedAt: at(2026, 6, 4, 23),
        chrysalisStartedAt: at(2026, 6, 8),
        emergedAt: at(2026, 6, 12, 0),
      }),
      diary,
    )
    expect(story).toMatchObject({
      arrivedAs: 'egg',
      hatchedOn: '2026-06-04',
      chrysalisOn: '2026-06-08',
      emergedOn: '2026-06-12',
    })
  })

  it('reads an older hatching from the third egg care day, the day it happened', () => {
    const story = companionStory(
      creature({
        stage: 'caterpillar',
        careDates: { egg: ['2026-06-05', '2026-06-02', '2026-06-03'], caterpillar: ['2026-06-06'] },
      }),
      diary,
    )
    expect(story.hatchedOn).toBe('2026-06-05')
  })

  it('leaves a day it cannot be sure of unsaid', () => {
    // Fewer than three egg care days: the rules that hatched it are not these.
    const story = companionStory(
      creature({ stage: 'chrysalis', careDates: { egg: ['2026-06-02'] } }),
      diary,
    )
    expect(story.arrivedAs).toBe('egg')
    expect(story.hatchedOn).toBeUndefined()
    expect(story.chrysalisOn).toBeUndefined()
  })

  it('knows a companion that came as a caterpillar never hatched here', () => {
    const story = companionStory(creature({ stage: 'chrysalis', careDates: {} }), diary)
    expect(story.arrivedAs).toBe('caterpillar')
    expect(story.hatchedOn).toBeUndefined()
  })

  it('says nothing of a stage not reached, whatever is stored', () => {
    const story = companionStory(
      creature({ stage: 'caterpillar', chrysalisStartedAt: at(2026, 6, 8) }),
      diary,
    )
    expect(story.chrysalisOn).toBeUndefined()
    expect(story.emergedOn).toBeUndefined()
  })

  it('counts the days it was cared for once each, across every stage', () => {
    const story = companionStory(
      creature({
        stage: 'caterpillar',
        careDates: {
          egg: ['2026-06-02', '2026-06-03', '2026-06-04'],
          caterpillar: ['2026-06-04', '2026-06-05'],
        },
      }),
      diary,
    )
    expect(story.daysCaredFor).toBe(4)
  })

  it('names the care given most, the latest given on a tie, then the first listed', () => {
    const counted = creature({
      stage: 'caterpillar',
      careCounts: { 'egg-warm': 1, 'cat-play': 3, 'cat-tuck': 3, 'not-an-action': 9 },
      actionLog: { 'cat-play': '2026-06-05', 'cat-tuck': '2026-06-07' },
    })
    expect(companionStory(counted, diary).favourite).toEqual({ name: 'Tuck in', count: 3 })

    const even = { ...counted, actionLog: {} }
    expect(companionStory(even, diary).favourite).toEqual({ name: 'Playtime', count: 3 })
  })

  it('lists every outfit worn, the one on now included, each once', () => {
    const story = companionStory(
      creature({
        stage: 'butterfly',
        outfitsWorn: ['silk-bow', 'retired-piece'],
        outfit: { headwear: 'sprout-cap', accessory: 'silk-bow' },
      }),
      diary,
    )
    expect(story.outfitsWorn).toEqual(['Silk Bow', 'Sprout Cap'])
  })

  it('tells the goals it grew alongside, by the days each gave', () => {
    const story = companionStory(
      creature({
        stage: 'butterfly',
        grownAlongside: [
          { goalId: 'walk', title: 'Walk outside', dates: ['2026-06-02', '2026-06-03'] },
          { goalId: 'gone', title: 'A goal since deleted', dates: ['2026-06-05'] },
        ],
      }),
      diary,
    )
    expect(story.grownAlongside).toEqual([
      { title: 'Walk outside', days: 2 },
      { title: 'A goal since deleted', days: 1 },
    ])
  })

  it('says when a companion is older than the diary', () => {
    const older = creature({ discoveredAt: at(2026, 3, 1) })
    expect(companionStory(older, diary).diary).toEqual({ kind: 'began', on: '2026-05-01' })
    // A date repaired to the epoch is no arrival: the story is not known whole.
    const unknown = creature({ discoveredAt: new Date(0).toISOString() })
    expect(companionStory(unknown, diary).diary.kind).toBe('began')
    expect(companionStory(older, undefined).diary).toEqual({ kind: 'not-begun' })
    expect(companionStory(older, {}).diary).toEqual({ kind: 'not-begun' })
  })

  it('tells the story care writes, from the first day to emergence', () => {
    let state: AppState = { ...createEmptyState(), creatures: [creature()] }
    const days = [2, 3, 4, 5, 6, 7, 8, 9, 10]
    for (const day of days) {
      const stage = state.creatures[0].stage
      const action =
        stage === 'egg' ? 'egg-warm' : stage === 'caterpillar' ? 'cat-play' : 'chr-sun'
      state = performCare(state, 'pip', action, new Date(2026, 5, day, 9)).state
    }
    const story = companionStory(state.creatures[0], diary)
    expect(story).toMatchObject({
      arrivedAs: 'egg',
      hatchedOn: '2026-06-04',
      chrysalisOn: '2026-06-07',
      emergedOn: '2026-06-10',
      daysCaredFor: 9,
      // Three of each kind: the latest given wins.
      favourite: { name: 'Warm sunbeam', count: 3 },
      diary: { kind: 'whole' },
    })
  })
})
