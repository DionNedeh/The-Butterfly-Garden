import { unwrap, wrap, type IDBPDatabase } from 'idb'
import type { LockRecord } from '../lib/gardenLock'
import {
  DATABASE_VERSION,
  GardenConflictError,
  GardenLockedError,
  isSwitchMark,
  OBJECT_STORES,
  RAW_EXPORT_FORMAT,
  revisionOf,
  type GardenDatabase,
  type QuarantineRecord,
  type SwitchMark,
} from './gardenRepository'

/*
 * Changing the lock, by writing the garden into a new database.
 *
 * A value written over another in IndexedDB is not taken off the disk:
 * Chromium's storage keeps the old one in its log until a compaction that a
 * small database may never get. So a switch -- the lock turned on or off, or
 * the garden sealed under a new data key once a secret is replaced -- never
 * stores the garden again in place. It:
 *
 *  1. reads every store and works out what each will hold (sealed under the
 *     new key, or opened), outside any transaction;
 *  2. checks nothing changed meanwhile and, in the same transaction, puts a
 *     switch mark where the lock is kept. From then on every write is
 *     refused, since each checks the lock in its own transaction, and reads
 *     go on under the lock the mark stands in for;
 *  3. writes the new contents, with the plan saying what they are, into a
 *     staging database, in one durable transaction;
 *  4. deletes the garden's database, which takes the browser's files for it
 *     away, and creates it again holding the new contents, in the very
 *     transaction that creates it. The two are asked for together, so the
 *     creation is next in line: no other tab, and no older build, finds the
 *     garden missing in between;
 *  5. checks what was written, and deletes the staging database.
 *
 * Any open settles a switch that was cut off (`settle`): with the staging
 * copy complete, steps 4 and 5 are done again; without it, the mark is taken
 * away and the garden is exactly as it was before.
 *
 * Loaded only to change the lock, or to settle a change cut off.
 */

const SWITCH_FORMAT = 'the-butterfly-garden-switch'

/** A store's name, a key in it, and the value there. */
type Entry = [store: string, key: IDBValidKey, value: unknown]

/** What a staging database holds besides the contents: what they are for. */
interface SwitchPlan {
  format: typeof SWITCH_FORMAT
  /** The switch mark's id: the switch this copy belongs to. */
  id: string
  /** The lock the new contents are sealed under, if any. */
  lockId?: string
  /** The garden's revision in the new contents. */
  revision: number
}

/** How many times a switch starts again when another tab writes during it. */
const SWITCH_ATTEMPTS = 3

/**
 * How long a switch mark is left alone, where the browser cannot say whether
 * the tab that made it is still at work (no Web Locks): far longer than any
 * switch takes.
 */
const STALE_MS = 60_000

const STRICT = { durability: 'strict' } as const

function stagingName(name: string): string {
  return `${name}-switch`
}

/** A store, without the per-store types that make a loop over every store awkward. */
interface AnyStore {
  get: (key: IDBValidKey) => Promise<unknown>
  getAll: () => Promise<unknown[]>
  getAllKeys: () => Promise<IDBValidKey[]>
}

function storeOf(tx: IDBTransaction, name: string): AnyStore {
  return wrap(tx.objectStore(name))
}

function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function valueAt(entries: Entry[], store: string): unknown {
  return entries.find(([name, key]) => name === store && key === 'current')?.[2]
}

/**
 * Hold the switch's Web Lock while `work` runs, if the browser has Web
 * Locks: `sure` then means no other tab is changing the lock or settling a
 * change. When another tab holds it, `busy` answers instead. Where there are
 * none, or the browser refuses them here, `work` runs unsure.
 */
async function exclusively<T>(
  name: string,
  work: (sure: boolean) => Promise<T>,
  busy: () => T,
): Promise<T> {
  const locks = globalThis.navigator?.locks
  if (!locks) return work(false)
  let asked = false
  try {
    return await locks.request(stagingName(name), { ifAvailable: true }, (lock) => {
      asked = true
      return lock ? work(true) : busy()
    })
  } catch (error) {
    if (asked) throw error
    return work(false)
  }
}

