import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
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

interface GardenDatabase extends DBSchema {
  state: {
    key: 'current'
    value: AppState
  }
  quarantine: {
    key: string
    value: QuarantineRecord
  }
}

const DATABASE_NAME = 'butterfly-garden'
const DATABASE_VERSION = 2
let databasePromise: Promise<IDBPDatabase<GardenDatabase>> | undefined

function database() {
  databasePromise ??= openDB<GardenDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state')
      }
      if (!db.objectStoreNames.contains('quarantine')) {
        db.createObjectStore('quarantine')
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

export const gardenRepository = {
  /**
   * Read the garden. A record this build cannot understand is preserved and
   * reported as 'withheld' rather than silently replaced with a blank garden.
   */
  async load(): Promise<LoadResult> {
    let saved: unknown
    try {
      saved = await (await database()).get('state', 'current')
    } catch {
      return {
        status: 'withheld',
        state: createEmptyState(),
        reason: 'unavailable',
      }
    }
    if (saved === undefined) {
      return { status: 'empty', state: createEmptyState() }
    }
    const migrated = migrateState(saved)
    if (migrated) return { status: 'loaded', state: migrated }

    const reason = classifyRecord(saved) === 'incompatible' ? 'incompatible' : 'malformed'
    await quarantine(saved, reason)
    return { status: 'withheld', state: createEmptyState(), reason }
  },

  /** Write the garden. Rejects on failure so callers can tell the user. */
  async save(state: AppState): Promise<void> {
    await (await database()).put('state', state, 'current')
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
