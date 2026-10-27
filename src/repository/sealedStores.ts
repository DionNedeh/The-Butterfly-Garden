import type { IDBPDatabase } from 'idb'
import type { LockRecord } from '../lib/gardenLock'
import { fromBase64, open, seal, toBase64 } from '../lib/sealing'
import { CURRENT_STATE_VERSION } from './validateGarden'
import {
  COLLECTION_STORES,
  GARDEN_COLLECTIONS,
  GardenLockedError,
  isSealed,
  revisionOf,
  type GardenDatabase,
  type GardenPart,
} from './gardenRepository'

/*
 * The garden lock at rest: how each stored value is sealed and opened, and
 * how a switch of the lock stores each one again (repository/gardenSwitch
 * writes them all into a new database).
 *
 * The repository loads this only once a garden has a lock (see `sealedStores`
 * there), so a garden without one never downloads it. Everything above the
 * repository is unchanged: it hands over a garden and gets one back.
 */

/**
 * A value as the lock stores it.
 *
 * `data` is the value as JSON, sealed with AES-GCM under the garden's data
 * key, with a fresh 96-bit IV and the name of its place (`meta`, `moods`,
 * `drafts`...) as additional data, so a value moved to another place does
 * not open. Photos are sealed one by one into `blobs`: their bytes and type
 * are kept exactly, and a photo already sealed is not sealed again on every
 * save of the field book.
 */
export interface SealedValue {
  sealed: 1
  iv: Uint8Array
  data: Uint8Array
  blobs?: Blob[]
}

/**
 * The version a sealed `meta` record shows in the clear: above any version
 * a build before the lock can read. Such a build cannot open this database
 * at all (DATABASE_VERSION), but a copy of it in a file -- safe mode's
 * "Download what's stored" -- still reaches one, and there it reads as a
 * newer version's work, not as a damaged garden. The garden's real version
 * is inside the seal.
 */
export const SEALED_META_VERSION = CURRENT_STATE_VERSION + 1

/** Where a photo stood in a sealed value, its type, and the IV it was sealed with. */
const PHOTO = '\u0000photo'
/** Bytes inside a value (a set-aside copy can hold sealed parts), as base64. */
const BYTES = '\u0000bytes'

interface PhotoPlace {
  [PHOTO]: number
  type: string
  iv: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
/** How BYTES appears in JSON text. */
const BYTES_MARK = JSON.stringify(BYTES)

/**
 * Photos already sealed, by data key, by the place they were sealed for, and
 * by photo. A Blob never changes, so a field book saved again reuses each
 * photo's sealed copy (and its IV: the same bytes sealed once, stored again)
 * rather than sealing every photo on every save. A new key starts afresh, and
 * so does another place: a photo's sealed copy is bound to its place
 * (`sightings/photo`), and the same photo set aside in `quarantine` must be
 * sealed for there, or it would never open again.
 */
const sealedPhotos = new WeakMap<
  CryptoKey,
  Map<string, WeakMap<Blob, { iv: Uint8Array; sealed: Blob }>>
>()

function photosFor(key: CryptoKey, label: string) {
  let places = sealedPhotos.get(key)
  if (!places) {
    places = new Map()
    sealedPhotos.set(key, places)
  }
  let photos = places.get(label)
  if (!photos) {
    photos = new WeakMap()
    places.set(label, photos)
  }
  return photos
}

/** The Blobs anywhere inside a value, each once, in the order found. */
function collectBlobs(value: unknown, into: Map<Blob, number>): void {
  if (value instanceof Blob) {
    if (!into.has(value)) into.set(value, into.size)
  } else if (Array.isArray(value)) {
    for (const item of value) collectBlobs(item, into)
  } else if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    for (const item of Object.values(value)) collectBlobs(item, into)
  }
}

