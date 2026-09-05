import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_PLANT_GROWTH,
  awardSunlight,
  createEmptyState,
  createInitialState,
} from '../lib/progression'
import { toLocalDate } from '../lib/date'
import type { AppState, MoodEntry } from '../types'
import {
  GARDEN_COLLECTIONS,
  changedParts,
  classifyRecord,
  gardenRepository,
  readImportedState,
  sameCollection,
} from './gardenRepository'

afterEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

async function writeRaw(record: unknown) {
  const db = await openDB('butterfly-garden')
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
      const db = await openDB('butterfly-garden')
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
      const otherTab = await openDB('butterfly-garden')
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

describe('detecting what a write actually changed', () => {
  /** A garden whose plants are all fully grown, so nothing can grow further. */
  function maturedGarden(): AppState {
    const seed = createInitialState('Dirty', 'Dirty Garden')
    return {
      ...seed,
      plants: seed.plants.map((plant) => ({
        ...plant,
        growth: MAX_PLANT_GROWTH,
      })),
    }
  }

  /** What `saveMood` in useGardenState does to the state, without the hook. */
  function checkInWithMood(state: AppState, now = new Date()): AppState {
    const localDate = toLocalDate(now)
    const entry: MoodEntry = {
      id: 'mood-under-test',
      localDate,
      level: 3,
      note: 'A quiet day.',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    return awardSunlight(
      { ...state, moods: [...state.moods, entry] },
      `mood:${localDate}`,
      now,
    )
  }

  it('treats collections with the same elements as unchanged', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(sameCollection(items, items)).toBe(true)
    expect(sameCollection(items, [...items])).toBe(true)
    expect(sameCollection(items, items.slice(0, 1))).toBe(false)
    expect(sameCollection(items, [{ id: 'a' }, { id: 'b' }])).toBe(false)
  })

  it('treats a mood check-in as touching only moods, sunlight and meta', () => {
    const before = maturedGarden()
    const after = checkInWithMood(before)

    // The trap: awardSunlight maps over plants unconditionally, so `plants`
    // arrives with a new array identity even though no plant grew. A plain
    // reference check would call it dirty on every single check-in.
    expect(after.plants).not.toBe(before.plants)

    expect(changedParts(before, after).sort()).toEqual(
      ['meta', 'moods', 'sunlight'].sort(),
    )
  })

  it('reports nothing dirty when the state did not change', () => {
    const state = maturedGarden()
    expect(changedParts(state, state)).toEqual([])
    expect(changedParts(state, { ...state })).toEqual([])
  })

  it('reports every part dirty when nothing is known to be stored', () => {
    const state = maturedGarden()
    expect(changedParts(undefined, state).sort()).toEqual(
      ['meta', ...GARDEN_COLLECTIONS].sort(),
    )
  })

  it('notices a change confined to one collection', () => {
    const before = maturedGarden()
    const after = {
      ...before,
      goals: [
        ...before.goals,
        {
          id: 'extra',
          title: 'Water the ferns',
          schedule: 'daily' as const,
          weekdays: [0, 1, 2, 3, 4, 5, 6],
          createdDate: '2026-09-05',
          archived: false,
        },
      ],
    }
    expect(changedParts(before, after)).toEqual(['goals'])
  })

  it('notices a change confined to a meta field', () => {
    const before = maturedGarden()
    expect(changedParts(before, { ...before, nectar: before.nectar + 1 })).toEqual([
      'meta',
    ])
  })
})
})
