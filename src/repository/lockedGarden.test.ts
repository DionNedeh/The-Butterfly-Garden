import { Blob as NodeBlob } from 'node:buffer'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLock, withAutoLock, type LockRecord } from '../lib/gardenLock'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import type { AppState } from '../types'
import {
  createGardenRepository,
  DATABASE_VERSION,
  GardenConflictError,
  GardenLockedError,
  GardenWithheldError,
  inspectImportedState,
  isSealed,
  RAW_EXPORT_FORMAT,
} from './gardenRepository'
import { validateGarden } from './validateGarden'

/*
 * The garden lock at rest: the repository seals every part as it is written
 * and opens it as it is read, and the switch seals (or opens) everything
 * already stored in one transaction. These tests read the database the way
 * someone with the device in hand could, and look for the gardener's words.
 *
 * A photo is a Blob; Node's Blob is the one fake-indexeddb can store, as a
 * browser's is (see gardenRepository.sightings.test.ts).
 */
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
})

let counter = 0
const names: string[] = []
function freshName() {
  counter += 1
  const name = `locked-garden-${counter}`
  names.push(name)
  return name
}

afterEach(async () => {
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

/** Quick derivations for tests; the app always uses PASSPHRASE_KDF's count. */
const FAST = 1_000
const PASSCODE = 'kingfisher at dawn'
/** Words the gardener wrote, which must be nowhere in the clear once the garden is locked. */
const PHRASE = 'I told nobody about the letter from my sister'
const PHOTO_BYTES = [82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 7, 250, 0, 128, 61, 62, 63, 64]

function journal(): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
    profile: {
      ...seed.profile!,
      comfortPlan: { helps: [{ id: 'help-1', text: `${PHRASE} (helps)` }] },
    },
    goals: [
      {
        id: 'goal-1',
        title: `Write to her: ${PHRASE}`,
        schedule: 'daily',
        weekdays: [],
        createdDate: '2026-09-01',
        archived: false,
      },
    ],
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-20',
        level: 2,
        note: PHRASE,
        createdAt: '2026-10-20T09:00:00.000Z',
        updatedAt: '2026-10-20T09:00:00.000Z',
      },
    ],
    reflections: [
      {
        id: 'reflection-1',
        localDate: '2026-10-20',
        promptId: 'notice',
        body: `Today: ${PHRASE}.`,
        createdAt: '2026-10-20T21:00:00.000Z',
        updatedAt: '2026-10-20T21:00:00.000Z',
      },
    ],
    recaps: [
      {
        id: 'recap-1',
        localDate: '2026-10-20',
        level: 3,
        wentWell: PHRASE,
        settingDown: 'The rain.',
        forTomorrow: 'Tea first',
        createdAt: '2026-10-20T22:00:00.000Z',
        updatedAt: '2026-10-20T22:00:00.000Z',
      },
    ],
    sightings: [
      {
        id: 'sighting-1',
        date: '2026-10-20',
        kind: 'butterfly',
        speciesId: 'monarch',
        note: PHRASE,
        photo: new Blob([new Uint8Array(PHOTO_BYTES)], { type: 'image/webp' }),
        createdAt: '2026-10-20T15:00:00.000Z',
      },
      {
        id: 'sighting-2',
        date: '2026-10-21',
        kind: 'plant',
        plantId: 'aster',
        createdAt: '2026-10-21T09:00:00.000Z',
      },
    ],
  }
}

async function bytesOf(blob: Blob | undefined): Promise<number[]> {
  return blob ? [...new Uint8Array(await blob.arrayBuffer())] : []
}

function contains(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let start = 0; start + needle.length <= haystack.length; start += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[start + index] !== needle[index]) continue outer
    }
    return true
  }
  return false
}

/**
 * Everything in the database where the phrase or the photo can be found in
 * the clear: in any string, any bytes, any stored Blob. Keys included.
 */
