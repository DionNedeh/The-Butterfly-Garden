import {
  CUSTOM_BACKDROP_LIMITS,
  isSupportedMimeType,
  SIGHTING_PHOTO_MAX_BYTES,
  SIGHTING_PHOTO_MAX_EDGE,
  type CustomBackdropCheck,
  type CustomBackdropRejection,
} from './customBackdrops'
import type { AppState, CustomBackdrop, CustomBackdropMimeType } from '../types'
import { createId } from './id'

// The checks made while an image is chosen live here, with the decoding they
// guard, rather than in customBackdrops: the garden's first load needs that
// module to show an image, and none of these until one is added.

const OK: CustomBackdropCheck = { ok: true }

function reject(
  reason: CustomBackdropRejection,
  message: string,
): CustomBackdropCheck {
  return { ok: false, reason, message }
}

/**
 * Whether a chosen file is worth decoding.
 *
 * Type and byte size are checked first because both are known without reading
 * the image, and decoding a very large file is the expensive, memory-hungry
 * step this is here to avoid.
 */
export function checkSourceFile(file: {
  type: string
  size: number
}): CustomBackdropCheck {
  if (!isSupportedMimeType(file.type)) {
    return reject(
      'unsupported-type',
      'Choose a JPEG, PNG or WebP image from your device.',
    )
  }
  if (
    !Number.isInteger(file.size) ||
    file.size <= 0 ||
    file.size > CUSTOM_BACKDROP_LIMITS.maxSourceBytes
  ) {
    return reject(
      'too-large',
      'That image is larger than 10 MB. Try a smaller copy.',
    )
  }
  return OK
}

/** Whether decoded dimensions are within what can be resized safely. */
export function checkDecodedSize(
  width: number,
  height: number,
): CustomBackdropCheck {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return reject('invalid', 'That image could not be read.')
  }
  if (width * height > CUSTOM_BACKDROP_LIMITS.maxMegapixels * 1_000_000) {
    return reject(
      'too-many-pixels',
      'That image has too many pixels to work with here.',
    )
  }
  return OK
}

/**
 * The size to resize an image to, preserving its aspect ratio: a personal
 * image's longest edge unless another is given (a sighting's photo keeps a
 * smaller one).
 *
 * Images already inside the limit are left alone rather than upscaled.
 */
export function fitWithinMaxEdge(
  width: number,
  height: number,
  maxEdge: number = CUSTOM_BACKDROP_LIMITS.maxEdge,
) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) }
  }
  const factor = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  }
}


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


/** What processing makes: the stored picture, without its name or framing. */
type BackdropPixels = Pick<
  CustomBackdrop,
  'mimeType' | 'width' | 'height' | 'byteLength' | 'imageData'
>

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

/**
 * The canvas transform that turns a picture by quarter turns to the right
 * (0 to 3), for a canvas already the turned shape: `width` by `height`.
 *
 * Whole numbers rather than `rotate()`, whose sine and cosine of a right
 * angle come out a hair off zero and can soften every pixel of the copy.
 */
export function quarterTurnTransform(
  turns: number,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (turns) {
    case 1:
      return [0, 1, -1, 0, width, 0]
    case 2:
      return [-1, 0, 0, -1, width, height]
    case 3:
      return [0, -1, 1, 0, 0, height]
    default:
      return [1, 0, 0, 1, 0, 0]
  }
}

/** Decode a chosen file, once the checks that keep a huge one from decoding at all have passed. */
async function decodeFile(file: File): Promise<ImageBitmap> {
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
  // The browser's default orientation applies the photo's own (EXIF)
  // rotation as it decodes, so the bitmap is upright as the gardener sees it,
  // and any quarter turns they ask for go on top. The copy made from it
  // carries no EXIF, so nothing turns it a second time.
  return createImageBitmap(file)
}

/** How large a redrawn picture may be: its longest edge, and its encoded bytes. */
interface EncodeLimits {
  maxEdge: number
  maxBytes: number
}

const BACKDROP_ENCODING: EncodeLimits = {
  maxEdge: CUSTOM_BACKDROP_LIMITS.maxEdge,
  maxBytes: CUSTOM_BACKDROP_LIMITS.maxEncodedBytes,
}

/**
 * Resize, turn and encode a decoded picture, letting go of it afterwards.
 *
 * The turn is part of the one draw that resizes, into the one canvas the
 * resize already needed (its longest edge capped), so turning costs no
 * second copy in memory and no pass over the pixels in script: a 4096 px
 * photo turned is the same work as one left as it is. Decoding and encoding
 * are the browser's, off the main thread. Only the pixels are drawn, so
 * nothing the camera wrote into the file, where it was taken included,
 * reaches the copy.
 */