/** Delete a staging copy, if there is one: a garden being deleted goes with it. */
export function removeStaging(name: string): Promise<void> {
  return removeDatabase(stagingName(name))
}

function removeDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('A database could not be deleted.'))
  })
}

/** Every record of every store, read in one transaction, and each store's keys. */
async function readAll(
  db: IDBPDatabase<GardenDatabase>,
): Promise<{ entries: Entry[]; keys: Map<string, IDBValidKey[]> }> {
  const tx = db.transaction(OBJECT_STORES, 'readonly')
  const entries: Entry[] = []
  const keys = new Map<string, IDBValidKey[]>()
  await Promise.all(
    OBJECT_STORES.map(async (name) => {
      const store = storeOf(unwrap(tx), name)
      const [found, values] = await Promise.all([store.getAllKeys(), store.getAll()])
      keys.set(name, found)
      found.forEach((key, index) => entries.push([name, key, values[index]]))
    }),
  )
  await tx.done
  return { entries, keys }
}

function sameKeys(a: IDBValidKey[], b: IDBValidKey[] = []): boolean {
  return a.length === b.length && a.every((key, index) => indexedDB.cmp(key, b[index]) === 0)
}

function sameLock(a: unknown, b: unknown): boolean {
  const [x, y] = [a as LockRecord | undefined, b as LockRecord | undefined]
  return x?.id === y?.id && x?.stamp === y?.stamp
}

/**
 * The switch's commit point. In one transaction: check that nothing was
 * written since `read` -- no garden write (the revision), no change to the
 * lock, no record added or taken away anywhere, no draft changed -- and put
 * the mark in the lock's place. Throws GardenConflictError if anything was.
 */
async function freeze(
  db: IDBPDatabase<GardenDatabase>,
  read: { entries: Entry[]; keys: Map<string, IDBValidKey[]> },
  mark: SwitchMark,
): Promise<void> {
  const tx = db.transaction(OBJECT_STORES, 'readwrite', STRICT)
  const raw = unwrap(tx)
  try {
    const [unchanged, meta, lock, drafts] = await Promise.all([
      Promise.all(
        OBJECT_STORES.map(async (name) =>
          sameKeys(await storeOf(raw, name).getAllKeys(), read.keys.get(name)),
        ),
      ),
      tx.objectStore('meta').get('current'),
      tx.objectStore('lock').get('current'),
      tx.objectStore('drafts').get('current'),
    ])
    if (
      !unchanged.every(Boolean) ||
      revisionOf(meta) !== revisionOf(valueAt(read.entries, 'meta')) ||
      !sameLock(lock, valueAt(read.entries, 'lock')) ||
      JSON.stringify(drafts) !== JSON.stringify(valueAt(read.entries, 'drafts'))
    ) {
      throw new GardenConflictError()
    }
    await Promise.all([tx.objectStore('lock').put(mark, 'current'), tx.done])
  } catch (error) {
    try {
      tx.abort()
    } catch {
      // Already finished.
    }
    await tx.done.catch(() => undefined)
    throw error
  }
}

/** Put back the lock a mark stood in for, if the mark is still there. */
async function unfreeze(db: IDBPDatabase<GardenDatabase>, mark: SwitchMark): Promise<void> {
  const tx = db.transaction('lock', 'readwrite', STRICT)
  const stored = await tx.store.get('current')
  if (isSwitchMark(stored) && stored.id === mark.id) {
    await (mark.was ? tx.store.put(mark.was, 'current') : tx.store.delete('current'))
  }
  await tx.done
}

/** Whether the mark is still where the lock is kept; throws if not. */
async function stillMarked(db: IDBPDatabase<GardenDatabase>, mark: SwitchMark): Promise<void> {
  const stored = await db.get('lock', 'current')
  if (!isSwitchMark(stored) || stored.id !== mark.id) throw new GardenLockedError()
}

