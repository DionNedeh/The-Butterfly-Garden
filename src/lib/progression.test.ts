import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import {
  awardMoonlight,
  awardSunlight,
  createEmptyState,
  createInitialState,
  DAILY_SUNLIGHT_CAP,
  DAILY_SEED_REWARD,
  EMERGENCE_SEED_REWARD,
  PLANT_SEED_COST,
  plantSeed,
  progressGarden,
  STARTER_SEEDS,
  MOONLIGHT_STARDUST_REWARD,
  moonlightForDate,
  NECTAR_PER_SUNLIGHT,
  recapForDate,
} from './progression'

beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => `id-${Math.random()}`),
  })
})

describe('garden progression', () => {
  it('caps Sunlight at five unique care activities per day', () => {
    const now = new Date(2026, 5, 13, 10)
    let state = createEmptyState()
    for (let index = 0; index < 8; index += 1) {
      state = awardSunlight(state, `activity-${index}`, now)
    }
    expect(state.sunlight).toHaveLength(DAILY_SUNLIGHT_CAP)
  })

  it('does not award the same activity twice', () => {
    const now = new Date(2026, 5, 13, 10)
    const once = awardSunlight(createEmptyState(), 'mood:2026-06-13', now)
    const twice = awardSunlight(once, 'mood:2026-06-13', now)
    expect(twice.sunlight).toHaveLength(1)
    expect(twice.nectar).toBe(NECTAR_PER_SUNLIGHT)
  })

  it('awards three Nectar for each accepted Sunlight up to the daily cap', () => {
    const now = new Date(2026, 5, 13, 10)
    let state = createEmptyState()
    for (let index = 0; index < 8; index += 1) {
      state = awardSunlight(state, `nectar-${index}`, now)
    }
    expect(state.nectar).toBe(DAILY_SUNLIGHT_CAP * NECTAR_PER_SUNLIGHT)
  })

  it('awards one seed with the first Sunlight of each local day', () => {
    const firstDay = new Date(2026, 5, 13, 10)
    const nextDay = new Date(2026, 5, 14, 10)
    const first = awardSunlight(createEmptyState(), 'mood:2026-06-13', firstDay)
    const second = awardSunlight(first, 'goal:one:2026-06-13', firstDay)
    const tomorrow = awardSunlight(second, 'mood:2026-06-14', nextDay)

    expect(first.seeds).toBe(DAILY_SEED_REWARD)
    expect(second.seeds).toBe(DAILY_SEED_REWARD)
    expect(tomorrow.seeds).toBe(DAILY_SEED_REWARD * 2)
  })

  it('starts with two seeds and spends one per planted plant', () => {
    const initial = createInitialState(
      'Gardener',
      'Seed Garden',
      new Date('2026-06-13T10:00:00.000Z'),
    )
    const planted = plantSeed(initial, 'aster')

    expect(initial.seeds).toBe(STARTER_SEEDS)
    expect(planted.seeds).toBe(STARTER_SEEDS - PLANT_SEED_COST)
    expect(planted.plants).toHaveLength(initial.plants.length + 1)
  })

  it('begins the journey with a starter caterpillar and care supplies', () => {
    const initial = createInitialState(
      'Gardener',
      'Starter Garden',
      new Date('2026-06-13T10:00:00.000Z'),
    )
    expect(initial.creatures[0]).toMatchObject({
      speciesId: 'monarch',
      stage: 'caterpillar',
      bond: 0,
    })
    expect(initial.inventory['leaf-bundle']).toBeGreaterThan(0)
  })

  it('matures a host plant and reveals a butterfly egg', () => {
    const state: AppState = {
      ...createEmptyState(),
      plants: [
        {
          id: 'plant-1',
          plantId: 'milkweed',
          growth: 2,
          plantedAt: '2026-06-13T10:00:00.000Z',
        },
      ],
    }
    const next = awardSunlight(state, 'goal:one', new Date(2026, 5, 13, 10))
    expect(next.plants[0].growth).toBe(3)
    expect(next.creatures[0]).toMatchObject({
      speciesId: 'monarch',
      stage: 'egg',
    })
  })

  it('welcomes undiscovered species before repeating from a shared host', () => {
    const state: AppState = {
      ...createEmptyState(),
      plants: [
        {
          id: 'plant-1',
          plantId: 'passionflower',
          growth: 2,
          plantedAt: '2026-06-13T10:00:00.000Z',
        },
      ],
      creatures: [
        {
          id: 'creature-1',
          speciesId: 'gulf-fritillary',
          name: 'Poppy',
          stage: 'butterfly',
          careDates: {},
          actionLog: {},
          bond: 0,
          outfit: {},
          carePoints: 2,
          discoveredAt: '2026-06-01T10:00:00.000Z',
          emergedAt: '2026-06-04T10:00:00.000Z',
        },
      ],
    }

    const next = awardSunlight(state, 'goal:shared-host', new Date(2026, 5, 13, 10))

    expect(next.creatures.at(-1)).toMatchObject({
      speciesId: 'zebra-longwing',
      stage: 'egg',
    })
  })

  it('honors legacy chrysalis timers and never reverses after a clock change', () => {
    const state: AppState = {
      ...createEmptyState(),
      profile: {
        id: 'profile',
        name: 'Gardener',
        gardenName: 'Test Garden',
        createdAt: '2026-06-01T00:00:00.000Z',
        reducedMotion: false,
      },
      creatures: [
        {
          id: 'creature-1',
          speciesId: 'monarch',
          name: 'Sol',
          stage: 'chrysalis',
          careDates: {},
          actionLog: {},
          bond: 0,
          outfit: {},
          carePoints: 0,
          discoveredAt: '2026-06-01T00:00:00.000Z',
          emergeAt: '2026-06-04T00:00:00.000Z',
        },
      ],
    }
    const emerged = progressGarden(state, new Date('2026-06-04T00:01:00.000Z'))
    const clockMovedBack = progressGarden(
      emerged,
      new Date('2026-06-02T00:00:00.000Z'),
    )
    expect(clockMovedBack.creatures[0].stage).toBe('butterfly')
    expect(clockMovedBack.seeds).toBe(EMERGENCE_SEED_REWARD)
    expect(clockMovedBack.profile?.activeCompanionId).toBe('creature-1')
  })
})

