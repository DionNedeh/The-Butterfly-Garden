import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_PLANT_GROWTH,
  awardSunlight,
  createEmptyState,
  createInitialState,
} from '../lib/progression'
import { flightPatterns } from '../data/flightPatterns'
import { toLocalDate } from '../lib/date'
import type { AppState, MoodEntry } from '../types'
import type { GardenCollection } from './gardenRepository'
import {
  COLLECTION_SINCE_VERSION,
  COLLECTION_STORES,
  CURRENT_STATE_VERSION,
  DATABASE_VERSION,
  GARDEN_COLLECTIONS,
  META_FIELDS,
  changedParts,
  classifyRecord,
  gardenRepository,
  readImportedState,
  sameCollection,
} from './gardenRepository'

afterEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

/**
 * Stores that together hold a garden in the split layout.
 *
 * Derived rather than listed. A hand-written copy silently stops clearing the
 * stores a new collection adds, which leaves a "pre-split" garden with split
 * parts still in it -- and the legacy path under test is then never reached.
 */
const PART_STORES = [
  'meta',
  ...GARDEN_COLLECTIONS.map((collection) => COLLECTION_STORES[collection]),
] as const

/**
 * Leave the database holding a pre-split garden: the legacy whole-garden
 * record, and no split parts at all. That is exactly what an older build
 * leaves behind, and what the lazy migration has to cope with.
 */
async function writeRaw(record: unknown) {
  const db = await openDB('butterfly-garden')
  try {
    const tx = db.transaction(['state', ...PART_STORES], 'readwrite')
    await Promise.all([
      tx.objectStore('state').put(record, 'current'),
      ...PART_STORES.map((store) => tx.objectStore(store).delete('current')),
      tx.done,
    ])
  } finally {
    db.close()
  }
}

/**
 * A garden with something in every collection.
 *
 * Deliberately exhaustive: the backup tests below walk GARDEN_COLLECTIONS and
 * require each one to be non-empty here, so adding a collection without
 * deciding how it survives a backup fails loudly rather than quietly shipping
 * a restore that drops it.
 */
