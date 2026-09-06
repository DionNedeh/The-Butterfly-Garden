import { openDB, type DBSchema, type IDBPDatabase, type StoreNames } from 'idb'
import { createEmptyState } from '../lib/progression'
import { DEFAULT_FLIGHT_PATTERN_ID } from '../lib/flightPatterns'
import { flightPatterns } from '../data/flightPatterns'
import { jarCharacters, jarColors } from '../data/jars'
import { DEFAULT_AMBIENT_TRACK_ID } from '../data/ambientTracks'
import type { AmbientTrackId, AppState } from '../types'

/** Newest schema this build understands. Anything higher was written by a
 *  newer client and must be left untouched rather than overwritten. */
export const CURRENT_STATE_VERSION = 4
const READABLE_STATE_VERSIONS = new Set([1, 2, 3, 4])

export interface QuarantineRecord {
  id: string
  reason: 'incompatible' | 'malformed'
  storedAt: string
  raw: unknown
}

/**
 * The large collections, each of which becomes its own stored record. The
 * value is the object store that holds it; only `jarPlacements` differs from
 * its field name, because `placements` reads better as a store.
 */
export const COLLECTION_STORES = {
  goals: 'goals',
  completions: 'completions',
  moods: 'moods',
  reflections: 'reflections',
  plants: 'plants',
  creatures: 'creatures',
  sunlight: 'sunlight',
  jarPlacements: 'placements',
  jars: 'jars',
} as const

export type GardenCollection = keyof typeof COLLECTION_STORES

export const GARDEN_COLLECTIONS = Object.keys(
  COLLECTION_STORES,
) as GardenCollection[]

/**
 * Everything that is not a large collection. These are tiny and nearly always
 * change together, so they share one record rather than paying for a store
 * each.
 */
export const META_FIELDS = [
  'version',
  'profile',
  'seeds',
  'nectar',
  'stardust',
  'inventory',
  'ownedItemIds',
  'ownedFlightPatternIds',
  'selectedFlightPatternId',
] as const

export type MetaField = (typeof META_FIELDS)[number]
export type GardenPart = GardenCollection | 'meta'

/**
 * Whether two collections hold the same elements, compared by reference.
 *
 * Plain `a === b` is not enough: `awardSunlight` maps over `plants` on every
 * award, so an untouched collection still arrives with a fresh array identity
 * and a reference check would call it dirty forever. Comparing element-wise
 * costs O(n) pointer comparisons and allocates nothing, which is orders of
 * magnitude cheaper than serialising the collection to find out.
 *
 * Every update in `src/lib` replaces rather than mutates, so an element that
 * kept its identity cannot have changed. A false "unchanged" would lose data;
 * this comparison cannot produce one.
 */
export function sameCollection(
  a: readonly unknown[],
  b: readonly unknown[],
): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function metaChanged(before: AppState, after: AppState): boolean {
  for (const field of META_FIELDS) {
    const previous: unknown = before[field]
    const next: unknown = after[field]
    if (previous === next) continue
    if (
      Array.isArray(previous) &&
      Array.isArray(next) &&
      sameCollection(previous, next)
    ) {
      continue
    }
    return true
  }
  return false
}

/**
 * Which parts of the garden a write actually has to touch. With no known
 * previous state every part is dirty, which is the safe answer.
 */
export function changedParts(
  before: AppState | undefined,
  after: AppState,
): GardenPart[] {
  if (!before) return ['meta', ...GARDEN_COLLECTIONS]
  const dirty: GardenPart[] = []
  if (metaChanged(before, after)) dirty.push('meta')
  for (const collection of GARDEN_COLLECTIONS) {
    if (!sameCollection(before[collection], after[collection])) {
      dirty.push(collection)
    }
  }
  return dirty
}

/** The small fields, stored together in the `meta` record. */
export type GardenMeta = Pick<AppState, MetaField>

