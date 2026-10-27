import { Blob as NodeBlob } from 'node:buffer'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLock,
  openLock,
  openLockWithPasskey,
  withAutoLock,
  withNewPasscode,
  withNewRecoveryCode,
  withoutPasskey,
  withPasskey,
  type LockRecord,
} from '../lib/gardenLock'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import { randomBytes } from '../lib/sealing'
import type { AppState } from '../types'
import {
  createGardenRepository,
  DATABASE_VERSION,
  GardenConflictError,
  GardenDeletedElsewhereError,
  GardenLockedError,
  isSealed,
  isSwitchMark,
} from './gardenRepository'
import { openValue } from './sealedStores'

/*
 * A change of the lock is written into a new database, and the old one
 * deleted (repository/gardenSwitch). These tests cut a change off at each
 * step, as a closed tab or a crash would, and open the garden again; ask for
 * the database as an older build would at each step; and keep two tabs
 * writing while it happens. The garden must always come back whole, under
 * one lock, with none of its words left in the clear under the lock.
 */
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
})

let counter = 0
const names: string[] = []
function freshName() {
  counter += 1
  const name = `garden-switch-${counter}`
  names.push(name, `${name}-switch`)
  return name
}

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'locks')
  for (const name of names.splice(0)) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }
})

const FAST = 1_000
const PASSCODE = 'heron by the weir'
const PHRASE = 'what I could not say at the table'
const PHOTO = [82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 1, 2, 3, 4]

function garden(): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
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
    sightings: [
      {
        id: 'sighting-1',
        date: '2026-10-20',
        kind: 'butterfly',
        speciesId: 'monarch',
        note: 'by the gate',
        photo: new Blob([new Uint8Array(PHOTO)], { type: 'image/webp' }),
        createdAt: '2026-10-20T15:00:00.000Z',
      },
    ],
  }
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

/** Where the phrase or the photo can be read in the clear, in any store of a database. */
async function clearText(name: string): Promise<string[]> {
  const phrase = new TextEncoder().encode(PHRASE)
  const photo = new Uint8Array(PHOTO)
  const found: string[] = []
  const db = await openDB(name)
  try {
    for (const store of Array.from(db.objectStoreNames)) {
      const [keys, values] = await Promise.all([db.getAllKeys(store), db.getAll(store)])
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
        const key = keys[index]
        await visit(values[index], `${store}/${typeof key === 'string' ? key : JSON.stringify(key)}`)
      }
    }
  } finally {
    db.close()
  }
  return found
}

async function exists(name: string): Promise<boolean> {
  return (await indexedDB.databases()).some((database) => database.name === name)
}

/** A garden with words in every store: the parts, a snapshot, a draft, a set-aside copy. */
async function stored(name = freshName()) {
  const repository = createGardenRepository(name)
  await repository.save(garden())
  await repository.replace({ ...garden(), seeds: 9 }, { snapshot: true })
  await repository.writeDrafts({ 'reflection:2026-10-21': `Half written: ${PHRASE}` })
  const db = await openDB(name)
  try {
    await db.put(
      'quarantine',
      { id: 'malformed-x', reason: 'malformed', storedAt: '2026-10-01T00:00:00.000Z', raw: { moods: [{ note: PHRASE }] } },
      'malformed-x',
    )
  } finally {
    db.close()
  }
  return { name, repository }
}

async function locked(name = freshName()) {
  const { repository } = await stored(name)
  const words = newRecoveryCode()
  const { record, key } = await createLock(PASSCODE, words, FAST)
  await repository.relock({ record, key })
  return { name, repository, record, key, words }
}

/** Another tab: a repository of its own on the same database. */
function tab(name: string, opened?: { key: CryptoKey; record: LockRecord }) {
  const repository = createGardenRepository(name)
  if (opened) repository.unlock(opened.key, opened.record.id)
  return repository
}

/** What an older build (3.3, at database version 7) gets when it asks for the garden. */
function olderBuildOpens(name: string): Promise<string> {
  return new Promise((resolve) => {
    const request = indexedDB.open(name, 7)
    request.onsuccess = () => {
      request.result.close()
      resolve('opened')
    }
    request.onerror = (event) => {
      event.preventDefault()
      resolve(request.error?.name ?? 'error')
    }
  })
}