function fullGarden(): AppState {
  const seed = createInitialState('Whole', 'Whole Garden')
  const plantId = seed.plants[0].id
  return {
    ...seed,
    goals: [
      {
        id: 'goal-1',
        title: 'Step outside',
        schedule: 'daily',
        weekdays: [],
        createdDate: '2026-09-01',
        archived: false,
      },
    ],
    completions: [
      {
        id: 'completion-1',
        goalId: 'goal-1',
        localDate: '2026-09-08',
        completedAt: '2026-09-08T10:00:00.000Z',
      },
    ],
    moods: [mood('2026-09-08', 'A quiet day.')],
    reflections: [
      {
        id: 'reflection-1',
        localDate: '2026-09-08',
        promptId: 'notice',
        body: 'The light through the window.',
        createdAt: '2026-09-08T21:00:00.000Z',
        updatedAt: '2026-09-08T21:00:00.000Z',
      },
    ],
    recaps: [
      {
        id: 'recap-1',
        localDate: '2026-09-08',
        level: 4,
        wentWell: 'Walked to the river.',
        settingDown: 'The unanswered email.',
        forTomorrow: 'Book the appointment',
        createdAt: '2026-09-08T22:00:00.000Z',
        updatedAt: '2026-09-08T22:00:00.000Z',
      },
    ],
    moonlight: [
      {
        id: 'moonlight-1',
        localDate: '2026-09-08',
        awardedAt: '2026-09-08T22:00:00.000Z',
      },
    ],
    sunlight: [
      {
        id: 'sunlight-1',
        localDate: '2026-09-08',
        source: 'mood:2026-09-08',
        awardedAt: '2026-09-08T10:00:00.000Z',
      },
    ],
    jars: [
      {
        id: 'jar-1',
        character: 'A',
        colorId: 'blue',
        purchasedAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    jarPlacements: [{ jarId: 'jar-1', plantId }],
    stardust: 3,
  }
}

function mood(localDate: string, note: string): MoodEntry {
  return {
    id: `mood-${localDate}`,
    localDate,
    level: 3,
    note,
    createdAt: `${localDate}T09:00:00.000Z`,
    updatedAt: `${localDate}T09:00:00.000Z`,
  }
}

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

describe('garden repository', () => {
  it('persists and reloads versioned state', async () => {
    const state = { ...createEmptyState(), seeds: 4 }
    await gardenRepository.save(state)
    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'loaded',
      state: { version: 5, seeds: 4 },
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
        version: 5,
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
        version: 5,
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
      await writeRaw({ ...real, version: 6, seeds: 99 })

      const result = await gardenRepository.load()
      expect(result.status).toBe('withheld')
      expect(result.reason).toBe('incompatible')

      // The newer record must survive: the app refuses to write while withheld,
      // so a later read still finds it exactly as the newer client left it.
      const db = await openDB('butterfly-garden')
      try {
        const stored = (await db.get('state', 'current')) as Record<string, unknown>
        expect(stored.version).toBe(6)
        expect(stored.seeds).toBe(99)
      } finally {
        db.close()
      }
    })

    it('classifies records by why they could not be read', () => {
      expect(classifyRecord(createEmptyState())).toBe('readable')
      expect(classifyRecord({ ...createEmptyState(), version: 6 })).toBe('incompatible')
      expect(classifyRecord({ broken: true })).toBe('malformed')
      expect(classifyRecord(undefined)).toBe('malformed')
    })
  })

  it('reports an upgrade blocked by an older tab instead of hanging', async () => {
    // Raising DATABASE_VERSION makes the open an upgrade, and an upgrade waits
    // for every older connection to close. The build being replaced does not
    // let go on its own, so without a `blocked` handler this open never
    // settles and the app sits on its splash screen forever.
    await gardenRepository.clear().catch(() => undefined)
    const older = await openDB('butterfly-garden', 3, {
      upgrade(db) {
        db.createObjectStore('meta')
      },
    })

    try {
      const result = await gardenRepository.load()
      expect(result.status).toBe('withheld')
      expect(result.reason).toBe('unavailable')
    } finally {
      older.close()
    }
  })

  describe('backups', () => {
    it('reads a garden back out of an exported envelope', () => {
      const state = { ...createInitialState('Backup', 'Backup Garden'), seeds: 6 }
      const envelope = {
        format: 'the-butterfly-garden',
        exportedAt: '2026-01-01T00:00:00.000Z',
        garden: state,
      }
      expect(readImportedState(envelope)).toMatchObject({ version: 5, seeds: 6 })
    })

    it('accepts a bare garden and rejects anything else', () => {
      expect(readImportedState(createEmptyState())).toBeTruthy()
      expect(readImportedState({ nope: true })).toBeUndefined()
      expect(readImportedState('not json')).toBeUndefined()
    })

    it('restores a backup taken before the split into the split stores', async () => {
      // A backup file written by the pre-split build: the same envelope, since
      // the format is the gardener's only recovery path and must not change.
      const envelope = {
        format: 'the-butterfly-garden',
        exportedAt: '2026-01-01T00:00:00.000Z',
        garden: {
          ...createInitialState('Restored', 'Restored Garden'),
          seeds: 21,
          moods: [
            {
              id: 'kept',
              localDate: '2026-08-30',
              level: 5 as const,
              note: 'Survived the restore.',
              createdAt: '2026-08-30T08:00:00.000Z',
              updatedAt: '2026-08-30T08:00:00.000Z',
            },
          ],
        },
      }
      // Something else is already in the garden, so this is a real replacement.
      await gardenRepository.save(createInitialState('Old', 'Old Garden'))

      const imported = readImportedState(envelope)
      expect(imported).toBeTruthy()
      await gardenRepository.save(imported!)

      await expect(gardenRepository.load()).resolves.toMatchObject({
        status: 'loaded',
        state: { seeds: 21, moods: envelope.garden.moods },
      })
    })
  })

  describe('backups across versions', () => {
    /** The oldest version at which some collection did not yet exist. */
    const beforeNewestCollections =
      Math.min(...Object.values(COLLECTION_SINCE_VERSION)) - 1

    it('round-trips every collection through an exported backup', () => {
      const garden = fullGarden()
      const envelope = JSON.parse(
        JSON.stringify({
          format: 'the-butterfly-garden',
          exportedAt: '2026-09-08T22:30:00.000Z',
          garden,
        }),
      ) as unknown

      const restored = readImportedState(envelope)
      expect(restored).toBeDefined()
      for (const collection of GARDEN_COLLECTIONS) {
        // Non-empty here is the point: a collection nobody put in the fixture
        // would round-trip trivially and prove nothing.
        expect(garden[collection].length).toBeGreaterThan(0)
        expect(restored?.[collection]).toEqual(garden[collection])
      }
      for (const field of META_FIELDS) {
        expect(restored?.[field]).toEqual(garden[field])
      }
    })

    it('gives every collection a value when a backup predates it', () => {
      // A backup written before a collection existed has no key for it at all.
      // Every reader treats collections as arrays, so migration has to supply
      // one rather than letting undefined through.
      const older = { ...fullGarden(), version: beforeNewestCollections } as
        Record<string, unknown>
      for (const collection of Object.keys(COLLECTION_SINCE_VERSION)) {
        delete older[collection]
      }

      const restored = readImportedState(older)
      expect(restored).toBeDefined()
      for (const collection of GARDEN_COLLECTIONS) {
        expect(Array.isArray(restored?.[collection])).toBe(true)
      }
      expect(restored?.version).toBe(CURRENT_STATE_VERSION)
    })

    it('refuses a backup from a newer build without touching the garden', () => {
      const mine = fullGarden()
      const theirs = {
        format: 'the-butterfly-garden',
        garden: { ...createEmptyState(), version: CURRENT_STATE_VERSION + 1 },
      }

      expect(readImportedState(theirs)).toBeUndefined()
      // Rejection is the whole safety property: the caller keeps what it has.
      expect(mine.recaps).toHaveLength(1)
    })

    it('keeps every flight pattern in the catalog through a backup', () => {
      // The repository filters unknown pattern ids out of a restored garden.
      // It derives the known set from the catalog, so a pattern added without
      // updating that filter would be silently stripped from someone's
      // ownership on the next restore.
      const owned = flightPatterns.map((pattern) => pattern.id)
      const garden = {
        ...createEmptyState(),
        ownedFlightPatternIds: owned,
        selectedFlightPatternId: owned[owned.length - 1],
      }

      const restored = readImportedState({ garden })
      expect(restored?.ownedFlightPatternIds).toEqual(owned)
      expect(restored?.selectedFlightPatternId).toBe(owned[owned.length - 1])
    })

    it('drops a pattern id this build does not know, keeping the rest', () => {
      const garden = {
        ...createEmptyState(),
        ownedFlightPatternIds: ['gentle-drift', 'retired-pattern', 'ribbon-loop'],
        selectedFlightPatternId: 'retired-pattern',
      }

      const restored = readImportedState({ garden })
      expect(restored?.ownedFlightPatternIds).toEqual(['gentle-drift', 'ribbon-loop'])
      // A selection this build cannot render falls back rather than sticking.
      expect(restored?.selectedFlightPatternId).toBe('gentle-drift')
    })

    it('refuses anything that is not a garden', () => {
      expect(readImportedState({ format: 'the-butterfly-garden' })).toBeUndefined()
      expect(readImportedState({ garden: { version: 5 } })).toBeUndefined()
      expect(readImportedState([])).toBeUndefined()
      expect(readImportedState(null)).toBeUndefined()
    })

    it('stores every part of a restored backup, not just what differed', async () => {
      // Restoring replaces the document. Writing only the difference from the
      // garden being replaced can leave a collection's record behind -- and
      // for a collection the backup predates, there may be no record at all
      // while the meta it writes claims a version that expects one.
      await gardenRepository.save(createInitialState('Before', 'Before Garden'))

      const backup = { ...fullGarden(), version: beforeNewestCollections } as
        Record<string, unknown>
      for (const collection of Object.keys(COLLECTION_SINCE_VERSION)) {
        delete backup[collection]
      }
      const restored = readImportedState(backup)
      expect(restored).toBeDefined()
      await gardenRepository.replace(restored as AppState)

      const reopened = await gardenRepository.load()
      expect(reopened.status).toBe('loaded')
      expect(reopened.state.moods).toEqual(restored?.moods)
      for (const collection of GARDEN_COLLECTIONS) {
        expect(Array.isArray(reopened.state[collection])).toBe(true)
      }
      expect(await gardenRepository.quarantined()).toHaveLength(0)
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
        const stored = await otherTab.get('meta', 'current')
        expect(stored).toBeTruthy()
      } finally {
        otherTab.close()
      }
    })
  })

describe('adding a collection', () => {
  it('raises the database version whenever the store list changes', () => {
    // A deliberate canary rather than a clever check. Adding a collection but
    // leaving DATABASE_VERSION alone means `upgrade` never runs on databases
    // that already exist, the store is never created, and the transaction that
    // reads the garden fails for everyone who already had the app -- a failure
    // no other test can see, because a fresh database gets every store anyway.
    //
    // It is also the backstop for COLLECTION_SINCE_VERSION. The generic tests
    // above are driven off that table, so a new collection missing from it is
    // a collection they do not test -- this is what fires instead.
    //
    // If this fails you changed the collections. Work the checklist on
    // COLLECTION_STORES in gardenRepository.ts, raise DATABASE_VERSION so
    // installed databases gain the store, then update the numbers here.
    expect(GARDEN_COLLECTIONS).toHaveLength(11)
    expect(DATABASE_VERSION).toBe(4)
  })

  it('creates every part store when an older database is upgraded', () => {
    // The other half: the upgrade has to actually create what is missing.
    // Covered end to end by the pre-split migration tests, which start from a
    // database holding only the legacy record and end with a garden split
    // across every store.
    expect(new Set(GARDEN_COLLECTIONS).size).toBe(GARDEN_COLLECTIONS.length)
    expect(
      new Set(GARDEN_COLLECTIONS.map((c) => COLLECTION_STORES[c])).size,
    ).toBe(GARDEN_COLLECTIONS.length)
  })
})

describe('detecting what a write actually changed', () => {
  it('accounts for every field of the garden', () => {
    // Storage is split by a hand-written list of collections and meta fields.
    // A field added to AppState but to neither list would be silently dropped
    // on save and absent on load, which no other test would notice.
    const stored = new Set<string>([...META_FIELDS, ...GARDEN_COLLECTIONS])
    const fields = new Set([
      ...Object.keys(createEmptyState()),
      ...Object.keys(createInitialState('Cover', 'Cover Garden')),
    ])
    expect([...fields].filter((field) => !stored.has(field))).toEqual([])
  })

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

describe('writing only what changed', () => {
  const UNTOUCHED = ['completions', 'creatures', 'plants', 'goals'] as const

  /** Overwrite stores with a marker, so a needless rewrite is visible. */
  async function markStores() {
    const db = await openDB('butterfly-garden')
    try {
      const tx = db.transaction(UNTOUCHED, 'readwrite')
      await Promise.all([
        ...UNTOUCHED.map((store) =>
          tx.objectStore(store).put(['untouched-marker'], 'current'),
        ),
        tx.done,
      ])
    } finally {
      db.close()
    }
  }

  async function readStore(name: string): Promise<unknown> {
    const db = await openDB('butterfly-garden')
    try {
      return await db.get(name, 'current')
    } finally {
      db.close()
    }
  }

  it('leaves the collections a mood check-in did not change alone', async () => {
    const before = maturedGarden()
    await gardenRepository.save(before)
    await markStores()

    const after = checkInWithMood(before)
    await gardenRepository.save(after)

    // The markers survive only because those stores were never written to.
    for (const store of UNTOUCHED) {
      expect(await readStore(store)).toEqual(['untouched-marker'])
    }
    // What did change was written.
    expect(await readStore('moods')).toHaveLength(after.moods.length)
    expect(await readStore('sunlight')).toHaveLength(after.sunlight.length)
    expect(await readStore('meta')).toMatchObject({ nectar: after.nectar })
  })

  it('writes nothing at all when the garden did not change', async () => {
    const state = maturedGarden()
    await gardenRepository.save(state)
    await markStores()

    await gardenRepository.save({ ...state })

    for (const store of UNTOUCHED) {
      expect(await readStore(store)).toEqual(['untouched-marker'])
    }
  })

  it('writes every part of a garden it has no stored baseline for', async () => {
    const state = maturedGarden()
    // Opens the database (creating the stores) without establishing a
    // baseline: an empty garden leaves nothing on disk to diff against.
    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'empty',
    })
    await markStores()
    await gardenRepository.save(state)

    // No baseline means every part is dirty, so the markers are all replaced.
    for (const store of UNTOUCHED) {
      expect(await readStore(store)).not.toEqual(['untouched-marker'])
    }
  })

  it('keeps the pre-split record as a revert path but stops writing to it', async () => {
    await gardenRepository.save(createEmptyState())
    await writeRaw({ ...maturedGarden(), seeds: 41 })

    const loaded = await gardenRepository.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.seeds).toBe(41)

    await gardenRepository.save({ ...loaded.state, seeds: 99 })

    // Frozen at the moment of migration, so a build without the split still
    // finds a garden rather than an empty database it would onboard over.
    expect(await readStore('state')).toMatchObject({ seeds: 41 })
    expect(await readStore('meta')).toMatchObject({ seeds: 99 })
  })
})