interface GardenDatabase extends DBSchema {
  /** The pre-split whole-garden record. Still read as the migration source. */
  state: {
    key: 'current'
    value: AppState
  }
  meta: {
    key: 'current'
    value: GardenMeta
  }
  goals: {
    key: 'current'
    value: AppState['goals']
  }
  completions: {
    key: 'current'
    value: AppState['completions']
  }
  moods: {
    key: 'current'
    value: AppState['moods']
  }
  reflections: {
    key: 'current'
    value: AppState['reflections']
  }
  plants: {
    key: 'current'
    value: AppState['plants']
  }
  creatures: {
    key: 'current'
    value: AppState['creatures']
  }
  sunlight: {
    key: 'current'
    value: AppState['sunlight']
  }
  jars: {
    key: 'current'
    value: AppState['jars']
  }
  placements: {
    key: 'current'
    value: AppState['jarPlacements']
  }
  quarantine: {
    key: string
    value: QuarantineRecord
  }
}

/** Every store this build expects to exist, created on upgrade if missing. */
const OBJECT_STORES = [
  'state',
  'meta',
  'goals',
  'completions',
  'moods',
  'reflections',
  'plants',
  'creatures',
  'sunlight',
  'jars',
  'placements',
  'quarantine',
] as const

const DATABASE_NAME = 'butterfly-garden'
/**
 * Which object stores exist. Distinct from AppState.version, which describes
 * the shape of the document and is unchanged by the split: bumping that
 * instead would make every existing client treat its own data as written by a
 * newer build and refuse to write.
 */
const DATABASE_VERSION = 3
let databasePromise: Promise<IDBPDatabase<GardenDatabase>> | undefined

/**
 * The state believed to be on disk, used to work out what a write must touch.
 * Set only after a load or a write that actually committed, so a failed write
 * leaves it pointing at the last known-good garden and the next attempt
 * recomputes the same work rather than trusting a write that never landed.
 */
let persisted: AppState | undefined

/**
 * The write currently committing, if there is one. A read that merges onto
 * `persisted` waits for this first, so it can never build on a base that is
 * about to be replaced by a write already in flight.
 */
let pendingWrite: Promise<void> = Promise.resolve()

/** Whether a value names parts of the garden this build knows how to read. */
function knownParts(value: unknown): value is GardenPart[] {
  if (!Array.isArray(value) || value.length === 0) return false
  const known = new Set<string>(['meta', ...GARDEN_COLLECTIONS])
  return value.every((part) => typeof part === 'string' && known.has(part))
}

/** Stores holding the split garden. The legacy record is deliberately not
 *  among them: it is read only when there is no split garden to read. */
const PART_STORES: StoreNames<GardenDatabase>[] = [
  'meta',
  ...GARDEN_COLLECTIONS.map((collection) => COLLECTION_STORES[collection]),
]

function metaOf(state: AppState): GardenMeta {
  return {
    version: state.version,
    profile: state.profile,
    seeds: state.seeds,
    nectar: state.nectar,
    stardust: state.stardust,
    inventory: state.inventory,
    ownedItemIds: state.ownedItemIds,
    ownedFlightPatternIds: state.ownedFlightPatternIds,
    selectedFlightPatternId: state.selectedFlightPatternId,
  }
}

function database() {
  databasePromise ??= openDB<GardenDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      // Creating stores is all that happens here. Data is moved lazily on the
      // first load instead, because a version-change transaction is an awkward
      // place to do async work and a half-finished migration inside one is
      // precisely the silent loss this repository exists to prevent.
      for (const store of OBJECT_STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      }
    },
  })
  return databasePromise
}

const CREATURE_STAGES = new Set(['egg', 'caterpillar', 'chrysalis', 'butterfly'])
const AMBIENT_TRACK_IDS = new Set<AmbientTrackId>([
  'garden-chimes',
  'garden',
  'piano-music',
])

function migrateCreatures(creatures: unknown[]): AppState['creatures'] {
  return creatures
    .filter((creature): creature is Record<string, unknown> => {
      return Boolean(creature) && typeof creature === 'object'
    })
    .filter(
      (creature) =>
        typeof creature.id === 'string' &&
        typeof creature.speciesId === 'string',
    )
    .map((creature) => {
      // 1.x used 'emerged' as the final stage; 2.0 renames it 'butterfly'
      // and adds the 'egg' stage plus per-stage care tracking.
      const rawStage = creature.stage === 'emerged' ? 'butterfly' : creature.stage
      const stage = (
        typeof rawStage === 'string' && CREATURE_STAGES.has(rawStage)
          ? rawStage
          : 'caterpillar'
      ) as AppState['creatures'][number]['stage']
      return {
        ...(creature as unknown as AppState['creatures'][number]),
        stage,
        careDates:
          creature.careDates && typeof creature.careDates === 'object'
            ? (creature.careDates)
            : {},
        actionLog:
          creature.actionLog && typeof creature.actionLog === 'object'
            ? (creature.actionLog as Record<string, string>)
            : {},
        bond: typeof creature.bond === 'number' ? creature.bond : 0,
        outfit:
          creature.outfit && typeof creature.outfit === 'object'
            ? (creature.outfit)
            : {},
        carePoints:
          typeof creature.carePoints === 'number' ? creature.carePoints : 0,
      }
    })
}

