import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ButterflySprite } from '../components/sprites/ButterflySprite'
import { fakeDevice, picture, type Call } from '../test/fakePostcard'
import {
  describePostcard,
  drawPostcard,
  postcardFileName,
  POSTCARD_HEIGHT,
  POSTCARD_TYPE,
  POSTCARD_WIDTH,
  spriteSvg,
  svgDataUrl,
  type PostcardPlan,
} from './postcard'

const PLAN: PostcardPlan = {
  gardenName: 'Quiet Corner',
  year: '2026',
  backdrop: { src: 'scene.webp' },
  butterflies: ['<svg id="one"/>', '<svg id="two"/>'],
}

function drawnImages(calls: Call[]) {
  return calls.filter((call) => call[0] === 'drawImage')
}

function words(calls: Call[]) {
  return calls.filter((call) => call[0] === 'fillText').map((call) => call[1])
}

describe('drawing a postcard', () => {
  it('draws the scene, the butterflies, the name and the year, and no other words', async () => {
    const { device, surfaces, toBlob, order, load } = fakeDevice()
    const postcard = await drawPostcard(PLAN, device)
    expect(postcard?.blob.type).toBe(POSTCARD_TYPE)
    expect(postcard).toMatchObject({ backdrop: true, butterflies: [0, 1] })
    const { calls } = surfaces[0]
    expect(drawnImages(calls)).toHaveLength(3)
    expect(words(calls)).toEqual(['Quiet Corner', '2026'])
    expect(toBlob).toHaveBeenCalledWith(POSTCARD_TYPE, expect.any(Number))
    // The fonts are asked for before anything is drawn in them.
    expect(order).toEqual(['fonts', 'surface'])
    // The butterflies are loaded from their own markup, never from elsewhere.
    expect(load).toHaveBeenCalledWith(svgDataUrl('<svg id="one"/>'))
    expect(load).toHaveBeenCalledWith('scene.webp')
  })

  it('covers the picture with the scene, framed and lit as the garden shows it', async () => {
    const { device, surfaces } = fakeDevice()
    await drawPostcard(
      { ...PLAN, butterflies: [], backdrop: { src: 'own.jpg', brightness: -20, crop: { x: 0, y: 0.5, zoom: 1 } } },
      device,
    )
    const [scene] = drawnImages(surfaces[0].calls)
    const [, , x, , width, height, filter] = scene as [string, unknown, number, number, number, number, string]
    expect(width).toBeGreaterThanOrEqual(POSTCARD_WIDTH - 72)
    expect(height).toBeGreaterThanOrEqual(POSTCARD_HEIGHT - 72)
    // Framed from its left edge, as the crop asks.
    expect(x).toBe(36)
    expect(filter).toBe('brightness(0.8)')
  })

  it('leaves out a picture that cannot be loaded, rather than the card', async () => {
    const { device, surfaces } = fakeDevice({
      pictures: (src) => (src.includes('two') ? picture('butterfly') : undefined),
    })
    const postcard = await drawPostcard(PLAN, device)
    expect(postcard).toMatchObject({ backdrop: false, butterflies: [1] })
    expect(drawnImages(surfaces[0].calls)).toHaveLength(1)
    expect(words(surfaces[0].calls)).toEqual(['Quiet Corner', '2026'])
  })

  it('leaves out a picture the canvas will not take', async () => {
    const { device, surfaces } = fakeDevice({
      pictures: (src) =>
        src.startsWith('data:') ? picture('butterfly') : picture('scene', 1600, 900, true),
    })
    const postcard = await drawPostcard(PLAN, device)
    expect(postcard).toMatchObject({ backdrop: false, butterflies: [0, 1] })
    expect(drawnImages(surfaces[0].calls)).toHaveLength(2)
  })

  it('draws a card with no scene or butterflies at all: the name and the year', async () => {
    const { device, surfaces } = fakeDevice()
    const postcard = await drawPostcard({ gardenName: 'Quiet Corner', year: '2026', butterflies: [] }, device)
    expect(postcard).toMatchObject({ backdrop: false, butterflies: [] })
    expect(drawnImages(surfaces[0].calls)).toHaveLength(0)
    expect(words(surfaces[0].calls)).toEqual(['Quiet Corner', '2026'])
  })

  it('draws again with less when the finished card will not read back', async () => {
    const tainted = () => Promise.reject(new DOMException('Tainted canvases', 'SecurityError'))
    const { device, surfaces } = fakeDevice({
      readBack: (attempt) =>
        attempt === 1 ? tainted() : Promise.resolve(new Blob(['jpeg'], { type: POSTCARD_TYPE })),
    })
    const postcard = await drawPostcard(PLAN, device)
    expect(postcard).toMatchObject({ backdrop: true, butterflies: [] })
    expect(surfaces).toHaveLength(2)
    expect(drawnImages(surfaces[1].calls)).toHaveLength(1)
  })

  it('gives up only when nothing can be read back, or there is no canvas', async () => {
    const never = fakeDevice({ readBack: () => Promise.resolve(null) })
    await expect(drawPostcard(PLAN, never.device)).resolves.toBeUndefined()
    // With the butterflies, without them, and without the scene too.
    expect(never.surfaces).toHaveLength(3)
    await expect(drawPostcard(PLAN, fakeDevice({ canvas: false }).device)).resolves.toBeUndefined()
  })

  it('sets the name as large as fits, and shortens one too long to fit at all', async () => {
    const fit = async (gardenName: string) => {
      const { device, surfaces } = fakeDevice()
      await drawPostcard({ ...PLAN, gardenName }, device)
      return surfaces[0].calls.find((call) => call[0] === 'fillText')
    }
    expect(await fit('Quiet Corner')).toEqual(['fillText', 'Quiet Corner', expect.stringMatching(/^600 96px/)])
    const long = 'A garden with a rather long name, forty!'
    expect(await fit(long)).toEqual(['fillText', long, expect.stringMatching(/^600 60px/)])
    const [, shortened, font] = (await fit('x'.repeat(60))) as [string, string, string]
    expect(font).toMatch(/^600 44px/)
    expect(shortened.endsWith('…')).toBe(true)
    expect(Array.from(shortened).length).toBeLessThan(60)
  })
})

