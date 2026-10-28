import { Blob as NodeBlob } from 'node:buffer'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLock } from '../lib/gardenLock'
import { createInitialState } from '../lib/progression'
import { markQuietWrite } from '../lib/quietWrites'
import { newRecoveryCode } from '../lib/recoveryCode'
import type { AppState, Sighting } from '../types'
import {
  dailyCopiesKept,
  DAILY_COPY_BUDGET,
  describeCopies,
  sizeOf,
  withoutPhotos,
  withPhotosOf,
} from './dailyCopies'
import { BACKUP_FILE_KEY, createGardenRepository, isSealed, type SnapshotRecord } from './gardenRepository'
import { sealValue } from './sealedStores'

/*
 * Daily copies (plan c.6): the garden as it stood before each day's first
 * change, seven days of them, kept apart from the copies a restore keeps,
 * sealed under the lock like everything else that holds the journal. Days
 * are moved by the clock alone; IndexedDB keeps its own timers.
 */

let counter = 0
const names: string[] = []
function freshName() {
  counter += 1
  const name = `daily-copies-${counter}`
  names.push(name)
  return name
}

beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.useFakeTimers({ toFake: ['Date'] })
  onDay(20)
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const name of names.splice(0)) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }
})

/** Nine in the morning, local time, on a day of October 2026. */
function onDay(day: number, hour = 9) {
  vi.setSystemTime(new Date(2026, 9, day, hour))
}

/** Quick derivations for tests; the app always uses the full count. */
const FAST = 1_000
const PHRASE = 'What I said to my brother on the phone'
const PHOTO = [82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 7, 250, 0, 128]

function garden(seeds = 2): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
    seeds,
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-19',
        level: 2,
        note: PHRASE,
        createdAt: '2026-10-19T09:00:00.000Z',
        updatedAt: '2026-10-19T09:00:00.000Z',
      },
    ],
  }
}

function withPhoto(base: AppState): AppState {
  const sightings: Sighting[] = [
    {
      id: 'sighting-1',
      date: '2026-10-19',
      kind: 'butterfly',
      speciesId: 'monarch',
      photo: new Blob([new Uint8Array(PHOTO)], { type: 'image/webp' }),
      createdAt: '2026-10-19T15:00:00.000Z',
    },
    {
      id: 'sighting-2',
      date: '2026-10-19',
      kind: 'plant',
      plantId: 'aster',
      createdAt: '2026-10-19T16:00:00.000Z',
    },
  ]
  return { ...base, sightings }
}

async function storedSnapshots(name: string): Promise<SnapshotRecord[]> {
  const db = await openDB(name)
  try {
    return (await db.getAll('snapshots')) as SnapshotRecord[]
  } finally {
    db.close()
  }
}

async function dailyDays(name: string): Promise<string[]> {
  return (await storedSnapshots(name))
    .filter((record) => record.reason === 'daily')
    .map((record) => record.day!)
}