async function encodeBitmap(
  bitmap: ImageBitmap,
  turns: number,
  limits: EncodeLimits,
): Promise<{ blob: Blob; width: number; height: number }> {
  try {
    const decoded = checkDecodedSize(bitmap.width, bitmap.height)
    if (!decoded.ok) throw new Error(decoded.message)
    const size = fitWithinMaxEdge(bitmap.width, bitmap.height, limits.maxEdge)
    const sideways = turns % 2 === 1
    const canvas = document.createElement('canvas')
    canvas.width = sideways ? size.height : size.width
    canvas.height = sideways ? size.width : size.height
    try {
      const context = canvas.getContext('2d')
      if (!context)
        throw new Error('Image editing is unavailable in this browser.')
      context.fillStyle = '#f5f0e4'
      context.fillRect(0, 0, canvas.width, canvas.height)
      if (turns)
        context.setTransform(
          ...quarterTurnTransform(turns, canvas.width, canvas.height),
        )
      context.drawImage(bitmap, 0, 0, size.width, size.height)
      let blob = await encode(canvas, 'image/webp', 0.86)
      if (blob.type !== 'image/webp')
        blob = await encode(canvas, 'image/jpeg', 0.86)
      for (const quality of [0.72, 0.58, 0.45]) {
        if (blob.size <= limits.maxBytes) break
        blob = await encode(canvas, blob.type, quality)
      }
      if (blob.size > limits.maxBytes)
        throw new Error(
          'This image is too detailed to fit. Try a smaller image.',
        )
      return { blob, width: canvas.width, height: canvas.height }
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    bitmap.close()
  }
}

/** A personal image's pixels, encoded and written as base64 for storage. */
async function processBitmap(
  bitmap: ImageBitmap,
  turns: number,
): Promise<BackdropPixels> {
  const { blob, width, height } = await encodeBitmap(bitmap, turns, BACKDROP_ENCODING)
  return {
    mimeType: blob.type as CustomBackdropMimeType,
    width,
    height,
    byteLength: blob.size,
    imageData: await base64(blob),
  }
}

/**
 * A photo for the field book, from a file the gardener chose: checked and
 * decoded as a personal image is, upright as they took it, then redrawn at
 * no more than SIGHTING_PHOTO_MAX_EDGE and re-encoded. Nothing of the
 * original file but its pixels is kept, and its location is never read.
 */
export async function prepareSightingPhoto(file: File): Promise<Blob> {
  const { blob } = await encodeBitmap(await decodeFile(file), 0, {
    maxEdge: SIGHTING_PHOTO_MAX_EDGE,
    maxBytes: SIGHTING_PHOTO_MAX_BYTES,
  })
  return blob
}

/**
 * Bytes of a stored image, from its base64: by a plain loop, many times
 * quicker than Uint8Array.from with a mapping function.
 */
function storedBytes(record: Pick<CustomBackdrop, 'imageData'>): Uint8Array<ArrayBuffer> {
  const binary = atob(record.imageData)
  const bytes = new Uint8Array(binary.length)
  for (let at = 0; at < binary.length; at += 1) bytes[at] = binary.charCodeAt(at)
  return bytes
}

export async function prepareBackdrop(
  file: File,
  turns = 0,
): Promise<CustomBackdrop> {
  const pixels = await processBitmap(await decodeFile(file), turns)
  const now = new Date().toISOString()
  return {
    id: createId(),
    name: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'My garden image',
    createdAt: now,
    updatedAt: now,
    ...pixels,
    crop: { x: 0.5, y: 0.5, zoom: 1 },
  }
}

/**
 * The picture turned by quarter turns to the right (0 to 3).
 *
 * Made from the chosen file when there is one, so a turned photo is encoded
 * once from the original; otherwise from the stored copy, the only source an
 * image saved earlier has. Either way the editor keeps its source and asks
 * for the total turn each time, so turning back and forth never re-encodes
 * a copy of a copy.
 */
export async function turnBackdrop(
  source: File | CustomBackdrop,
  turns: number,
): Promise<BackdropPixels> {
  const bitmap =
    'imageData' in source
      ? await createImageBitmap(
          new Blob([storedBytes(source)], { type: source.mimeType }),
        )
      : await decodeFile(source)
  return processBitmap(bitmap, turns)
}

/** A structurally valid backup can still contain corrupt image bytes. Check before replacement. */
export async function verifyBackdropImages(
  records: readonly CustomBackdrop[],
): Promise<void> {
  for (const record of records) {
    const bytes = storedBytes(record)
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

/**
 * The photos in a backup, checked before anything is replaced, as its
 * personal images are: each must be the image its type says, no larger
 * than a photo this app makes, and one this browser can draw at that size.
 *
 * The size is read from the header before anything is decoded: a file of a
 * few kilobytes can claim hundreds of megapixels, and decoding it would ask
 * a phone for more memory than it has.
 */
export async function verifySightingPhotos(photos: readonly Blob[]): Promise<void> {
  for (const photo of photos) {
    let readable = false
    try {
      const { mime, width, height } = imageHeader(new Uint8Array(await photo.arrayBuffer()))
      if (
        mime === photo.type &&
        checkDecodedSize(width, height).ok &&
        Math.max(width, height) <= SIGHTING_PHOTO_MAX_EDGE
      ) {
        const bitmap = await createImageBitmap(photo)
        // A header that tells the truth about the size, too.
        readable = bitmap.width === width && bitmap.height === height
        bitmap.close()
      }
    } catch {
      readable = false
    }
    if (!readable)
      throw new Error('A photo in that backup could not be read, so nothing was replaced.')
  }
}

/**
 * Every picture a backup brings, its personal images and its field book's
 * photos, checked before anything is replaced: a file can be well formed and
 * still hold damaged bytes.
 */
export async function verifyGardenImages(
  garden: Pick<AppState, 'customBackdrops' | 'sightings'>,
): Promise<void> {
  await verifyBackdropImages(garden.customBackdrops)
  await verifySightingPhotos(
    garden.sightings.flatMap((sighting) => (sighting.photo ? [sighting.photo] : [])),
  )
}
