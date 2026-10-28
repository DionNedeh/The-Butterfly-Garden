import type { IDBPDatabase } from 'idb'
import type { GardenDatabase, QuarantineRecord } from './gardenRepository'

/*
 * Setting an unreadable garden aside (quarantine), so it is never lost. Only
 * a garden this build cannot read needs it, so it loads only then and the
 * first load never pays for it.
 */

type Lock = { key: CryptoKey; lockId: string } | undefined

/** How many set-aside copies of an unreadable garden are kept. */
const QUARANTINE_LIMIT = 3

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
 * Set an unreadable record aside.
 *
 * Keyed by a fingerprint of its contents, so the same unreadable garden is
 * kept once however many times it is loaded -- it used to gain a full copy,
 * images and all, on every launch. At most a few distinct copies are kept,
 * oldest discarded first.
 *
 * Under the lock (`lock`, the one this tab holds), what is set aside is
 * sealed too: it may be journal. It is written only under the lock it was
 * sealed for, checked in the same transaction, so it is never left in the
 * clear under a lock another tab has just turned on, nor sealed under one
 * turned off, nor written while the lock is being changed.
 */
export async function setAside(
  database: () => Promise<IDBPDatabase<GardenDatabase>>,
  raw: unknown,
  reason: 'incompatible' | 'malformed',
  lock: Lock,
): Promise<void> {
  const print = await fingerprint(raw)
  const db = await database()
  const storedAt = new Date().toISOString()
  const id = print ? `${reason}-${print}` : `${reason}-${storedAt}`
  if (print && (await db.getKey('quarantine', id)) !== undefined) return
  const kept = lock
    ? await (await import('./sealedStores')).sealValue(lock.key, 'quarantine', raw)
    : raw
  const tx = db.transaction(['quarantine', 'lock'], 'readwrite')
  const store = tx.objectStore('quarantine')
  const stored = await tx.objectStore('lock').get('current')
  if (stored === undefined ? lock !== undefined : lock?.lockId !== stored.id) {
    tx.abort()
    await tx.done.catch(() => undefined)
    return
  }
  await store.put({ id, reason, storedAt, raw: kept }, id)
  const all = await store.getAll()
  const oldest = all
    .sort((a, b) => a.storedAt.localeCompare(b.storedAt))
    .slice(0, Math.max(0, all.length - QUARANTINE_LIMIT))
  for (const record of oldest) await store.delete(record.id)
  await tx.done
}

/**
 * Every set-aside copy, newest first, opened with the garden's key (`lock`,
 * if this tab holds one) as far as it opens, part by part
 * (repository/sealedStores); what will not open stays as it is, sealed.
 */
export async function setAsideCopies(
  db: IDBPDatabase<GardenDatabase>,
  lock: Lock,
): Promise<QuarantineRecord[]> {
  const all = await db.getAll('quarantine')
  const opened = await Promise.all(
    all.map(async (record) => ({
      ...record,
      raw: lock
        ? await (await import('./sealedStores'))
            .openQuarantined(lock.key, record.raw)
            .catch(() => record.raw)
        : record.raw,
    })),
  )
  return opened.sort((a, b) => b.storedAt.localeCompare(a.storedAt))
}