async function clearTextIn(name: string): Promise<string[]> {
  const phrase = new TextEncoder().encode(PHRASE)
  const photo = new Uint8Array(PHOTO_BYTES)
  const found: string[] = []
  const db = await openDB(name)
  try {
    for (const store of Array.from(db.objectStoreNames)) {
      const tx = db.transaction(store)
      const [keys, values] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()])
      await tx.done
      const visit = async (value: unknown, where: string): Promise<void> => {
        if (typeof value === 'string') {
          if (value.includes(PHRASE)) found.push(where)
        } else if (value instanceof Blob) {
          const bytes = new Uint8Array(await value.arrayBuffer())
          if (contains(bytes, phrase) || contains(bytes, photo)) found.push(`${where} (Blob)`)
        } else if (ArrayBuffer.isView(value)) {
          const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          if (contains(bytes, phrase) || contains(bytes, photo)) found.push(`${where} (bytes)`)
        } else if (value && typeof value === 'object') {
          for (const [field, item] of Object.entries(value)) await visit(item, `${where}.${field}`)
        }
      }
      for (let index = 0; index < keys.length; index += 1) {
        const stored = keys[index]
        const key = typeof stored === 'string' ? stored : JSON.stringify(stored)
        await visit(key, `${store}[key]`)
        await visit(values[index], `${store}/${key}`)
      }
    }
  } finally {
    db.close()
  }
  return found
}

/** A garden stored with something in every store that can hold the gardener's words. */
async function storedEverywhere(name: string) {
  const repository = createGardenRepository(name)
  const garden = journal()
  await repository.save(garden)
  // A restore keeps the garden it replaces as a snapshot.
  await repository.replace({ ...garden, seeds: 9 }, { snapshot: true })
  await repository.writeDrafts({ 'reflection:2026-10-21': `Half written: ${PHRASE}` })
  const db = await openDB(name)
  try {
    // A set-aside copy of a garden an earlier build could not read, and the
    // record the store split left behind, both holding the words.
    await db.put('quarantine', { id: 'malformed-x', reason: 'malformed', storedAt: '2026-10-01T00:00:00.000Z', raw: { moods: [{ note: PHRASE }] } }, 'malformed-x')
    await db.put('state', { ...garden, photo: undefined, sightings: [] }, 'current')
  } finally {
    db.close()
  }
  expect((await clearTextIn(name)).length).toBeGreaterThan(5)
  return { repository, garden: { ...garden, seeds: 9 } }
}

async function lockedGarden(name = freshName()) {
  const { repository, garden } = await storedEverywhere(name)
  const words = newRecoveryCode()
  const { record, key } = await createLock(PASSCODE, words, FAST)
  await repository.relock({ record, key })
  return { name, repository, garden, record, key, words }
}

/** Another tab: a repository of its own on the same database. */
function otherTab(name: string, unlockWith?: { key: CryptoKey; record: LockRecord }) {
  const tab = createGardenRepository(name)
  if (unlockWith) tab.unlock(unlockWith.key, unlockWith.record.id)
  return tab
}