/**
 * Why a stored record could not be read. 'incompatible' means a newer client
 * wrote it; that data is still good and must never be overwritten.
 */
export function classifyRecord(
  value: unknown,
): 'readable' | 'incompatible' | 'malformed' {
  if (!value || typeof value !== 'object') return 'malformed'
  const version = (value as Record<string, unknown>).version
  if (typeof version === 'number' && version > CURRENT_STATE_VERSION) {
    return 'incompatible'
  }
  return migrateState(value) ? 'readable' : 'malformed'
}

function migrateState(value: unknown): AppState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.version !== 'number' ||
    !READABLE_STATE_VERSIONS.has(candidate.version) ||
    !Array.isArray(candidate.goals) ||
    !Array.isArray(candidate.completions) ||
    !Array.isArray(candidate.moods) ||
    !Array.isArray(candidate.reflections) ||
    !Array.isArray(candidate.plants) ||
    !Array.isArray(candidate.creatures) ||
    !Array.isArray(candidate.sunlight) ||
    typeof candidate.seeds !== 'number'
  ) {
    return undefined
  }
  const knownPatternIds = new Set(flightPatterns.map((pattern) => pattern.id))
  const owned = [
    DEFAULT_FLIGHT_PATTERN_ID,
    ...(Array.isArray(candidate.ownedFlightPatternIds)
      ? candidate.ownedFlightPatternIds.filter(
          (id): id is AppState['ownedFlightPatternIds'][number] =>
            typeof id === 'string' &&
            knownPatternIds.has(id as AppState['ownedFlightPatternIds'][number]),
        )
      : []),
  ].filter((id, index, ids) => ids.indexOf(id) === index)
  const selected =
    typeof candidate.selectedFlightPatternId === 'string' &&
    owned.includes(
      candidate.selectedFlightPatternId as AppState['selectedFlightPatternId'],
    )
      ? candidate.selectedFlightPatternId
      : DEFAULT_FLIGHT_PATTERN_ID
  const knownColorIds = new Set<string>(jarColors.map((color) => color.id))
  const jars = Array.isArray(candidate.jars)
    ? candidate.jars.filter(
        (
          jar,
        ): jar is AppState['jars'][number] & Record<string, unknown> => {
          if (!jar || typeof jar !== 'object') return false
          const item = jar as Record<string, unknown>
          return (
            typeof item.id === 'string' &&
            typeof item.character === 'string' &&
            jarCharacters.includes(item.character) &&
            typeof item.colorId === 'string' &&
            knownColorIds.has(item.colorId) &&
            typeof item.purchasedAt === 'string'
          )
        },
      )
    : []
  const knownJarIds = new Set(jars.map((jar) => jar.id))
  const knownPlantIds = new Set(
    candidate.plants
      .filter((plant): plant is Record<string, unknown> => {
        return Boolean(plant) && typeof plant === 'object'
      })
      .map((plant) => plant.id)
      .filter((id): id is string => typeof id === 'string'),
  )
  const placedJarIds = new Set<string>()
  const placedPlantIds = new Set<string>()
  const jarPlacements = Array.isArray(candidate.jarPlacements)
    ? candidate.jarPlacements.filter(
        (
          placement,
        ): placement is AppState['jarPlacements'][number] &
          Record<string, unknown> => {
          if (!placement || typeof placement !== 'object') return false
          const item = placement as Record<string, unknown>
          if (
            typeof item.jarId !== 'string' ||
            typeof item.plantId !== 'string' ||
            !knownJarIds.has(item.jarId) ||
            !knownPlantIds.has(item.plantId) ||
            placedJarIds.has(item.jarId) ||
            placedPlantIds.has(item.plantId)
          ) {
            return false
          }
          placedJarIds.add(item.jarId)
          placedPlantIds.add(item.plantId)
          return true
        },
      )
    : []
  const candidateProfile =
    candidate.profile && typeof candidate.profile === 'object'
      ? (candidate.profile as Record<string, unknown>)
      : undefined
  const ambientTrack =
    typeof candidateProfile?.ambientTrack === 'string' &&
    AMBIENT_TRACK_IDS.has(candidateProfile.ambientTrack as AmbientTrackId)
      ? (candidateProfile.ambientTrack as AmbientTrackId)
      : DEFAULT_AMBIENT_TRACK_ID
  return {
    ...(candidate as unknown as AppState),
    version: 4,
    profile: candidateProfile
      ? {
          ...(candidateProfile as unknown as NonNullable<AppState['profile']>),
          ambientTrack,
        }
      : undefined,
    creatures: migrateCreatures(candidate.creatures),
    nectar: typeof candidate.nectar === 'number' ? candidate.nectar : 0,
    stardust: typeof candidate.stardust === 'number' ? candidate.stardust : 0,
    inventory:
      candidate.inventory && typeof candidate.inventory === 'object'
        ? (candidate.inventory as Record<string, number>)
        : {},
    ownedItemIds: Array.isArray(candidate.ownedItemIds)
      ? candidate.ownedItemIds.filter(
          (id): id is string => typeof id === 'string',
        )
      : [],
    ownedFlightPatternIds: owned,
    selectedFlightPatternId: selected as AppState['selectedFlightPatternId'],
    jars,
    jarPlacements,
  }
}