/**
 * The staging copy: written in one durable transaction with its plan, so a
 * copy with a plan is a whole one. A copy left from before goes first.
 */
async function writeStaging(name: string, plan: SwitchPlan, entries: Entry[]): Promise<void> {
  await removeDatabase(stagingName(name))
  const staging = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(stagingName(name), 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('entries')
      request.result.createObjectStore('plan')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('The copy could not be made.'))
  })
  try {
    staging.onversionchange = () => staging.close()
    const tx = staging.transaction(['entries', 'plan'], 'readwrite', STRICT)
    await new Promise<void>((resolve, reject) => {
      for (const [store, key, value] of entries) tx.objectStore('entries').put(value, [store, key])
      tx.objectStore('plan').put(plan, 'current')
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error ?? new Error('The copy could not be made.'))
    })
  } finally {
    staging.close()
  }
}

/**
 * The staging copy, if there is one: its contents, and its plan when the
 * copy is whole. Looked for without leaving a database behind where there
 * is none.
 */
async function readStaging(name: string): Promise<{ plan?: SwitchPlan; entries: Entry[] } | undefined> {
  const found = await new Promise<IDBDatabase | undefined>((resolve, reject) => {
    const request = indexedDB.open(stagingName(name))
    // There was none: opening it would make one, which is taken back.
    request.onupgradeneeded = () => request.transaction?.abort()
    request.onsuccess = () => resolve(request.result)
    request.onerror = (event) => {
      event.preventDefault()
      if (request.error?.name === 'AbortError') resolve(undefined)
      else reject(request.error ?? new Error('The copy could not be read.'))
    }
  })
  if (!found) return undefined
  try {
    found.onversionchange = () => found.close()
    if (!found.objectStoreNames.contains('entries') || !found.objectStoreNames.contains('plan'))
      return { entries: [] }
    const tx = found.transaction(['entries', 'plan'])
    const [keys, values, plan] = await Promise.all([
      storeOf(tx, 'entries').getAllKeys(),
      storeOf(tx, 'entries').getAll(),
      storeOf(tx, 'plan').get('current'),
    ])
    const entries = keys.map((key, index): Entry => {
      const [store, inStore] = key as [string, IDBValidKey]
      return [store, inStore, values[index]]
    })
    const whole = (plan as SwitchPlan | undefined)?.format === SWITCH_FORMAT
    return whole ? { plan: plan as SwitchPlan, entries } : { entries }
  } finally {
    found.close()
  }
}

/**
 * Steps 4 and 5's first half: delete the garden's database and create it
 * again holding `entries`, written in the transaction that creates it, then
 * check it in a durable transaction. The creation is asked for together
 * with the deletion, so it is next in line for the name. `onWaiting` is
 * told when the deletion waits for a connection another tab will not close.
 */
function replaceMain(
  name: string,
  entries: Entry[],
  plan: SwitchPlan,
  onWaiting?: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let filled = false
    const removal = indexedDB.deleteDatabase(name)
    removal.onblocked = () => onWaiting?.()
    const request = indexedDB.open(name, DATABASE_VERSION)
    request.onupgradeneeded = (event) => {
      const tx = request.transaction!
      // Something other than this switch made it, an older build perhaps:
      // it is not filled over, and the staging copy stays for `settle`.
      if (event.oldVersion !== 0) {
        tx.abort()
        return
      }
      for (const store of OBJECT_STORES) request.result.createObjectStore(store)
      for (const [store, key, value] of entries) tx.objectStore(store).put(value, key)
      filled = true
    }
    request.onerror = (event) => {
      event.preventDefault()
      reject(request.error ?? new Error('The garden could not be stored again.'))
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      if (!filled) {
        db.close()
        reject(new Error('The garden could not be stored again.'))
        return
      }
      // Read back, and written once more durably, so everything before it
      // is on the disk before the staging copy goes.
      const tx = db.transaction(['meta', 'lock'], 'readwrite', STRICT)
      const meta = tx.objectStore('meta').get('current')
      const lock = tx.objectStore('lock').get('current')
      meta.onsuccess = () => {
        if (meta.result !== undefined) tx.objectStore('meta').put(meta.result, 'current')
      }
      tx.oncomplete = () => {
        db.close()
        const stored = lock.result as unknown
        if (
          revisionOf(meta.result) === plan.revision &&
          !isSwitchMark(stored) &&
          (stored as LockRecord | undefined)?.id === plan.lockId
        ) {
          resolve()
        } else {
          reject(new Error('The garden stored again is not what was written.'))
        }
      }
      tx.onabort = () => {
        db.close()
        reject(tx.error ?? new Error('The garden could not be stored again.'))
      }
    }
  })
}

