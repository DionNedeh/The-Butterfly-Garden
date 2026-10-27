import { openDB, type DBSchema, type IDBPDatabase, type StoreNames } from 'idb'
import { createEmptyState } from '../lib/progression'
import type { AppState } from '../types'
import {
  CURRENT_STATE_VERSION,
  classifyRecord,
  migrateState,
  storedVersionOf,
  validateGarden,
} from './validateGarden'

export { CURRENT_STATE_VERSION, classifyRecord }

export interface QuarantineRecord {
  id: string
  reason: 'incompatible' | 'malformed'
  storedAt: string
  raw: unknown
}

/**
 * A copy of the whole garden, kept before something replaces it.
 *
 * A restore replaces the document outright; this is what makes it undoable.
 * The garden is stored raw, exactly as it was read, so taking a snapshot can
 * never be the thing that fails.
 */
export interface SnapshotRecord {
  id: string
  reason: 'restore'
  takenAt: string
  garden: unknown
}

/**
 * Text the gardener has typed but not yet saved, by field.
 *
 * Not an entry and not part of the garden: it is never exported, never counted
 * and never earns anything. It exists so a half-written reflection survives a
 * change of page, a reload or a closed tab.
 */
export type Drafts = Record<string, string>

/**
 * The large collections, each of which becomes its own stored record. The
 * value is the object store that holds it; only `jarPlacements` differs from
 * its field name, because `placements` reads better as a store.
 *
 * ---
 * ADDING A COLLECTION. Six steps, and the tests cover four of them:
 *
 *  1. Add the field to `AppState` and the empty value to `createEmptyState`.
 *     -- pinned by "accounts for every field of the garden".
 *  2. Add it here, and to the `GardenDatabase` interface below. `OBJECT_STORES`
 *     is derived, so there is no third list to keep in step.
 *  3. Raise `DATABASE_VERSION`, so the store is actually created.
 *     -- pinned by "every part store exists in the database it opens".
 *  4. Raise `CURRENT_STATE_VERSION` (in validateGarden.ts; every lower version
 *     stays readable automatically), have `storedVersionOf` write the new
 *     version for every garden from then on, and give the collection a
 *     `COLLECTION_SINCE_VERSION` entry. Without that entry every garden in the
 *     wild is read as damaged.
 *     -- pinned by "loads a stored garden from before every new collection".
 *  5. Default it in `validateGarden`, the way `jars` and `recaps` are defaulted
 *     rather than the way `moods` is required. A backup written before the
 *     collection existed has no key for it.
 *     -- pinned by "gives every collection a value when a backup predates it".
 *  6. Decide whether it belongs in a backup. It does unless it is a cache;
 *     export carries the whole document.
 */
export const COLLECTION_STORES = {
  goals: 'goals',
  completions: 'completions',
  moods: 'moods',
  reflections: 'reflections',
  recaps: 'recaps',
  moonlight: 'moonlight',
  customBackdrops: 'customBackdrops',
  plants: 'plants',
  creatures: 'creatures',
  sunlight: 'sunlight',
  jarPlacements: 'placements',
  jars: 'jars',
} as const

export type GardenCollection = keyof typeof COLLECTION_STORES

export const GARDEN_COLLECTIONS = Object.keys(
  COLLECTION_STORES,
) as GardenCollection[]

/**
 * Collections introduced after a given state version, and the version that
 * introduced each.
 *
 * A garden stored below that version could not have written the collection --
 * no build that produced it knew the collection existed -- so its absence
 * there is a fact about the record, not a guess about missing data.
 *
 * At or above that version a missing collection is still a hole and still
 * withholds the whole garden. This narrows what counts as missing; it does not
 * soften what happens when something is. See docs/handoff-p5-store-split.md
 * section 3.
 */
export const COLLECTION_SINCE_VERSION: Partial<
  Record<GardenCollection, number>
> = {
  recaps: 5,
  moonlight: 5,
  customBackdrops: 6,
}

/** The newest version that brought a collection with it. */
const LATEST_COLLECTION_VERSION = Math.max(
  ...Object.values(COLLECTION_SINCE_VERSION).filter((version) => version !== undefined),
)

/**
 * Whether an absent collection is explained by the version the garden was
 * stored at, rather than being a hole in it.
 */
function absenceIsExpected(
  collection: GardenCollection,
  storedVersion: unknown,
): boolean {
  const since = COLLECTION_SINCE_VERSION[collection]
  return (
    since !== undefined &&
    typeof storedVersion === 'number' &&
    storedVersion < since
  )
}

/**
 * Everything that is not a large collection. These are tiny and nearly always
 * change together, so they share one record rather than paying for a store
 * each.
 */
export const META_FIELDS = [
  'version',
  'profile',
  'seeds',
  'nectar',
  'stardust',
  'inventory',
  'ownedItemIds',
  'ownedFlightPatternIds',
  'selectedFlightPatternId',
] as const

