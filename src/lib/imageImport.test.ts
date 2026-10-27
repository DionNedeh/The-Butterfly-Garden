import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  imageHeader,
  prepareBackdrop,
  verifyBackdropImages,
} from './imageImport'
import { CUSTOM_BACKDROP_LIMITS } from './customBackdrops'
import type { CustomBackdrop } from '../types'

const png = (width: number, height: number) => {
  const bytes = new Uint8Array(32)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}
const file = (bytes: Uint8Array, type = 'image/png') =>
  ({
    name: 'scene.png',
    type,
    size: bytes.length,
    arrayBuffer: () => Promise.resolve(bytes.buffer),
  }) as File

afterEach(() => vi.unstubAllGlobals())

describe('image intake boundaries', () => {
  it('rejects non-images and truncated headers', () => {
    for (const bytes of [
      new Uint8Array(),
      new Uint8Array([137, 80, 78, 71]),
      new TextEncoder().encode('<svg></svg>'),
    ])
      expect(() => imageHeader(bytes)).toThrow(/not a readable/)
  })
  it('reads dimensions before decode', () => {
    expect(imageHeader(png(7000, 5000))).toEqual({
      width: 7000,
      height: 5000,
      mime: 'image/png',
    })
  })
  it('refuses a decompression-sized image before allocating a bitmap', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    await expect(prepareBackdrop(file(png(7000, 5000)))).rejects.toThrow(
      /too many pixels/,
    )
    expect(decode).not.toHaveBeenCalled()
  })
  it('refuses a MIME mismatch before decode', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    await expect(
      prepareBackdrop(file(png(100, 100), 'image/jpeg')),
    ).rejects.toThrow(/do not match/)
    expect(decode).not.toHaveBeenCalled()
  })
  it('rejects mismatched backup dimensions without decoding', async () => {
    const decode = vi.fn()
    vi.stubGlobal('createImageBitmap', decode)
    const record = {
      name: 'Saved image',
      imageData: btoa(String.fromCharCode(...png(100, 100))),
      mimeType: 'image/png',
      width: 101,
      height: 100,
    } as CustomBackdrop
    await expect(verifyBackdropImages([record])).rejects.toThrow(/inconsistent/)
    expect(decode).not.toHaveBeenCalled()
  })
  it('closes a decoded bitmap even when its dimensions fail verification', async () => {
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 99, height: 100, close }),
    )
    const record = {
      name: 'Saved image',
      imageData: btoa(String.fromCharCode(...png(100, 100))),
      mimeType: 'image/png',
      width: 100,
      height: 100,
    } as CustomBackdrop
    await expect(verifyBackdropImages([record])).rejects.toThrow(
      /could not be verified/,
    )
    expect(close).toHaveBeenCalledOnce()
  })
})

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0))

function webp(kind: string, fill: (bytes: Uint8Array) => void) {
  const bytes = new Uint8Array(32)
  bytes.set([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...ascii(kind)])
  fill(bytes)
  return bytes
}

function jpeg(...segments: number[][]) {
  return new Uint8Array([255, 216, ...segments.flat(), 0, 0, 0, 0])
}

/** A start-of-frame segment, marker included, for a picture of this size. */
const frame = (marker: number, width: number, height: number) => [
  255, marker, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255,
  ...new Array<number>(10).fill(0),
]

describe('reading a header', () => {
  it('reads each kind of WebP', () => {
    const extended = webp('VP8X', (bytes) => bytes.set([199, 0, 0, 99, 0, 0], 24))
    expect(imageHeader(extended)).toEqual({ width: 200, height: 100, mime: 'image/webp' })

    const lossy = webp('VP8 ', (bytes) => {
      const view = new DataView(bytes.buffer)
      view.setUint16(26, 0xc000 | 640, true) // the top bits are scaling, not size
      view.setUint16(28, 480, true)
    })
    expect(imageHeader(lossy)).toEqual({ width: 640, height: 480, mime: 'image/webp' })

    const lossless = webp('VP8L', (bytes) => bytes.set([0x2f, 0x2b, 0xc1, 49, 0], 20))
    expect(imageHeader(lossless)).toEqual({ width: 300, height: 200, mime: 'image/webp' })
  })

  it('refuses a lossless WebP without its signature, or an unknown kind', () => {
    expect(() => imageHeader(webp('VP8L', () => undefined))).toThrow(/not a readable/)
    expect(() => imageHeader(webp('ANIM', () => undefined))).toThrow(/not a readable/)
  })

  it('walks a JPEG to its frame, past padding, restarts and other segments', () => {
    const app0 = [255, 224, 0, 6, 0, 0, 0, 0]
    const restart = [255, 208]
    const padded = [255, ...frame(194, 800, 600)] // an extra fill byte before the marker
    expect(imageHeader(jpeg(app0, restart, padded))).toEqual({
      width: 800,
      height: 600,
      mime: 'image/jpeg',
    })
  })

  it('stops a JPEG at the image data, the end, or a broken segment', () => {
    const scan = [255, 218, 0, 4, 0, 0]
    const end = [255, 217]
    const tooShort = [255, 224, 0, 1]
    const overrun = [255, 224, 0, 200]
    const notAMarker = [0, 224]
    for (const segment of [scan, end, tooShort, overrun, notAMarker])
      expect(() => imageHeader(jpeg(segment, frame(192, 10, 10)))).toThrow(/not a readable/)
    // A frame marker whose segment is too short to hold a size is skipped.
    expect(() => imageHeader(jpeg([255, 192, 0, 4, 0, 0]))).toThrow(/not a readable/)
  })
})

