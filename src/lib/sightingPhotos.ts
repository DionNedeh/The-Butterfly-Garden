// A sighting's photo is a Blob in storage (types.ts), and JSON has no Blob:
// written into a file as it is, it would become `{}`. So every file the
// garden is saved to (a backup, the set-aside copy, safe mode's raw copy)
// carries a photo the way it carries a personal image, as base64 beside
// its type. validateGarden turns that back into a Blob when a file is read.
//
// Loaded only when a garden with photos is saved to a file.

/** A photo as a file carries it. */
export interface PhotoAsText {
  mimeType: string
  /** Base64, without a data-URL prefix, as a personal image's `imageData`. */
  imageData: string
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
function replace(value: unknown, texts: ReadonlyMap<Blob, PhotoAsText>): unknown {
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

/** A Blob's bytes as base64, a slice at a time so no argument list grows too long. */
export async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  }
  return btoa(binary)
}

/**
 * The value with every Blob inside it written as text, ready for
 * JSON.stringify: a garden, or any set of stored records. The same value
 * when it holds none.
 */
export async function withPhotosAsText<T>(value: T): Promise<T> {
  const blobs = new Set<Blob>()
  collect(value, blobs)
  if (blobs.size === 0) return value
  const texts = new Map<Blob, PhotoAsText>()
  for (const blob of blobs) {
    texts.set(blob, { mimeType: blob.type, imageData: await base64Of(blob) })
  }
  return replace(value, texts) as T
}
