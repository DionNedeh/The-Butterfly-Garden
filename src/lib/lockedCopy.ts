/**
 * Safe mode's copy of a garden that had the lock on ("Download what's
 * stored", lib/storedCopy), opened with that lock's passcode or recovery
 * code, so it can be restored as any backup is.
 *
 * Such a copy holds the garden as it was stored: each part sealed under the
 * garden's data key, its bytes as base64 (lib/storedBytes), and the lock's
 * record beside them, with the data key wrapped by the passcode and by the
 * recovery code (lib/gardenLock). So the copy carries its own way in, and
 * nothing else does: the passcode or recovery code unwraps the data key from
 * the copy's own record, exactly as the lock screen unwraps it from storage,
 * each part opens under its own name, and the whole goes on as the text of a
 * plain backup, to the same checks, preview, snapshot and undo as any other.
 * A wrong secret is told only that it is wrong, after the full derivation.
 *
 * What opens is the garden alone, not the lock: once restored, it is kept
 * under whatever lock the garden it replaces has, or none.
 *
 * Loaded only when such a copy is chosen to restore.
 */
import { COLLECTION_STORES, GARDEN_COLLECTIONS, isSealed } from '../repository/gardenRepository'
import { sealedKind } from './backupFile'
import type { PhotoLeftOut } from './sightingPhotos'
import {
  LOCK_FORMAT,
  openLock,
  WrongSecretError,
  type LockRecord,
  type LockSecret,
  type WrappedKey,
} from './gardenLock'
import { fromBase64 } from './sealing'

/**
 * The highest key-derivation count this build will spend time on, as for a
 * protected backup (lib/sealedBackup): a copy asking for more would hold the
 * page for minutes on a phone.
 */
const MAX_ITERATIONS = 10_000_000

/** A copy of a locked garden, checked and decoded, ready to be opened. */
export interface LockedCopy {
  /** The lock as it was when the copy was made. */
  record: LockRecord
  /** The garden's sealed parts, as a snapshot under the lock holds them. */
  garden: Record<string, unknown>
  exportedAt?: string
}

/**
 * Why a copy cannot be opened before any secret is asked for:
 * - `newer`   its lock was made by a later version, in a form this one does not know;
 * - `damaged` not a whole copy of a locked garden: cut short, or changed by hand.
 */
export type LockedCopyProblem = 'newer' | 'damaged'

export type LockedCopyRead = { ok: true; copy: LockedCopy } | { ok: false; problem: LockedCopyProblem }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Bytes a copy holds as `{ base64 }` (lib/storedBytes), or undefined. */
function bytesOf(value: unknown): Uint8Array | undefined {
  if (!isRecord(value) || typeof value.base64 !== 'string') return undefined
  try {
    return fromBase64(value.base64)
  } catch {
    return undefined
  }
}

/**
 * A sealed photo as a copy holds it: its sealed bytes as text, as any photo
 * goes into a file (lib/sightingPhotos). One whose bytes could not be read
 * when the copy was made is marked as left out, and stays missing here.
 */
function sealedPhotoOf(value: unknown): Blob | undefined {
  if (!isRecord(value) || typeof value.imageData !== 'string') return undefined
  try {
    return new Blob([fromBase64(value.imageData) as Uint8Array<ArrayBuffer>])
  } catch {
    return undefined
  }
}

/** A sealed value with its bytes and photos as they were stored, or undefined. */
function sealedValueOf(value: unknown): Record<string, unknown> | undefined {
  if (!isSealed(value)) return undefined
  const iv = bytesOf(value.iv)
  const data = bytesOf(value.data)
  if (!iv || !data) return undefined
  const { blobs } = value as { blobs?: unknown }
  if (blobs === undefined) return { ...value, iv, data }
  if (!Array.isArray(blobs)) return undefined
  return { ...value, iv, data, blobs: blobs.map(sealedPhotoOf) }
}

/** A wrapped data key as the copy holds it, or 'newer', or undefined when damaged. */
function wrappedKeyOf(value: unknown): WrappedKey | 'newer' | undefined {
  if (!isRecord(value)) return undefined
  if (value.kdf !== 'PBKDF2-SHA-256') return 'newer'
  const { iterations } = value
  if (typeof iterations !== 'number' || !Number.isSafeInteger(iterations) || iterations < 1) return undefined
  if (iterations > MAX_ITERATIONS) return 'newer'
  const salt = bytesOf(value.salt)
  const iv = bytesOf(value.iv)
  const wrapped = bytesOf(value.wrapped)
  return salt && iv && wrapped ? { kdf: 'PBKDF2-SHA-256', iterations, salt, iv, wrapped } : undefined
}