/** A request that never answers: the tab asking for it is gone. */
function lost(): IDBOpenDBRequest {
  return {} as IDBOpenDBRequest
}

type Step = 'staging' | 'delete' | 'fill' | 'cleanup'

/**
 * Cut the next change of the lock on `name` off at `step`, as a closed tab
 * would: the request for that step never answers. Resolves once the change
 * has got there.
 */
function cutOffAt(name: string, step: Step): Promise<void> {
  const open = indexedDB.open.bind(indexedDB)
  const remove = indexedDB.deleteDatabase.bind(indexedDB)
  let reached!: () => void
  const there = new Promise<void>((resolve) => (reached = resolve))
  let done = false
  let deleting = false
  vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation((asked: string) => {
    if (done) return remove(asked)
    if (asked === name) {
      deleting = true
      if (step === 'delete') return lost()
    }
    if (step === 'cleanup' && deleting && asked === `${name}-switch`) {
      done = true
      reached()
      return lost()
    }
    return remove(asked)
  })
  vi.spyOn(indexedDB, 'open').mockImplementation((asked: string, version?: number) => {
    if (done) return open(asked, version)
    const cut =
      (step === 'staging' && asked === `${name}-switch` && version === 1) ||
      ((step === 'delete' || step === 'fill') && deleting && asked === name && version === DATABASE_VERSION)
    if (cut) {
      done = true
      reached()
      return lost()
    }
    return open(asked, version)
  })
  return there.then(() => {
    // The tab is gone; the browser carries on without it.
    vi.restoreAllMocks()
  })
}

/** Web Locks as a browser gives them: one holder at a time, let go when its tab is gone. */
function webLocks() {
  const held = new Map<string, () => void>()
  const locks = {
    request: async (
      name: string,
      _options: { ifAvailable: boolean },
      callback: (lock: { name: string } | null) => Promise<unknown>,
    ) => {
      if (held.has(name)) return callback(null)
      let release!: () => void
      const gone = new Promise<undefined>((resolve) => (release = () => resolve(undefined)))
      held.set(name, release)
      try {
        return await Promise.race([callback({ name }), gone])
      } finally {
        if (held.get(name) === release) held.delete(name)
      }
    },
  }
  Object.defineProperty(navigator, 'locks', { value: locks, configurable: true })
  return {
    /** The tab holding the lock is gone. */
    drop: (name: string) => {
      held.get(name)?.()
      held.delete(name)
    },
    held: (name: string) => held.has(name),
  }
}

