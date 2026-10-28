import { afterEach, describe, expect, it, vi } from 'vitest'
import { SIGHTING_PHOTO_MAX_BYTES, SIGHTING_PHOTO_MAX_EDGE } from './customBackdrops'
import {
  fitWithinMaxEdge,
  prepareSightingPhoto,
  verifyGardenImages,
  verifySightingPhotos,
} from './imageImport'

/** A PNG's first bytes, enough for its header to be read. */
const png = (width: number, height: number) => {
  const bytes = new Uint8Array(32)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

const chosen = (bytes: Uint8Array, type = 'image/png') =>
  ({
    name: 'Monarch.png',
    type,
    size: bytes.length,
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  }) as File

function stubDecode(width: number, height: number) {
  const close = vi.fn()
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }))
  return close
}

function stubCanvas(sizes: number[]) {
  const drawn = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    drawn as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type = 'image/png') => {
    const size = sizes.shift()
    callback(size === undefined ? null : new Blob([new Uint8Array(size)], { type }))
  })
  return drawn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('a photo for the field book', () => {
  it('is redrawn no larger than its own, smaller edge', async () => {
    expect(fitWithinMaxEdge(4032, 3024, SIGHTING_PHOTO_MAX_EDGE)).toEqual({ width: 1024, height: 768 })
    const close = stubDecode(4032, 3024)
    const drawn = stubCanvas([2000])
    const photo = await prepareSightingPhoto(chosen(png(4032, 3024)))
    expect(photo.type).toBe('image/webp')
    expect(photo.size).toBe(2000)
    // Only the pixels are drawn: nothing else of the file, its location included.
    expect(drawn.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1024, 768)
    expect(close).toHaveBeenCalledOnce()
  })

  it('is made smaller until it fits its own byte limit, or refused', async () => {
    stubDecode(800, 600)
    stubCanvas([SIGHTING_PHOTO_MAX_BYTES + 1, 1000])
    expect((await prepareSightingPhoto(chosen(png(800, 600)))).size).toBe(1000)
    vi.restoreAllMocks()
    stubDecode(800, 600)
    const big = SIGHTING_PHOTO_MAX_BYTES + 1
    stubCanvas([big, big, big, big])
    await expect(prepareSightingPhoto(chosen(png(800, 600)))).rejects.toThrow(/too detailed/)
  })

  it('is refused when it is not the image its type says', async () => {
    await expect(prepareSightingPhoto(chosen(png(10, 10), 'image/jpeg'))).rejects.toThrow(/do not match/)
  })
})

describe('the photos in a backup', () => {
  it('are each checked as pictures before anything is replaced', async () => {
    const close = stubDecode(10, 10)
    const sound = new Blob([png(10, 10)], { type: 'image/png' })
    await expect(verifySightingPhotos([sound])).resolves.toBeUndefined()
    expect(close).toHaveBeenCalledOnce()

    const mislabelled = new Blob([png(10, 10)], { type: 'image/webp' })
    await expect(verifySightingPhotos([mislabelled])).rejects.toThrow(/could not be read, so nothing was replaced/)
    const garbage = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    await expect(verifySightingPhotos([garbage])).rejects.toThrow(/could not be read/)
  })

  it('are refused, before anything is decoded, when the header claims a picture larger than this app makes', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    // A lossless WebP's header: a few dozen bytes that claim 16383 by 16383,
    // a gigabyte once decoded.
    const bomb = new Uint8Array(32)
    bomb.set([82, 73, 70, 70, 24, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 76, 12, 0, 0, 0, 0x2f, 0xfe, 0xbf, 0xff, 0x0f])
    for (const bytes of [bomb, png(16383, 16383), png(SIGHTING_PHOTO_MAX_EDGE + 1, 10), png(0, 10)]) {
      const photo = new Blob([bytes], { type: bytes === bomb ? 'image/webp' : 'image/png' })
      await expect(verifySightingPhotos([photo])).rejects.toThrow(/could not be read, so nothing was replaced/)
    }
    expect(decode).not.toHaveBeenCalled()
    // As large as the app makes is fine.
    stubDecode(SIGHTING_PHOTO_MAX_EDGE, 768)
    await expect(
      verifySightingPhotos([new Blob([png(SIGHTING_PHOTO_MAX_EDGE, 768)], { type: 'image/png' })]),
    ).resolves.toBeUndefined()
  })

  it('are refused when the picture drawn is not the size its header says', async () => {
    const close = stubDecode(20, 20)
    await expect(verifySightingPhotos([new Blob([png(10, 10)], { type: 'image/png' })])).rejects.toThrow(
      /could not be read/,
    )
    expect(close).toHaveBeenCalledOnce()
  })

  it('are refused when the browser cannot draw one', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    const sound = new Blob([png(10, 10)], { type: 'image/png' })
    await expect(verifySightingPhotos([sound])).rejects.toThrow(/could not be read/)
  })

  it('are checked with the garden’s own images, all in one', async () => {
    stubDecode(10, 10)
    const photo = new Blob([png(10, 10)], { type: 'image/png' })
    await expect(
      verifyGardenImages({
        customBackdrops: [],
        sightings: [
          { id: 'a', date: '2026-10-01', kind: 'butterfly', speciesId: 'monarch', photo, createdAt: '' },
          { id: 'b', date: '2026-10-01', kind: 'plant', plantId: 'aster', createdAt: '' },
        ],
      }),
    ).resolves.toBeUndefined()
    expect(createImageBitmap).toHaveBeenCalledOnce()
  })
})
