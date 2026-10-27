import { gardenRepository } from '../repository/gardenRepository'
import type { FileCopy } from './sightingPhotos'

/**
 * Everything the app has stored, as the text of a file the gardener can keep
 * (safe mode, and a page that failed to draw). A sighting's photo is a Blob,
 * which a file holds only as text (lib/sightingPhotos), and a photo whose
 * bytes cannot be read is left out, and said so. Should that module not
 * load, everything else still goes: each photo is marked as left out rather
 * than written as `{}`, which no restore would take.
 */
export async function storedCopy(): Promise<FileCopy> {
  const raw = await gardenRepository.readRaw()
  return import('./sightingPhotos').then(
    ({ fileCopy }) => fileCopy(raw),
    () => {
      let left = 0
      const text = JSON.stringify(
        raw,
        (_key, value: unknown) => {
          if (!(value instanceof Blob)) return value
          left += 1
          return { unreadable: true }
        },
        2,
      )
      // Said, as the module would: the copy is not everything, by that much.
      return left
        ? { text, leftOut: `${left === 1 ? 'One photo' : `${left} photos`} could not be written into this copy, so it keeps the sightings without them.` }
        : { text }
    },
  )
}