describe('a daily copy', () => {
  it('keeps the garden as it stood before the day’s first change, once a day', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    // A new garden's first write has nothing before it to keep.
    await repository.save(garden(2))
    expect(await dailyDays(name)).toEqual([])

    await repository.save(garden(3))
    await repository.save(garden(4))
    const { copies } = await repository.earlierCopies()
    expect(copies).toEqual([
      {
        id: 'daily-2026-10-20',
        reason: 'daily',
        gardenName: 'Quiet Corner',
        day: '2026-10-20',
        held: { checkIns: 1, reflections: 0, goals: 0 },
      },
    ])
    expect((await repository.snapshot(copies[0].id))?.seeds).toBe(2)

    onDay(21)
    await repository.save(garden(5))
    expect(await dailyDays(name)).toEqual(['2026-10-20', '2026-10-21'])
    expect((await repository.snapshot('daily-2026-10-21'))?.seeds).toBe(4)
  })

  it('is not kept for a write the app made on its own, such as a visit noted', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    const first = garden(2)
    await repository.save(first)
    onDay(21)
    const visited = markQuietWrite({
      ...first,
      profile: { ...first.profile!, lastVisitOn: '2026-10-21' },
    })
    await repository.save(visited)
    expect(await dailyDays(name)).toEqual([])
    await repository.save({ ...visited, seeds: 8 })
    expect(await dailyDays(name)).toEqual(['2026-10-21'])
    expect((await repository.snapshot('daily-2026-10-21'))?.profile?.lastVisitOn).toBe(
      '2026-10-21',
    )
  })

  it('keeps seven, one for each day the garden changed, and lets the oldest go', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    onDay(11)
    await repository.save(garden(0))
    for (let day = 11; day <= 19; day += 1) {
      onDay(day)
      await repository.save(garden(day))
    }
    const { copies } = await repository.earlierCopies()
    expect(copies.map((copy) => copy.day)).toEqual([
      '2026-10-19',
      '2026-10-18',
      '2026-10-17',
      '2026-10-16',
      '2026-10-15',
      '2026-10-14',
      '2026-10-13',
    ])
    // Each the garden of the day before it changed.
    expect((await repository.snapshot('daily-2026-10-13'))?.seeds).toBe(12)
  })

  it('is kept apart from the copies a restore keeps, so neither pushes the other out', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    onDay(11)
    await repository.save(garden(0))
    for (let day = 11; day <= 17; day += 1) {
      onDay(day)
      await repository.save(garden(day))
    }
    for (let seeds = 40; seeds < 44; seeds += 1) {
      onDay(17, 10 + seeds - 40)
      await repository.replace(garden(seeds), { snapshot: true })
    }
    const restores = await repository.snapshots()
    expect(restores).toHaveLength(2)
    expect(restores.every((snapshot) => snapshot.reason === 'restore')).toBe(true)
    expect((await repository.earlierCopies()).copies.filter((copy) => copy.reason === 'daily')).toHaveLength(7)

    onDay(18)
    await repository.save(garden(18))
    expect(await repository.snapshots()).toEqual(restores)
    expect((await repository.earlierCopies()).copies.filter((copy) => copy.reason === 'daily')).toHaveLength(7)
  })

  it('is kept by a restore too, before the garden it replaces goes', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden(2))
    onDay(21)
    await repository.replace(garden(42), { snapshot: true })
    expect(await dailyDays(name)).toEqual(['2026-10-21'])
    expect((await repository.snapshot('daily-2026-10-21'))?.seeds).toBe(2)
    // An undo of that restore is a write of the same day: no second copy.
    const [restore] = await repository.snapshots()
    await repository.replace((await repository.snapshot(restore.id))!)
    expect(await dailyDays(name)).toEqual(['2026-10-21'])
  })

  it('is put back as a restore is, and that can be undone', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden(2))
    onDay(21)
    const now = garden(5)
    await repository.save(now)

    const copy = await repository.dailyCopy('daily-2026-10-21', now)
    expect(copy?.seeds).toBe(2)
    await repository.replace(copy!, { snapshot: true })
    expect((await createGardenRepository(name).load()).state.seeds).toBe(2)

    const [restore] = await repository.snapshots()
    await repository.replace((await repository.snapshot(restore.id))!)
    expect((await createGardenRepository(name).load()).state.seeds).toBe(5)
  })

  it('is found by a second tab, so a day has one copy whichever tab changes it first', async () => {
    const name = freshName()
    const first = createGardenRepository(name)
    await first.save(garden(2))
    onDay(21)
    const second = createGardenRepository(name)
    await second.load()
    await first.save(garden(3))
    const reread = await second.load()
    await second.save({ ...reread.state, seeds: 4 })
    expect(await dailyDays(name)).toEqual(['2026-10-21'])
    expect((await second.snapshot('daily-2026-10-21'))?.seeds).toBe(2)
  })

  it('never costs the change it was to go in with', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden(2))
    onDay(21)
    const put = Reflect.get(IDBObjectStore.prototype, 'put') as (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) => IDBRequest<IDBValidKey>
    let refused = 0
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name !== 'snapshots') return put.apply(this, args)
      refused += 1
      throw new DOMException('Disk full', 'QuotaExceededError')
    })
    await expect(repository.save(garden(7))).resolves.toContain('meta')
    expect((await createGardenRepository(name).load()).state.seeds).toBe(7)
    expect(refused).toBe(1)
    // Not tried again on every write of the day.
    await repository.save(garden(8))
    expect(refused).toBe(1)
    vi.restoreAllMocks()
    expect(await dailyDays(name)).toEqual([])
  })
})

describe('a daily copy that would not fit', () => {
  it('is left out, and the change written again without it, when the disk aborts both', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden(2))
    onDay(21)
    const put = Reflect.get(IDBObjectStore.prototype, 'put') as (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) => IDBRequest<IDBValidKey>
    let aborted = 0
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      const request = put.apply(this, args)
      // What a full disk does at commit: the whole transaction goes.
      if (this.name === 'snapshots') {
        aborted += 1
        this.transaction.abort()
      }
      return request
    })
    await expect(repository.save(garden(7))).resolves.toContain('meta')
    vi.restoreAllMocks()
    expect(aborted).toBe(1)
    expect((await createGardenRepository(name).load()).state.seeds).toBe(7)
    expect(await dailyDays(name)).toEqual([])
    // A restore the same day makes no second attempt either.
    await repository.replace(garden(9), { snapshot: true })
    expect(await dailyDays(name)).toEqual([])
  })
})