/** Seal any value the garden stores, photos included. */
export async function sealValue(
  key: CryptoKey,
  label: string,
  value: unknown,
): Promise<SealedValue> {
  const blobs = new Map<Blob, number>()
  collectBlobs(value, blobs)
  const cache = photosFor(key, label)
  const photoLabel = encoder.encode(`${label}/photo`)
  const sealedBlobs: Blob[] = []
  const places = new Map<Blob, PhotoPlace>()
  for (const [blob, index] of blobs) {
    let copy = cache.get(blob)
    if (!copy) {
      const { iv, ciphertext } = await seal(key, new Uint8Array(await blob.arrayBuffer()), photoLabel)
      copy = { iv, sealed: new Blob([ciphertext as Uint8Array<ArrayBuffer>]) }
      cache.set(blob, copy)
    }
    sealedBlobs[index] = copy.sealed
    places.set(blob, { [PHOTO]: index, type: blob.type, iv: toBase64(copy.iv) })
  }
  const text =
    JSON.stringify(value, (_key, item: unknown) =>
      item instanceof Blob
        ? places.get(item)
        : ArrayBuffer.isView(item)
          ? { [BYTES]: toBase64(new Uint8Array(item.buffer, item.byteOffset, item.byteLength)) }
          : item,
    ) ?? 'null'
  const { iv, ciphertext } = await seal(key, encoder.encode(text), encoder.encode(label))
  return sealedBlobs.length
    ? { sealed: 1, iv, data: ciphertext, blobs: sealedBlobs }
    : { sealed: 1, iv, data: ciphertext }
}

function isPhotoPlace(value: unknown): value is PhotoPlace {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>)[PHOTO] === 'number'
  )
}

function isBytes(value: unknown): value is { [BYTES]: string } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>)[BYTES] === 'string'
  )
}

/**
 * Put each photo, and any bytes, back where they stood. The value was just
 * parsed, so it is this function's own and is filled in place.
 */
async function revive(
  value: unknown,
  photoAt: (place: PhotoPlace) => Promise<unknown>,
): Promise<unknown> {
  if (isPhotoPlace(value)) return photoAt(value)
  if (isBytes(value)) return fromBase64(value[BYTES])
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = await revive(value[index], photoAt)
    }
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const [name, item] of Object.entries(record)) {
      record[name] = await revive(item, photoAt)
    }
  }
  return value
}

/**
 * Open what `sealValue` sealed. Throws when the key is wrong, the label is
 * not the one it was sealed under, or anything in it was changed: a photo's
 * IV is inside the sealed text, so photos swapped between places fail too.
 *
 * A sealed photo that is missing altogether fails it too, unless `leftOut`
 * says what stands in its place: a copy in a file (lib/lockedCopy) can be
 * missing one whose bytes could not be read when it was made, and keeps its
 * sighting without it, as a plain copy does. What is stored never is.
 */
export async function openValue(
  key: CryptoKey,
  label: string,
  sealed: SealedValue,
  leftOut?: (type: string) => unknown,
): Promise<unknown> {
  if (!ArrayBuffer.isView(sealed.iv) || !ArrayBuffer.isView(sealed.data)) {
    throw new Error('A sealed value is damaged.')
  }
  const bytes = await open(key, { iv: sealed.iv, ciphertext: sealed.data }, encoder.encode(label))
  const text = decoder.decode(bytes)
  const value: unknown = JSON.parse(text)
  // Most values hold neither photos nor bytes, and are not walked at all.
  if (!sealed.blobs?.length && !text.includes(BYTES_MARK)) return value
  // Each photo opened is remembered as sealed for this place, and only this one.
  const cache = photosFor(key, label)
  const photoLabel = encoder.encode(`${label}/photo`)
  return revive(value, async (place) => {
    const stored = sealed.blobs?.[place[PHOTO]]
    if (!(stored instanceof Blob)) {
      if (leftOut) return leftOut(place.type)
      throw new Error('A sealed photo is missing.')
    }
    const iv = fromBase64(place.iv)
    const photoBytes = await open(
      key,
      { iv, ciphertext: new Uint8Array(await stored.arrayBuffer()) },
      photoLabel,
    )
    const photo = new Blob([photoBytes as Uint8Array<ArrayBuffer>], { type: place.type })
    // The copy it came from is the one to store again, as long as it is kept.
    cache.set(photo, { iv, sealed: stored })
    return photo
  })
}

/**
 * Seal one part of the garden for its store. `meta` keeps its revision (which
 * orders every write, and is added as it is written) and a version in the
 * clear; everything else in it is sealed.
 */
export async function sealPart(key: CryptoKey, part: GardenPart, value: unknown): Promise<unknown> {
  const sealed = await sealValue(key, part, value)
  return part === 'meta' ? { version: SEALED_META_VERSION, ...sealed } : sealed
}

