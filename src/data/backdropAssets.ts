import meadow from '../assets/garden-background.webp'
import woodland from '../assets/garden-woodland-brook.webp'
import conservatory from '../assets/garden-secret-conservatory.webp'
import cottage from '../assets/garden-cottage-bloom.webp'
import pond from '../assets/garden-rain-kissed-pond.webp'
import orchard from '../assets/garden-twilight-orchard.webp'
import cloud from '../assets/garden-cloud-garden.webp'
import meadowThumb from '../assets/thumb-sunlit-meadow.webp'
import woodlandThumb from '../assets/thumb-woodland-brook.webp'
import conservatoryThumb from '../assets/thumb-secret-conservatory.webp'
import cottageThumb from '../assets/thumb-cottage-bloom.webp'
import pondThumb from '../assets/thumb-rain-kissed-pond.webp'
import orchardThumb from '../assets/thumb-twilight-orchard.webp'
import cloudThumb from '../assets/thumb-cloud-garden.webp'
import type { GardenBackdropId } from '../types'
import { isAndroidApp } from '../lib/platform'

export const backdropAssets: Record<
  GardenBackdropId,
  { image: string; thumbnail: string }
> = {
  'sunlit-meadow': { image: meadow, thumbnail: meadowThumb },
  'woodland-brook': { image: woodland, thumbnail: woodlandThumb },
  'secret-conservatory': { image: conservatory, thumbnail: conservatoryThumb },
  'cottage-bloom': { image: cottage, thumbnail: cottageThumb },
  'rain-kissed-pond': { image: pond, thumbnail: pondThumb },
  'twilight-orchard': { image: orchard, thumbnail: orchardThumb },
  'cloud-garden': { image: cloud, thumbnail: cloudThumb },
}

/** How long a scene may take before the gallery stops waiting for it. */
export const BACKDROP_TIMEOUT_MS = 8000

/** Scenes already downloaded and decoded this session. */
const decoded = new Set<GardenBackdropId>()
/** Loads under way, so two callers share one download. */
const loading = new Map<GardenBackdropId, Promise<void>>()

/** Whether a scene can be shown at once, with nothing left to fetch or decode. */
export function isBackdropReady(id: GardenBackdropId): boolean {
  return decoded.has(id)
}

/**
 * Fetches and decodes a scene, so swapping to it never shows a half-drawn
 * image. Settles within BACKDROP_TIMEOUT_MS: a stalled request used to leave
 * the scene gallery waiting, and disabled, for as long as it stalled.
 */
export function loadBackdrop(
  id: GardenBackdropId,
  timeoutMs = BACKDROP_TIMEOUT_MS,
): Promise<void> {
  if (decoded.has(id)) return Promise.resolve()
  const pending = loading.get(id)
  if (pending) return pending
  const load = new Promise<void>((resolve, reject) => {
    const image = new Image()
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      loading.delete(id)
      if (error) {
        reject(error)
        return
      }
      decoded.add(id)
      resolve()
    }
    const timer = window.setTimeout(
      () =>
        finish(
          new Error(
            'This scene is taking too long to open. Please try again in a moment.',
          ),
        ),
      timeoutMs,
    )
    image.onload = () => {
      // Decoded off the main thread before anything swaps to it. An engine
      // without decode(), or one that refuses, still has a loaded image.
      void Promise.resolve(image.decode?.()).then(
        () => finish(),
        () => finish(),
      )
    }
    image.onerror = () =>
      finish(
        new Error(
          isAndroidApp()
            ? 'This scene could not be opened. Please try again.'
            : 'This scene is not available offline yet. Reconnect once to download it.',
        ),
      )
    image.src = backdropAssets[id].image
  })
  loading.set(id, load)
  return load
}
