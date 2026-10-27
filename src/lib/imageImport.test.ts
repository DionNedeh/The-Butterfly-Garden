import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkDecodedSize,
  checkSourceFile,
  fitWithinMaxEdge,
  imageHeader,
  prepareBackdrop,
  quarterTurnTransform,
  turnBackdrop,
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

describe('accepting a file from the device', () => {
  it('takes JPEG, PNG and WebP and refuses everything else', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(checkSourceFile({ type, size: 1000 }).ok).toBe(true)
    }
    // SVG can carry script, GIF is animated, HTML is not an image at all.
    for (const type of ['image/svg+xml', 'image/gif', 'text/html', '']) {
      const check = checkSourceFile({ type, size: 1000 })
      expect(check.ok).toBe(false)
      expect(check.reason).toBe('unsupported-type')
    }
  })

  it('refuses an oversized file before decoding it', () => {
    const check = checkSourceFile({
      type: 'image/jpeg',
      size: CUSTOM_BACKDROP_LIMITS.maxSourceBytes + 1,
    })
    expect(check.reason).toBe('too-large')
    expect(check.message).toContain('10 MB')
  })

  it('refuses an image with too many pixels', () => {
    // 24 megapixels exactly is allowed; past it is not.
    expect(checkDecodedSize(6000, 4000).ok).toBe(true)
    expect(checkDecodedSize(7000, 4000).reason).toBe('too-many-pixels')
    expect(checkDecodedSize(0, 100).reason).toBe('invalid')
    expect(checkDecodedSize(Number.NaN, 100).reason).toBe('invalid')
  })

  it('resizes only what is bigger than the limit', () => {
    expect(fitWithinMaxEdge(1000, 500)).toEqual({ width: 1000, height: 500 })
    // Aspect ratio preserved, longest edge brought to the limit.
    expect(fitWithinMaxEdge(4096, 2048)).toEqual({ width: 2048, height: 1024 })
    expect(fitWithinMaxEdge(2048, 4096)).toEqual({ width: 1024, height: 2048 })
  })
})

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

  describe('turning a picture', () => {
    /** A canvas that notes its own size at the moment it is drawn on. */
    function turningCanvas() {
      const canvases: HTMLCanvasElement[] = []
      const drawnAt: Array<{ width: number; height: number }> = []
      const context = {
        fillStyle: '',
        fillRect: vi.fn(),
        setTransform: vi.fn(),
        getImageData: vi.fn(),
        putImageData: vi.fn(),
        drawImage: vi.fn(function (this: { canvas: HTMLCanvasElement }) {
          drawnAt.push({ width: this.canvas.width, height: this.canvas.height })
        }),
        canvas: undefined as unknown as HTMLCanvasElement,
      }
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
        this: HTMLCanvasElement,
      ) {
        canvases.push(this)
        context.canvas = this
        return context as unknown as CanvasRenderingContext2D
      })
      const toBlob = vi
        .spyOn(HTMLCanvasElement.prototype, 'toBlob')
        .mockImplementation((callback, type) =>
          callback(new Blob([new Uint8Array(900)], { type: type ?? 'image/webp' })),
        )
      return { canvases, context, drawnAt, toBlob }
    }

    const stored = (overrides: Partial<CustomBackdrop> = {}): CustomBackdrop => ({
      id: 'kept',
      name: 'Saved image',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      imageData: btoa(String.fromCharCode(...png(2048, 1536))),
      mimeType: 'image/png',
      width: 2048,
      height: 1536,
      byteLength: 32,
      crop: { x: 0.5, y: 0.5, zoom: 1 },
      ...overrides,
    })

    it('maps each corner of the picture to the corner a turn to the right takes it to', () => {
      // A 4 by 2 picture. Turned once or three times the canvas is 2 by 4.
      const corners = [
        [0, 0],
        [4, 0],
        [4, 2],
        [0, 2],
      ]
      const place = (turns: number, width: number, height: number) => {
        const [a, b, c, d, e, f] = quarterTurnTransform(turns, width, height)
        return corners.map(([x, y]) => [a * x + c * y + e, b * x + d * y + f])
      }
      expect(place(0, 4, 2)).toEqual([[0, 0], [4, 0], [4, 2], [0, 2]])
      // Clockwise: the top-left corner goes to the top right.
      expect(place(1, 2, 4)).toEqual([[2, 0], [2, 4], [0, 4], [0, 0]])
      expect(place(2, 4, 2)).toEqual([[4, 2], [0, 2], [0, 0], [4, 0]])
      expect(place(3, 2, 4)).toEqual([[0, 4], [0, 0], [2, 0], [2, 4]])
    })

    it('turns a large photo within the one resize, in no more memory than leaving it as it is', async () => {
      const close = stubDecode(4096, 3072)
      const { canvases, context, drawnAt } = turningCanvas()
      const create = vi.spyOn(document, 'createElement')
      const prepared = await prepareBackdrop(named('Tall.png', png(4096, 3072)), 1)

      // Only the one canvas the resize needs, already at the capped size,
      // the other way round: 2048 by 1536 turned is 1536 by 2048.
      expect(create.mock.calls.filter(([tag]) => tag === 'canvas')).toHaveLength(1)
      expect(drawnAt).toEqual([{ width: 1536, height: 2048 }])
      expect(context.setTransform).toHaveBeenCalledWith(0, 1, -1, 0, 1536, 0)
      expect(context.drawImage).toHaveBeenCalledOnce()
      expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2048, 1536)
      // No pass over the pixels in script, which would hold the main thread.
      expect(context.getImageData).not.toHaveBeenCalled()
      expect(context.putImageData).not.toHaveBeenCalled()
      expect(prepared).toMatchObject({ width: 1536, height: 2048, byteLength: 900 })
      // The canvas and the decoded photo are both let go.
      expect(canvases[0].width).toBe(0)
      expect(close).toHaveBeenCalledOnce()
    })

    it('leaves a picture with no turn exactly as before, with no transform', async () => {
      stubDecode(300, 200)
      const { context } = turningCanvas()
      const prepared = await prepareBackdrop(named('Wide.png', png(300, 200)))
      expect(context.setTransform).not.toHaveBeenCalled()
      expect(prepared).toMatchObject({ width: 300, height: 200 })
    })

    it('turns a stored image from its own bytes, letting go of it after', async () => {
      const close = stubDecode(2048, 1536)
      const { context } = turningCanvas()
      const record = stored()
      const half = await turnBackdrop(record, 2)
      // Encoded afresh, as WebP, whatever it was stored as.
      expect(half).toMatchObject({ width: 2048, height: 1536, mimeType: 'image/webp' })
      expect(context.setTransform).toHaveBeenCalledWith(-1, 0, 0, -1, 2048, 1536)
      const decoded = vi.mocked(createImageBitmap).mock.calls[0][0] as Blob
      expect(decoded.type).toBe('image/png')
      expect(new Uint8Array(await decoded.arrayBuffer())).toEqual(png(2048, 1536))

      const left = await turnBackdrop(record, 3)
      expect(left).toMatchObject({ width: 1536, height: 2048 })
      // Only the picture comes back; the name and framing are the editor's.
      expect(Object.keys(left).sort()).toEqual(['byteLength', 'height', 'imageData', 'mimeType', 'width'])
      expect(close).toHaveBeenCalledTimes(2)
    })

    it('turns a chosen file only after the same checks as choosing it', async () => {
      const decode = vi.fn()
      vi.stubGlobal('createImageBitmap', decode)
      await expect(turnBackdrop(file(png(100, 100), 'image/jpeg'), 1)).rejects.toThrow(/do not match/)
      await expect(turnBackdrop(file(png(7000, 5000)), 1)).rejects.toThrow(/too many pixels/)
      expect(decode).not.toHaveBeenCalled()

      stubDecode(100, 80)
      turningCanvas()
      expect(await turnBackdrop(file(png(100, 80)), 1)).toMatchObject({ width: 80, height: 100 })
    })

    it('lets a tap through while it works: decoding and encoding are waited on, not held', async () => {
      const order: string[] = []
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn(
          () =>
            new Promise((resolve) =>
              setTimeout(() => {
                order.push('decoded')
                resolve({ width: 2048, height: 1536, close: vi.fn() })
              }),
            ),
        ),
      )
      const { context, toBlob } = turningCanvas()
      toBlob.mockImplementation((callback, type) =>
        setTimeout(() => {
          order.push('encoded')
          callback(new Blob([new Uint8Array(900)], { type: type ?? 'image/webp' }))
        }),
      )
      const working = turnBackdrop(stored(), 1)
      // A tap that arrives while the picture is decoding.
      setTimeout(() => order.push('tap'))
      await working
      // The tap is handled between decoding and encoding, and the only work
      // in between is one draw.
      expect(order).toEqual(['decoded', 'tap', 'encoded'])
      expect(context.drawImage).toHaveBeenCalledOnce()
    })
  })
})
