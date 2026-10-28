/**
 * Asking the browser to keep the garden.
 *
 * Without this a PWA's storage is "best effort": Chrome may evict it under
 * storage pressure, and Safari clears a site's script-writable storage after
 * seven days of browsing without a visit unless the site is on the Home
 * Screen. For a journal whose only copy is on this device, that is the largest
 * way to lose it. Browsers grant the request by their own rules -- an
 * installed app, frequent use -- so the answer is reported, never assumed.
 *
 * In the Android app the garden already lives in the app's private storage,
 * which Android never evicts; asking there is harmless.
 */

export type StorageProtection = 'protected' | 'best-effort' | 'unknown'

export interface StorageStatus {
  protection: StorageProtection
  /** Bytes the browser says this origin is using, when it will say. */
  usage?: number
  /** Bytes the browser would allow this origin, when it will say. */
  quota?: number
}

function storageManager(): StorageManager | undefined {
  return typeof navigator !== 'undefined' ? navigator.storage : undefined
}

/**
 * Request persistence once, quietly. Returns whether storage is now protected.
 * Never throws: a refusal is an answer, not an error.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = storageManager()
  if (!storage?.persist) return false
  try {
    if (storage.persisted && (await storage.persisted())) return true
    return await storage.persist()
  } catch {
    return false
  }
}

export async function storageStatus(): Promise<StorageStatus> {
  const storage = storageManager()
  if (!storage) return { protection: 'unknown' }
  let protection: StorageProtection = 'unknown'
  try {
    if (storage.persisted) {
      protection = (await storage.persisted()) ? 'protected' : 'best-effort'
    }
  } catch {
    protection = 'unknown'
  }
  try {
    if (storage.estimate) {
      const { usage, quota } = await storage.estimate()
      return { protection, usage, quota }
    }
  } catch {
    // An estimate is a nicety; the protection answer stands on its own.
  }
  return { protection }
}

/** "2.4 MB", for showing storage use to a person. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}