/**
 * A switch past the point where its staging copy is whole, which could not
 * be finished here (the disk full, say). Its change is kept: the next open
 * of the garden finishes it from the copy.
 */
class SwitchUnfinishedError extends Error {
  constructor() {
    super(
      'The change is kept, but the garden could not be written again just now. It finishes the next time the garden opens, and nothing is lost.',
    )
    this.name = 'SwitchUnfinishedError'
  }
}

export interface SwitchRequest {
  /** The garden's database. */
  name: string
  /** The repository's connection to it, closed (`release`) before it is deleted. */
  db: IDBPDatabase<GardenDatabase>
  release: () => void
  /** The key the garden is under now, if it has a lock. */
  from?: { key: CryptoKey; lockId: string }
  /** The new lock and its key, or none to turn the lock off. */
  next?: { record: LockRecord; key: CryptoKey }
  /** The lock record a change was made from: refused if it has changed since. */
  madeFrom?: LockRecord
  /** Told when the old database is held open by another window, and the switch waits for it. */
  onWaiting?: () => void
}

/**
 * Turn the lock on or off, or seal the garden under a new key: every store
 * read, opened with `from` (if any), sealed with `next` (if any), and written
 * into a new database (see the top of this file). Resolves with the revision
 * it replaced, and, for a change kept but not finished here, why
 * (SwitchUnfinishedError); throws if the change was not made.
 */
export function switchGarden(
  request: SwitchRequest,
): Promise<{ base: number; unfinished?: Error }> {
  return exclusively(
    request.name,
    () => runSwitch(request),
    () => {
      throw new GardenLockedError()
    },
  )
}

async function runSwitch({
  name,
  db,
  release,
  from,
  next,
  madeFrom,
  onWaiting,
}: SwitchRequest): Promise<{ base: number; unfinished?: Error }> {
  const { restoreValue } = await import('./sealedStores')
  let entries: Entry[]
  let base: number
  let mark: SwitchMark
  for (let attempt = 1; ; attempt += 1) {
    const read = await readAll(db)
    const lock = valueAt(read.entries, 'lock') as LockRecord | SwitchMark | undefined
    if (
      isSwitchMark(lock) ||
      lock?.id !== from?.lockId ||
      (madeFrom !== undefined && lock?.stamp !== madeFrom.stamp)
    ) {
      throw new GardenLockedError()
    }
    const meta = valueAt(read.entries, 'meta')
    if (meta === undefined) throw new Error('There is no garden stored here to lock yet.')
    base = revisionOf(meta)
    const revision = base + 1
    entries = await Promise.all(
      read.entries
        .filter(([store]) => store !== 'lock')
        .map(async ([store, key, value]): Promise<Entry> => {
          const stored = await restoreValue(store, value, from?.key, next?.key)
          return [store, key, store === 'meta' ? { ...(stored as object), revision } : stored]
        }),
    )
    if (next) entries.push(['lock', 'current', next.record])
    mark = {
      format: SWITCH_FORMAT,
      id: newId(),
      stamp: newId(),
      at: new Date().toISOString(),
      ...(lock ? { was: lock } : {}),
    }
    try {
      await freeze(db, read, mark)
      break
    } catch (error) {
      if (error instanceof GardenConflictError && attempt < SWITCH_ATTEMPTS) continue
      throw error
    }
  }

  const plan: SwitchPlan = {
    format: SWITCH_FORMAT,
    id: mark.id,
    ...(next ? { lockId: next.record.id } : {}),
    revision: base + 1,
  }
  try {
    await writeStaging(name, plan, entries)
    await stillMarked(db, mark)
  } catch (error) {
    // Nothing of a switch that did not get this far is kept.
    await unfreeze(db, mark).catch(() => undefined)
    await removeDatabase(stagingName(name)).catch(() => undefined)
    throw error
  }
  // From here the staging copy is whole: if anything below fails, or the
  // tab is closed, the next open finishes the switch from it.
  release()
  try {
    await replaceMain(name, entries, plan, onWaiting)
    await removeDatabase(stagingName(name))
  } catch {
    return { base, unfinished: new SwitchUnfinishedError() }
  }
  return { base }
}

