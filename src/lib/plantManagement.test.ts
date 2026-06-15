import { describe, expect, it } from 'vitest'
import type { AppState } from '../types'
import { createEmptyState, plantSeed } from './progression'
import {
  PLANT_CAPACITY,
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

  it('protects plants supporting developing creatures', () => {
    const state: AppState = {
      ...fullGarden(),
      creatures: [
        {
          id: 'creature',
          speciesId: 'monarch',
          name: 'Sol',
          stage: 'chrysalis',
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
          stage: 'emerged',
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