describe('a sprite as a picture', () => {
  it('is one SVG document holding every layer, so the mirrored wing still finds its drawing', () => {
    const { container } = render(<ButterflySprite speciesId="monarch" flapping={false} />)
    const svg = spriteSvg(container.querySelector('.sprite-frame')!, 240)
    expect(svg).toBeDefined()
    const document = new DOMParser().parseFromString(svg!, 'image/svg+xml')
    const root = document.documentElement
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(root.getAttribute('viewBox')).toBe('0 0 120 110')
    expect(root.getAttribute('width')).toBe('240')
    expect(root.getAttribute('height')).toBe('220')
    expect(root.children).toHaveLength(3)
    const used = root.querySelector('use')?.getAttribute('href')?.slice(1)
    expect(used && root.querySelector(`[id="${used}"]`)).toBeTruthy()
  })

  it('is nothing for anything that is not a sprite', () => {
    expect(spriteSvg(document.createElement('div'))).toBeUndefined()
  })

  it('loads from its own markup, with no request', () => {
    expect(svgDataUrl('<svg a="b c"/>')).toBe(
      'data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%22b%20c%22%2F%3E',
    )
  })
})

describe('what the postcard is called', () => {
  it('is a file named for its year', () => {
    expect(postcardFileName(2026)).toBe('butterfly-garden-postcard-2026.jpg')
  })

  it('says in words what was drawn, and only that', () => {
    expect(
      describePostcard('Quiet Corner', '2026', {
        scene: 'the Sunlit Meadow',
        species: ['Monarch', 'American Lady'],
      }),
    ).toBe('A postcard of Quiet Corner for 2026: a Monarch and an American Lady, over the Sunlit Meadow.')
    expect(describePostcard('Quiet Corner', '2026', { scene: 'your own picture', species: [] })).toBe(
      'A postcard of Quiet Corner for 2026: your own picture.',
    )
    expect(describePostcard('Quiet Corner', '2026', { species: ['Monarch'] })).toBe(
      'A postcard of Quiet Corner for 2026: a Monarch.',
    )
    expect(describePostcard('Quiet Corner', '2026', { species: [] })).toBe(
      'A postcard of Quiet Corner for 2026.',
    )
  })
})