/**
 * Check a copy of a locked garden, without any secret: its lock's record,
 * and every part of the garden sealed as the lock stores it. A copy that
 * could never open says so at once, before anything is typed.
 */
export function readLockedCopy(text: string): LockedCopyRead {
  // A copy of everything stored, holding a lock: what a chosen file is
  // recognised as (lib/backupFile), and nothing else.
  if (sealedKind(text) !== 'copy') return { ok: false, problem: 'damaged' }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, problem: 'damaged' }
  }
  if (!isRecord(value) || !isRecord(value.stores)) return { ok: false, problem: 'damaged' }
  const stores = value.stores
  const current = (store: string) => {
    const records = stores[store]
    return isRecord(records) ? records.current : undefined
  }

  const lock = current('lock')
  if (!isRecord(lock) || lock.format !== LOCK_FORMAT) return { ok: false, problem: 'damaged' }
  if (typeof lock.version !== 'number' || lock.version < 1) return { ok: false, problem: 'damaged' }
  if (lock.version > 1) return { ok: false, problem: 'newer' }
  const passcode = wrappedKeyOf(lock.passcode)
  const recovery = wrappedKeyOf(lock.recovery)
  if (passcode === 'newer' || recovery === 'newer') return { ok: false, problem: 'newer' }
  if (typeof lock.id !== 'string' || !passcode || !recovery) return { ok: false, problem: 'damaged' }

  const meta = sealedValueOf(current('meta'))
  if (!meta) return { ok: false, problem: 'damaged' }
  const garden: Record<string, unknown> = { ...meta }
  for (const collection of GARDEN_COLLECTIONS) {
    const stored = current(COLLECTION_STORES[collection])
    if (stored === undefined) continue
    const sealed = sealedValueOf(stored)
    if (!sealed) return { ok: false, problem: 'damaged' }
    garden[collection] = sealed
  }

  return {
    ok: true,
    copy: {
      record: {
        format: LOCK_FORMAT,
        version: 1,
        id: lock.id,
        createdAt: typeof lock.createdAt === 'string' ? lock.createdAt : '',
        stamp: typeof lock.stamp === 'string' ? lock.stamp : '',
        passcode,
        recovery,
      },
      garden,
      exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : undefined,
    },
  }
}

export type LockedCopyOpened =
  | { ok: true; text: string }
  | { ok: false; problem: 'wrong' | 'damaged' }

/** A photo the copy was missing, as a plain copy marks one: its sighting is kept without it. */
function photoLeftOut(type: string): PhotoLeftOut {
  return type ? { mimeType: type, unreadable: true } : { unreadable: true }
}

/**
 * Open a checked copy with the lock's passcode or recovery code: the text of
 * a plain backup of the garden it holds, `wrong` when the secret does not
 * open its lock, or `damaged` when the secret does but a part will not
 * (changed since it was made). Nothing partial is ever handed back. Throws
 * only when the browser cannot do the work at all.
 */
export async function openLockedCopy(copy: LockedCopy, secret: LockSecret): Promise<LockedCopyOpened> {
  let key: CryptoKey
  try {
    key = await openLock(copy.record, secret)
  } catch (error) {
    if (error instanceof WrongSecretError) return { ok: false, problem: 'wrong' }
    throw error
  }
  // Fetched as everything else fetches them, never alongside: a module
  // both fetched and imported costs every first load a helper to join them.
  const [{ openGarden }, { fileCopy }] = await Promise.all([
    import('../repository/sealedStores'),
    import('./sightingPhotos'),
  ])
  let garden: Record<string, unknown>
  try {
    garden = await openGarden(key, copy.garden, photoLeftOut)
  } catch {
    return { ok: false, problem: 'damaged' }
  }
  const { text } = await fileCopy({
    format: 'the-butterfly-garden',
    exportedAt: copy.exportedAt,
    garden,
  })
  return { ok: true, text }
}