/** Seal each part of a write for its store, before the transaction opens. */
export async function sealParts(
  key: CryptoKey,
  values: Array<[GardenPart, unknown]>,
): Promise<Map<GardenPart, unknown>> {
  return new Map(
    await Promise.all(
      values.map(
        async ([part, value]): Promise<[GardenPart, unknown]> => [part, await sealPart(key, part, value)],
      ),
    ),
  )
}

/**
 * Open the parts a read found, or say they cannot be: damaged, moved from
 * another part's place, or not sealed where everything must be.
 */
export async function openParts(
  key: CryptoKey,
  parts: Array<[GardenPart, unknown]>,
): Promise<Array<[GardenPart, unknown]> | 'unreadable'> {
  try {
    return await Promise.all(
      parts.map(
        async ([part, value]): Promise<[GardenPart, unknown]> => [
          part,
          value === undefined ? undefined : await openPart(key, part, value),
        ],
      ),
    )
  } catch {
    return 'unreadable'
  }
}

/**
 * Store a change to the lock record, refused (GardenLockedError) when the
 * stored lock is not the one the change was made from.
 */
export async function writeLock(
  db: IDBPDatabase<GardenDatabase>,
  record: LockRecord,
  madeFrom: LockRecord,
): Promise<void> {
  const tx = db.transaction('lock', 'readwrite', { durability: 'strict' })
  const stored = await tx.store.get('current')
  if (stored?.id !== madeFrom.id || stored.stamp !== madeFrom.stamp) {
    tx.abort()
    await tx.done.catch(() => undefined)
    throw new GardenLockedError()
  }
  await Promise.all([tx.store.put(record, 'current'), tx.done])
}

/** Open one stored part. Under the lock every part is sealed; one that is not is refused. */
export async function openPart(key: CryptoKey, part: GardenPart, value: unknown): Promise<unknown> {
  if (!isSealed(value)) throw new Error(`The ${part} part is not sealed.`)
  const opened = await openValue(key, part, value)
  if (part !== 'meta') return opened
  return { ...(opened as Record<string, unknown>), revision: revisionOf(value) }
}

/** The fields of a sealed `meta` record that make up the sealed value itself. */
function sealedOf(record: Record<string, unknown>): SealedValue {
  const { iv, data, blobs } = record as unknown as SealedValue
  return blobs ? { sealed: 1, iv, data, blobs } : { sealed: 1, iv, data }
}

/**
 * A whole garden, sealed as its parts are stored: the shape a snapshot taken
 * under the lock has, since it copies the stored parts as they are.
 */
export async function sealGarden(key: CryptoKey, garden: unknown): Promise<Record<string, unknown>> {
  const whole = { ...(garden as Record<string, unknown>) }
  const sealed: Record<string, unknown> = {}
  for (const collection of GARDEN_COLLECTIONS) {
    if (whole[collection] !== undefined) {
      sealed[collection] = await sealValue(key, collection, whole[collection])
    }
    delete whole[collection]
  }
  return { version: SEALED_META_VERSION, ...(await sealValue(key, 'meta', whole)), ...sealed }
}

/**
 * Open a garden `sealGarden` (or a snapshot taken under the lock) sealed:
 * or, with `leftOut` (see openValue), one in a copy of what was stored.
 */
export async function openGarden(
  key: CryptoKey,
  garden: unknown,
  leftOut?: (type: string) => unknown,
): Promise<Record<string, unknown>> {
  const record = garden as Record<string, unknown>
  const whole = { ...((await openValue(key, 'meta', sealedOf(record), leftOut)) as Record<string, unknown>) }
  for (const collection of GARDEN_COLLECTIONS) {
    const value = record[collection]
    if (value !== undefined) {
      if (!isSealed(value)) throw new Error(`The ${collection} part is not sealed.`)
      whole[collection] = await openValue(key, collection, value, leftOut)
    }
  }
  return whole
}

/** Every store that can hold the gardener's words, and so is sealed under the lock. */
const SEALED_STORES = new Set<string>([
  'meta',
  ...GARDEN_COLLECTIONS.map((collection) => COLLECTION_STORES[collection]),
  'state',
  'quarantine',
  'snapshots',
  'drafts',
])

/** Which part of the garden a store holds, for the label its values are sealed under. */
const PART_OF_STORE = new Map<string, GardenPart>([
  ['meta', 'meta'],
  ...GARDEN_COLLECTIONS.map((collection): [string, GardenPart] => [
    COLLECTION_STORES[collection],
    collection,
  ]),
])

