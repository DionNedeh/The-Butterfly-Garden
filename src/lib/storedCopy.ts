import { gardenRepository } from '../repository/gardenRepository'

/**
 * Everything the app has stored, as the text of a file the gardener can keep
 * (safe mode, and a page that failed to draw). A sighting's photo is a Blob,
 * which a file holds only as text (lib/sightingPhotos); should that module
 * not load, everything else still goes.
 */
export async function storedCopy(): Promise<string> {
  const raw = await gardenRepository.readRaw()
  const portable = await import('./sightingPhotos').then(
    ({ withPhotosAsText }) => withPhotosAsText(raw),
    () => raw,
  )
  return JSON.stringify(portable, null, 2)
}