/** Read every part of the split garden in one transaction. */
async function readParts(
  db: IDBPDatabase<GardenDatabase>,
): Promise<{ meta: unknown; collections: unknown[] }> {
  const tx = db.transaction(PART_STORES, 'readonly')
  const requests = [
    tx.objectStore('meta').get('current') as Promise<unknown>,
    ...GARDEN_COLLECTIONS.map((collection) =>
      (
        tx.objectStore(COLLECTION_STORES[collection]) as {
          get: (key: 'current') => Promise<unknown>
        }
      ).get('current'),
    ),
  ]
  const [meta, ...collections] = await Promise.all(requests)
  await tx.done
  return { meta, collections }
}

/** Read just the named parts, in one transaction. */
async function readNamedParts(
  db: IDBPDatabase<GardenDatabase>,
  parts: GardenPart[],
): Promise<Map<GardenPart, unknown>> {
  const stores = parts.map((part) =>
    part === 'meta' ? 'meta' : COLLECTION_STORES[part],
  )
  const tx = db.transaction(stores, 'readonly')
  const requests = parts.map((part) =>
    (
      tx.objectStore(part === 'meta' ? 'meta' : COLLECTION_STORES[part]) as {
        get: (key: 'current') => Promise<unknown>
      }
    ).get('current'),
  )
  const values = await Promise.all(requests)
  await tx.done
  return new Map(parts.map((part, index) => [part, values[index]]))
}

/** Write the whole garden across every part store, atomically. */
async function writeAllParts(
  db: IDBPDatabase<GardenDatabase>,
  state: AppState,
): Promise<void> {
  const tx = db.transaction(PART_STORES, 'readwrite')
  const writes: Promise<unknown>[] = [
    tx.objectStore('meta').put(metaOf(state), 'current'),
  ]
  for (const collection of GARDEN_COLLECTIONS) {
    const store = tx.objectStore(COLLECTION_STORES[collection]) as {
      put: (value: unknown, key: 'current') => Promise<unknown>
    }
    writes.push(store.put(state[collection], 'current'))
  }
  await Promise.all([...writes, tx.done])
}

/** Rebuild the AppState the rest of the app expects from its stored parts. */
function assembleGarden(meta: unknown, collections: unknown[]): unknown {
  const assembled: Record<string, unknown> = {
    ...(meta && typeof meta === 'object' ? meta : {}),
  }
  GARDEN_COLLECTIONS.forEach((collection, index) => {
    assembled[collection] = collections[index]
  })
  return assembled
}

/**
 * What happened when the garden was read back.
 *
 * - `loaded`   a real garden was found and migrated.
 * - `empty`    nothing has been stored yet (a genuinely new gardener).
 * - `withheld` a record exists but this build cannot read it. The state
 *              handed back is empty *for display only* — writing over the
 *              stored record would destroy the gardener's data, so callers
 *              must stay read-only until the user resolves it.
 */