/**
 * A set-aside garden that would not open under the lock is kept as its
 * stored parts, still sealed. Each part is opened on its own here: what opens
 * is kept open, and only a part that will not open stays sealed, so one
 * damaged part never keeps the rest of the garden sealed with it.
 */
export async function openSetAside(key: CryptoKey, raw: unknown): Promise<unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  const record = raw as Record<string, unknown>
  let whole: Record<string, unknown> = { ...record }
  if (isSealed(record)) {
    const meta = await openValue(key, 'meta', sealedOf(record)).catch(() => undefined)
    if (meta && typeof meta === 'object') {
      const collections = Object.fromEntries(
        GARDEN_COLLECTIONS.filter((collection) => collection in record).map((collection) => [
          collection,
          record[collection],
        ]),
      )
      whole = { ...(meta as Record<string, unknown>), ...collections }
    }
  }
  for (const collection of GARDEN_COLLECTIONS) {
    const value = whole[collection]
    if (isSealed(value)) {
      whole[collection] = await openValue(key, collection, value).catch(() => value)
    }
  }
  return whole
}

/** A set-aside record's garden, opened as far as it opens (see openSetAside). */
export async function openQuarantined(key: CryptoKey, raw: unknown): Promise<unknown> {
  return openSetAside(key, isSealed(raw) ? await openValue(key, 'quarantine', raw) : raw)
}

/** Whether anything of a set-aside garden is still sealed. */
function stillSealed(raw: unknown): boolean {
  if (isSealed(raw)) return true
  if (!raw || typeof raw !== 'object') return false
  const record = raw as Record<string, unknown>
  return GARDEN_COLLECTIONS.some((collection) => isSealed(record[collection]))
}

/**
 * A set-aside copy of the garden holds something that will not open with the
 * garden's key. Changing the lock would take that key away, and with it the
 * only chance of ever opening what is left, so the lock is left as it is.
 */
export class SetAsideSealedError extends Error {
  constructor() {
    super(
      'A copy of your garden set aside on this device has parts that could not be opened, and changing the lock now would leave them sealed for good, so nothing was changed. Download the set-aside copy under Backup and restore in Settings; once you have it, or if you no longer need it, discard it there and try again.',
    )
    this.name = 'SetAsideSealedError'
  }
}

/**
 * One stored value as a switch stores it again: opened with the key the
 * garden is under now (`from`, if it is sealed), and sealed with the new one
 * (`to`, if any). Throws if anything sealed will not open, and
 * SetAsideSealedError if a set-aside copy would be left sealed under a key
 * about to be gone; either way the switch changes nothing.
 */
export async function restoreValue(
  store: string,
  value: unknown,
  from: CryptoKey | undefined,
  to: CryptoKey | undefined,
): Promise<unknown> {
  if (!SEALED_STORES.has(store)) return value
  const part = PART_OF_STORE.get(store)
  if (part) {
    const plain = from ? await openPart(from, part, value) : value
    if (isSealed(plain)) throw new Error(`The ${part} part is sealed under no lock.`)
    if (!to) return plain
    const { revision, ...fields } = plain as Record<string, unknown>
    const sealed = await sealPart(to, part, part === 'meta' ? fields : plain)
    return part === 'meta' ? { ...(sealed as object), revision } : sealed
  }
  if (store === 'quarantine') {
    const record = value as Record<string, unknown>
    let raw = record.raw
    if (from) {
      if (isSealed(raw)) {
        raw = await openValue(from, 'quarantine', raw).catch(() => {
          throw new SetAsideSealedError()
        })
      }
      // A garden set aside because it would not open under the lock may be
      // its sealed parts: each opened that will open. Anything left sealed
      // would be sealed for good once this key is gone, so nothing changes.
      raw = await openSetAside(from, raw)
      if (stillSealed(raw)) throw new SetAsideSealedError()
    }
    return { ...record, raw: to ? await sealValue(to, 'quarantine', raw) : raw }
  }
  if (store === 'snapshots') {
    const record = value as Record<string, unknown>
    let garden = record.garden
    if (from && isSealed(garden)) garden = await openGarden(from, garden)
    return { ...record, garden: to ? await sealGarden(to, garden) : garden }
  }
  // The pre-split record and the drafts: one value each, sealed by name.
  const plain = from && isSealed(value) ? await openValue(from, store, value) : value
  return to ? await sealValue(to, store, plain) : plain
}
