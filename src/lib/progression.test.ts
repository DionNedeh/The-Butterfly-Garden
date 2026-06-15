import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import {
  awardSunlight,
  CHRYSALIS_DURATION_MS,
  createEmptyState,
  createInitialState,
  DAILY_SUNLIGHT_CAP,
  DAILY_SEED_REWARD,
  EMERGENCE_SEED_REWARD,
  PLANT_SEED_COST,
  plantSeed,
  progressGarden,
  STARTER_SEEDS,
  NECTAR_PER_SUNLIGHT,
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

  it('matures a host plant and attracts its caterpillar', () => {
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
      stage: 'caterpillar',
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
          stage: 'emerged',
          carePoints: 2,
          discoveredAt: '2026-06-01T10:00:00.000Z',
          emergedAt: '2026-06-04T10:00:00.000Z',
        },
      ],
    }

    const next = awardSunlight(state, 'goal:shared-host', new Date(2026, 5, 13, 10))

    expect(next.creatures.at(-1)).toMatchObject({
      speciesId: 'zebra-longwing',
      stage: 'caterpillar',
    })
  })

  it('turns a cared-for caterpillar into a 72-hour chrysalis', () => {
    const now = new Date('2026-06-13T14:00:00.000Z')
    const state: AppState = {
      ...createEmptyState(),
      creatures: [
        {
          id: 'creature-1',
          speciesId: 'monarch',
          name: 'Clover',
          stage: 'caterpillar',
          carePoints: 1,
          discoveredAt: now.toISOString(),
        },
      ],
    }
    const next = awardSunlight(state, 'reflection:today', now)
    expect(next.creatures[0].stage).toBe('chrysalis')
    expect(new Date(next.creatures[0].emergeAt!).getTime()).toBe(
      now.getTime() + CHRYSALIS_DURATION_MS,
    )
  })

  it('emerges after elapsed time and never reverses after a clock change', () => {
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
    expect(clockMovedBack.creatures[0].stage).toBe('emerged')
    expect(clockMovedBack.seeds).toBe(EMERGENCE_SEED_REWARD)
    expect(clockMovedBack.profile?.activeCompanionId).toBe('creature-1')
  })
})
