import { forceCloseDatabase } from 'fake-indexeddb'
import { openDB } from 'idb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toLocalDate } from '../lib/date'
import { createLock } from '../lib/gardenLock'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import {
  createGardenRepository,
  DAILY_PREFIX,
  GardenConflictError,
} from './gardenRepository'

/**
 * Points a write or a delete awaits, where a test can hold it while
 * something else happens. Nothing is held unless a test asks (`holdAt`).
 */
const pause = vi.hoisted(() => {
  const points = new Map<string, { reached: () => void; release: Promise<void> }>()
  return {
    points,
    async at(point: string) {
      const held = points.get(point)
      if (!held) return
      points.delete(point)
      held.reached()
      await held.release
    },
  }
})

vi.mock('./dailyCopies', async (importOriginal) => {
  const original = await importOriginal<typeof import('./dailyCopies')>()
  return {
    ...original,
    prepareDaily: async (...args: Parameters<typeof original.prepareDaily>) => {
      await pause.at('prepareDaily')
      return original.prepareDaily(...args)
    },
  }
})

vi.mock('./sealedStores', async (importOriginal) => {
  const original = await importOriginal<typeof import('./sealedStores')>()
  return {
    ...original,
    sealValue: async (...args: Parameters<typeof original.sealValue>) => {
      const sealed = await original.sealValue(...args)
      await pause.at('sealValue')
      return sealed
    },
  }
})

vi.mock('./gardenSwitch', async (importOriginal) => {
  const original = await importOriginal<typeof import('./gardenSwitch')>()
  return {
    ...original,
    removeStaging: async (name: string) => {
      await pause.at('removeStaging')
      return original.removeStaging(name)
    },
  }
})

