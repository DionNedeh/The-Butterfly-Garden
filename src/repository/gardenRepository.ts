import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createEmptyState } from '../lib/progression'
import { DEFAULT_FLIGHT_PATTERN_ID } from '../lib/flightPatterns'
import { flightPatterns } from '../data/flightPatterns'
import { jarCharacters, jarColors } from '../data/jars'
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
    (candidate.version !== 1 &&
      candidate.version !== 2 &&
      candidate.version !== 3) ||
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
  return {
    ...(candidate as unknown as AppState),
    version: 3,
    nectar: typeof candidate.nectar === 'number' ? candidate.nectar : 0,
    ownedFlightPatternIds: owned as AppState['ownedFlightPatternIds'],
    selectedFlightPatternId: selected as AppState['selectedFlightPatternId'],
    jars,
    jarPlacements,
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