describe('moving a pre-split garden across', () => {
  async function readStore(name: string): Promise<unknown> {
    const db = await openDB('butterfly-garden')
    try {
      return await db.get(name, 'current')
    } finally {
      db.close()
    }
  }

  it('migrates a pre-split garden on first load without losing anything', async () => {
    const original = {
      ...createInitialState('Mover', 'Moving Garden'),
      seeds: 12,
      nectar: 34,
      moods: [
        {
          id: 'mood-1',
          localDate: '2026-09-01',
          level: 4 as const,
          note: 'Kept safe across the move.',
          createdAt: '2026-09-01T09:00:00.000Z',
          updatedAt: '2026-09-01T09:00:00.000Z',
        },
      ],
    }
    await gardenRepository.save(createEmptyState())
    await writeRaw(original)

    const result = await gardenRepository.load()
    expect(result.status).toBe('loaded')
    expect(result.state).toMatchObject({
      version: 5,
      seeds: 12,
      nectar: 34,
      moods: original.moods,
      plants: original.plants,
    })

    // The garden now genuinely lives in the split stores.
    expect(await readStore('meta')).toMatchObject({ seeds: 12, nectar: 34 })
    expect(await readStore('moods')).toEqual(original.moods)
    expect(await readStore('plants')).toEqual(original.plants)
  })

  it('migrates a version-two garden into the split layout', async () => {
    const legacy = {
      ...createEmptyState(),
      version: 2,
      nectar: 15,
    } as Record<string, unknown>
    delete legacy.jars
    delete legacy.jarPlacements

    await gardenRepository.save(createEmptyState())
    await writeRaw(legacy)

    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'loaded',
      state: { version: 5, nectar: 15, jars: [], jarPlacements: [] },
    })
    expect(await readStore('meta')).toMatchObject({ version: 5, nectar: 15 })
    expect(await readStore('placements')).toEqual([])
  })

  it('runs the migration only once, and reads the same garden the second time', async () => {
    await gardenRepository.save(createEmptyState())
    await writeRaw({ ...createInitialState('Once', 'Once Garden'), seeds: 8 })

    const first = await gardenRepository.load()
    expect(first.status).toBe('loaded')

    // Sabotage the legacy record. A second migration would pick this up; a
    // load that reads the split stores cannot.
    await writeRaw2({ broken: 'a second migration would read this' })

    const second = await gardenRepository.load()
    expect(second.status).toBe('loaded')
    expect(second.state.seeds).toBe(8)
  })

  /** Overwrite only the legacy record, leaving the split stores in place. */
  async function writeRaw2(record: unknown) {
    const db = await openDB('butterfly-garden')
    try {
      await db.put('state', record, 'current')
    } finally {
      db.close()
    }
  }

  it('withholds a split garden with a missing collection rather than half-reading it', async () => {
    await gardenRepository.save(createInitialState('Holey', 'Holey Garden'))

    const db = await openDB('butterfly-garden')
    try {
      await db.delete('reflections', 'current')
    } finally {
      db.close()
    }

    const result = await gardenRepository.load()
    expect(result.status).toBe('withheld')
    expect(result.reason).toBe('malformed')
    expect(await gardenRepository.quarantined()).toHaveLength(1)
  })

  it('loads a stored garden from before every new collection', async () => {
    // The regression that protects every existing gardener. A collection
    // introduced at version N was never written by a garden stored below N,
    // so its absence there is a fact about the record rather than a hole in
    // it -- and treating it as a hole would withhold every garden in the wild.
    //
    // Driven off COLLECTION_SINCE_VERSION so the next collection to be added
    // is covered by this without anyone remembering to come back here.
    const newest = Object.entries(COLLECTION_SINCE_VERSION) as Array<
      [GardenCollection, number]
    >
    const storedVersion = Math.min(...newest.map(([, since]) => since)) - 1
    const stores = newest.map(([collection]) => COLLECTION_STORES[collection])

    await gardenRepository.save(createInitialState('Before', 'Before Garden'))

    const db = await openDB('butterfly-garden')
    try {
      const meta = (await db.get('meta', 'current')) as Record<string, unknown>
      const tx = db.transaction(['meta', ...stores], 'readwrite')
      await Promise.all([
        tx.objectStore('meta').put({ ...meta, version: storedVersion }, 'current'),
        ...stores.map((store) => tx.objectStore(store).delete('current')),
        tx.done,
      ])
    } finally {
      db.close()
    }

    const result = await gardenRepository.load()
    expect(result.status).toBe('loaded')
    expect(result.state.version).toBe(CURRENT_STATE_VERSION)
    for (const [collection] of newest) {
      expect(result.state[collection]).toEqual([])
    }
    // Nothing was treated as damaged, so nothing was quarantined.
    expect(await gardenRepository.quarantined()).toHaveLength(0)

    // Reading it also brought the stored layout up to date, so the record no
    // longer relies on being read at the older version.
    expect(await readStore('meta')).toMatchObject({
      version: CURRENT_STATE_VERSION,
    })
    for (const store of stores) {
      expect(await readStore(store)).toEqual([])
    }
  })

  it('does not strand a migrated garden the next time meta alone changes', async () => {
    // The stored version is what makes an absent collection provably empty.
    // If a later write raised meta to 5 while leaving the collection unwritten
    // -- earning a single Nectar would do it -- the garden would then be a
    // version-5 record with a hole, and the next launch would withhold it.
    await gardenRepository.save(createInitialState('Drift', 'Drift Garden'))
    const db = await openDB('butterfly-garden')
    try {
      const meta = (await db.get('meta', 'current')) as Record<string, unknown>
      const tx = db.transaction(['meta', 'recaps', 'moonlight'], 'readwrite')
      await Promise.all([
        tx.objectStore('meta').put({ ...meta, version: 4 }, 'current'),
        tx.objectStore('recaps').delete('current'),
        tx.objectStore('moonlight').delete('current'),
        tx.done,
      ])
    } finally {
      db.close()
    }

    const migrated = await gardenRepository.load()
    expect(migrated.status).toBe('loaded')

    // Something that touches only meta, exactly as earning Nectar would.
    await gardenRepository.save({ ...migrated.state, nectar: 99 })

    await expect(gardenRepository.load()).resolves.toMatchObject({
      status: 'loaded',
      state: { nectar: 99 },
    })
    expect(await gardenRepository.quarantined()).toHaveLength(0)
  })

  it('still withholds a version-5 garden whose recaps are missing', async () => {
    // The other half of the narrowing. Once this build has written a garden
    // the collection is expected to be there, and its absence is damage --
    // exactly as it was before recaps existed.
    await gardenRepository.save(createInitialState('After', 'After Garden'))

    const db = await openDB('butterfly-garden')
    try {
      await db.delete('recaps', 'current')
    } finally {
      db.close()
    }

    const result = await gardenRepository.load()
    expect(result.status).toBe('withheld')
    expect(result.reason).toBe('malformed')
    expect(await gardenRepository.quarantined()).toHaveLength(1)
  })

  it('withholds a split garden written by a newer client', async () => {
    await gardenRepository.save(createInitialState('Ahead', 'Ahead Garden'))

    const db = await openDB('butterfly-garden')
    try {
      const meta = (await db.get('meta', 'current')) as Record<string, unknown>
      await db.put('meta', { ...meta, version: 6, seeds: 77 }, 'current')
    } finally {
      db.close()
    }

    const result = await gardenRepository.load()
    expect(result.status).toBe('withheld')
    expect(result.reason).toBe('incompatible')

    // The newer garden must survive untouched.
    expect(await readStore('meta')).toMatchObject({ version: 6, seeds: 77 })
  })
})

