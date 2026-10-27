// A sighting's photo is a Blob in storage (types.ts), and JSON has no Blob:
// written into a file as it is, it would become `{}`. So every file the
// garden is saved to (a backup, the set-aside copy, safe mode's raw copy)
// carries a photo the way it carries a personal image, as base64 beside
// its type. validateGarden turns that back into a Blob when a file is read.
//
// Loaded only when a garden with photos is saved to a file, and with the
// set-aside copy.

import type { QuarantineRecord } from '../repository/gardenRepository'

/** A photo as a file carries it. */
export interface PhotoAsText {
  mimeType: string
  /** Base64, without a data-URL prefix, as a personal image's `imageData`. */
  imageData: string
}

/**
 * A photo whose bytes could not be read when the file was made: storage can
 * lose a Blob's bytes and keep its record. The rest of the file is still
 * written, and a restore keeps the sighting without it, and counts it
 * (validateGarden), by `unreadable` alone; safe mode's copy, made without
 * this module, cannot say the type.
 */
export interface PhotoLeftOut {
  mimeType?: string
  unreadable: true
}

/** A file's text, and a word on any photo it had to leave out. */
export interface FileCopy {
  text: string
  /** Said with the file when a photo could not be read and was left out. */
  leftOut?: string
}

/** The Blobs anywhere inside a value, each once. */
function collect(value: unknown, into: Set<Blob>): void {
  if (value instanceof Blob) {
    into.add(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collect(item, into)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collect(item, into)
  }
}

/**
 * The value with each Blob swapped for its text. Only what holds a Blob is
 * copied; everything else is handed back as it was, so a large journal is
 * not rebuilt to change a few photos.
 */
function replace(
  value: unknown,
  texts: ReadonlyMap<Blob, PhotoAsText | PhotoLeftOut>,
): unknown {
  if (value instanceof Blob) return texts.get(value)
  if (Array.isArray(value)) {
    const items = value.map((item: unknown) => replace(item, texts))
    return items.some((item, index) => item !== value[index]) ? items : value
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => [key, replace(item, texts)] as const)
    return entries.some(([key, item]) => item !== (value as Record<string, unknown>)[key])
      ? Object.fromEntries(entries)
      : value
  }
  return value
}

/**
 * A Blob's bytes as base64, by the browser's own encoder: a sighting's photo
 * written into a file, or a postcard handed to the Android app (lib/saveImage).
 * Ten times quicker than building the text in script a slice at a time,
 * which on a phone could take long enough for *Share backup…* to lose the
 * tap that allowed it.
 */
export function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // A data URL, read as one: "data:image/webp;base64," and the bytes.
      const url = reader.result as string
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('The image could not be read.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * The value with every Blob inside it written as text, ready for
 * JSON.stringify: a garden, or any set of stored records. The same value
 * when it holds none. A photo whose bytes cannot be read is marked as left
 * out rather than failing the whole file, and counted as `unreadable`.
 */
export async function withPhotosAsText<T>(value: T): Promise<{ value: T; unreadable: number }> {
  const blobs = new Set<Blob>()
  collect(value, blobs)
  if (blobs.size === 0) return { value, unreadable: 0 }
  const texts = new Map<Blob, PhotoAsText | PhotoLeftOut>()
  let unreadable = 0
  for (const blob of blobs) {
    try {
      texts.set(blob, { mimeType: blob.type, imageData: await base64Of(blob) })
    } catch {
      unreadable += 1
      texts.set(blob, { mimeType: blob.type, unreadable: true })
    }
  }
  return { value: replace(value, texts) as T, unreadable }
}

/** What a file says when `count` photos could not be read into it. */
export function photosLeftOut(count: number): string {
  return count === 1
    ? 'One photo in the field book could not be read on this device, so the file keeps its sighting without it.'
    : `${count} photos in the field book could not be read on this device, so the file keeps their sightings without them.`
}

/**
 * The text of a file holding `value`, its photos written as text: a backup,
 * the set-aside copy, or everything stored.
 */
export async function fileCopy(value: unknown): Promise<FileCopy> {
  const { value: portable, unreadable } = await withPhotosAsText(value)
  const text = JSON.stringify(portable, null, 2)
  return unreadable ? { text, leftOut: photosLeftOut(unreadable) } : { text }
}

/** The set-aside copy of a garden this build could not read, as a file. */
export function setAsideCopy(
  setAside: Pick<QuarantineRecord, 'reason' | 'storedAt' | 'raw'>,
): Promise<FileCopy> {
  return fileCopy({
    format: 'the-butterfly-garden-set-aside',
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    reason: setAside.reason,
    storedAt: setAside.storedAt,
    garden: setAside.raw,
  })
}
