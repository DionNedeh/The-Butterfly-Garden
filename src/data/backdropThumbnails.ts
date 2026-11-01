import meadow from '../assets/thumb-sunlit-meadow.webp'
import woodland from '../assets/thumb-woodland-brook.webp'
import conservatory from '../assets/thumb-secret-conservatory.webp'
import cottage from '../assets/thumb-cottage-bloom.webp'
import pond from '../assets/thumb-rain-kissed-pond.webp'
import orchard from '../assets/thumb-twilight-orchard.webp'
import cloud from '../assets/thumb-cloud-garden.webp'
import meadowNight from '../assets/thumb-sunlit-meadow-night.webp'
import woodlandNight from '../assets/thumb-woodland-brook-night.webp'
import conservatoryNight from '../assets/thumb-secret-conservatory-night.webp'
import cottageNight from '../assets/thumb-cottage-bloom-night.webp'
import pondNight from '../assets/thumb-rain-kissed-pond-night.webp'
import orchardNight from '../assets/thumb-twilight-orchard-night.webp'
import cloudNight from '../assets/thumb-cloud-garden-night.webp'
import type { GardenBackdropId } from '../types'

/**
 * Each scene's thumbnails for the scene gallery: by day, and by night from
 * its night painting (ART-8), which the gallery shows while the theme on
 * screen is night. Only the gallery shows them, so they are kept apart from
 * data/backdropAssets, which every page loads, and come with it. The day's
 * are precached; the night's are left out of the web app's precache
 * (vite.config.ts): one is cached once seen, and until then the day's
 * stands in for it.
 */
export const backdropThumbnails: Record<GardenBackdropId, { day: string; night: string }> = {
  'sunlit-meadow': { day: meadow, night: meadowNight },
  'woodland-brook': { day: woodland, night: woodlandNight },
  'secret-conservatory': { day: conservatory, night: conservatoryNight },
  'cottage-bloom': { day: cottage, night: cottageNight },
  'rain-kissed-pond': { day: pond, night: pondNight },
  'twilight-orchard': { day: orchard, night: orchardNight },
  'cloud-garden': { day: cloud, night: cloudNight },
}