/** Hold the next call that reaches `point` there, until released. */
function holdAt(point: string): { reached: Promise<void>; release: () => void } {
  let reached!: () => void
  let release!: () => void
  const whenReached = new Promise<void>((resolve) => {
    reached = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  pause.points.set(point, { reached, release: released })
  return { reached: whenReached, release }
}

/*
 * The browser can close the connection a repository keeps open (Safari's
 * "connection to IndexedDB server lost", storage cleared from the browser's
 * settings) before `terminated` ever reaches it. The next write's
 * transaction then throws InvalidStateError. That write is made once more,
 * on a fresh connection, in the same turn of the queue: nothing was written
 * the first time, so nothing is written twice.
 */

let counter = 0
const names: string[] = []
function freshName() {
  counter += 1
  const name = `reconnect-${counter}`
  names.push(name)
  return name
}

afterEach(async () => {
  vi.restoreAllMocks()
  pause.points.clear()
  for (const name of names.splice(0)) {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  }
})

function garden(seeds = 2) {
  return { ...createInitialState('Tester', 'Reconnecting'), seeds }
}

/** Every connection opened from now on, as IndexedDB hands it over. */
function connections(): IDBDatabase[] {
  const opened: IDBDatabase[] = []
  const open = indexedDB.open.bind(indexedDB)
  vi.spyOn(indexedDB, 'open').mockImplementation((name: string, version?: number) => {
    const request = open(name, version)
    request.addEventListener('success', () => opened.push(request.result))
    return request
  })
  return opened
}

/** Close every connection the repository holds, as the browser does, without telling it. */
function closeUnderneath(opened: IDBDatabase[]) {
  for (const db of opened) db.close()
}

async function stored(name: string, store: string, key: string): Promise<unknown> {
  const db = await openDB(name)
  try {
    return await db.get(store, key)
  } finally {
    db.close()
  }
}

describe('4.1 a write after the browser closed the connection', () => {
  it('saves once more on a fresh connection, moving the revision by exactly one', async () => {
    const name = freshName()
    const opened = connections()
    const tab = createGardenRepository(name)
    const first = garden(2)
    await tab.save(first)
    expect(await stored(name, 'meta', 'current')).toMatchObject({ revision: 1, seeds: 2 })

    closeUnderneath(opened)
    await expect(tab.save({ ...first, seeds: 3 })).resolves.toEqual(['meta'])

    expect(await stored(name, 'meta', 'current')).toMatchObject({ revision: 2, seeds: 3 })
    // Still in step with what it wrote: the next save is no conflict.
    await expect(tab.save({ ...first, seeds: 4 })).resolves.toEqual(['meta'])
    expect(await stored(name, 'meta', 'current')).toMatchObject({ revision: 3, seeds: 4 })
  })

  it('keeps the day’s copy that goes in with the change', async () => {
    const name = freshName()
    const opened = connections()
    const tab = createGardenRepository(name)
    const first = garden(2)
    await tab.save(first)

    closeUnderneath(opened)
    await tab.save({ ...first, seeds: 3 })

    // The day's first change keeps the garden as it stood before it.
    const copy = (await stored(name, 'snapshots', `${DAILY_PREFIX}${toLocalDate()}`)) as
      | { reason: string; garden: { seeds: number } }
      | undefined
    expect(copy).toMatchObject({ reason: 'daily', garden: { seeds: 2 } })
  })

  it('replaces once more, keeping a single copy of the garden it replaced', async () => {
    const name = freshName()
    const opened = connections()
    const tab = createGardenRepository(name)
    await tab.save(garden(2))

    closeUnderneath(opened)
    await tab.replace(garden(40), { snapshot: true })

    expect(await stored(name, 'meta', 'current')).toMatchObject({ revision: 2, seeds: 40 })
    const kept = await tab.snapshots()
    expect(kept).toHaveLength(1)
    expect(await tab.snapshot(kept[0].id)).toMatchObject({ seeds: 2 })
  })

  it('writes the drafts once more', async () => {
    const name = freshName()
    const opened = connections()
    const tab = createGardenRepository(name)
    await tab.save(garden(2))
    await tab.writeDrafts({ reflection: 'first words' })

    closeUnderneath(opened)
    await tab.writeDrafts({ reflection: 'kept words' })

    expect(await createGardenRepository(name).readDrafts()).toEqual({ reflection: 'kept words' })
  })

  it('discards a kept copy once more', async () => {
    const name = freshName()
    const opened = connections()
    const tab = createGardenRepository(name)
    await tab.save(garden(2))
    await tab.replace(garden(40), { snapshot: true })
    const [kept] = await tab.snapshots()

    closeUnderneath(opened)
    await expect(tab.discardSnapshot(kept.id)).resolves.toBeUndefined()

    expect(await createGardenRepository(name).snapshots()).toEqual([])
  })

  it('forgets the backup file once more', async () => {
    const name = freshName()
    const opened = connections()
    const tab = createGardenRepository(name)
    await tab.save(garden(2))
    await tab.writeBackupFile({ handle: { kind: 'file', name: 'garden.json' } as never })

    closeUnderneath(opened)
    await expect(tab.writeBackupFile(undefined)).resolves.toBeUndefined()

    expect(await createGardenRepository(name).readBackupFile()).toBeUndefined()
  })

  it('tries once more for a closed connection, and for nothing else', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    // Open, with nothing written yet: no day's copy is looked for.
    await tab.readDrafts()
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction')
    const closing = () => {
      throw new DOMException('The connection is closing.', 'InvalidStateError')
    }

    transaction.mockImplementationOnce(closing)
    await expect(tab.save(garden(2))).resolves.toContain('meta')
    expect(transaction).toHaveBeenCalledTimes(2)
    // The day's copy is kept with the next change; after that, one
    // transaction a write.
    await tab.save(garden(3))

    for (const refusal of ['QuotaExceededError', 'ConstraintError']) {
      transaction.mockClear()
      transaction.mockImplementationOnce(() => {
        throw new DOMException('Refused.', refusal)
      })
      await expect(tab.save(garden(9))).rejects.toMatchObject({ name: refusal })
      expect(transaction).toHaveBeenCalledTimes(1)
    }

    const other = createGardenRepository(name)
    await other.save({ ...(await other.load()).state, seeds: 50 })
    transaction.mockClear()
    await expect(tab.save(garden(9))).rejects.toBeInstanceOf(GardenConflictError)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(await stored(name, 'meta', 'current')).toMatchObject({ seeds: 50 })
  })

  it('tries only once more, and then says why', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.readDrafts()
    const transaction = vi
      .spyOn(IDBDatabase.prototype, 'transaction')
      .mockImplementation(() => {
        throw new DOMException('The connection is closing.', 'InvalidStateError')
      })

    await expect(tab.replace(garden(3))).rejects.toMatchObject({ name: 'InvalidStateError' })
    expect(transaction).toHaveBeenCalledTimes(2)
  })
})

