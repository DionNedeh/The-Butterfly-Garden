import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance } from '../types'
import { describeEvent, gardenEvents } from './gardenEvents'
import { createInitialState } from './progression'

function creature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: 'c1',
    speciesId: 'monarch',
    name: 'Clover',
    stage: 'egg',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Tester', 'Events'), ...overrides }
}

describe('what changed, worth marking', () => {
  it('finds a bloom, a new egg, a transformation and a deeper bond', () => {
    const before = garden({
      plants: [{ id: 'p1', plantId: 'milkweed', growth: 2, plantedAt: '' }],
      creatures: [creature({ id: 'old', name: 'Sol', stage: 'caterpillar', bond: 0 })],
    })
    const after = garden({
      plants: [{ id: 'p1', plantId: 'milkweed', growth: 3, plantedAt: '' }],
      creatures: [
        creature({ id: 'old', name: 'Sol', stage: 'chrysalis', bond: 1000 }),
        creature({ id: 'new', name: 'Clover', sourcePlantId: 'p1' }),
      ],
    })
    const events = gardenEvents(before, after)
    expect(events.map((event) => event.kind)).toEqual([
      'plant-bloomed',
      'stage-advanced',
      'bond-level',
      'egg-found',
    ])
    const text = events.map(describeEvent)
    expect(text[0]).toMatch(/in full bloom/)
    expect(text[1]).toBe('Sol wrapped up into a chrysalis.')
    expect(text[3]).toMatch(/egg appeared on your .*named Clover/)
  })

  it('stays quiet when nothing worth marking changed', () => {
    const state = garden({ creatures: [creature()] })
    expect(gardenEvents(state, { ...state, nectar: state.nectar + 3 })).toEqual([])
    expect(gardenEvents(state, state)).toEqual([])
  })

  it('says how each stage arrives', () => {
    expect(describeEvent({ kind: 'stage-advanced', creatureName: 'Sol', stage: 'caterpillar' })).toBe(
      'Sol hatched into a caterpillar!',
    )
    expect(describeEvent({ kind: 'stage-advanced', creatureName: 'Sol', stage: 'butterfly' })).toBe(
      'Sol emerged as a butterfly!',
    )
  })
})
