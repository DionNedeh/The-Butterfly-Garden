import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createEmptyState } from '../lib/progression'
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

function isValidState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<AppState>
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.goals) &&
    Array.isArray(candidate.plants) &&
    Array.isArray(candidate.creatures)
  )
}

export const gardenRepository = {
  async load(): Promise<AppState> {
    try {
      const saved = await (await database()).get('state', 'current')
      return isValidState(saved) ? saved : createEmptyState()
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