export type MetaField = (typeof META_FIELDS)[number]
export type GardenPart = GardenCollection | 'meta'

/**
 * Whether two collections hold the same elements, compared by reference.
 *
 * Plain `a === b` is not enough: `awardSunlight` maps over `plants` on every
 * award, so an untouched collection still arrives with a fresh array identity
 * and a reference check would call it dirty forever. Comparing element-wise
 * costs O(n) pointer comparisons and allocates nothing, which is orders of
 * magnitude cheaper than serialising the collection to find out.
 *
 * Every update in `src/lib` replaces rather than mutates, so an element that
 * kept its identity cannot have changed. A false "unchanged" would lose data;
 * this comparison cannot produce one.
 */
export function sameCollection(
  a: readonly unknown[],
  b: readonly unknown[],
): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function metaChanged(before: AppState, after: AppState): boolean {
  for (const field of META_FIELDS) {
    const previous: unknown = before[field]
    const next: unknown = after[field]
    if (previous === next) continue
    if (
      Array.isArray(previous) &&
      Array.isArray(next) &&
      sameCollection(previous, next)
    ) {
      continue
    }
    return true
  }
  return false
}

/**
 * Which parts of the garden a write actually has to touch. With no known
 * previous state every part is dirty, which is the safe answer.
 */
export function changedParts(
  before: AppState | undefined,
  after: AppState,
): GardenPart[] {
  if (!before) return ['meta', ...GARDEN_COLLECTIONS]
  const dirty: GardenPart[] = []
  if (metaChanged(before, after)) dirty.push('meta')
  for (const collection of GARDEN_COLLECTIONS) {
    if (!sameCollection(before[collection], after[collection])) {
      dirty.push(collection)
    }
  }
  return dirty
}

/**
 * The small fields, stored together in the `meta` record, plus the revision
 * that orders every write (see `save`). The revision never leaves the
 * repository: it is stripped when the garden is assembled.
 */
export type GardenMeta = Pick<AppState, MetaField> & { revision?: number }

interface GardenDatabase extends DBSchema {
  /** The pre-split whole-garden record. Still read as the migration source. */
  state: {
    key: 'current'
    value: AppState
  }
  meta: {
    key: 'current'
    value: GardenMeta
  }
  goals: {
    key: 'current'
    value: AppState['goals']
  }
  completions: {
    key: 'current'
    value: AppState['completions']
  }
  moods: {
    key: 'current'
    value: AppState['moods']
  }
  reflections: {
    key: 'current'
    value: AppState['reflections']
  }
  recaps: {
    key: 'current'
    value: AppState['recaps']
  }
  moonlight: {
    key: 'current'
    value: AppState['moonlight']
  }
  customBackdrops: {
    key: 'current'
    value: AppState['customBackdrops']
  }
  plants: {
    key: 'current'
    value: AppState['plants']
  }
  creatures: {
    key: 'current'
    value: AppState['creatures']
  }
  sunlight: {
    key: 'current'
    value: AppState['sunlight']
  }
  jars: {
    key: 'current'
    value: AppState['jars']
  }
  placements: {
    key: 'current'
    value: AppState['jarPlacements']
  }
  quarantine: {
    key: string
    value: QuarantineRecord
  }
  snapshots: {
    key: string
    value: SnapshotRecord
  }
  drafts: {
    key: 'current'
    value: Drafts
  }
}

/**
 * Every store this build expects to exist, created on upgrade if missing.
 *
 * Derived from the collection map rather than listed again: a hand-written
 * copy stops naming the store a new collection needs, and the transaction that
 * reads the garden then fails for everyone at once.
 */
const OBJECT_STORES: readonly StoreNames<GardenDatabase>[] = [
  'state',
  'meta',
  ...GARDEN_COLLECTIONS.map((collection) => COLLECTION_STORES[collection]),
  'quarantine',
  'snapshots',
  'drafts',
]

export const DATABASE_NAME = 'butterfly-garden'
/**
 * Which object stores exist. Distinct from AppState.version, which describes
 * the shape of the document. The store split moved only this one, precisely
 * because bumping the other would have made every existing client treat its
 * own data as written by a newer build and refuse to write.
 *
 * Moonlight moved both, and deliberately: it added two stores (this number)
 * and two fields to the document (AppState.version). Version 6 adds the
 * `snapshots` and `drafts` stores only, so the document version stays put.
 */
export const DATABASE_VERSION = 6

/** How many set-aside copies of an unreadable garden are kept. */
const QUARANTINE_LIMIT = 3
/** How many pre-restore snapshots are kept. */
const SNAPSHOT_LIMIT = 2

