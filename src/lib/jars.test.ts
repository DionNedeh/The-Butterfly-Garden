import { describe, expect, it } from 'vitest'
import type { AppState } from '../types'
import { createEmptyState } from './progression'
import {
  availableJars,
  placeJar,
  purchaseJar,
  removeJarPlacement,
} from './jars'

function jarGarden(): AppState {
  return {
    ...createEmptyState(),
    plants: [
      {
        id: 'plant-1',
        plantId: 'milkweed',
        growth: 3,
        plantedAt: '2026-06-01T12:00:00.000Z',
      },
      {
        id: 'plant-2',
        plantId: 'aster',
        growth: 3,
        plantedAt: '2026-06-01T12:00:00.000Z',
      },
    ],
    jars: [
      {
        id: 'jar-a',
        character: 'A',
        colorId: 'blue',
        purchasedAt: '2026-06-02T12:00:00.000Z',
      },
      {
        id: 'jar-s',
        character: 'S',
        colorId: 'yellow',
        purchasedAt: '2026-06-02T12:00:00.000Z',
      },
    ],
  }
}

describe('jar shop and placement', () => {
  it('buys reusable jar copies for exactly 6 Nectar', () => {
    const now = new Date('2026-06-03T12:00:00.000Z')
    const state = { ...createEmptyState(), nectar: 12 }
    const first = purchaseJar(state, 's', 'blue', now)
    const second = purchaseJar(first, 'S', 'blue', now)

    expect(first.nectar).toBe(6)
    expect(first.jars).toMatchObject([
      { character: 'S', colorId: 'blue', purchasedAt: now.toISOString() },
    ])
    expect(second.nectar).toBe(0)
    expect(second.jars).toHaveLength(2)
    expect(second.jars[0].id).not.toBe(second.jars[1].id)
  })

  it('rejects insufficient funds, invalid characters, and invalid colors', () => {
    const empty = createEmptyState()
    expect(purchaseJar(empty, 'A', 'blue')).toBe(empty)

    const funded = { ...empty, nectar: 12 }
    expect(purchaseJar(funded, '*', 'blue')).toBe(funded)
    expect(purchaseJar(funded, 'A', 'made-up-color' as 'blue')).toBe(funded)
  })

  it('places, moves, replaces, and removes jars without deleting ownership', () => {
    const state = jarGarden()
    const placed = placeJar(state, 'jar-a', 'plant-1')
    const moved = placeJar(placed, 'jar-a', 'plant-2')
    const replaced = placeJar(moved, 'jar-s', 'plant-2')
    const removed = removeJarPlacement(replaced, 'plant-2')

    expect(placed.jarPlacements).toEqual([
      { jarId: 'jar-a', plantId: 'plant-1' },
    ])
    expect(moved.jarPlacements).toEqual([
      { jarId: 'jar-a', plantId: 'plant-2' },
    ])
    expect(replaced.jarPlacements).toEqual([
      { jarId: 'jar-s', plantId: 'plant-2' },
    ])
    expect(availableJars(replaced).map((jar) => jar.id)).toEqual(['jar-a'])
    expect(removed.jarPlacements).toEqual([])
    expect(removed.jars).toHaveLength(2)
  })

  it('ignores unknown jars and plants', () => {
    const state = jarGarden()
    expect(placeJar(state, 'missing-jar', 'plant-1')).toBe(state)
    expect(placeJar(state, 'jar-a', 'missing-plant')).toBe(state)
    expect(removeJarPlacement(state, 'missing-plant')).toBe(state)
  })
})
