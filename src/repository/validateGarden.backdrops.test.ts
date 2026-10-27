import { describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { CustomBackdrop } from '../types'
import { validateGarden } from './validateGarden'

/** A stored image whose declared size matches its data. */
function image(overrides: Record<string, unknown> = {}): CustomBackdrop {
  return {
    id: 'image-1',
    name: 'The back garden',
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
    mimeType: 'image/webp',
    width: 1600,
    height: 900,
    byteLength: 23,
    imageData: 'QUJDREVGR0hJSktMTU5PUFFSU1RVVlc=',
    crop: { x: 0.5, y: 0.4, zoom: 1.2 },
    ...overrides,
  }
}

function garden(overrides: Record<string, unknown> = {}) {
  return { ...createInitialState('Tester', 'Images'), ...overrides }
}

describe("an image's brightness", () => {
  it('keeps one in range, the collection itself untouched', () => {
    const images = [image({ brightness: -20 }), image({ id: 'image-2', brightness: 15 })]
    const result = validateGarden(garden({ customBackdrops: images }))
    expect(result.refused).toBeUndefined()
    // The same list, so loading it never makes the images look changed.
    expect(result.state?.customBackdrops).toBe(images)
  })

  it('drops one that is out of range or not a number, and keeps the picture', () => {
    for (const brightness of [-41, 21, '10', null, Number.NaN, { by: 5 }]) {
      const images = [image({ brightness }), image({ id: 'image-2', brightness: -10 })]
      const result = validateGarden(garden({ customBackdrops: images }))
      expect(result.refused).toBeUndefined()
      const [dropped, kept] = result.state!.customBackdrops
      expect(dropped).not.toHaveProperty('brightness')
      expect(dropped.imageData).toBe(images[0].imageData)
      expect(dropped.crop).toEqual(images[0].crop)
      // The other image keeps its own, and is the very same record.
      expect(kept).toBe(images[1])
      // The stored list is not changed in place.
      expect(images[0]).toHaveProperty('brightness')
    }
  })

  it('reads an image from before brightness, as taken', () => {
    const images = [image()]
    const result = validateGarden(garden({ customBackdrops: images }))
    expect(result.state?.customBackdrops).toBe(images)
    expect(result.state?.customBackdrops[0]).not.toHaveProperty('brightness')
  })

  it('still refuses a damaged picture, whatever its brightness', () => {
    const result = validateGarden(
      garden({ customBackdrops: [image({ brightness: 50, imageData: 'not base64!' })] }),
    )
    expect(result.refused).toMatch(/damaged/)
  })
})

describe('the image by night', () => {
  const withNight = (nightCustomBackdropId: unknown) => {
    const seed = createInitialState('Tester', 'Images')
    return garden({
      customBackdrops: [image()],
      profile: { ...seed.profile!, selectedCustomBackdropId: 'image-1', nightCustomBackdropId },
    })
  }

  it('keeps the choice when it is an id', () => {
    const result = validateGarden(withNight('image-1'))
    expect(result.state?.profile?.nightCustomBackdropId).toBe('image-1')
  })

  it('drops a choice that is not an id, and the day image stays chosen', () => {
    for (const value of [3, true, { id: 'image-1' }, ['image-1'], null]) {
      const result = validateGarden(withNight(value))
      expect(result.refused).toBeUndefined()
      expect(result.state?.profile).not.toHaveProperty('nightCustomBackdropId')
      expect(result.state?.profile?.selectedCustomBackdropId).toBe('image-1')
    }
  })

  it('drops a choice that names no image the garden holds', () => {
    // Removed in a build that knew nothing of night images: every night
    // would say the image is unavailable, and nothing in Settings could
    // clear it, since "the same as by day" already reads as chosen.
    const result = validateGarden(withNight('image-gone'))
    expect(result.refused).toBeUndefined()
    expect(result.repaired).toBe(0)
    expect(result.state?.profile).not.toHaveProperty('nightCustomBackdropId')
    expect(result.state?.profile?.selectedCustomBackdropId).toBe('image-1')
  })

  it('gives an older garden no night image at all', () => {
    const result = validateGarden(garden())
    expect(result.state?.profile).not.toHaveProperty('nightCustomBackdropId')
  })
})