describe('4.1 a write the delete cut off', () => {
  /** How many records a store holds, as stored (none when it is not there). */
  async function held(name: string, store: string): Promise<number> {
    const db = await openDB(name)
    try {
      return db.objectStoreNames.contains(store) ? await db.count(store) : 0
    } finally {
      db.close()
    }
  }

  it('makes no write again over a garden this tab has deleted since it began', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    const first = garden(2)
    await tab.save(first)

    // The day's first change: its copy is being made when Delete everything comes.
    const copying = holdAt('prepareDaily')
    const saving = tab.save({ ...first, seeds: 3 }).then(
      () => undefined,
      (error: unknown) => error,
    )
    await copying.reached
    await tab.clear()
    copying.release()

    // Refused, as before the write was ever made again: the garden stays
    // deleted, and its database is not even made again, empty.
    expect(await saving).toMatchObject({ name: 'InvalidStateError' })
    expect((await indexedDB.databases()).map((db) => db.name)).not.toContain(name)
    expect((await createGardenRepository(name).load()).status).toBe('empty')
  })

  it('nor while the delete is still under way', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    const first = garden(2)
    await tab.save(first)

    const copying = holdAt('prepareDaily')
    const saving = tab.save({ ...first, seeds: 3 }).then(
      () => undefined,
      (error: unknown) => error,
    )
    await copying.reached
    // The tab lets go of the garden; the database is not deleted yet.
    const deleting = holdAt('removeStaging')
    const clearing = tab.clear()
    await deleting.reached
    copying.release()

    expect(await saving).toMatchObject({ name: 'InvalidStateError' })
    deleting.release()
    await clearing
    expect((await createGardenRepository(name).load()).status).toBe('empty')
  })

  it('makes no write again once the tab has forgotten a garden deleted elsewhere', async () => {
    const name = freshName()
    const deleter = createGardenRepository(name)
    await deleter.save(garden(2))
    const opened = connections()
    const tab = createGardenRepository(name)
    const loaded = await tab.load()

    const copying = holdAt('prepareDaily')
    const saving = tab.save({ ...loaded.state, seeds: 9 }).then(
      () => undefined,
      (error: unknown) => error,
    )
    await copying.reached
    // The browser drops this tab's connection, so the delete never reaches
    // it; the other tab's word that the garden is gone does.
    for (const db of opened.splice(0)) forceCloseDatabase(db as never)
    await deleter.clear()
    tab.forget()
    copying.release()

    expect(await saving).toMatchObject({ name: 'InvalidStateError' })
    expect((await createGardenRepository(name).load()).status).toBe('empty')
  })

  it('makes no write again when the delete finishes as the fresh connection opens', async () => {
    const name = freshName()
    const tab = createGardenRepository(name)
    await tab.save(garden(2))
    await tab.relock(await createLock('kingfisher at dawn', newRecoveryCode(), 1_000))

    const deleting = holdAt('removeStaging')
    const clearing = tab.clear()
    await deleting.reached
    // Words typed as the delete begins are sealed on a fresh connection...
    const opened = connections()
    const sealing = holdAt('sealValue')
    const drafting = tab.writeDrafts({ reflection: 'private words' })
    await sealing.reached
    expect(opened).toHaveLength(1)
    // ...which the delete closes before they go in.
    opened[0].addEventListener('versionchange', () => sealing.release())
    deleting.release()
    await drafting
    await clearing

    // None kept: not sealed, and not in the clear either.
    expect(await held(name, 'drafts')).toBe(0)
    expect(await held(name, 'meta')).toBe(0)
  })
})