describe('collecting Moonlight', () => {
  const evening = new Date(2026, 8, 8, 21, 30)

  it('pays Stardust once and records the recap', () => {
    const state = awardMoonlight(
      createInitialState('Dusk', 'Dusk Garden'),
      '2026-09-08',
      {
        level: 4,
        wentWell: '  Walked to the river.  ',
        settingDown: 'The unanswered email.',
        forTomorrow: '',
      },
      evening,
    )

    expect(state.stardust).toBe(MOONLIGHT_STARDUST_REWARD)
    expect(moonlightForDate(state, '2026-09-08')).toMatchObject({
      localDate: '2026-09-08',
      awardedAt: evening.toISOString(),
    })
    expect(recapForDate(state, '2026-09-08')).toMatchObject({
      level: 4,
      wentWell: 'Walked to the river.',
      settingDown: 'The unanswered email.',
      forTomorrow: '',
    })
  })

  it('pays for a recap with every question skipped', () => {
    // The reward is for closing the day, not for filling anything in. Gating
    // it on typing would turn self-care into a form.
    const state = awardMoonlight(
      createInitialState('Quiet', 'Quiet Garden'),
      '2026-09-08',
      {},
      evening,
    )

    expect(state.stardust).toBe(MOONLIGHT_STARDUST_REWARD)
    expect(recapForDate(state, '2026-09-08')).toMatchObject({
      wentWell: '',
      settingDown: '',
      forTomorrow: '',
    })
    expect(recapForDate(state, '2026-09-08')?.level).toBeUndefined()
  })

  it('pays a day on which no Sunlight was earned', () => {
    const state = awardMoonlight(
      createInitialState('Hard', 'Hard Garden'),
      '2026-09-08',
      {},
      evening,
    )

    expect(state.sunlight).toHaveLength(0)
    expect(state.stardust).toBe(MOONLIGHT_STARDUST_REWARD)
  })

  it('refuses a second collection for the same day', () => {
    const once = awardMoonlight(
      createInitialState('Twice', 'Twice Garden'),
      '2026-09-08',
      { wentWell: 'A first attempt.' },
      evening,
    )
    const twice = awardMoonlight(
      once,
      '2026-09-08',
      { wentWell: 'A second attempt.' },
      new Date(2026, 8, 8, 22),
    )

    expect(twice.stardust).toBe(MOONLIGHT_STARDUST_REWARD)
    expect(twice.moonlight).toHaveLength(1)
    expect(twice.recaps).toHaveLength(1)
    expect(recapForDate(twice, '2026-09-08')?.wentWell).toBe('A first attempt.')
  })

  it('does not pay again after the recap is deleted', () => {
    // The ledger, not the recap, decides whether a night has paid out. A
    // gardener who dislikes what they wrote can rewrite it for nothing.
    const collected = awardMoonlight(
      createInitialState('Redo', 'Redo Garden'),
      '2026-09-08',
      { wentWell: 'Something I would rather not keep.' },
      evening,
    )
    const deleted = { ...collected, recaps: [] }
    const again = awardMoonlight(deleted, '2026-09-08', {}, evening)

    expect(again.stardust).toBe(MOONLIGHT_STARDUST_REWARD)
    expect(again.recaps).toHaveLength(0)
  })

  it('leaves the Sunlight economy exactly as it found it', () => {
    // Moonlight must not grow a plant: plant growth is what reveals eggs, and
    // it is paced by the daily Sunlight cap. Nor may it award Sunlight, or the
    // journal's promise that a streak means an act of care becomes false.
    const before = createInitialState('Apart', 'Apart Garden')
    const after = awardMoonlight(before, '2026-09-08', {}, evening)

    expect(after.sunlight).toEqual(before.sunlight)
    expect(after.plants).toEqual(before.plants)
    expect(after.creatures).toEqual(before.creatures)
    expect(after.nectar).toBe(before.nectar)
    expect(after.seeds).toBe(before.seeds)
  })

  it('collects alongside a full day of Sunlight', () => {
    let state: AppState = createInitialState('Both', 'Both Garden')
    for (let index = 0; index < DAILY_SUNLIGHT_CAP; index += 1) {
      state = awardSunlight(state, `activity-${index}`, evening)
    }
    const sunlitStardust = state.stardust
    const collected = awardMoonlight(state, '2026-09-08', {}, evening)

    expect(collected.sunlight).toHaveLength(DAILY_SUNLIGHT_CAP)
    expect(collected.stardust).toBe(sunlitStardust + MOONLIGHT_STARDUST_REWARD)
  })

  it('closes yesterday when the grace window says so', () => {
    // The day being closed is not always the day it is written on.
    const afterMidnight = new Date(2026, 8, 9, 1, 15)
    const state = awardMoonlight(
      createInitialState('Late', 'Late Garden'),
      '2026-09-08',
      {},
      afterMidnight,
    )

    expect(recapForDate(state, '2026-09-08')).toBeDefined()
    expect(recapForDate(state, '2026-09-09')).toBeUndefined()
    expect(state.recaps[0].createdAt).toBe(afterMidnight.toISOString())
  })
})