export type LoadStatus = 'loaded' | 'empty' | 'withheld'

export interface LoadResult {
  status: LoadStatus
  state: AppState
  /** Present when status is 'withheld'. */
  reason?: 'incompatible' | 'malformed' | 'unavailable'
}

async function quarantine(
  raw: unknown,
  reason: 'incompatible' | 'malformed',
): Promise<void> {
  try {
    const id = `${reason}-${new Date().toISOString()}`
    const db = await database()
    await db.put('quarantine', { id, reason, storedAt: new Date().toISOString(), raw }, id)
  } catch {
    // Quarantining is best effort; never let it mask the original problem.
  }
}

/**
 * Validate a garden that came from an exported backup file. Returns undefined
 * when the file is not a garden this build can read.
 */
export function readImportedState(value: unknown): AppState | undefined {
  const payload =
    value && typeof value === 'object' && 'garden' in (value)
      ? (value).garden
      : value
  return migrateState(payload)
}

/**
 * Move a pre-split garden into the split stores, or report that there is
 * nothing to move.
 *
 * The legacy record is left in place afterwards, on purpose. It is the
 * migration's source, so keeping it is what makes a revert of this work
 * possible, and it means a build without the split still finds a garden
 * rather than an empty database that it would onboard over. It does go stale
 * from this point, since writes now go to the split stores only.
 *
 * If the process dies before the write below commits, the split stores stay
 * empty and the next launch simply runs this again -- nothing is lost.
 */
async function loadFromLegacyRecord(
  db: IDBPDatabase<GardenDatabase>,
): Promise<LoadResult> {
  let legacy: unknown
  try {
    legacy = await db.get('state', 'current')
  } catch {
    persisted = undefined
    return {
      status: 'withheld',
      state: createEmptyState(),
      reason: 'unavailable',
    }
  }

  if (legacy === undefined) {
    persisted = undefined
    return { status: 'empty', state: createEmptyState() }
  }

  const migrated = migrateState(legacy)
  if (!migrated) {
    const reason =
      classifyRecord(legacy) === 'incompatible' ? 'incompatible' : 'malformed'
    await quarantine(legacy, reason)
    persisted = undefined
    return { status: 'withheld', state: createEmptyState(), reason }
  }

  try {
    await writeAllParts(db, migrated)
  } catch {
    // The legacy record is untouched, so this is safe to retry on the next
    // launch. Staying read-only until then keeps the two layouts from
    // diverging in the meantime.
    persisted = undefined
    return {
      status: 'withheld',
      state: createEmptyState(),
      reason: 'unavailable',
    }
  }

  persisted = migrated
  return { status: 'loaded', state: migrated }
}