/**
 * Another tab wrote the garden after this one last read it.
 *
 * Writing anyway would overwrite that tab's change with this one's older view
 * -- the lost update that used to be possible whenever two tabs were open. The
 * caller reloads instead and tells the gardener their last change was not
 * saved, which is honest and rare.
 */
export class GardenConflictError extends Error {
  constructor() {
    super(
      'Your garden changed in another tab, so your last change was not saved. It has been refreshed; please make it again.',
    )
    this.name = 'GardenConflictError'
  }
}

/**
 * The last read of the garden was withheld, so there is nothing trustworthy to
 * write against. The hook stops saving in that state; this makes the storage
 * layer refuse too, so the invariant does not rest on one caller.
 */
export class GardenWithheldError extends Error {
  constructor() {
    super(
      'Saving is paused because the stored garden could not be read. Nothing has been changed.',
    )
    this.name = 'GardenWithheldError'
  }
}

/** The garden was deleted from another tab; nothing here may write it back. */
export class GardenDeletedElsewhereError extends Error {
  constructor() {
    super('This garden was deleted in another tab.')
    this.name = 'GardenDeletedElsewhereError'
  }
}

/**
 * Deletion could not start because another tab holds the database open.
 *
 * IndexedDB does not cancel a blocked deletion: it waits, and completes the
 * moment that tab lets go. So this is not "nothing happened" -- the garden is
 * on its way out, and the tab that asked must behave as if it already were.
 */
export class GardenDeletionPendingError extends Error {
  constructor() {
    super(
      'Another open tab of the garden is holding your data. The deletion will finish as soon as that tab is closed.',
    )
    this.name = 'GardenDeletionPendingError'
  }
}

/** Whether a value names parts of the garden this build knows how to read. */
function knownParts(value: unknown): value is GardenPart[] {
  if (!Array.isArray(value) || value.length === 0) return false
  const known = new Set<string>(['meta', ...GARDEN_COLLECTIONS])
  return value.every((part) => typeof part === 'string' && known.has(part))
}

/** Stores holding the split garden. The legacy record is deliberately not
 *  among them: it is read only when there is no split garden to read. */
const PART_STORES: StoreNames<GardenDatabase>[] = [
  'meta',
  ...GARDEN_COLLECTIONS.map((collection) => COLLECTION_STORES[collection]),
]

function storeFor(part: GardenPart): StoreNames<GardenDatabase> {
  return part === 'meta' ? 'meta' : COLLECTION_STORES[part]
}

function metaOf(state: AppState, revision: number): GardenMeta {
  return {
    // 6 or 7, by what the garden holds (validateGarden's storedVersionOf).
    version: storedVersionOf(state),
    profile: state.profile,
    seeds: state.seeds,
    nectar: state.nectar,
    stardust: state.stardust,
    inventory: state.inventory,
    ownedItemIds: state.ownedItemIds,
    ownedFlightPatternIds: state.ownedFlightPatternIds,
    selectedFlightPatternId: state.selectedFlightPatternId,
    revision,
  }
}

/** The revision a stored meta record carries; 0 for one that predates it. */
function revisionOf(meta: unknown): number {
  const revision = (meta as { revision?: unknown } | undefined)?.revision
  return typeof revision === 'number' &&
    Number.isInteger(revision) &&
    revision >= 0
    ? revision
    : 0
}

/**
 * Writes that replace the whole garden -- a migration, a version catch-up, a
 * restore -- ask the browser to reach the disk before reporting success.
 * Chrome commits with relaxed durability by default since version 121, and
 * Google recommends strict durability for exactly these cases.
 */
const STRICT = { durability: 'strict' } as const

/** Rebuild the AppState the rest of the app expects from its stored parts. */
function assembleGarden(meta: unknown, collections: unknown[]): unknown {
  const assembled: Record<string, unknown> = {
    ...(meta && typeof meta === 'object' ? meta : {}),
  }
  delete assembled.revision
  GARDEN_COLLECTIONS.forEach((collection, index) => {
    assembled[collection] = collections[index]
  })
  return assembled
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

/** The envelope a raw safe-mode download is written in. */
export const RAW_EXPORT_FORMAT = 'the-butterfly-garden-raw'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The garden inside a raw safe-mode download, assembled the same way a load
 * assembles it: the split parts when they are there, the legacy record if not.
 */
function gardenFromRawExport(value: Record<string, unknown>): unknown {
  const stores = isRecord(value.stores) ? value.stores : {}
  const current = (store: string) => {
    const records = stores[store]
    return isRecord(records) ? records.current : undefined
  }
  const meta = current('meta')
  if (meta !== undefined) {
    return assembleGarden(
      meta,
      GARDEN_COLLECTIONS.map((collection) =>
        current(COLLECTION_STORES[collection]),
      ),
    )
  }
  return current('state')
}

/** The garden a backup file holds, whichever envelope it arrived in. */
function payloadOf(value: unknown): unknown {
  if (!isRecord(value)) return value
  if (value.format === RAW_EXPORT_FORMAT) return gardenFromRawExport(value)
  return 'garden' in value ? value.garden : value
}

/**
 * Validate a garden that came from an exported backup file. Returns undefined
 * when the file is not a garden this build can read.
 */
export function readImportedState(value: unknown): AppState | undefined {
  return migrateState(payloadOf(value))
}

/**
 * The same check as `readImportedState`, with what it found: how many damaged
 * but recoverable entries were repaired, and why a file was refused.
 */
export function inspectImportedState(value: unknown) {
  return validateGarden(payloadOf(value))
}

/** A short hex fingerprint of a record, or undefined when one can't be made. */
async function fingerprint(raw: unknown): Promise<string | undefined> {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return undefined
    const text = JSON.stringify(raw)
    if (text === undefined) return undefined
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  } catch {
    return undefined
  }
}