describe('turning the lock on', () => {
  it('leaves none of the gardener’s words, and no photo, in the clear in any store', async () => {
    const { name, repository } = await lockedGarden()
    expect(await clearTextIn(name)).toEqual([])
    expect(repository.lockState()).toBe('unlocked')

    const db = await openDB(name)
    try {
      const sightings = (await db.get('sightings', 'current')) as Record<string, unknown>
      expect(isSealed(sightings)).toBe(true)
      expect(sightings.blobs).toHaveLength(1)
      const meta = (await db.get('meta', 'current')) as Record<string, unknown>
      expect(isSealed(meta)).toBe(true)
      // Ordering stays in the clear; the version shown is above any older build's.
      expect(meta.revision).toBe(3)
      expect(meta.version).toBe(9)
      expect(meta).not.toHaveProperty('profile')
      for (const store of ['goals', 'moods', 'reflections', 'recaps', 'sunlight', 'plants', 'drafts', 'state'])
        expect(isSealed(await db.get(store as 'goals', 'current')), store).toBe(true)
      const [quarantined] = (await db.getAll('quarantine')) as Array<{ raw: unknown }>
      expect(isSealed(quarantined.raw)).toBe(true)
      const [snapshot] = (await db.getAll('snapshots')) as Array<{ garden: unknown }>
      expect(isSealed(snapshot.garden)).toBe(true)
      expect(await db.get('lock', 'current')).toMatchObject({ format: 'the-butterfly-garden-lock' })
    } finally {
      db.close()
    }
  })

  it('reads back the same garden, photos and all, in a tab holding the key', async () => {
    const { name, garden, key, record } = await lockedGarden()
    const tab = otherTab(name, { key, record })
    const loaded = await tab.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.moods[0].note).toBe(PHRASE)
    expect(loaded.state.reflections).toEqual(garden.reflections)
    expect(loaded.state.profile?.comfortPlan).toEqual(garden.profile?.comfortPlan)
    expect(loaded.state.seeds).toBe(9)
    const [withPhoto, without] = loaded.state.sightings
    expect(await bytesOf(withPhoto.photo)).toEqual(PHOTO_BYTES)
    expect(withPhoto.photo?.type).toBe('image/webp')
    expect(without).toEqual(garden.sightings[1])
    expect(await tab.readDrafts()).toEqual({ 'reflection:2026-10-21': `Half written: ${PHRASE}` })
    expect((await tab.quarantined())[0].raw).toEqual({ moods: [{ note: PHRASE }] })
  })

  it('refuses to lock a garden this tab could not read', async () => {
    const name = freshName()
    const { repository } = await storedEverywhere(name)
    const db = await openDB(name)
    try {
      await db.put('moods', 'not a list', 'current')
    } finally {
      db.close()
    }
    expect((await repository.load()).status).toBe('withheld')
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await expect(repository.relock({ record, key })).rejects.toBeInstanceOf(GardenWithheldError)
    expect(await repository.readLock()).toBeUndefined()
  })

  it('refuses to lock a garden that has not been stored yet', async () => {
    const repository = createGardenRepository(freshName())
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await expect(repository.relock({ record, key })).rejects.toThrow(/no garden stored/i)
    expect(repository.lockState()).not.toBe('unlocked')
  })
})

describe('a locked garden in a tab without the key', () => {
  it('is withheld as locked: not damaged, not empty, and nothing set aside', async () => {
    const { name } = await lockedGarden()
    const tab = otherTab(name)
    const loaded = await tab.load()
    expect(loaded).toMatchObject({ status: 'withheld', reason: 'locked' })
    expect(loaded.state.profile).toBeUndefined()
    expect(tab.lockState()).toBe('locked')
    expect(await tab.quarantined()).toHaveLength(1)
  })

  it('writes nothing at all: no garden, no drafts, no whole-garden replace', async () => {
    const { name } = await lockedGarden()
    const tab = otherTab(name)
    await tab.load()
    await expect(tab.save(journal())).rejects.toBeInstanceOf(GardenWithheldError)
    await tab.writeDrafts({ 'mood:2026-10-22': PHRASE })
    await expect(tab.replace(journal())).rejects.toBeInstanceOf(GardenLockedError)
    expect(await clearTextIn(name)).toEqual([])
    expect(await tab.readDrafts()).toEqual({})
  })

  it('opens once unlocked, and locks again when told to', async () => {
    const { name, key, record } = await lockedGarden()
    const tab = otherTab(name)
    expect((await tab.load()).reason).toBe('locked')
    tab.unlock(key, record.id)
    expect((await tab.load()).status).toBe('loaded')
    await tab.lockNow()
    expect(tab.lockState()).toBe('locked')
    expect(await tab.load()).toMatchObject({ status: 'withheld', reason: 'locked' })
  })

  it('is not opened by a key for another lock', async () => {
    const { name } = await lockedGarden()
    const stranger = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const tab = otherTab(name)
    tab.unlock(stranger.key, stranger.record.id)
    expect(await tab.load()).toMatchObject({ status: 'withheld', reason: 'locked' })
    expect(tab.lockState()).toBe('locked')
  })
})