describe('a change of the lock is written into a new database', () => {
  it('writes the copy, deletes the old database, writes the new one, then deletes the copy', async () => {
    const { name, repository } = await stored()
    const steps: string[] = []
    const open = indexedDB.open.bind(indexedDB)
    const remove = indexedDB.deleteDatabase.bind(indexedDB)
    vi.spyOn(indexedDB, 'open').mockImplementation((asked: string, version?: number) => {
      if (asked === `${name}-switch` && version === 1) steps.push('copy')
      if (asked === name && version === DATABASE_VERSION && steps.includes('delete')) steps.push('write')
      return open(asked, version)
    })
    vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation((asked: string) => {
      steps.push(asked === name ? 'delete' : asked === `${name}-switch` ? 'delete copy' : asked)
      return remove(asked)
    })
    // A tab holding the database open is told it is going away, and lets go.
    const other = await openDB(name, DATABASE_VERSION, {
      blocking(_current, next, event) {
        steps.push(`told: ${String(next)}`)
        ;(event.target as IDBDatabase).close()
      },
    })
    void other
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await repository.relock({ record, key })
    expect(steps).toEqual(['delete copy', 'copy', 'delete', 'write', 'told: null', 'delete copy'])
    expect(await exists(`${name}-switch`)).toBe(false)
    expect(await clearText(name)).toEqual([])
    expect(repository.lockState()).toBe('unlocked')
  })

  it('opens everything back up into a new database when the lock is turned off', async () => {
    const { name, repository } = await locked()
    await repository.relock(undefined)
    expect(await exists(`${name}-switch`)).toBe(false)
    const fresh = tab(name)
    const loaded = await fresh.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.moods[0].note).toBe(PHRASE)
    expect(await fresh.readDrafts()).toEqual({ 'reflection:2026-10-21': `Half written: ${PHRASE}` })
  })

  for (const [what, change] of [
    [
      'a passcode change',
      (record: LockRecord, words: readonly string[]) =>
        withNewPasscode(record, { slot: 'passcode', passcode: PASSCODE }, 'a new passphrase', FAST).then(
          (next) => ({ next, old: { slot: 'passcode', passcode: PASSCODE } as const, words }),
        ),
    ],
    [
      'a new recovery code',
      (record: LockRecord, words: readonly string[]) =>
        withNewRecoveryCode(record, PASSCODE, newRecoveryCode(), FAST).then((next) => ({
          next,
          old: { slot: 'recovery', words } as const,
          words,
        })),
    ],
  ] as const) {
    it(`seals everything under a new key after ${what}: the old secret and an old copy of the lock open nothing stored`, async () => {
      const { name, repository, record, words } = await locked()
      const { next, old } = await change(record, words)
      await repository.relock(next, { madeFrom: record })
      expect(await clearText(name)).toEqual([])
      // An old copy of the lock record (in a file, or left on the disk), with
      // the old secret, gives only the old key...
      const oldKey = await openLock(record, old)
      const db = await openDB(name)
      try {
        for (const store of ['moods', 'reflections', 'drafts']) {
          const value = await db.get(store, 'current')
          expect(isSealed(value), store).toBe(true)
          // ...which opens nothing stored now.
          await expect(openValue(oldKey, store, value as never), store).rejects.toThrow()
          expect(await openValue(next.key, store, value as never)).toBeDefined()
        }
        expect((await db.get('lock', 'current')).id).toBe(next.record.id)
      } finally {
        db.close()
      }
      const reread = await tab(name, next).load()
      expect(reread.state.moods[0].note).toBe(PHRASE)
      expect(await bytes(reread.state.sightings[0].photo)).toEqual(PHOTO)
    })
  }

  it('seals everything under a new key when the passkey is taken away', async () => {
    const { name, repository, record } = await locked()
    const prfOutput = randomBytes(32)
    const withKey = await withPasskey(record, PASSCODE, {
      credentialId: randomBytes(16),
      prfSalt: randomBytes(32),
      prfOutput,
    })
    await repository.writeLock(withKey, record)
    const next = await withoutPasskey(withKey)
    await repository.relock(next, { madeFrom: withKey })
    const passkeyKey = await openLockWithPasskey(withKey, prfOutput)
    const db = await openDB(name)
    try {
      await expect(openValue(passkeyKey, 'moods', await db.get('moods', 'current'))).rejects.toThrow()
    } finally {
      db.close()
    }
    expect((await repository.readLock())?.passkey).toBeUndefined()
  })

  it('refuses a change made from an older copy of the lock, changing nothing', async () => {
    const { name, repository, record } = await locked()
    const newer = withAutoLock(record, 5)
    await repository.writeLock(newer, record)
    const next = await withNewPasscode(record, { slot: 'passcode', passcode: PASSCODE }, 'a new passphrase', FAST)
    await expect(repository.relock(next, { madeFrom: record })).rejects.toBeInstanceOf(GardenLockedError)
    expect((await repository.readLock())?.stamp).toBe(newer.stamp)
    expect(await exists(`${name}-switch`)).toBe(false)
  })

  it('waits for a window that holds the old database open, says so, and finishes once it lets go', async () => {
    const { name, repository } = await stored()
    // A window that does not let go when asked (frozen, say).
    const stuck = await openDB(name, DATABASE_VERSION)
    const waiting = vi.fn()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    let finished = false
    const switching = repository.relock({ record, key }, { waiting }).then(() => (finished = true))
    await vi.waitFor(() => expect(waiting).toHaveBeenCalled())
    expect(finished).toBe(false)
    // Nothing is lost while it waits: the copy is whole.
    expect(await exists(`${name}-switch`)).toBe(true)
    stuck.close()
    await switching
    expect(await clearText(name)).toEqual([])
    expect(await exists(`${name}-switch`)).toBe(false)
  })
})

async function bytes(blob: Blob | undefined): Promise<number[]> {
  return blob ? [...new Uint8Array(await blob.arrayBuffer())] : []
}

