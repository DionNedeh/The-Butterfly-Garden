import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance, PlantInstance } from '../types'
import { createEmptyState, createInitialState, MAX_PLANT_GROWTH, plantSeed } from './progression'
import {
  PLANT_CAPACITY,
  plantEggNote,
  plantingBlocker,
  plantRemovalBlocker,
  removePlant,
} from './plantManagement'

function fullGarden(): AppState {
  return {
    ...createEmptyState(),
    seeds: 3,
    plants: Array.from({ length: PLANT_CAPACITY }, (_, index) => ({
      id: `plant-${index}`,
      plantId: 'aster',
      growth: 0,
      plantedAt: '2026-06-01T12:00:00.000Z',
    })),
  }
}

describe('plant management', () => {
  it('blocks planting at capacity, including legacy gardens over capacity', () => {
    const full = fullGarden()
    expect(plantSeed(full, 'aster')).toBe(full)
    const legacy = {
      ...full,
      plants: [
        ...full.plants,
        { ...full.plants[0], id: 'legacy-extra' },
      ],
    }
    expect(plantSeed(legacy, 'aster')).toBe(legacy)
  })

  it('removes an eligible plant without refunding a seed', () => {
    const state = fullGarden()
    const next = removePlant(state, 'plant-0')
    expect(next.plants).toHaveLength(PLANT_CAPACITY - 1)
    expect(next.seeds).toBe(state.seeds)
  })

  it('returns a removed plant spot jar to inventory', () => {
    const state: AppState = {
      ...fullGarden(),
      jars: [
        {
          id: 'jar-a',
          character: 'A',
          colorId: 'blue',
          purchasedAt: '2026-06-03T12:00:00.000Z',
        },
      ],
      jarPlacements: [{ jarId: 'jar-a', plantId: 'plant-0' }],
    }
    const next = removePlant(state, 'plant-0')

    expect(next.plants).toHaveLength(PLANT_CAPACITY - 1)
    expect(next.jars).toEqual(state.jars)
    expect(next.jarPlacements).toEqual([])
  })

  it('protects plants supporting developing creatures', () => {
    const state: AppState = {
      ...fullGarden(),
      creatures: [
        {
          id: 'creature',
          speciesId: 'monarch',
          name: 'Sol',
          stage: 'chrysalis' as const,
          careDates: {},
          actionLog: {},
          bond: 0,
          outfit: {},
          carePoints: 2,
          discoveredAt: '2026-06-01T12:00:00.000Z',
          sourcePlantId: 'plant-0',
        },
      ],
    }
    expect(plantRemovalBlocker(state, 'plant-0')).toMatch(/chrysalis/i)
    expect(removePlant(state, 'plant-0')).toBe(state)
  })

  it('allows removal after the linked butterfly emerges', () => {
    const state: AppState = {
      ...fullGarden(),
      creatures: [
        {
          id: 'creature',
          speciesId: 'monarch',
          name: 'Sol',
          stage: 'butterfly' as const,
          careDates: {},
          actionLog: {},
          bond: 0,
          outfit: {},
          carePoints: 2,
          discoveredAt: '2026-06-01T12:00:00.000Z',
          sourcePlantId: 'plant-0',
        },
      ],
    }
    expect(plantRemovalBlocker(state, 'plant-0')).toBeUndefined()
    expect(removePlant(state, 'plant-0').plants).toHaveLength(PLANT_CAPACITY - 1)
  })
})

describe('saying why a seed cannot be planted', () => {
  it('names a full garden first, then an empty tray, and nothing when planting is open', () => {
    expect(plantingBlocker(fullGarden(), 1)).toMatch(/All 8 spaces are growing/)
    expect(plantingBlocker({ plants: [], seeds: 0 }, 1)).toMatch(/No seeds in your tray yet/)
    expect(plantingBlocker({ plants: [], seeds: 1 }, 1)).toBeUndefined()
  })
})

describe('what a host plant does about eggs', () => {
  const starter = createInitialState('Robin', 'Eggs').creatures[0]
  const milkweed = (growth: number): PlantInstance => ({
    id: 'p1',
    plantId: 'milkweed',
    growth,
    plantedAt: '2026-10-01T10:00:00.000Z',
  })
  const companion = (overrides: Partial<CreatureInstance>): CreatureInstance => ({
    ...starter,
    id: 'c2',
    name: 'Pip',
    speciesId: 'queen',
    ...overrides,
  })

  it('says nothing for a nectar plant', () => {
    expect(plantEggNote({ creatures: [starter] }, { ...milkweed(0), plantId: 'zinnia' }, MAX_PLANT_GROWTH)).toBeUndefined()
  })

  it('names the egg a growing plant can bring', () => {
    // The starter is a monarch caterpillar, so milkweed would bring a queen.
    expect(plantEggNote({ creatures: [starter] }, milkweed(1), MAX_PLANT_GROWTH)).toBe(
      'When it blooms, it can bring a Queen egg.',
    )
  })

  it('warns when every butterfly it hosts is still growing up', () => {
    const creatures = [starter, companion({ stage: 'caterpillar', sourcePlantId: 'other' })]
    expect(plantEggNote({ creatures }, milkweed(1), MAX_PLANT_GROWTH)).toMatch(/brings no egg/)
  })

  it('names the companion its bloom brought', () => {
    const creatures = [starter, companion({ sourcePlantId: 'p1' })]
    expect(plantEggNote({ creatures }, milkweed(MAX_PLANT_GROWTH), MAX_PLANT_GROWTH)).toBe(
      "This bloom brought Pip's egg.",
    )
  })

  it('says a bloom brought nothing, unless an older companion could have come from it', () => {
    const creatures = [starter, companion({ sourcePlantId: 'elsewhere' })]
    expect(plantEggNote({ creatures }, milkweed(MAX_PLANT_GROWTH), MAX_PLANT_GROWTH)).toMatch(
      /brought no egg. Plant another Milkweed/,
    )
    const legacy = [starter, companion({ sourcePlantId: undefined })]
    expect(plantEggNote({ creatures: legacy }, milkweed(MAX_PLANT_GROWTH), MAX_PLANT_GROWTH)).toBeUndefined()
  })
})