describe('adopting another tab\'s change', () => {
  async function readStore(name: string): Promise<unknown> {
    const db = await openDB('butterfly-garden')
    try {
      return await db.get(name, 'current')
    } finally {
      db.close()
    }
  }

  /** Write directly to one store, as another tab's save would. */
  async function writeStore(name: string, value: unknown) {
    const db = await openDB('butterfly-garden')
    try {
      await db.put(name, value, 'current')
    } finally {
      db.close()
    }
  }

  it('reads back only the parts the other tab named', async () => {
    const before = maturedGarden()
    await gardenRepository.save(before)

    // Another tab adds a mood: it writes the moods collection and the small
    // meta record, exactly as save() would. Everything else is left alone --
    // and the marker proves this read never touches those stores.
    const after = checkInWithMood(before)
    const meta = (await readStore('meta')) as Record<string, unknown>
    await writeStore('moods', after.moods)
    await writeStore('meta', { ...meta, nectar: after.nectar, seeds: after.seeds })
    const marker = ['not-read-by-adopt']
    await writeStore('completions', marker)

    const result = await gardenRepository.adopt(['meta', 'moods'])
    expect(result.status).toBe('loaded')
    expect(result.state.moods).toHaveLength(after.moods.length)
    expect(result.state.nectar).toBe(after.nectar)
    // The unnamed collection is taken from the base, not from the sabotaged
    // store, which is what proves it was never read.
    expect(result.state.completions).toEqual(before.completions)
    expect(await readStore('completions')).toEqual(marker)
  })

  it('falls back to a full load when the message names no parts', async () => {
    const stored = { ...maturedGarden(), seeds: 31 }
    await gardenRepository.save(stored)

    // An older tab, posting the message shape that predates this.
    await expect(gardenRepository.adopt(undefined)).resolves.toMatchObject({
      status: 'loaded',
      state: { seeds: 31 },
    })
  })

  it('falls back to a full load for a part it does not recognise', async () => {
    const stored = { ...maturedGarden(), seeds: 12 }
    await gardenRepository.save(stored)

    // A newer client naming a collection this build has never heard of.
    await expect(
      gardenRepository.adopt(['moods', 'constellations']),
    ).resolves.toMatchObject({ status: 'loaded', state: { seeds: 12 } })
  })

  it('falls back to a full load when a named part has gone missing', async () => {
    await gardenRepository.save(maturedGarden())

    const db = await openDB('butterfly-garden')
    try {
      await db.delete('moods', 'current')
    } finally {
      db.close()
    }

    // A hole is not an empty collection, so this must not be merged in as one.
    // The full load withholds the garden rather than guessing.
    const result = await gardenRepository.adopt(['moods'])
    expect(result.status).toBe('withheld')
  })

  it('falls back to a full load rather than merging something unreadable', async () => {
    await gardenRepository.save(maturedGarden())
    await writeStore('moods', 'not a collection')

    const result = await gardenRepository.adopt(['moods'])
    expect(result.status).toBe('withheld')
    expect(result.reason).toBe('malformed')
    // Quarantined by the ordinary load path rather than a second copy of it.
    expect(await gardenRepository.quarantined()).toHaveLength(1)
  })

  it('still withholds a garden a newer client wrote', async () => {
    await gardenRepository.save(maturedGarden())
    const meta = (await readStore('meta')) as Record<string, unknown>
    await writeStore('meta', { ...meta, version: 6 })

    const result = await gardenRepository.adopt(['meta'])
    expect(result.status).toBe('withheld')
    expect(result.reason).toBe('incompatible')
    // Untouched, exactly as the invariant requires.
    expect(await readStore('meta')).toMatchObject({ version: 6 })
  })
})

describe('reporting what a write touched', () => {
  it('names the parts it wrote so other tabs can read only those', async () => {
    const before = maturedGarden()
    await expect(gardenRepository.save(before)).resolves.toEqual(
      expect.arrayContaining(['meta', 'moods', 'plants']),
    )

    await expect(
      gardenRepository.save(checkInWithMood(before)),
    ).resolves.toEqual(['meta', 'moods', 'sunlight'])
  })

  it('reports nothing written when the garden did not change', async () => {
    const state = maturedGarden()
    await gardenRepository.save(state)
    await expect(gardenRepository.save({ ...state })).resolves.toEqual([])
  })
})