describe('a change cut off at any step, as a closed tab would, settles on the next open', () => {
  it('before its copy is whole: reads go on, writes wait, and the change is undone once nobody is at it', async () => {
    const { name, repository } = await stored()
    const before = await clearText(name)
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const cut = cutOffAt(name, 'staging')
    void repository.relock({ record, key })
    await cut

    // Another tab, opened now, reads the garden as it was...
    const other = tab(name)
    const loaded = await other.load()
    expect(loaded.status).toBe('loaded')
    expect(other.lockState()).toBe('none')
    // ...but may not write: whoever is changing the lock may still be at it.
    await expect(other.save({ ...loaded.state, nectar: 1 })).rejects.toBeInstanceOf(GardenConflictError)
    await other.writeDrafts({ 'mood:2026-10-22': 'not now' })
    expect(await other.readDrafts()).toEqual({ 'reflection:2026-10-21': `Half written: ${PHRASE}` })

    // Long after any change would have finished, the mark is taken away.
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000)
    const later = tab(name)
    expect((await later.load()).status).toBe('loaded')
    vi.restoreAllMocks()
    const db = await openDB(name)
    try {
      expect(await db.get('lock', 'current')).toBeUndefined()
    } finally {
      db.close()
    }
    expect(await clearText(name)).toEqual(before)
    const again = await later.load()
    await later.save({ ...again.state, nectar: 3 })
    expect(await exists(`${name}-switch`)).toBe(false)
  })

  it('before its copy is whole, with Web Locks: undone at once when its tab is gone, left alone while it is not', async () => {
    const locks = webLocks()
    const { name, repository } = await stored()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const cut = cutOffAt(name, 'staging')
    void repository.relock({ record, key })
    await cut

    // The tab is still there, holding the switch's lock: the mark stays.
    expect(locks.held(`${name}-switch`)).toBe(true)
    const other = tab(name)
    expect((await other.load()).status).toBe('loaded')
    const db = await openDB(name)
    try {
      expect(isSwitchMark(await db.get('lock', 'current'))).toBe(true)
    } finally {
      db.close()
    }
    // The tab is gone: the next open puts the garden back as it was.
    locks.drop(`${name}-switch`)
    const loaded = await tab(name).load()
    expect(loaded.status).toBe('loaded')
    const reopened = await openDB(name)
    try {
      expect(await reopened.get('lock', 'current')).toBeUndefined()
    } finally {
      reopened.close()
    }
  })

  it('after its copy is whole, before the old database is deleted: finished from the copy once its tab is gone', async () => {
    const locks = webLocks()
    const { name, repository } = await stored()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const cut = cutOffAt(name, 'delete')
    void repository.relock({ record, key })
    await cut
    expect(await exists(`${name}-switch`)).toBe(true)
    expect(await olderBuildOpens(name)).toBe('VersionError')
    // While its tab may still be at it, the garden is read as it was.
    expect((await tab(name).load()).status).toBe('loaded')

    locks.drop(`${name}-switch`)
    // The next open, in a tab that holds no key: the change is finished, and
    // the garden is locked.
    const other = tab(name)
    expect(await other.load()).toMatchObject({ status: 'withheld', reason: 'locked' })
    expect(await exists(`${name}-switch`)).toBe(false)
    expect(await clearText(name)).toEqual([])
    expect(await olderBuildOpens(name)).toBe('VersionError')
    const opened = await tab(name, { key, record }).load()
    expect(opened.state.moods[0].note).toBe(PHRASE)
    expect(await bytes(opened.state.sightings[0].photo)).toEqual(PHOTO)
  })

  it('after its copy is whole, where there are no Web Locks: finished once the change is long overdue', async () => {
    const { name, repository } = await stored()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const cut = cutOffAt(name, 'delete')
    void repository.relock({ record, key })
    await cut
    expect((await tab(name).load()).status).toBe('loaded')
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 61_000)
    expect(await tab(name).load()).toMatchObject({ status: 'withheld', reason: 'locked' })
    vi.restoreAllMocks()
    expect(await clearText(name)).toEqual([])
    expect((await tab(name, { key, record }).load()).state.reflections[0].body).toContain(PHRASE)
  })

  it('settles a change cut off even where the browser refuses Web Locks', async () => {
    const { name, repository } = await stored()
    Object.defineProperty(navigator, 'locks', {
      value: { request: () => Promise.reject(new DOMException('Not here', 'SecurityError')) },
      configurable: true,
    })
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const cut = cutOffAt(name, 'fill')
    void repository.relock({ record, key })
    await cut
    expect(await tab(name).load()).toMatchObject({ status: 'withheld', reason: 'locked' })
    expect(await clearText(name)).toEqual([])
    expect(await exists(`${name}-switch`)).toBe(false)
  })

  it('after the old database is deleted, before the new one is written: finished from the copy at the next open', async () => {
    const { name, repository } = await stored()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const cut = cutOffAt(name, 'fill')
    void repository.relock({ record, key })
    await cut
    expect(await exists(`${name}-switch`)).toBe(true)
    // Never offered as a new garden: the next open finishes the change.
    const other = tab(name)
    expect(await other.load()).toMatchObject({ status: 'withheld', reason: 'locked' })
    expect(await exists(`${name}-switch`)).toBe(false)
    expect(await clearText(name)).toEqual([])
    expect(await olderBuildOpens(name)).toBe('VersionError')
    const opened = await tab(name, { key, record }).load()
    expect(opened.state.moods[0].note).toBe(PHRASE)
    expect(await bytes(opened.state.sightings[0].photo)).toEqual(PHOTO)
  })

  it('after the new database is written, before the copy goes: the garden is whole, and the copy goes with the next change or a deletion', async () => {
    const { name, repository } = await locked()
    const cut = cutOffAt(name, 'cleanup')
    void repository.relock(undefined)
    await cut
    expect(await exists(`${name}-switch`)).toBe(true)
    const other = tab(name)
    const loaded = await other.load()
    expect(loaded.status).toBe('loaded')
    expect(other.lockState()).toBe('none')
    // The next change makes its own copy, and leaves none.
    const next = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await other.relock(next)
    expect(await exists(`${name}-switch`)).toBe(false)
    // A deletion takes any copy with it, so nothing can bring the garden back.
    const cut2 = cutOffAt(name, 'cleanup')
    void other.relock(undefined)
    await cut2
    const last = tab(name)
    await last.load()
    await last.clear()
    expect(await exists(`${name}-switch`)).toBe(false)
    expect((await tab(name).load()).status).toBe('empty')
  })
})