describe('what a daily copy keeps', () => {
  it('leaves the field book’s photos out, and one put back keeps the photos there now', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    const first = withPhoto(garden(2))
    await repository.save(first)
    onDay(21)
    const now = {
      ...first,
      seeds: 3,
      profile: { ...first.profile!, lastBackupAt: '2026-10-21T08:00:00.000Z' },
    }
    await repository.save(now)

    const [daily] = (await storedSnapshots(name)).filter((record) => record.reason === 'daily')
    const kept = daily.garden as AppState
    expect(kept.sightings).toHaveLength(2)
    expect(kept.sightings.some((sighting) => 'photo' in sighting)).toBe(false)
    expect(daily.bytes).toBeGreaterThan(0)

    const copy = await repository.dailyCopy(daily.id, now)
    expect(copy?.sightings[0].photo).toBe(now.sightings[0].photo)
    expect(copy?.sightings[1].photo).toBeUndefined()
    // The newest copy kept anywhere stays the one on record.
    expect(copy?.profile?.lastBackupAt).toBe('2026-10-21T08:00:00.000Z')
    expect(copy?.seeds).toBe(2)
  })

  it('brings back a sighting deleted since without its photo', () => {
    const before = withPhoto(garden(2))
    const copy = withoutPhotos(before)
    expect(copy.sightings[0]).not.toHaveProperty('photo')
    const now = { ...before, sightings: [] }
    expect(withPhotosOf(copy, now).sightings[0]).not.toHaveProperty('photo')
    expect(withPhotosOf(copy, undefined).sightings).toBe(copy.sightings)
    // A garden without photos is kept as it is.
    const plain = garden(1)
    expect(withoutPhotos(plain)).toBe(plain)
    // A photo the copy already has is its own.
    const own = withPhoto(garden(1))
    expect(withPhotosOf(own, before).sightings[0].photo).toBe(own.sightings[0].photo)
  })

  it('keeps fewer when copies grow large, never fewer than two', () => {
    expect(dailyCopiesKept(0)).toBe(7)
    expect(dailyCopiesKept(1024 * 1024)).toBe(7)
    expect(dailyCopiesKept(DAILY_COPY_BUDGET / 4)).toBe(4)
    expect(dailyCopiesKept(DAILY_COPY_BUDGET)).toBe(2)
    expect(dailyCopiesKept(DAILY_COPY_BUDGET * 10)).toBe(2)
  })

  it('measures what it keeps: text, bytes and Blobs', () => {
    expect(sizeOf('four')).toBe(4)
    expect(sizeOf(new Blob([new Uint8Array(10)]))).toBe(10)
    expect(sizeOf(new Uint8Array(12))).toBe(12)
    expect(sizeOf([1, 'ab'])).toBe(10)
    expect(sizeOf({ a: 'bc', d: null })).toBe(1 + 2 + 1 + 8)
  })

  it('counts every copy kept in the room they take, a restore’s with its photos too', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(withPhoto(garden(2)))
    onDay(21)
    await repository.save(withPhoto(garden(3)))
    const daily = await repository.earlierCopies()
    await repository.replace(garden(4), { snapshot: true })
    const both = await repository.earlierCopies()
    expect(both.copies).toHaveLength(2)
    // The restore's copy keeps the photo, which the daily one leaves out.
    expect(both.bytes - daily.bytes).toBeGreaterThan(PHOTO.length)
  })

  it('describes what it cannot open as holding nothing it can say', async () => {
    const records: SnapshotRecord[] = [
      { id: 'daily-2026-10-19', reason: 'daily', day: '2026-10-19', takenAt: 'x', garden: { sealed: 1 } },
      { id: 'daily-2026-10-20', reason: 'daily', day: '2026-10-20', takenAt: 'x', garden: 'damaged', bytes: 5 },
      { id: 'restore-x', reason: 'restore', takenAt: 'x', garden: { moods: [] } },
    ]
    const { copies, bytes } = await describeCopies(records, undefined)
    expect(copies).toEqual([
      { id: 'restore-x', reason: 'restore', day: 'x', takenAt: 'x', held: { checkIns: 0, reflections: 0, goals: 0 }, gardenName: undefined },
      { id: 'daily-2026-10-20', reason: 'daily', day: '2026-10-20' },
      { id: 'daily-2026-10-19', reason: 'daily', day: '2026-10-19' },
    ])
    expect(bytes).toBeGreaterThan(5)
  })
})

