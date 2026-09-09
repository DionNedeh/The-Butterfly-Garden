import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  imageHeader,
  prepareBackdrop,
  verifyBackdropImages,
} from './imageImport'
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