/**
 * One garden store: everything the app reads and writes, against one database.
 *
 * A factory rather than a module of loose state so that tests can hold two
 * instances on the same database -- a faithful model of two open tabs, which
 * is where the hardest bugs in this layer have lived.
 */
export function createGardenRepository(databaseName = DATABASE_NAME) {
  let databasePromise: Promise<IDBPDatabase<GardenDatabase>> | undefined

  /**
   * The state believed to be on disk, used to work out what a write must
   * touch. Set only after a load or a write that actually committed, so a
   * failed write leaves it pointing at the last known-good garden and the next
   * attempt recomputes the same work rather than trusting a write that never
   * landed.
   */
  let persisted: AppState | undefined

  /**
   * The revision of the stored garden this instance last read or wrote.
   *
   * Every save carries it into its transaction and compares it with what is
   * stored. If another tab has written in between, the numbers differ and the
   * save is refused instead of overwriting that tab's work.
   */
  let persistedRevision = 0

  /**
   * Every write goes through this queue, one after another.
   *
   * Two saves from the same tab must not race each other: the second has to
   * diff against what the first actually wrote, and has to carry the revision
   * the first produced. A read that merges onto `persisted` waits on the queue
   * too, so it can never build on a base that a write in flight is about to
   * replace.
   */
  let queue: Promise<unknown> = Promise.resolve()

  /** Set when another tab deleted the database out from under this one. */
  let deletedElsewhere = false

  /** Set while the last read was withheld; saving is refused until cleared. */
  let withheld = false

  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = queue.then(work)
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  /**
   * Open the database, refusing to wait forever on another tab.
   *
   * Raising DATABASE_VERSION makes the open an upgrade, and an upgrade cannot
   * start while another tab still holds a connection at the old version. The
   * open request then fires `blocked` and simply never settles -- which, since
   * every read waits on this, leaves the app sitting on its splash screen with
   * nothing to show and nothing to report.
   *
   * `blocked` turns that into an ordinary unavailable-storage failure, which
   * the app already knows how to explain and recover from.
   *
   * `blocking` is the other side of the same problem. It fires on this
   * connection when another tab wants to upgrade *or delete* the database, so
   * this tab steps aside. A delete (`newVersion === null`) also marks this
   * instance so it can never write the garden back afterwards.
   *
   * `terminated` fires when the browser drops the connection on its own
   * (storage cleared, or Safari's "connection to IndexedDB server lost"). The
   * cached handle is forgotten so the next call opens a fresh one, rather than
   * every save failing until the page is reloaded.
   */
  function database() {
    if (databasePromise) return databasePromise

    let reportBlocked: ((error: Error) => void) | undefined
    const blocked = new Promise<never>((_, reject) => {
      reportBlocked = reject
    })

    const opening = openDB<GardenDatabase>(databaseName, DATABASE_VERSION, {
      upgrade(db) {
        // Creating stores is all that happens here. Data is moved lazily on
        // the first load instead, because a version-change transaction is an
        // awkward place to do async work and a half-finished migration inside
        // one is precisely the silent loss this repository exists to prevent.
        for (const store of OBJECT_STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store)
          }
        }
      },
      blocked() {
        reportBlocked?.(
          new Error(
            'Another open tab of the garden is still using an older version. Close the other tabs and reopen the app.',
          ),
        )
      },
      blocking(_currentVersion, blockedVersion, event) {
        ;(event.target as IDBDatabase | null)?.close()
        databasePromise = undefined
        if (blockedVersion === null) {
          deletedElsewhere = true
          persisted = undefined
          persistedRevision = 0
        }
      },
      terminated() {
        databasePromise = undefined
      },
    })

    // Whichever resolves first wins. A failure is not cached: the other tab
    // may close a moment later, and the next attempt should get a real
    // connection rather than the remembered refusal.
    databasePromise = Promise.race([opening, blocked]).catch(
      (error: unknown) => {
        databasePromise = undefined
        throw error
      },
    )
    // The losing promise of the race keeps its rejection; claim it so it is
    // not reported as unhandled.
    blocked.catch(() => undefined)
    return databasePromise
  }

  /** Read every part of the split garden in one transaction. */
  async function readParts(
    db: IDBPDatabase<GardenDatabase>,
  ): Promise<{ meta: unknown; collections: unknown[] }> {
    const tx = db.transaction(PART_STORES, 'readonly')
    const requests = [
      tx.objectStore('meta').get('current') as Promise<unknown>,
      ...GARDEN_COLLECTIONS.map((collection) =>
        (
          tx.objectStore(COLLECTION_STORES[collection]) as {
            get: (key: 'current') => Promise<unknown>
          }
        ).get('current'),
      ),
    ]
    const [meta, ...collections] = await Promise.all(requests)
    await tx.done
    return { meta, collections }
  }

  /** Read just the named parts, in one transaction. */
  async function readNamedParts(
    db: IDBPDatabase<GardenDatabase>,
    parts: GardenPart[],
  ): Promise<Map<GardenPart, unknown>> {
    const tx = db.transaction(parts.map(storeFor), 'readonly')
    const requests = parts.map((part) =>
      (
        tx.objectStore(storeFor(part)) as {
          get: (key: 'current') => Promise<unknown>
        }
      ).get('current'),
    )
    const values = await Promise.all(requests)
    await tx.done
    return new Map(parts.map((part, index) => [part, values[index]]))
  }

  /**
   * Write the whole garden across every part store, atomically and durably,
   * one revision past whatever is stored. Returns the revision written.
   */
  async function writeAllParts(
    db: IDBPDatabase<GardenDatabase>,
    state: AppState,
  ): Promise<number> {
    const tx = db.transaction(PART_STORES, 'readwrite', STRICT)
    const metaStore = tx.objectStore('meta')
    const revision = revisionOf(await metaStore.get('current')) + 1
    const writes: Promise<unknown>[] = [
      metaStore.put(metaOf(state, revision), 'current'),
    ]
    for (const collection of GARDEN_COLLECTIONS) {
      const store = tx.objectStore(COLLECTION_STORES[collection]) as {
        put: (value: unknown, key: 'current') => Promise<unknown>
      }
      writes.push(store.put(state[collection], 'current'))
    }
    await Promise.all([...writes, tx.done])
    return revision
  }

  /**
   * Set an unreadable record aside so it is never lost.
   *
   * Keyed by a fingerprint of its contents, so the same unreadable garden is
   * kept once however many times it is loaded -- it used to gain a full copy,
   * images and all, on every launch. At most a few distinct copies are kept,
   * oldest discarded first.
   */
  async function quarantine(
    raw: unknown,
    reason: 'incompatible' | 'malformed',
  ): Promise<void> {
    try {
      const db = await database()
      const print = await fingerprint(raw)
      const storedAt = new Date().toISOString()
      const id = print ? `${reason}-${print}` : `${reason}-${storedAt}`
      if (print && (await db.getKey('quarantine', id)) !== undefined) return
      await db.put('quarantine', { id, reason, storedAt, raw }, id)
      const all = await db.getAll('quarantine')
      if (all.length > QUARANTINE_LIMIT) {
        const oldest = all
          .sort((a, b) => a.storedAt.localeCompare(b.storedAt))
          .slice(0, all.length - QUARANTINE_LIMIT)
        for (const record of oldest) await db.delete('quarantine', record.id)
      }
    } catch {
      // Quarantining is best effort; never let it mask the original problem.
    }
  }

  /**
   * Move a pre-split garden into the split stores, or report that there is
   * nothing to move.
   *
   * The legacy record is left in place afterwards, on purpose. It is the
   * migration's source, so keeping it is what makes a revert of this work
   * possible. It does go stale from this point, since writes now go to the
   * split stores only.
   *
   * If the process dies before the write below commits, the split stores stay
   * empty and the next launch simply runs this again -- nothing is lost.
   */
  async function loadFromLegacyRecord(
    db: IDBPDatabase<GardenDatabase>,
  ): Promise<LoadResult> {
    let legacy: unknown
    try {
      legacy = await db.get('state', 'current')
    } catch {
      persisted = undefined
      return {
        status: 'withheld',
        state: createEmptyState(),
        reason: 'unavailable',
      }
    }

    if (legacy === undefined) {
      persisted = undefined
      persistedRevision = 0
      return { status: 'empty', state: createEmptyState() }
    }

    const migrated = migrateState(legacy)
    if (!migrated) {
      const reason =
        classifyRecord(legacy) === 'incompatible' ? 'incompatible' : 'malformed'
      await quarantine(legacy, reason)
      persisted = undefined
      return { status: 'withheld', state: createEmptyState(), reason }
    }

    try {
      persistedRevision = await writeAllParts(db, migrated)
    } catch {
      // The legacy record is untouched, so this is safe to retry on the next
      // launch. Staying read-only until then keeps the two layouts from
      // diverging in the meantime.
      persisted = undefined
      return {
        status: 'withheld',
        state: createEmptyState(),
        reason: 'unavailable',
      }
    }

    persisted = migrated
    return { status: 'loaded', state: migrated }
  }

  /**
   * Read the garden. A record this build cannot understand is preserved and
   * reported as 'withheld' rather than silently replaced with a blank garden.
   */
  async function readGarden(): Promise<LoadResult> {
    let db: IDBPDatabase<GardenDatabase>
    let parts: { meta: unknown; collections: unknown[] }
    try {
      db = await database()
      parts = await readParts(db)
    } catch (error) {
      persisted = undefined
      return {
        status: 'withheld',
        state: createEmptyState(),
        // A newer build already raised the database version: this one is
        // out of date, not broken, and the gardener should update rather
        // than "try again".
        reason:
          (error as { name?: unknown } | null)?.name === 'VersionError'
            ? 'incompatible'
            : 'unavailable',
      }
    }
    deletedElsewhere = false

    const { meta, collections } = parts
    const nothingStored =
      meta === undefined && collections.every((part) => part === undefined)

    // No split garden: either a pre-split one to move across, or a new
    // gardener. The legacy record is read only here, so an ordinary launch
    // never pays to deserialise the snapshot left behind by the migration.
    if (nothingStored) return await loadFromLegacyRecord(db)

    const storedVersion = (meta as { version?: unknown } | undefined)?.version

    // A hole in an otherwise present garden cannot be filled in by guessing:
    // an absent collection is not an empty one. Withhold the whole garden
    // rather than hand back a half-read one.
    //
    // The exception is narrow and provable: a collection that did not exist
    // at the version this garden was stored at was never written, so its
    // absence is not a hole. A garden stored at or above that version is
    // held to the original rule.
    const complete =
      meta !== undefined &&
      collections.every(
        (part, index) =>
          part !== undefined ||
          absenceIsExpected(GARDEN_COLLECTIONS[index], storedVersion),
      )
    const candidate = complete ? assembleGarden(meta, collections) : undefined
    const migrated = candidate ? migrateState(candidate) : undefined
    if (migrated) {
      persistedRevision = revisionOf(meta)
      // Behind the newest version that brought a collection, that is: a
      // garden kept at 6 because it needs no more (storedVersionOf) is not
      // behind, and is not rewritten whole on every launch.
      const behind =
        typeof storedVersion === 'number' &&
        storedVersion < LATEST_COLLECTION_VERSION
      if (!behind) {
        persisted = migrated
        return { status: 'loaded', state: migrated }
      }

      // This garden was read by tolerating collections that did not exist
      // at the version it was stored under. That tolerance is anchored to
      // the stored version, so the whole garden has to be brought up to date
      // in one transaction now.
      //
      // Writing only what changes is otherwise the rule, and it would break
      // this: the next write to touch meta alone -- earning a single Nectar
      // would do it -- raises the stored version while leaving those
      // collections unwritten. The record then claims a version at which
      // their absence is a hole rather than a fact, and the launch after
      // that withholds the garden.
      try {
        persistedRevision = await writeAllParts(db, migrated)
        persisted = migrated
      } catch {
        // The stored record is untouched and still readable by the same
        // rule, so the next launch tries again. Leaving the baseline unset
        // means the next write covers every part rather than raising the
        // version alone.
        persisted = undefined
      }
      return { status: 'loaded', state: migrated }
    }

    const reason =
      typeof storedVersion === 'number' &&
      storedVersion > CURRENT_STATE_VERSION
        ? 'incompatible'
        : 'malformed'
    // Quarantine the whole assembled candidate: half a garden is not
    // something anyone could put back together by hand.
    await quarantine(candidate ?? assembleGarden(meta, collections), reason)
    persisted = undefined
    return { status: 'withheld', state: createEmptyState(), reason }
  }

  const repository = {
    /**
     * Read the garden. A record this build cannot understand is preserved and
     * reported as 'withheld' rather than silently replaced with a blank garden.
     */
    async load(): Promise<LoadResult> {
      const result = await readGarden()
      withheld = result.status === 'withheld'
      return result
    },

    /**
     * Write the garden, touching only the parts that changed.
     *
     * Everything goes in one transaction so the stored garden is never
     * internally inconsistent -- a creature that references a plant must not
     * survive a partial write in which the plant is missing.
     *
     * The transaction also checks the stored revision against the one this
     * instance last saw, and refuses with `GardenConflictError` when another
     * tab has written since. `meta` therefore joins every write: the revision
     * lives there. Rejects on failure so callers can tell the user.
     */
    save(state: AppState): Promise<GardenPart[]> {
      return enqueue(async () => {
        if (deletedElsewhere) throw new GardenDeletedElsewhereError()
        if (withheld) throw new GardenWithheldError()
        const dirty = changedParts(persisted, state)
        if (dirty.length === 0) return []
        if (!dirty.includes('meta')) dirty.unshift('meta')

        const db = await database()
        const base = persistedRevision
        const tx = db.transaction(dirty.map(storeFor), 'readwrite')
        const metaStore = tx.objectStore('meta')
        const stored = await metaStore.get('current')
        if (revisionOf(stored) !== base) {
          tx.abort()
          await tx.done.catch(() => undefined)
          throw new GardenConflictError()
        }
        const revision = base + 1
        const writes: Promise<unknown>[] = [
          metaStore.put(metaOf(state, revision), 'current'),
        ]
        for (const part of dirty) {
          if (part === 'meta') continue
          // The store and the field it holds are paired by COLLECTION_STORES,
          // but that correspondence is beyond what the index signature can
          // express.
          const store = tx.objectStore(COLLECTION_STORES[part]) as {
            put: (value: unknown, key: 'current') => Promise<unknown>
          }
          writes.push(store.put(state[part], 'current'))
        }
        await Promise.all([...writes, tx.done])
        persisted = state
        persistedRevision = revision
        return dirty
      })
    },

    /**
     * Settles once every write already asked for has finished, whether it
     * was kept or refused. An update's reload waits on it, so a change made
     * a moment before is never cut off half-written.
     */
    async settled(): Promise<void> {
      await queue
    },

    /**
     * Write a whole garden, replacing whatever was stored.
     *
     * `save` writes only what changed, which is right for an edit and wrong
     * for a restore: a backup replaces the document rather than amending it,
     * and two collections that happen to be empty on both sides would leave
     * their stored records untouched -- including, for a collection the backup
     * predates, a record that is not there at all. Writing every part keeps
     * the stored layout matching the version the record now claims.
     *
     * With `snapshot`, the garden being replaced is copied aside first so the
     * restore can be undone. A restore wins over any other tab's revision: it
     * is the gardener's explicit choice to replace everything.
     *
     * Returns every part, so the caller can tell other tabs the whole garden
     * moved rather than letting them keep editing the one it replaced.
     */
    replace(
      state: AppState,
      options: { snapshot?: boolean } = {},
    ): Promise<GardenPart[]> {
      return enqueue(async () => {
        const db = await database()
        if (options.snapshot) await takeSnapshot(db, 'restore')
        persistedRevision = await writeAllParts(db, state)
        persisted = state
        deletedElsewhere = false
        withheld = false
        return ['meta', ...GARDEN_COLLECTIONS] as GardenPart[]
      })
    },

    /**
     * Adopt a change another tab just wrote, reading only the parts it named.
     *
     * Anything unexpected falls back to a full load, which is always correct:
     * an older tab that names no parts, a part this build does not know, no
     * trustworthy base to merge onto, a store that has since emptied, or a
     * merge that fails validation -- that last case goes back through load()
     * so the quarantine path handles it rather than being reimplemented here.
     *
     * A result other than 'loaded' means this tab can no longer trust what it
     * holds. The caller must stop writing (see useGardenState), because the
     * baseline it would diff against is gone.
     */
    async adopt(parts: unknown): Promise<LoadResult> {
      if (!knownParts(parts)) return await repository.load()
      await queue

      let values: Map<GardenPart, unknown>
      try {
        values = await readNamedParts(await database(), parts)
      } catch {
        return await repository.load()
      }

      // Read after the awaits: a write that landed while this was reading has
      // already updated the base, and merging onto the older one would undo it.
      const base = persisted
      if (!base) return await repository.load()

      const candidate: Record<string, unknown> = { ...base }
      let revision = persistedRevision
      for (const [part, value] of values) {
        if (value === undefined) return await repository.load()
        if (part === 'meta') {
          revision = revisionOf(value)
          const meta = { ...(value as Record<string, unknown>) }
          delete meta.revision
          Object.assign(candidate, meta)
          continue
        }
        candidate[part] = value
      }

      const migrated = migrateState(candidate)
      if (!migrated) return await repository.load()
      persisted = migrated
      persistedRevision = revision
      withheld = false
      return { status: 'loaded', state: migrated }
    },

    /** Records this build could not read, kept so they are never lost. */
    async quarantined(): Promise<QuarantineRecord[]> {
      try {
        const all = await (await database()).getAll('quarantine')
        return all.sort((a, b) => b.storedAt.localeCompare(a.storedAt))
      } catch {
        return []
      }
    },

    async clearQuarantine(): Promise<void> {
      const db = await database()
      await db.clear('quarantine')
    },

    /** Copies taken before a restore, newest first, without their contents. */
    async snapshots(): Promise<Array<Omit<SnapshotRecord, 'garden'>>> {
      try {
        const all = await (await database()).getAll('snapshots')
        return all
          .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
          .map(({ id, reason, takenAt }) => ({ id, reason, takenAt }))
      } catch {
        return []
      }
    },

    /** One snapshot's garden, validated, or undefined if it cannot be read. */
    async snapshot(id: string): Promise<AppState | undefined> {
      const record = await (await database()).get('snapshots', id)
      return record ? migrateState(record.garden) : undefined
    },

    async readDrafts(): Promise<Drafts> {
      try {
        const stored = await (await database()).get('drafts', 'current')
        if (!isRecord(stored)) return {}
        const drafts: Drafts = {}
        for (const [key, value] of Object.entries(stored)) {
          if (typeof value === 'string') drafts[key] = value
        }
        return drafts
      } catch {
        return {}
      }
    },

    /** Best effort: a draft that fails to save is still on screen. */
    async writeDrafts(drafts: Drafts): Promise<void> {
      if (deletedElsewhere) return
      try {
        await (await database()).put('drafts', drafts, 'current')
      } catch {
        // Drafts are a convenience; the entry itself is saved separately.
      }
    },

    /**
     * Every record in the database, as stored, for safe mode.
     *
     * Opened without a version so it reads whatever is there without
     * upgrading anything: this runs when something has already gone wrong,
     * and must not be able to make it worse.
     */
    async readRaw(): Promise<Record<string, unknown>> {
      const db = await openDB(databaseName)
      try {
        const stores: Record<string, Record<string, unknown>> = {}
        for (const name of Array.from(db.objectStoreNames)) {
          const tx = db.transaction(name, 'readonly')
          const [keys, values] = await Promise.all([
            tx.store.getAllKeys(),
            tx.store.getAll(),
          ])
          await tx.done
          stores[name] = Object.fromEntries(
            keys.map((key, index) => [
              typeof key === 'string' ? key : JSON.stringify(key),
              values[index],
            ]),
          )
        }
        return {
          format: RAW_EXPORT_FORMAT,
          exportedAt: new Date().toISOString(),
          databaseVersion: db.version,
          stores,
        }
      } finally {
        db.close()
      }
    },

    /**
     * Get ready to start a new garden over one this build could not read.
     *
     * Only ever called once the unreadable record has been set aside in
     * quarantine. The stored revision is adopted so the new garden's first
     * save is not mistaken for a conflict with the record it replaces.
     */
    async prepareFreshStart(): Promise<void> {
      const db = await database()
      persistedRevision = revisionOf(await db.get('meta', 'current'))
      persisted = undefined
      deletedElsewhere = false
      withheld = false
    },

    /**
     * Forget everything this instance believes about the stored garden.
     *
     * Used when another tab deleted it: the next write must start a new garden
     * from scratch rather than diff against, or restore, the deleted one.
     */
    forget(): void {
      persisted = undefined
      persistedRevision = 0
      deletedElsewhere = false
      withheld = false
    },

    /**
     * Delete every trace of the garden. Rejects if another tab still holds the
     * database open — reporting success there would be a lie about deleted
     * data. The deletion stays queued in that case and completes as soon as
     * the other tab lets go, which is what the message says.
     */
    async clear(): Promise<void> {
      const db = await database()
      db.close()
      databasePromise = undefined
      persisted = undefined
      persistedRevision = 0
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName)
        request.onsuccess = () => {
          // This instance did the deleting; the versionchange its own
          // connection may have seen is not a deletion from elsewhere.
          deletedElsewhere = false
          withheld = false
          resolve()
        }
        request.onerror = () =>
          reject(request.error ?? new Error('The garden could not be deleted.'))
        request.onblocked = () => reject(new GardenDeletionPendingError())
      })
    },
  }

  /**
   * Copy the stored garden aside before it is replaced. Nothing to copy is
   * not an error: a first restore into an empty garden has nothing to undo.
   */
  async function takeSnapshot(
    db: IDBPDatabase<GardenDatabase>,
    reason: SnapshotRecord['reason'],
  ): Promise<void> {
    const { meta, collections } = await readParts(db)
    if (meta === undefined) return
    const takenAt = new Date().toISOString()
    const id = `${reason}-${takenAt}`
    await db.put(
      'snapshots',
      { id, reason, takenAt, garden: assembleGarden(meta, collections) },
      id,
    )
    const all = await db.getAll('snapshots')
    const stale = all
      .filter((record) => record.reason === reason)
      .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
      .slice(SNAPSHOT_LIMIT)
    for (const record of stale) await db.delete('snapshots', record.id)
  }

  return repository
}

export type GardenRepository = ReturnType<typeof createGardenRepository>

export const gardenRepository = createGardenRepository()