describe('writing under the lock', () => {
  it('seals each part it writes, and writes only what changed', async () => {
    const { name, repository, key, record } = await lockedGarden()
    const { state } = await repository.load()
    // The first write after a load also rewrites what reading rebuilds
    // (docs/handoff-p5-store-split.md 7.3); the one after it, only the change.
    await repository.save({ ...state, nectar: state.nectar + 1 })
    const next = { ...state, nectar: state.nectar + 1 }
    await repository.save(next)
    const changed: AppState = {
      ...next,
      moods: [{ ...next.moods[0], note: `${PHRASE}, and then I did.` }],
    }
    await expect(repository.save(changed)).resolves.toEqual(['meta', 'moods'])
    expect(await clearTextIn(name)).toEqual([])
    const reread = await (otherTab(name, { key, record })).load()
    expect(reread.state.moods[0].note).toBe(`${PHRASE}, and then I did.`)
  })

  it('reads back what it wrote in another tab with the key, through adopt', async () => {
    const { name, repository, garden, key, record } = await lockedGarden()
    await repository.load()
    const tab = otherTab(name, { key, record })
    await tab.load()
    const written = await repository.save({
      ...garden,
      reflections: [{ ...garden.reflections[0], body: 'Changed in the first tab.' }],
    })
    const adopted = await tab.adopt(written)
    expect(adopted.status).toBe('loaded')
    expect(adopted.state.reflections[0].body).toBe('Changed in the first tab.')
    // A tab without the key falls back to a full load, which is locked.
    const keyless = otherTab(name)
    expect(await keyless.adopt(written)).toMatchObject({ status: 'withheld', reason: 'locked' })
  })

  it('does not seal an unchanged photo again on every save of the field book', async () => {
    const { repository, garden } = await lockedGarden()
    const loaded = await repository.load()
    const encrypt = vi.spyOn(crypto.subtle, 'encrypt')
    await repository.save({
      ...loaded.state,
      sightings: [loaded.state.sightings[0], { ...loaded.state.sightings[1], note: 'Asters by the shed.' }],
    })
    // The field book's text and meta, and no photo.
    expect(encrypt).toHaveBeenCalledTimes(2)
    void garden
  })

  it('keeps drafts sealed, and opens them for the tab that holds the key', async () => {
    const { name, repository } = await lockedGarden()
    await repository.writeDrafts({ 'mood:2026-10-22': PHRASE })
    expect(await clearTextIn(name)).toEqual([])
    expect(await repository.readDrafts()).toEqual({ 'mood:2026-10-22': PHRASE })
  })

  it('snapshots a restore sealed, and undoes it only where the key is', async () => {
    const { name, repository, garden, key, record } = await lockedGarden()
    await repository.replace({ ...garden, seeds: 42 }, { snapshot: true })
    expect(await clearTextIn(name)).toEqual([])
    const [newest] = await repository.snapshots()
    const before = await repository.snapshot(newest.id)
    expect(before?.seeds).toBe(9)
    expect(before?.moods[0].note).toBe(PHRASE)
    expect(await (otherTab(name)).snapshot(newest.id)).toBeUndefined()
    expect((await (otherTab(name, { key, record })).snapshot(newest.id))?.seeds).toBe(9)
  })
})

describe('what the lock binds', () => {
  it('refuses a part moved into another part’s place, and sets the garden aside sealed', async () => {
    const { name, key, record } = await lockedGarden()
    const db = await openDB(name)
    try {
      await db.put('moods', await db.get('reflections', 'current'), 'current')
    } finally {
      db.close()
    }
    const tab = otherTab(name, { key, record })
    expect(await tab.load()).toMatchObject({ status: 'withheld', reason: 'malformed' })
    expect(await tab.quarantined()).toHaveLength(2)
    expect(await clearTextIn(name)).toEqual([])
  })

  it('refuses a part changed by a single byte', async () => {
    const { name, key, record } = await lockedGarden()
    const db = await openDB(name)
    try {
      const stored = (await db.get('reflections', 'current')) as unknown as { data: Uint8Array }
      const data = new Uint8Array(stored.data)
      data[5] ^= 1
      await db.put('reflections', { ...stored, data }, 'current')
    } finally {
      db.close()
    }
    const tab = otherTab(name, { key, record })
    expect(await tab.load()).toMatchObject({ status: 'withheld', reason: 'malformed' })
  })

  it('refuses a sealed part found with no lock to open it', async () => {
    const { name } = await lockedGarden()
    const db = await openDB(name)
    try {
      await db.delete('lock', 'current')
    } finally {
      db.close()
    }
    expect(await (otherTab(name)).load()).toMatchObject({
      status: 'withheld',
      reason: 'malformed',
    })
  })

  it('refuses a photo swapped for another', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    const garden = journal()
    const second = { ...garden.sightings[0], id: 'sighting-3', photo: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }) }
    await repository.save({ ...garden, sightings: [...garden.sightings, second] })
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await repository.relock({ record, key })
    const db = await openDB(name)
    try {
      const stored = (await db.get('sightings', 'current')) as unknown as { blobs: Blob[] }
      await db.put('sightings', { ...stored, blobs: [stored.blobs[1], stored.blobs[0]] }, 'current')
    } finally {
      db.close()
    }
    expect(await (otherTab(name, { key, record })).load()).toMatchObject({
      status: 'withheld',
      reason: 'malformed',
    })
  })
})

