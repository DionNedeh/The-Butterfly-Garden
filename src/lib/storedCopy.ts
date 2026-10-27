import { gardenRepository } from '../repository/gardenRepository'

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
 * which a file holds only as text (lib/sightingPhotos); should that module
 * not load, everything else still goes. Under the garden lock what is stored
 * is sealed, and the copy is too.
 */
export async function storedCopy(): Promise<string> {
  const raw = await gardenRepository.readRaw()
  const portable = await import('./sightingPhotos').then(
    ({ withPhotosAsText }) => withPhotosAsText(raw),
    () => raw,
  )
  return JSON.stringify(
    portable,
    (_key, value: unknown) => (ArrayBuffer.isView(value) ? { base64: base64Of(value) } : value),
    2,
  )
}
