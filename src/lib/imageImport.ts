import {
  checkSourceFile,
  checkDecodedSize,
  fitWithinMaxEdge,
  CUSTOM_BACKDROP_LIMITS,
} from './customBackdrops'
import type { CustomBackdrop, CustomBackdropMimeType } from '../types'
import { createId } from './id'

/** Read dimensions before allocating a decoded bitmap. Never trust a file extension. */
export function imageHeader(bytes: Uint8Array): {
  width: number
  height: number
  mime: CustomBackdropMimeType
} {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length))
  if (
    bytes.length >= 24 &&
    bytes[0] === 137 &&
    ascii(1, 3) === 'PNG' &&
    ascii(12, 4) === 'IHDR'
  ) {
    return {
      width: data.getUint32(16),
      height: data.getUint32(20),
      mime: 'image/png',
    }
  }
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const kind = ascii(12, 4)
    if (kind === 'VP8X')
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
        mime: 'image/webp',
      }
    if (kind === 'VP8 ')
      return {
        width: data.getUint16(26, true) & 0x3fff,
        height: data.getUint16(28, true) & 0x3fff,
        mime: 'image/webp',
      }
    if (kind === 'VP8L' && bytes[20] === 0x2f)
      return {
        width: 1 + bytes[21] + ((bytes[22] & 63) << 8),
        height:
          1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10),
        mime: 'image/webp',
      }
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) break
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 217 || marker === 218) break
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue
      if (offset + 2 > bytes.length) break
      const length = data.getUint16(offset)
      if (length < 2 || offset + length > bytes.length) break
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 7
      )
        return {
          width: data.getUint16(offset + 5),
          height: data.getUint16(offset + 3),
          mime: 'image/jpeg',
        }
      offset += length
    }
  }
  throw new Error('This file is not a readable JPEG, PNG or WebP image.')
}

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('The image could not be prepared.')),
      type,
      quality,
    ),
  )
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string')
        resolve(reader.result.split(',')[1])
      else reject(new Error('The image could not be read.'))
    }
    reader.onerror = () => reject(new Error('The image could not be read.'))
    reader.readAsDataURL(blob)
  })
}

export async function prepareBackdrop(file: File): Promise<CustomBackdrop> {
  const check = checkSourceFile(file)
  if (!check.ok) throw new Error(check.message)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const header = imageHeader(bytes)
  if (header.mime !== file.type)
    throw new Error(
      'The image contents do not match its file type. Choose another copy.',
    )
  const dimensions = checkDecodedSize(header.width, header.height)
  if (!dimensions.ok) throw new Error(dimensions.message)
  const bitmap = await createImageBitmap(file)
  try {
    const decoded = checkDecodedSize(bitmap.width, bitmap.height)
    if (!decoded.ok) throw new Error(decoded.message)
    const size = fitWithinMaxEdge(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    try {
      const context = canvas.getContext('2d')
      if (!context)
        throw new Error('Image editing is unavailable in this browser.')
      context.fillStyle = '#f5f0e4'
      context.fillRect(0, 0, size.width, size.height)
      context.drawImage(bitmap, 0, 0, size.width, size.height)
      let blob = await encode(canvas, 'image/webp', 0.86)
      if (blob.type !== 'image/webp')
        blob = await encode(canvas, 'image/jpeg', 0.86)
      for (const quality of [0.72, 0.58, 0.45]) {
        if (blob.size <= CUSTOM_BACKDROP_LIMITS.maxEncodedBytes) break
        blob = await encode(canvas, blob.type, quality)
      }
      if (blob.size > CUSTOM_BACKDROP_LIMITS.maxEncodedBytes)
        throw new Error(
          'This image is too detailed to fit. Try a smaller image.',
        )
      const now = new Date().toISOString()
      return {
        id: createId(),
        name:
          file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'My garden image',
        createdAt: now,
        updatedAt: now,
        mimeType: blob.type as CustomBackdropMimeType,
        width: size.width,
        height: size.height,
        byteLength: blob.size,
        imageData: await base64(blob),
        crop: { x: 0.5, y: 0.5, zoom: 1 },
      }
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    bitmap.close()
  }
}

/** A structurally valid backup can still contain corrupt image bytes. Check before replacement. */
export async function verifyBackdropImages(
  records: readonly CustomBackdrop[],
): Promise<void> {
  for (const record of records) {
    const bytes = Uint8Array.from(atob(record.imageData), (character) =>
      character.charCodeAt(0),
    )
    const header = imageHeader(bytes)
    if (
      header.mime !== record.mimeType ||
      header.width !== record.width ||
      header.height !== record.height
    )
      throw new Error(
        `The image “${record.name}” has inconsistent dimensions or format.`,
      )
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: record.mimeType }),
    )
    try {
      if (bitmap.width !== record.width || bitmap.height !== record.height)
        throw new Error(`The image “${record.name}” could not be verified.`)
    } finally {
      bitmap.close()
    }
  }
}