describe('an interrupted switch', () => {
  it('leaves the garden as it was, readable and in the clear, when the lock does not finish turning on', async () => {
    const name = freshName()
    const { repository, garden } = await storedEverywhere(name)
    const before = await clearTextIn(name)
    const put = Reflect.get(IDBObjectStore.prototype, 'put') as (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) => IDBRequest<IDBValidKey>
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      // Cut off part-way through the write.
      if (this.name === 'reflections') throw new DOMException('Disk full', 'QuotaExceededError')
      return put.apply(this, args)
    })
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await expect(repository.relock({ record, key })).rejects.toThrow()
    vi.restoreAllMocks()

    expect(repository.lockState()).not.toBe('unlocked')
    expect(await clearTextIn(name)).toEqual(before)
    const fresh = createGardenRepository(name)
    const loaded = await fresh.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.moods).toEqual(garden.moods)
    expect(fresh.lockState()).toBe('none')
    // And the gardener can simply try again.
    await repository.load()
    await repository.relock({ record, key })
    expect(await clearTextIn(name)).toEqual([])
  })

  it('leaves the garden locked and readable with its key when the lock does not finish turning off', async () => {
    const { name, repository, garden, key, record } = await lockedGarden()
    const put = Reflect.get(IDBObjectStore.prototype, 'put') as (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) => IDBRequest<IDBValidKey>
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name === 'snapshots') throw new DOMException('Disk full', 'QuotaExceededError')
      return put.apply(this, args)
    })
    await expect(repository.relock(undefined)).rejects.toThrow()
    vi.restoreAllMocks()
    expect(repository.lockState()).toBe('unlocked')
    expect(await clearTextIn(name)).toEqual([])
    const loaded = await (otherTab(name, { key, record })).load()
    expect(loaded.state.reflections).toEqual(garden.reflections)
  })

  it('starts again when another tab writes during the switch, keeping that write', async () => {
    const name = freshName()
    const { repository, garden } = await storedEverywhere(name)
    const tab = createGardenRepository(name)
    await tab.load()
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle)
    let wrote = false
    vi.spyOn(crypto.subtle, 'encrypt').mockImplementation(async (...args) => {
      if (!wrote) {
        wrote = true
        await tab.save({ ...garden, nectar: 77 })
      }
      return encrypt(...args)
    })
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await repository.relock({ record, key })
    vi.restoreAllMocks()
    const loaded = await (otherTab(name, { key, record })).load()
    expect(loaded.state.nectar).toBe(77)
    expect(await clearTextIn(name)).toEqual([])
  })
})

