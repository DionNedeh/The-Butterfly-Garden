import type { AppState, Sighting } from '../types'
import { DAILY_PREFIX, isSealed, type SnapshotRecord } from './gardenRepository'
import { storedVersionOf } from './validateGarden'
import { toLocalDate } from '../lib/date'

/*
 * Daily copies: the garden as it stood before each day's first change, for
 * the last seven days the garden changed. They are there to put a mistake
 * right -- a wrong delete, a restore of the wrong file -- and say so; they
 * live beside the garden, so they go wherever it goes if the browser clears
 * the site's storage. A backup file is still the only copy that survives
 * that.
 *
 * The repository takes one in the same transaction as the day's first
 * change of the gardener's own (gardenRepository, copyBeforeToday), and
 * loads this module to make it, so a day without one never downloads it.
 *
 * What they keep, and what they leave out. A field book's photos (up to 50
 * of 400 KB) would make a week of copies twenty times larger than the
 * journal they protect, so a daily copy leaves them out, and one put back
 * keeps the photos the field book has now (withPhotosOf). Everything else is
 * kept whole, the gardener's own backdrops too (three at most). Should the
 * copies still grow large, fewer are kept (DAILY_COPY_BUDGET), never fewer
 * than two.
 *
 * Under the garden lock a copy is sealed as the repository seals a restore's
 * (sealedStores, sealGarden), so it is as unreadable at rest as the garden.
 */

/** How many daily copies are kept: a week of days the garden changed. */
export const DAILY_COPY_LIMIT = 7

/** About how much room the daily copies may take together before fewer are kept. */
export const DAILY_COPY_BUDGET = 24 * 1024 * 1024

/** The fewest daily copies kept, however large a garden grows. */
const DAILY_COPY_FLOOR = 2

/** A daily copy made and ready to go in with the day's first change. */
export interface PreparedDaily {
  day: string
  record: SnapshotRecord
  /** Keep it, inside the write's own transaction, unless the day has one. */
  keepIn: (store: unknown) => Promise<void>
}

/** The snapshots store as a write's transaction hands it over. */
interface SnapshotStore {
  getKey(key: string): Promise<IDBValidKey | undefined>
  put(value: SnapshotRecord, key: string): Promise<IDBValidKey>
  getAllKeys(query: IDBKeyRange): Promise<IDBValidKey[]>
  getAll(query: IDBKeyRange): Promise<SnapshotRecord[]>
  delete(key: IDBValidKey): Promise<void>
}

/** A daily copy as Settings lists it. */
export interface EarlierCopy {
  id: string
  reason?: 'daily' | 'restore'
  gardenName?: string
  takenAt?: string
  /** The local day it was kept, before that day's first change. */
  day: string
  /** What it held, when it can be opened here (not under a lock this tab cannot open). */
  held?: { checkIns: number; reflections: number; goals: number }
}

/**
 * About how many bytes a stored value takes: its text, its bytes and its
 * Blobs. Close enough to say "about 2 MB" honestly, and to decide how many
 * copies fit, without asking the browser to serialise anything.
 */
export function sizeOf(value: unknown): number {
  if (typeof value === 'string') return value.length
  if (value instanceof Blob) return value.size
  if (ArrayBuffer.isView(value)) return value.byteLength
  if (Array.isArray(value)) {
    let total = 0
    for (const item of value) total += sizeOf(item)
    return total
  }
  if (value && typeof value === 'object') {
    let total = 0
    for (const [key, item] of Object.entries(value)) total += key.length + sizeOf(item)
    return total
  }
  return 8
}

/** The garden with its field book's photos left out. */
export function withoutPhotos(garden: AppState): AppState {
  if (!garden.sightings.some((sighting) => sighting.photo)) return garden
  return {
    ...garden,
    sightings: garden.sightings.map((sighting) => {
      if (!sighting.photo) return sighting
      const copy: Sighting = { ...sighting }
      delete copy.photo
      return copy
    }),
  }
}

/**
 * A copy to put back over the garden `now`. Each sighting gets back the
 * photo it has now, if it still has one; a sighting deleted since comes back
 * without its photo. The last backup on record stays the newest one: a copy
 * from this device is not a copy kept anywhere else.
 */
export function withPhotosOf(copy: AppState, now: AppState | undefined): AppState {
  const photos = new Map<string, Blob>()
  for (const sighting of now?.sightings ?? []) {
    if (sighting.photo) photos.set(sighting.id, sighting.photo)
  }
  const lastBackupAt = now?.profile?.lastBackupAt
  return {
    ...copy,
    sightings: photos.size
      ? copy.sightings.map((sighting) => {
          const photo = photos.get(sighting.id)
          return photo && !sighting.photo ? { ...sighting, photo } : sighting
        })
      : copy.sightings,
    profile: copy.profile && lastBackupAt && (!copy.profile.lastBackupAt || lastBackupAt > copy.profile.lastBackupAt)
      ? { ...copy.profile, lastBackupAt } : copy.profile,
  }
}

