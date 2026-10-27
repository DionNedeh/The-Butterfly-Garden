import { vi } from 'vitest'
import {
  POSTCARD_TYPE,
  type Picture,
  type PostcardContext,
  type PostcardDevice,
} from '../lib/postcard'

/*
 * Stand-ins for the canvas, images and fonts a postcard is drawn with
 * (lib/postcard), which jsdom does not have. The context records what is
 * drawn, so a test can say what is on the card and what is not.
 */

export type Call = [string, ...unknown[]]

/**
 * A 2D context that records what is drawn. Text is measured as half its
 * font size per character, so a name's fit can be followed.
 */
export function fakeContext() {
  const calls: Call[] = []
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args])
    }
  const context = {
    fillStyle: '' as unknown,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    filter: 'none',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    fillRect: record('fillRect'),
    save: record('save'),
    restore: record('restore'),
    translate: record('translate'),
    rotate: record('rotate'),
    beginPath: record('beginPath'),
    rect: record('rect'),
    clip: record('clip'),
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    drawImage(source: { broken?: boolean }, ...args: unknown[]) {
      if (source.broken) throw new DOMException('The image is broken', 'InvalidStateError')
      calls.push(['drawImage', source, ...args, context.filter])
    },
    fillText(text: string) {
      calls.push(['fillText', text, context.font])
    },
    measureText(text: string) {
      const size = Number(/(\d+)px/.exec(context.font)?.[1] ?? 10)
      return { width: Array.from(text).length * size * 0.5 }
    },
  }
  return { context: context as unknown as PostcardContext, calls }
}

/** A picture to stand in for a loaded image. */
export function picture(kind: string, width = 480, height = 440, broken = false): Picture {
  return { source: { kind, broken } as unknown as CanvasImageSource, width, height }
}

/** A device with a recording canvas, the pictures given, and a blob for each read back. */
export function fakeDevice({
  pictures = (src: string) =>
    src.startsWith('data:image/svg+xml') ? picture('butterfly') : picture('scene', 1600, 900),
  readBack = () => Promise.resolve<Blob | null>(new Blob(['jpeg'], { type: POSTCARD_TYPE })),
  canvas = true,
}: {
  pictures?: (src: string) => Picture | undefined
  readBack?: (attempt: number) => Promise<Blob | null>
  canvas?: boolean
} = {}) {
  const surfaces: ReturnType<typeof fakeContext>[] = []
  const toBlob = vi.fn((type: string, quality: number) => {
    void type
    void quality
    return readBack(surfaces.length)
  })
  const order: string[] = []
  const load = vi.fn((src: string) => Promise.resolve(pictures(src)))
  const fonts = vi.fn(() => {
    order.push('fonts')
    return Promise.resolve()
  })
  const device: PostcardDevice = {
    surface() {
      if (!canvas) return undefined
      const surface = fakeContext()
      surfaces.push(surface)
      order.push('surface')
      return { context: surface.context, toBlob }
    },
    picture: load,
    fonts,
  }
  return { device, surfaces, toBlob, order, load }
}

