import { gardenRepository } from '../repository/gardenRepository'
import type { FileCopy } from './sightingPhotos'

/**
 * Bytes as base64. A locked garden is stored as sealed bytes (repository/
 * sealedStores), which JSON would write as a long list of numbers; a file
 * holds them far more compactly as text, exactly as they are.
 */
function base64Of(bytes: ArrayBufferView): string {
  const view = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let binary = ''
  for (let start = 0; start < view.length; start += 0x8000) {
    binary += String.fromCharCode(...view.subarray(start, start + 0x8000))
  }
  return btoa(binary)
}

/**
 * Everything the app has stored, as the text of a file the gardener can keep
 * (safe mode, and a page that failed to draw). A sighting's photo is a Blob,
 * which a file holds only as text (lib/sightingPhotos), and a photo whose
 * bytes cannot be read is left out, and said so. Should that module not
 * load, everything else still goes: each photo is marked as left out rather
 * than written as `{}`, which no restore would take. Under the garden lock
 * what is stored is sealed, and the copy is too, its bytes as base64.
 */
export async function storedCopy(): Promise<FileCopy> {
  const raw = await gardenRepository.readRaw()
  const bytes = (_key: string, value: unknown) =>
    ArrayBuffer.isView(value) ? { base64: base64Of(value) } : value
  return import('./sightingPhotos').then(
    async ({ withPhotosAsText, photosLeftOut }) => {
      const { value, unreadable } = await withPhotosAsText(raw)
      const text = JSON.stringify(value, bytes, 2)
      return unreadable ? { text, leftOut: photosLeftOut(unreadable) } : { text }
    },
    () => {
      let left = 0
      const text = JSON.stringify(
        raw,
        (key, value: unknown) => {
          if (!(value instanceof Blob)) return bytes(key, value)
          left += 1
          return { unreadable: true }
        },
        2,
      )
      // Said, as the module would: the copy is not everything, by that much.
      return left
        ? {
            text,
            leftOut: `${left === 1 ? 'One photo' : `${left} photos`} could not be written into this copy, so it keeps the sightings without them.`,
          }
        : { text }
    },
  )
}
