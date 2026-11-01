import type { AppState } from '../types'
import type { FileCopy } from './sightingPhotos'

/*
 * A plain backup's check on itself (plan a.5 WP2). The file carries the
 * revision of the garden it was made from and a SHA-256 of that garden,
 * which a restore's preview reads to say whether the file is as it was
 * saved. Both are optional: a file made before them has neither and
 * restores as it always has, and an older build reads past them. A
 * protected backup or a move file is sealed with authenticated encryption,
 * its own check, and is left as it is.
 *
 * Loaded when a backup is made or looked at, never with the garden.
 */

/** Whether a file is as it was saved: its check matches, does not, or it has none. */
export type BackupIntegrity = 'ok' | 'changed' | 'absent'

/**
 * The SHA-256, in hex, of a garden as a file holds it: written as compact
 * JSON, its photos already text. Reading a file back and writing its garden
 * the same way gives the same text, however the file was laid out, so the
 * same digest. Undefined where the browser cannot make one.
 */
export async function gardenDigest(garden: unknown): Promise<string | undefined> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(garden)))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return undefined
  }
}

/** A plain backup as the garden makes it, before its photos are text. */
export interface PlainBackup {
  format: 'the-butterfly-garden'
  exportedAt: string
  appVersion: string
  /** The revision of the stored garden the backup was made from. */
  revision: number
  garden: AppState | undefined
}

/**
 * The text of a plain backup, with its check. A sighting's photo is a Blob,
 * which goes into the file as text, as a personal image always has
 * (lib/sightingPhotos); one that cannot be read is left out, and said so,
 * rather than fail the backup. The check is taken over the garden exactly
 * as it is then written.
 */
export async function backupCopy(file: PlainBackup): Promise<FileCopy> {
  let garden: unknown = file.garden
  let leftOut: string | undefined
  if (file.garden?.sightings.some((sighting) => sighting.photo)) {
    const photos = await import('./sightingPhotos')
    const written = await photos.withPhotosAsText(file.garden)
    garden = written.value
    if (written.unreadable) leftOut = photos.photosLeftOut(written.unreadable)
  }
  const { format, exportedAt, appVersion, revision } = file
  const sha256 = garden === undefined ? undefined : await gardenDigest(garden)
  const text = JSON.stringify({ format, exportedAt, appVersion, revision, sha256, garden }, null, 2)
  return leftOut ? { text, leftOut } : { text }
}

/**
 * Whether a backup file, as read, holds the garden its check was taken
 * over. 'absent' for a file without one (made before checks, a copy of
 * everything stored, or hand-made), and where no digest can be made here.
 */
export async function integrityOf(file: unknown): Promise<BackupIntegrity> {
  const { sha256, garden } = (file ?? {}) as { sha256?: unknown; garden?: unknown }
  if (typeof sha256 !== 'string') return 'absent'
  const digest = await gardenDigest(garden)
  if (digest === undefined) return 'absent'
  return digest === sha256.toLowerCase() ? 'ok' : 'changed'
}
