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
      version: 1,
      seeds: 4,
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