/** How many daily copies to keep, given how large the newest one is. */
export function dailyCopiesKept(bytes: number): number {
  return Math.max(
    DAILY_COPY_FLOOR,
    Math.min(DAILY_COPY_LIMIT, Math.floor(DAILY_COPY_BUDGET / Math.max(1, bytes))),
  )
}

/**
 * Keep a daily copy, unless another tab kept the day's first, and let the
 * oldest go. Only requests on the store: it runs inside a write's
 * transaction, which anything else awaited would close early. It never
 * rejects: a copy refused outright is simply not kept, and the change it
 * went in with is. (A request that fails later aborts the whole
 * transaction, and the repository writes the change again without it.)
 */
async function keepDaily(store: SnapshotStore, record: SnapshotRecord): Promise<void> {
  try {
    if ((await store.getKey(record.id)) !== undefined) return
    await store.put(record, record.id)
    const keys = await store.getAllKeys(IDBKeyRange.bound(DAILY_PREFIX, `${DAILY_PREFIX}\uffff`))
    // Ids name their day, so they sort oldest first.
    for (const key of keys.slice(0, -dailyCopiesKept(record.bytes ?? 0))) await store.delete(key)
    const remaining = await store.getAll(IDBKeyRange.bound(DAILY_PREFIX, `${DAILY_PREFIX}\uffff`))
    let bytes = remaining.reduce((sum, copy) => sum + (copy.bytes ?? sizeOf(copy.garden)), 0)
    while (remaining.length > DAILY_COPY_FLOOR && bytes > DAILY_COPY_BUDGET) {
      const oldest = remaining.shift()!
      bytes -= oldest.bytes ?? sizeOf(oldest.garden)
      await store.delete(oldest.id)
    }
  } catch {
    // Not kept today.
  }
}

/**
 * Make the day's copy of `garden`, the garden as stored before the day's
 * first change: photos left out, measured, and sealed under the lock when
 * `key` is given.
 */
export async function prepareDaily(
  garden: AppState,
  day: string,
  key?: CryptoKey,
): Promise<PreparedDaily> {
  const plain = { ...withoutPhotos(garden), version: storedVersionOf() }
  const record: SnapshotRecord = {
    id: `${DAILY_PREFIX}${day}`,
    reason: 'daily',
    day,
    takenAt: new Date().toISOString(),
    bytes: sizeOf(plain),
    garden: key ? await (await import('./sealedStores')).sealGarden(key, plain) : plain,
  }
  return { day, record, keepIn: (store) => keepDaily(store as SnapshotStore, record) }
}

/** What a stored copy held, in counts, or undefined when it cannot be opened here. */
async function heldIn(garden: unknown, key: CryptoKey | undefined): Promise<Pick<EarlierCopy, 'held' | 'gardenName'>> {
  try {
    const opened = isSealed(garden)
      ? key && (await (await import('./sealedStores')).openGarden(key, garden))
      : garden
    if (!opened || typeof opened !== 'object') return {}
    const { moods, reflections, goals, profile } = opened as Record<string, unknown>
    const count = (list: unknown) => (Array.isArray(list) ? list.length : 0)
    return { held: { checkIns: count(moods), reflections: count(reflections), goals: count(goals) },
      gardenName: (profile as { gardenName?: string } | undefined)?.gardenName }
  } catch {
    return {}
  }
}

/**
 * The daily copies among the stored snapshots, newest first, and about how
 * much room every snapshot takes, a restore's included.
 */
export async function describeCopies(
  records: readonly SnapshotRecord[],
  key: CryptoKey | undefined,
): Promise<{ copies: EarlierCopy[]; bytes: number }> {
  let bytes = 0
  const copies: EarlierCopy[] = []
  for (const record of records) {
    bytes += typeof record.bytes === 'number' ? record.bytes : sizeOf(record.garden)
    if (record.reason !== 'daily' && record.reason !== 'restore') continue
    const taken = new Date(record.takenAt)
    copies.push({ id: record.id, reason: record.reason,
      ...(record.reason === 'restore' ? { takenAt: record.takenAt } : {}),
      day: record.day ?? (Number.isNaN(taken.getTime()) ? record.takenAt.slice(0, 10) : toLocalDate(taken)),
      ...await heldIn(record.garden, key) })
  }
  copies.sort((a, b) => b.day.localeCompare(a.day))
  return { copies, bytes }
}
