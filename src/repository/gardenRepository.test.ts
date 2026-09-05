import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyState, createInitialState } from '../lib/progression'
import {
  classifyRecord,
  gardenRepository,
  readImportedState,
} from './gardenRepository'

afterEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

async function writeRaw(record: unknown) {
  const db = await openDB('butterfly-garden', 2)
  try {
    await db.put('state', record, 'current')
  } finally {
    db.close()
  }
}

describe('garden repository', () => {
  it('persists and reloads versioned state', async () => {
    const state = { ...createEmptyState(), seeds: 4 }
    await gardenRepository.save(state)
    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'loaded',
      state: { version: 4, seeds: 4 },
    })
  })

  it('reports an untouched database as empty rather than loaded', async () => {
    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'empty',
      state: createEmptyState(),
    })
  })

  it('persists the selected ambient track', async () => {
    const state = createInitialState('Sound Tester', 'Listening Garden')
    if (!state.profile) throw new Error('Expected an initialized profile')
    state.profile.ambientSound = true
    state.profile.ambientTrack = 'piano-music'

    await gardenRepository.save(state)

    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'loaded',
      state: {
        profile: {
          ambientSound: true,
          ambientTrack: 'piano-music',
        },
      },
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
    await writeRaw(legacy)

    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'loaded',
      state: {
        version: 4,
        seeds: 7,
        nectar: 0,
        ownedFlightPatternIds: ['gentle-drift'],
        selectedFlightPatternId: 'gentle-drift',
        jars: [],
        jarPlacements: [],
        profile: expect.objectContaining({
          name: 'Legacy Gardener',
          gardenName: 'Remembered Garden',
          ambientTrack: 'garden-chimes',
        }),
        plants: [expect.objectContaining({ id: 'remembered-plant', growth: 2 })],
      },
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
    await writeRaw(legacy)

    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'loaded',
      state: {
        version: 4,
        nectar: 15,
        ownedFlightPatternIds: ['gentle-drift', 'petal-hop'],
        selectedFlightPatternId: 'petal-hop',
        jars: [],
        jarPlacements: [],
      },
    })
  })

  describe('records this build cannot read', () => {
    it('withholds a malformed record and keeps a quarantined copy', async () => {
      await gardenRepository.save(createEmptyState())
      await writeRaw({ broken: true })

      const result = await gardenRepository.load()
      expect(result.status).toBe('withheld')
      expect(result.reason).toBe('malformed')
      expect(result.state).toEqual(createEmptyState())

      const quarantined = await gardenRepository.quarantined()
      expect(quarantined).toHaveLength(1)
      expect(quarantined[0]).toMatchObject({
        reason: 'malformed',
        raw: { broken: true },
      })
    })

    it('withholds a garden written by a newer client instead of discarding it', async () => {
      const real = createInitialState('Future', 'Future Garden')
      await gardenRepository.save(real)
      await writeRaw({ ...real, version: 5, seeds: 99 })

      const result = await gardenRepository.load()
      expect(result.status).toBe('withheld')
      expect(result.reason).toBe('incompatible')

      // The newer record must survive: the app refuses to write while withheld,
      // so a later read still finds it exactly as the newer client left it.
      const db = await openDB('butterfly-garden', 2)
      try {
        const stored = (await db.get('state', 'current')) as Record<string, unknown>
        expect(stored.version).toBe(5)
        expect(stored.seeds).toBe(99)
      } finally {
        db.close()
      }
    })

    it('classifies records by why they could not be read', () => {
      expect(classifyRecord(createEmptyState())).toBe('readable')
      expect(classifyRecord({ ...createEmptyState(), version: 5 })).toBe('incompatible')
      expect(classifyRecord({ broken: true })).toBe('malformed')
      expect(classifyRecord(undefined)).toBe('malformed')
    })
  })

  describe('backups', () => {
    it('reads a garden back out of an exported envelope', () => {
      const state = { ...createInitialState('Backup', 'Backup Garden'), seeds: 6 }
      const envelope = {
        format: 'the-butterfly-garden',
        exportedAt: '2026-01-01T00:00:00.000Z',
        garden: state,
      }
      expect(readImportedState(envelope)).toMatchObject({ version: 4, seeds: 6 })
    })

    it('accepts a bare garden and rejects anything else', () => {
      expect(readImportedState(createEmptyState())).toBeTruthy()
      expect(readImportedState({ nope: true })).toBeUndefined()
      expect(readImportedState('not json')).toBeUndefined()
    })
  })

  describe('deletion', () => {
    it('deletes the local database', async () => {
      await gardenRepository.save({ ...createEmptyState(), seeds: 3 })
      await gardenRepository.clear()
      await expect(gardenRepository.load()).resolves.toMatchObject({
        status: 'empty',
      })
    })

    it('refuses to report success while another tab holds the data', async () => {
      await gardenRepository.save(createInitialState('Held', 'Held Garden'))
      const otherTab = await openDB('butterfly-garden', 2)
      try {
        await expect(gardenRepository.clear()).rejects.toThrow(/another open tab/i)
        // The garden is still there, exactly as it should be.
        const stored = await otherTab.get('state', 'current')
        expect(stored).toBeTruthy()
      } finally {
        otherTab.close()
      }
    })
  })
})