/**
 * Whatever an older build left in the garden's database while it was briefly
 * gone, kept as a set-aside copy in the safe mode download's shape, so a
 * garden begun there is never lost. Undefined when it holds nothing.
 */
async function strayCopy(
  db: IDBPDatabase<GardenDatabase>,
  version: number,
): Promise<QuarantineRecord | undefined> {
  const { entries } = await readAll(db)
  if (entries.length === 0) return undefined
  const stores: Record<string, Record<string, unknown>> = {}
  for (const [store, key, value] of entries) {
    stores[store] = { ...stores[store], [typeof key === 'string' ? key : JSON.stringify(key)]: value }
  }
  const storedAt = new Date().toISOString()
  return {
    id: `malformed-stray-${storedAt}`,
    reason: 'malformed',
    storedAt,
    raw: { format: RAW_EXPORT_FORMAT, exportedAt: storedAt, databaseVersion: version, stores },
  }
}

/**
 * Settle a switch that was cut off, when the garden's database has just been
 * opened (`upgradedFrom`: it was created, or an older build's was upgraded)
 * or is found with a switch mark in it. Returns true when it changed the
 * garden's database, having closed `db`: the caller opens it again.
 *
 * Nothing is done while the tab that made a mark may still be at work: it
 * holds the switch's Web Lock, or, where there are none, its mark is recent.
 * Otherwise:
 * - The staging copy is whole, and the database is the one that switch
 *   marked, or it is empty (deleted, and not yet made again), or an older
 *   build made it while it was gone: the switch is finished from the copy,
 *   and anything an older build wrote is kept as a set-aside copy.
 * - Any other staging copy is stale or part-made, and goes; a mark is taken
 *   away, the lock it stood in for put back, and the garden is as it was.
 */
export function settle(
  name: string,
  db: IDBPDatabase<GardenDatabase>,
  upgradedFrom?: number,
): Promise<boolean> {
  return exclusively(
    name,
    async (sure) => {
      const staged = await readStaging(name)
      const stored = await db.get('lock', 'current')
      const mark = isSwitchMark(stored) ? stored : undefined
      if (mark && !sure && Date.now() - Date.parse(mark.at) <= STALE_MS) return false
      const stray = upgradedFrom !== undefined && upgradedFrom > 0
      const empty = (await db.count('meta')) + (await db.count('state')) === 0
      if (staged?.plan && (mark ? mark.id === staged.plan.id : empty || stray)) {
        const copy = stray ? await strayCopy(db, upgradedFrom) : undefined
        db.close()
        await replaceMain(
          name,
          copy ? [...staged.entries, ['quarantine', copy.id, copy]] : staged.entries,
          staged.plan,
        )
        await removeDatabase(stagingName(name))
        return true
      }
      if (staged) await removeDatabase(stagingName(name))
      if (!mark) return false
      await unfreeze(db, mark)
      db.close()
      return true
    },
    () => false,
  )
}