describe('what an older build sees during a change of the lock', () => {
  it('cannot open the garden at any step: it reads as a newer version’s', async () => {
    const { name, repository } = await stored()
    expect(await olderBuildOpens(name)).toBe('VersionError')
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const seen: string[] = []
    const open = indexedDB.open.bind(indexedDB)
    const remove = indexedDB.deleteDatabase.bind(indexedDB)
    let asking: Promise<string> | undefined
    vi.spyOn(indexedDB, 'open').mockImplementation((asked: string, version?: number) => {
      if (asked === `${name}-switch` && version === 1) asking = olderBuildOpens(name).then((what) => (seen.push(`frozen: ${what}`), what))
      return open(asked, version)
    })
    vi.spyOn(indexedDB, 'deleteDatabase').mockImplementation((asked: string) => {
      const request = remove(asked)
      // An older build asking the moment the old database goes waits behind
      // the new one, which holds the garden: it is refused, never let in.
      if (asked === name) {
        queueMicrotask(() => {
          void olderBuildOpens(name).then((what) => seen.push(`replaced: ${what}`))
        })
      }
      return request
    })
    await repository.relock({ record, key })
    await asking
    await vi.waitFor(() => expect(seen).toHaveLength(2))
    expect(seen.sort()).toEqual(['frozen: VersionError', 'replaced: VersionError'])
    expect(await olderBuildOpens(name)).toBe('VersionError')
  })

  it('in the instant between the deletion and the new database: the change finishes on the next open, and what the older build began is kept', async () => {
    const { name, repository } = await stored()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    const open = indexedDB.open.bind(indexedDB)
    let older: IDBDatabase | undefined
    let first = true
    vi.spyOn(indexedDB, 'open').mockImplementation((asked: string, version?: number) => {
      if (first && asked === name && version === DATABASE_VERSION) {
        first = false
        // An older build's request lands between the two: it makes an empty
        // garden at its own version, and starts a new one there.
        const request = open(name, 7)
        request.onupgradeneeded = () => {
          for (const store of ['meta', 'moods', 'drafts']) request.result.createObjectStore(store)
        }
        request.onsuccess = () => {
          older = request.result
          older.onversionchange = () => older?.close()
          const tx = older.transaction('drafts', 'readwrite')
          tx.objectStore('drafts').put({ 'mood:2026-10-22': 'begun in the older build' }, 'current')
        }
      }
      return open(asked, version)
    })
    await expect(repository.relock({ record, key })).rejects.toThrow(/finishes the next time/)
    vi.restoreAllMocks()
    expect(older).toBeDefined()
    expect(await exists(`${name}-switch`)).toBe(true)

    // The next open finishes the change from the copy, and keeps what the
    // older build wrote as a set-aside copy.
    const opened = tab(name, { key, record })
    const loaded = await opened.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.moods[0].note).toBe(PHRASE)
    expect(await exists(`${name}-switch`)).toBe(false)
    const setAside = (await opened.quarantined()).find((copy) => copy.id.startsWith('malformed-stray-'))
    expect(JSON.stringify(setAside?.raw)).toContain('begun in the older build')
    expect(await olderBuildOpens(name)).toBe('VersionError')
  })
})