describe('preparing an image', () => {
  type Encoded = { type: string; size: number } | null

  /** A canvas that encodes to whatever `encodings` says, one call at a time. */
  function stubCanvas(encodings: Encoded[], context: object | null = {}) {
    const drawn = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context && (Object.assign(drawn, context) as unknown as CanvasRenderingContext2D),
    )
    const requested: Array<[string, number]> = []
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback, type = 'image/png', quality = 1) => {
        requested.push([type, quality])
        const next = encodings.shift() ?? null
        callback(next && new Blob([new Uint8Array(next.size)], { type: next.type }))
      },
    )
    return { drawn, requested }
  }

  function stubDecode(width = 100, height = 80) {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }))
    return close
  }

  const named = (name: string, bytes = png(100, 80)) =>
    ({ ...file(bytes), name }) as File

  afterEach(() => vi.restoreAllMocks())

  it('draws on a paper ground, encodes a WebP, and names it after the file', async () => {
    const close = stubDecode()
    const { drawn, requested } = stubCanvas([{ type: 'image/webp', size: 1200 }])
    const prepared = await prepareBackdrop(named('Summer meadow.png'))
    expect(prepared).toMatchObject({
      name: 'Summer meadow',
      mimeType: 'image/webp',
      width: 100,
      height: 80,
      byteLength: 1200,
      crop: { x: 0.5, y: 0.5, zoom: 1 },
    })
    expect(atob(prepared.imageData)).toHaveLength(1200)
    expect(drawn.fillStyle).toBe('#f5f0e4')
    expect(drawn.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 100, 80)
    expect(requested).toEqual([['image/webp', 0.86]])
    expect(close).toHaveBeenCalledOnce()
  })

  it('falls back to JPEG where WebP cannot be written, and gives a nameless file a name', async () => {
    stubDecode()
    const { requested } = stubCanvas([
      { type: 'image/png', size: 10 },
      { type: 'image/jpeg', size: 10 },
    ])
    const prepared = await prepareBackdrop(named('.png'))
    expect(prepared.mimeType).toBe('image/jpeg')
    expect(prepared.name).toBe('My garden image')
    expect(requested.map(([type]) => type)).toEqual(['image/webp', 'image/jpeg'])
  })

  it('lowers the quality until the image fits', async () => {
    stubDecode()
    const big = CUSTOM_BACKDROP_LIMITS.maxEncodedBytes + 1
    const { requested } = stubCanvas([
      { type: 'image/webp', size: big },
      { type: 'image/webp', size: big },
      { type: 'image/webp', size: 500 },
    ])
    expect((await prepareBackdrop(named('a.png'))).byteLength).toBe(500)
    expect(requested.map(([, quality]) => quality)).toEqual([0.86, 0.72, 0.58])
  })

  it('gives up on an image too detailed to fit, and still lets go of the bitmap', async () => {
    const close = stubDecode()
    const big = { type: 'image/webp', size: CUSTOM_BACKDROP_LIMITS.maxEncodedBytes + 1 }
    stubCanvas([big, big, big, big])
    await expect(prepareBackdrop(named('a.png'))).rejects.toThrow(/too detailed/)
    expect(close).toHaveBeenCalledOnce()
  })

  it('says so when the browser cannot draw or encode', async () => {
    stubDecode()
    stubCanvas([], null)
    await expect(prepareBackdrop(named('a.png'))).rejects.toThrow(/editing is unavailable/)

    vi.restoreAllMocks()
    stubDecode()
    stubCanvas([null])
    await expect(prepareBackdrop(named('a.png'))).rejects.toThrow(/could not be prepared/)
  })

  it('checks the decoded size too, since a header can lie', async () => {
    const close = stubDecode(9000, 9000)
    await expect(prepareBackdrop(named('a.png'))).rejects.toThrow(/too many pixels/)
    expect(close).toHaveBeenCalledOnce()
  })

  it('refuses an unsupported file before reading it', async () => {
    const read = vi.fn()
    const gif = { name: 'a.gif', type: 'image/gif', size: 10, arrayBuffer: read } as unknown as File
    await expect(prepareBackdrop(gif)).rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
  })

  it('verifies a sound backup image and lets go of it', async () => {
    const close = stubDecode(100, 100)
    const record = {
      name: 'Saved image',
      imageData: btoa(String.fromCharCode(...png(100, 100))),
      mimeType: 'image/png',
      width: 100,
      height: 100,
    } as CustomBackdrop
    await expect(verifyBackdropImages([record])).resolves.toBeUndefined()
    expect(close).toHaveBeenCalledOnce()
  })
})