/** Whether the phrase can be read anywhere in a stored value, bytes included. */
function holdsPhrase(value: unknown): boolean {
  if (typeof value === 'string') return value.includes(PHRASE)
  if (ArrayBuffer.isView(value)) return new TextDecoder().decode(value).includes(PHRASE)
  if (value && typeof value === 'object') return Object.values(value).some(holdsPhrase)
  return false
}

describe('daily copies and the garden lock', () => {
  it('are sealed when taken under the lock, and open only where the key is', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(withPhoto(garden(2)))
    const { record, key } = await createLock('kingfisher at dawn', newRecoveryCode(), FAST)
    await repository.relock({ record, key })
    onDay(21)
    await repository.save(withPhoto(garden(3)))

    const [daily] = (await storedSnapshots(name)).filter((stored) => stored.reason === 'daily')
    expect(daily.day).toBe('2026-10-21')
    expect(isSealed(daily.garden)).toBe(true)
    expect(holdsPhrase(daily)).toBe(false)

    const keyless = createGardenRepository(name)
    expect((await keyless.earlierCopies()).copies[0].held).toBeUndefined()
    expect(await keyless.dailyCopy(daily.id, undefined)).toBeUndefined()

    const opened = createGardenRepository(name)
    opened.unlock(key, record.id)
    expect((await opened.earlierCopies()).copies[0].held).toEqual({
      checkIns: 1,
      reflections: 0,
      goals: 0,
    })
    const copy = await opened.dailyCopy(daily.id, undefined)
    expect(copy?.moods[0].note).toBe(PHRASE)
    expect(copy?.seeds).toBe(2)
  })

  it('are sealed as the lock goes on, and opened as it comes off', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden(2))
    onDay(21)
    await repository.save(garden(3))
    const plain = (await storedSnapshots(name))[0]
    expect(holdsPhrase(plain.garden)).toBe(true)

    const { record, key } = await createLock('kingfisher at dawn', newRecoveryCode(), FAST)
    await repository.relock({ record, key })
    const sealed = (await storedSnapshots(name))[0]
    expect(isSealed(sealed.garden)).toBe(true)
    expect(holdsPhrase(sealed)).toBe(false)
    expect(sealed).toMatchObject({ id: 'daily-2026-10-21', reason: 'daily', day: '2026-10-21' })

    await repository.relock(undefined)
    const opened = (await storedSnapshots(name))[0]
    expect(isSealed(opened.garden)).toBe(false)
    expect((await repository.snapshot(opened.id))?.seeds).toBe(2)
  })
})

describe('the backup file’s record', () => {
  /** A stand-in for the file handle: IndexedDB keeps a real one as it is. */
  const record = { handle: { kind: 'file', name: 'garden.json' }, writtenAt: '2026-10-20T09:00:00.000Z' }

  it('is kept beside the drafts, and forgotten when asked or with the garden', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden(2))
    await repository.writeDrafts({ 'mood:2026-10-20': 'Half a thought' })
    await repository.writeBackupFile(record as never)
    expect(await repository.readBackupFile()).toMatchObject(record)
    expect(await repository.readDrafts()).toEqual({ 'mood:2026-10-20': 'Half a thought' })
    await repository.writeBackupFile(undefined)
    expect(await repository.readBackupFile()).toBeUndefined()
    await repository.writeBackupFile(record as never)
    await repository.clear()
    expect(await createGardenRepository(name).readBackupFile()).toBeUndefined()
  })

  it('stays as it is through the lock switch, while the drafts are sealed', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden(2))
    await repository.writeDrafts({ 'mood:2026-10-20': PHRASE })
    await repository.writeBackupFile(record as never)
    const { record: lock, key } = await createLock('kingfisher at dawn', newRecoveryCode(), FAST)
    await repository.relock({ record: lock, key })
    const db = await openDB(name)
    try {
      expect(isSealed(await db.get('drafts', 'current'))).toBe(true)
      expect(await db.get('drafts', BACKUP_FILE_KEY)).toMatchObject(record)
    } finally {
      db.close()
    }
    await repository.relock(undefined)
    expect(await repository.readBackupFile()).toMatchObject(record)
  })

  it('is opened as the lock comes off when a build before it sealed it', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden(2))
    const { record: lock, key } = await createLock('kingfisher at dawn', newRecoveryCode(), FAST)
    await repository.relock({ record: lock, key })
    const db = await openDB(name)
    try {
      // What the lock switch of a build without this record makes of it: a draft.
      await db.put('drafts', await sealValue(key, 'drafts', { handle: {} }), BACKUP_FILE_KEY)
    } finally {
      db.close()
    }
    await repository.relock(undefined)
    expect(await repository.readBackupFile()).toEqual({ handle: {} })
  })
})
