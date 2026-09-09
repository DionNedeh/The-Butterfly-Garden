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

export function loadBackdrop(id: GardenBackdropId): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve()
    image.onerror = () =>
      reject(
        new Error(
          'This scene is not available offline yet. Reconnect once to download it.',
        ),
      )
    image.src = backdropAssets[id].image
  })
}