describe('two tabs and a change of the lock', () => {
  it('a tab with the garden open follows a passcode change: its write refused, then locked until the new passcode', async () => {
    const { name, repository, record, key } = await locked()
    const other = tab(name, { key, record })
    const { state } = await other.load()
    const next = await withNewPasscode(record, { slot: 'passcode', passcode: PASSCODE }, 'a new passphrase', FAST)
    await repository.relock(next, { madeFrom: record })
    // Not "deleted in another tab": changed there, so refused and read again.
    await expect(other.save({ ...state, nectar: 5 })).rejects.toBeInstanceOf(GardenConflictError)
    expect(await other.load()).toMatchObject({ status: 'withheld', reason: 'locked' })
    expect(other.lockState()).toBe('locked')
    other.unlock(await openLock(next.record, { slot: 'passcode', passcode: 'a new passphrase' }), next.record.id)
    expect((await other.load()).state.moods[0].note).toBe(PHRASE)
  })

  it('a tab without the lock follows it turned on, and one with it follows it turned off', async () => {
    const { name, repository } = await stored()
    const other = tab(name)
    const { state } = await other.load()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await repository.relock({ record, key })
    await expect(other.save({ ...state, nectar: 5 })).rejects.toBeInstanceOf(GardenConflictError)
    await other.writeDrafts({ 'mood:2026-10-22': PHRASE })
    expect(await clearText(name)).toEqual([])
    expect(await other.load()).toMatchObject({ status: 'withheld', reason: 'locked' })

    other.unlock(key, record.id)
    const opened = await other.load()
    await repository.relock(undefined)
    await expect(other.save({ ...opened.state, nectar: 6 })).rejects.toBeInstanceOf(GardenConflictError)
    const reread = await other.load()
    expect(reread.status).toBe('loaded')
    expect(other.lockState()).toBe('none')
    await other.save({ ...reread.state, nectar: 7 })
  })

  it('a deletion of the garden is still a deletion', async () => {
    const { name, repository } = await stored()
    const other = tab(name)
    const { state } = await other.load()
    await repository.load()
    await repository.clear()
    await expect(other.save({ ...state, nectar: 5 })).rejects.toBeInstanceOf(GardenDeletedElsewhereError)
  })
})

