import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createEmptyState } from '../lib/progression'
import { DEFAULT_FLIGHT_PATTERN_ID } from '../lib/flightPatterns'
import { flightPatterns } from '../data/flightPatterns'
import type { AppState } from '../types'

interface GardenDatabase extends DBSchema {
  state: {
    key: 'current'
    value: AppState
  }
}

const DATABASE_NAME = 'butterfly-garden'
const DATABASE_VERSION = 1
let databasePromise: Promise<IDBPDatabase<GardenDatabase>> | undefined

function database() {
  databasePromise ??= openDB<GardenDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('state')) {
        db.createObjectStore('state')
      }
    },
  })
  return databasePromise
}

function migrateState(value: unknown): AppState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Record<string, unknown>
  if (
    (candidate.version !== 1 && candidate.version !== 2) ||
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
  return {
    ...(candidate as unknown as AppState),
    version: 2,
    nectar: typeof candidate.nectar === 'number' ? candidate.nectar : 0,
    ownedFlightPatternIds: owned as AppState['ownedFlightPatternIds'],
    selectedFlightPatternId: selected as AppState['selectedFlightPatternId'],
  }
}

export const gardenRepository = {
  async load(): Promise<AppState> {
    try {
      const saved = await (await database()).get('state', 'current')
      return migrateState(saved) ?? createEmptyState()
    } catch {
      return createEmptyState()
    }
  },

  async save(state: AppState): Promise<void> {
    await (await database()).put('state', state, 'current')
  },

  async clear(): Promise<void> {
    const db = await database()
    db.close()
    databasePromise = undefined
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DATABASE_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    })
  },
}