export const gardenRepository = {
  /**
   * Read the garden. A record this build cannot understand is preserved and
   * reported as 'withheld' rather than silently replaced with a blank garden.
   */
  async load(): Promise<LoadResult> {
    let db: IDBPDatabase<GardenDatabase>
    let parts: { meta: unknown; collections: unknown[] }
    try {
      db = await database()
      parts = await readParts(db)
    } catch {
      persisted = undefined
      return {
        status: 'withheld',
        state: createEmptyState(),
        reason: 'unavailable',
      }
    }

    const { meta, collections } = parts
    const nothingStored =
      meta === undefined && collections.every((part) => part === undefined)

    // No split garden: either a pre-split one to move across, or a new
    // gardener. The legacy record is read only here, so an ordinary launch
    // never pays to deserialise the snapshot left behind by the migration.
    if (nothingStored) return await loadFromLegacyRecord(db)

    // A hole in an otherwise present garden cannot be filled in by guessing:
    // an absent collection is not an empty one. Withhold the whole garden
    // rather than hand back a half-read one.
    const complete =
      meta !== undefined && collections.every((part) => part !== undefined)
    const candidate = complete ? assembleGarden(meta, collections) : undefined
    const migrated = candidate ? migrateState(candidate) : undefined
    if (migrated) {
      persisted = migrated
      return { status: 'loaded', state: migrated }
    }

    const storedVersion = (meta as { version?: unknown } | undefined)?.version
    const reason =
      typeof storedVersion === 'number' && storedVersion > CURRENT_STATE_VERSION
        ? 'incompatible'
        : 'malformed'
    // Quarantine the whole assembled candidate: half a garden is not something
    // anyone could put back together by hand.
    await quarantine(candidate ?? assembleGarden(meta, collections), reason)
    persisted = undefined
    return { status: 'withheld', state: createEmptyState(), reason }
  },

  /**
   * Write the garden, touching only the parts that changed.
   *
   * Everything goes in one transaction so the stored garden is never
   * internally inconsistent -- a creature that references a plant must not
   * survive a partial write in which the plant is missing. Rejects on failure
   * so callers can tell the user.
   */
  async save(state: AppState): Promise<GardenPart[]> {
    const dirty = changedParts(persisted, state)
    if (dirty.length === 0) return []

    const stores: StoreNames<GardenDatabase>[] = dirty.map((part) =>
      part === 'meta' ? 'meta' : COLLECTION_STORES[part],
    )

    const db = await database()
    const write = (async () => {
      const tx = db.transaction(stores, 'readwrite')
      const writes: Promise<unknown>[] = []
      for (const part of dirty) {
        if (part === 'meta') {
          writes.push(tx.objectStore('meta').put(metaOf(state), 'current'))
          continue
        }
        // The store and the field it holds are paired by COLLECTION_STORES,
        // but that correspondence is beyond what the index signature can
        // express.
        const store = tx.objectStore(COLLECTION_STORES[part]) as {
          put: (value: unknown, key: 'current') => Promise<unknown>
        }
        writes.push(store.put(state[part], 'current'))
      }
      await Promise.all([...writes, tx.done])
      persisted = state
    })()
    // Published before it is awaited so a sync arriving mid-write can wait for
    // it; a rejection is handled by the caller, not by this handle.
    pendingWrite = write.then(
      () => undefined,
      () => undefined,
    )
    await write
    return dirty
  },

  /**
   * Adopt a change another tab just wrote, reading only the parts it named.
   *
   * Before the garden was split there was one record, so any change meant
   * re-reading all of it. Now a mood check-in in one tab made every other tab
   * deserialise and re-validate the whole garden to learn about one entry.
   *
   * Anything unexpected falls back to a full load, which is always correct:
   * an older tab that names no parts, a part this build does not know, no
   * trustworthy base to merge onto, a store that has since emptied, or a merge
   * that fails validation -- that last case goes back through load() so the
   * quarantine path handles it rather than being reimplemented here.
   */
  async adopt(parts: unknown): Promise<LoadResult> {
    if (!knownParts(parts)) return await gardenRepository.load()
    await pendingWrite

    let values: Map<GardenPart, unknown>
    try {
      values = await readNamedParts(await database(), parts)
    } catch {
      return await gardenRepository.load()
    }

    // Read after the awaits: a write that landed while this was reading has
    // already updated the base, and merging onto the older one would undo it.
    const base = persisted
    if (!base) return await gardenRepository.load()

    const candidate: Record<string, unknown> = { ...base }
    for (const [part, value] of values) {
      if (value === undefined) return await gardenRepository.load()
      if (part === 'meta') {
        Object.assign(candidate, value as Record<string, unknown>)
        continue
      }
      candidate[part] = value
    }

    const migrated = migrateState(candidate)
    if (!migrated) return await gardenRepository.load()
    persisted = migrated
    return { status: 'loaded', state: migrated }
  },

  /** Records this build could not read, kept so they are never lost. */
  async quarantined(): Promise<QuarantineRecord[]> {
    try {
      return await (await database()).getAll('quarantine')
    } catch {
      return []
    }
  },

  async clearQuarantine(): Promise<void> {
    const db = await database()
    await db.clear('quarantine')
  },

  /**
   * Delete every trace of the garden. Rejects if another tab still holds the
   * database open — reporting success there would be a lie about deleted data.
   */
  async clear(): Promise<void> {
    const db = await database()
    db.close()
    databasePromise = undefined
    persisted = undefined
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DATABASE_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () =>
        reject(request.error ?? new Error('The garden could not be deleted.'))
      request.onblocked = () =>
        reject(
          new Error(
            'Another open tab of the garden is holding your data. Close the other tabs and try again.',
          ),
        )
    })
  },
}