describe('writes from another tab while the lock goes on are sealed, or refused', () => {
  /** Run `during` once the switch has read the garden and is sealing it. */
  function whileSealing(during: () => Promise<unknown>) {
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle)
    let ran = false
    vi.spyOn(crypto.subtle, 'encrypt').mockImplementation(async (...args) => {
      if (!ran) {
        ran = true
        await during()
      }
      return encrypt(...args)
    })
  }

  /** Run `during` once the switch has marked the garden, before it is replaced. */
  function onceMarked(name: string, during: () => Promise<unknown>) {
    const open = indexedDB.open.bind(indexedDB)
    let ran = false
    let finished: Promise<unknown> = Promise.resolve()
    vi.spyOn(indexedDB, 'open').mockImplementation((asked: string, version?: number) => {
      if (!ran && asked === `${name}-switch` && version === 1) {
        ran = true
        finished = during()
      }
      return open(asked, version)
    })
    return () => finished
  }

  it('a restore’s snapshot taken while the garden is sealed is sealed too', async () => {
    const { name, repository } = await stored()
    const other = tab(name)
    await other.load()
    let restored: unknown
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    whileSealing(async () => {
      restored = await other.replace({ ...garden(), seeds: 21 }, { snapshot: true }).catch((error: unknown) => error)
    })
    await repository.relock({ record, key })
    vi.restoreAllMocks()
    // The restore landed first, so the switch started again and sealed it all.
    expect(restored).toEqual(expect.arrayContaining(['meta']))
    expect(await clearText(name)).toEqual([])
    const opened = tab(name, { key, record })
    expect((await opened.load()).state.seeds).toBe(21)
    const [newest] = await opened.snapshots()
    expect((await opened.snapshot(newest.id))?.seeds).toBe(9)
  })

  it('a restore once the garden is marked is refused whole, its snapshot included', async () => {
    const { name, repository } = await stored()
    const other = tab(name)
    await other.load()
    const before = (await other.snapshots()).length
    let restored: unknown
    const finished = onceMarked(name, async () => {
      restored = await other.replace({ ...garden(), seeds: 21 }, { snapshot: true }).catch((error: unknown) => error)
    })
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await repository.relock({ record, key })
    await finished()
    vi.restoreAllMocks()
    expect(restored).toBeInstanceOf(GardenLockedError)
    expect(await clearText(name)).toEqual([])
    const opened = tab(name, { key, record })
    expect((await opened.load()).state.seeds).toBe(9)
    expect(await opened.snapshots()).toHaveLength(before)
  })

  it('a set-aside copy and a first draft written while the garden is sealed are sealed too', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden())
    const other = tab(name)
    // What the other tab's build cannot read, it sets aside.
    const db = await openDB(name)
    try {
      await db.put('moods', 'not a list', 'current')
    } finally {
      db.close()
    }
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    whileSealing(async () => {
      expect((await other.load()).status).toBe('withheld')
      await other.writeDrafts({ 'mood:2026-10-22': PHRASE })
    })
    await repository.relock({ record, key })
    vi.restoreAllMocks()
    expect(await clearText(name)).toEqual([])
    const opened = tab(name, { key, record })
    expect(await opened.quarantined()).toHaveLength(1)
    expect(await opened.readDrafts()).toEqual({ 'mood:2026-10-22': PHRASE })
  })

  it('a tab that read the garden before the lock went on sets nothing aside in the clear after', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden())
    const other = tab(name)
    const db = await openDB(name)
    try {
      await db.put('moods', 'not a list', 'current')
    } finally {
      db.close()
    }
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    // The other tab has read the garden, found it unreadable, and is about to
    // set it aside when the whole change of the lock happens.
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    let ran = false
    vi.spyOn(crypto.subtle, 'digest').mockImplementation(async (...args) => {
      if (!ran) {
        ran = true
        await repository.relock({ record, key })
      }
      return digest(...args)
    })
    expect((await other.load()).status).toBe('withheld')
    vi.restoreAllMocks()
    expect(await clearText(name)).toEqual([])
    expect(await tab(name, { key, record }).quarantined()).toHaveLength(0)
  })

  it('a set-aside copy or a draft once the garden is marked is not written at all', async () => {
    const name = freshName()
    const repository = createGardenRepository(name)
    await repository.save(garden())
    const other = tab(name)
    const db = await openDB(name)
    try {
      await db.put('moods', 'not a list', 'current')
    } finally {
      db.close()
    }
    const finished = onceMarked(name, async () => {
      expect((await other.load()).status).toBe('withheld')
      await other.writeDrafts({ 'mood:2026-10-22': PHRASE })
    })
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), FAST)
    await repository.relock({ record, key })
    await finished()
    vi.restoreAllMocks()
    expect(await clearText(name)).toEqual([])
    const opened = tab(name, { key, record })
    expect(await opened.quarantined()).toHaveLength(0)
    expect(await opened.readDrafts()).toEqual({})
  })
})