describe('turning the lock off', () => {
  it('opens everything back into the clear and forgets the lock', async () => {
    const { name, repository, garden } = await lockedGarden()
    await repository.relock(undefined)
    expect(repository.lockState()).toBe('none')
    const db = await openDB(name)
    try {
      expect(await db.get('lock', 'current')).toBeUndefined()
      expect(isSealed(await db.get('meta', 'current'))).toBe(false)
      expect((await db.get('drafts', 'current')) as unknown).toEqual({
        'reflection:2026-10-21': `Half written: ${PHRASE}`,
      })
      const [quarantined] = await db.getAll('quarantine')
      expect(quarantined.raw).toEqual({ moods: [{ note: PHRASE }] })
      expect(isSealed(await db.get('state', 'current'))).toBe(false)
    } finally {
      db.close()
    }
    const fresh = createGardenRepository(name)
    const loaded = await fresh.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.recaps).toEqual(garden.recaps)
    expect(await bytesOf(loaded.state.sightings[0].photo)).toEqual(PHOTO_BYTES)
    const [snapshot] = await fresh.snapshots()
    expect((await fresh.snapshot(snapshot.id))?.moods[0].note).toBe(PHRASE)
  })

  it('needs the lock it was turned on with', async () => {
    const { name } = await lockedGarden()
    const stranger = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const tab = otherTab(name, stranger)
    await expect(tab.relock(undefined)).rejects.toBeInstanceOf(GardenLockedError)
  })
})

describe('two tabs and the lock', () => {
  it('a tab holding the garden in the clear may not write once another tab locks it', async () => {
    const name = freshName()
    const { repository, garden } = await storedEverywhere(name)
    const tab = createGardenRepository(name)
    await tab.load()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await repository.relock({ record, key })

    await expect(tab.save({ ...garden, nectar: 5 })).rejects.toBeInstanceOf(GardenConflictError)
    await tab.writeDrafts({ 'mood:2026-10-22': PHRASE })
    expect(await clearTextIn(name)).toEqual([])
    expect(await tab.checkLock()).toBe('locked')
    expect(await tab.load()).toMatchObject({ status: 'withheld', reason: 'locked' })
  })

  it('a tab that was unlocked follows the lock being turned off, without writing sealed parts', async () => {
    const { name, repository, key, record, garden } = await lockedGarden()
    const tab = otherTab(name, { key, record })
    await tab.load()
    await repository.relock(undefined)
    expect(await tab.checkLock()).toBe('none')
    // Its next write was made against the locked garden: refused, then read again.
    await expect(tab.save({ ...garden, nectar: 5 })).rejects.toBeInstanceOf(GardenConflictError)
    const loaded = await tab.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.moods[0].note).toBe(PHRASE)
  })

  it('a change to the lock made from an older copy is refused', async () => {
    const { repository, record } = await lockedGarden()
    const first = withAutoLock(record, 5)
    await repository.writeLock(first, record)
    await expect(repository.writeLock(withAutoLock(record, 60), record)).rejects.toBeInstanceOf(
      GardenLockedError,
    )
    expect((await repository.readLock())?.autoLockMinutes).toBe(5)
  })
})

describe('what an older build sees', () => {
  it('cannot open the database at all, which it reads as a newer version’s work', async () => {
    const { name } = await lockedGarden()
    expect(DATABASE_VERSION).toBe(8)
    // What 3.3 asks for: its own DATABASE_VERSION, 7. The browser refuses with
    // VersionError, and 3.3's repository turns that into 'incompatible':
    // "written by a newer version", never damaged and never empty. It cannot
    // set anything aside, restore over it, or start a new garden there,
    // because every one of those needs the database it cannot open.
    const error = await new Promise<DOMException | null>((resolve) => {
      const request = indexedDB.open(name, 7)
      request.onsuccess = () => {
        request.result.close()
        resolve(null)
      }
      request.onerror = () => resolve(request.error)
    })
    expect(error?.name).toBe('VersionError')
  })

  it('reads a copy of the locked garden in a file as a newer version’s, and this build says what it is', async () => {
    const { repository } = await lockedGarden()
    const raw = await repository.readRaw()
    expect(raw.format).toBe(RAW_EXPORT_FORMAT)
    const stores = raw.stores as Record<string, Record<string, unknown>>
    // What a build at 8 makes of it: the same validateGarden every build since
    // 3.0 runs on a restored file, with a stored version it does not know.
    const assembled = { ...(stores.meta.current as object), moods: stores.moods.current }
    expect(validateGarden(assembled).refused).toBe('It was written by a newer version of the garden.')
    expect(inspectImportedState(raw).refused).toMatch(/copy of a locked garden/)
  })
})
