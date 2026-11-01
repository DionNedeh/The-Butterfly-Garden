import meadow from '../assets/garden-background.webp'
import woodland from '../assets/garden-woodland-brook.webp'
import conservatory from '../assets/garden-secret-conservatory.webp'
import cottage from '../assets/garden-cottage-bloom.webp'
import pond from '../assets/garden-rain-kissed-pond.webp'
import orchard from '../assets/garden-twilight-orchard.webp'
import cloud from '../assets/garden-cloud-garden.webp'
import meadowNight from '../assets/garden-sunlit-meadow-night.webp'
import woodlandNight from '../assets/garden-woodland-brook-night.webp'
import conservatoryNight from '../assets/garden-secret-conservatory-night.webp'
import cottageNight from '../assets/garden-cottage-bloom-night.webp'
import pondNight from '../assets/garden-rain-kissed-pond-night.webp'
import orchardNight from '../assets/garden-twilight-orchard-night.webp'
import cloudNight from '../assets/garden-cloud-garden-night.webp'
import type { GardenBackdropId } from '../types'
import { isAndroidApp } from '../lib/platform'

/**
 * Each scene's painting by day and by night. Their thumbnails are only the
 * scene gallery's, so they come with it (data/backdropThumbnails).
 */
export const backdropAssets: Record<GardenBackdropId, { image: string; night: string }> = {
  'sunlit-meadow': { image: meadow, night: meadowNight },
  'woodland-brook': { image: woodland, night: woodlandNight },
  'secret-conservatory': { image: conservatory, night: conservatoryNight },
  'cottage-bloom': { image: cottage, night: cottageNight },
  'rain-kissed-pond': { image: pond, night: pondNight },
  'twilight-orchard': { image: orchard, night: orchardNight },
  'cloud-garden': { image: cloud, night: cloudNight },
}

/** How long a scene may take before the gallery stops waiting for it. */
export const BACKDROP_TIMEOUT_MS = 8000

/** Scenes already downloaded and decoded this session. */
const decoded = new Set<string>()
/** Loads under way, so two callers share one download. */
const loading = new Map<string, Promise<void>>()

/** Whether a scene can be shown at once, with nothing left to fetch or decode. */
export function isBackdropReady(id: GardenBackdropId, night = false): boolean {
  return decoded.has(night ? backdropAssets[id].night : backdropAssets[id].image)
}

/**
 * Fetches and decodes a scene, so swapping to it never shows a half-drawn
 * image. Settles within BACKDROP_TIMEOUT_MS: a stalled request used to leave
 * the scene gallery waiting, and disabled, for as long as it stalled.
 */
export function loadBackdrop(
  id: GardenBackdropId,
  timeoutMs = BACKDROP_TIMEOUT_MS,
  night = false,
): Promise<void> {
  const url = night ? backdropAssets[id].night : backdropAssets[id].image
  if (decoded.has(url)) return Promise.resolve()
  const pending = loading.get(url)
  if (pending) return pending
  const load = new Promise<void>((resolve, reject) => {
    const image = new Image()
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      loading.delete(url)
      if (error) {
        reject(error)
        return
      }
      decoded.add(url)
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
    image.src = url
  })
  loading.set(url, load)
  return load
}
