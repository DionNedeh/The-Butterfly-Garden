import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyState } from '../lib/progression'
import { gardenRepository } from './gardenRepository'

afterEach(async () => {
  await gardenRepository.clear()
})

describe('garden repository', () => {
  it('persists and reloads versioned state', async () => {
    const state = { ...createEmptyState(), seeds: 4 }
    await gardenRepository.save(state)
    await expect(gardenRepository.load()).resolves.toMatchObject({
      version: 3,
      seeds: 4,
    })
  })

  it('migrates a version-one garden without backfilling Nectar', async () => {
    const current = createEmptyState()
    const legacy = {
      ...current,
      version: 1,
      seeds: 7,
      profile: {
        id: 'profile',
        name: 'Legacy Gardener',
        gardenName: 'Remembered Garden',
        createdAt: '2026-05-01T12:00:00.000Z',
        reducedMotion: false,
      },
      plants: [
        {
          id: 'remembered-plant',
          plantId: 'aster',
          growth: 2,
          plantedAt: '2026-05-02T12:00:00.000Z',
        },
      ],
      sunlight: [
        {
          id: 'old-light',
          localDate: '2026-06-01',
          source: 'old-goal',
          awardedAt: '2026-06-01T12:00:00.000Z',
        },
      ],
    } as Record<string, unknown>
    delete legacy.nectar
    delete legacy.ownedFlightPatternIds
    delete legacy.selectedFlightPatternId
    delete legacy.jars
    delete legacy.jarPlacements
    await gardenRepository.save(createEmptyState())
    const db = await openDB('butterfly-garden', 1)
    try {
      await db.put('state', legacy, 'current')
    } finally {
      db.close()
    }

    await expect(gardenRepository.load()).resolves.toMatchObject({
      version: 3,
      seeds: 7,
      nectar: 0,
      ownedFlightPatternIds: ['gentle-drift'],
      selectedFlightPatternId: 'gentle-drift',
      jars: [],
      jarPlacements: [],
      profile: expect.objectContaining({
        name: 'Legacy Gardener',
        gardenName: 'Remembered Garden',
      }),
      plants: [expect.objectContaining({ id: 'remembered-plant', growth: 2 })],
    })
  })

  it('migrates a version-two garden with an empty jar inventory', async () => {
    const legacy = {
      ...createEmptyState(),
      version: 2,
      nectar: 15,
      ownedFlightPatternIds: ['gentle-drift', 'petal-hop'],
      selectedFlightPatternId: 'petal-hop',
    } as Record<string, unknown>
    delete legacy.jars
    delete legacy.jarPlacements

    await gardenRepository.save(createEmptyState())
    const db = await openDB('butterfly-garden', 1)
    try {
      await db.put('state', legacy, 'current')
    } finally {
      db.close()
    }

    await expect(gardenRepository.load()).resolves.toMatchObject({
      version: 3,
      nectar: 15,
      ownedFlightPatternIds: ['gentle-drift', 'petal-hop'],
      selectedFlightPatternId: 'petal-hop',
      jars: [],
      jarPlacements: [],
    })
  })

  it('recovers to an empty state when a stored record is malformed', async () => {
    await gardenRepository.save(createEmptyState())
    const db = await openDB('butterfly-garden', 1)
    try {
      await db.put('state', { broken: true }, 'current')
    } finally {
      db.close()
    }
    await expect(gardenRepository.load()).resolves.toEqual(createEmptyState())
  })

  it('deletes the local database', async () => {
    await gardenRepository.save({ ...createEmptyState(), seeds: 3 })
    await gardenRepository.clear()
    await expect(gardenRepository.load()).resolves.toEqual(createEmptyState())
  })
})
