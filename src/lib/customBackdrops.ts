import type {
  AppState,
  CustomBackdrop,
  CustomBackdropCrop,
  CustomBackdropMimeType,
} from '../types'

/**
 * How many images a garden may hold.
 *
 * A bounded keepsake shelf rather than a photo library. Three fit inside the
 * existing whole-garden backup without turning an ordinary export into
 * something too big to send or restore.
 */
export const CUSTOM_BACKDROP_SLOTS = 3

/** Guardrails to test on target browsers, not measured device capacity. */
export const CUSTOM_BACKDROP_LIMITS = {
  /** Largest file accepted from the device, before any decode. */
  maxSourceBytes: 10 * 1024 * 1024,
  /** Refused before decoding: a huge image can exhaust memory decoding it. */
  maxMegapixels: 24,
  /** Longest edge kept after resizing. */
  maxEdge: 2048,
  /** Largest stored image, decoded. Base64 costs about a third on top. */
  maxEncodedBytes: 1024 * 1024,
  maxNameLength: 60,
  minZoom: 1,
  maxZoom: 3,
} as const

export const SUPPORTED_MIME_TYPES: readonly CustomBackdropMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

export function isSupportedMimeType(
  value: unknown,
): value is CustomBackdropMimeType {
  return (
    typeof value === 'string' &&
    (SUPPORTED_MIME_TYPES as readonly string[]).includes(value)
  )
}

export type CustomBackdropRejection =
  | 'unsupported-type'
  | 'too-large'
  | 'too-many-pixels'
  | 'no-slots'
  | 'invalid'

export interface CustomBackdropCheck {
  ok: boolean
  reason?: CustomBackdropRejection
  /** Plain wording suitable for showing to a gardener. */
  message?: string
}

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
  if (file.size > CUSTOM_BACKDROP_LIMITS.maxSourceBytes) {
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
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
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
 * The size to resize an image to, preserving its aspect ratio.
 *
 * Images already inside the limit are left alone rather than upscaled.
 */
export function fitWithinMaxEdge(width: number, height: number) {
  const longest = Math.max(width, height)
  if (longest <= CUSTOM_BACKDROP_LIMITS.maxEdge) {
    return { width: Math.round(width), height: Math.round(height) }
  }
  const factor = CUSTOM_BACKDROP_LIMITS.maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  }
}

export const DEFAULT_CROP: CustomBackdropCrop = { x: 0.5, y: 0.5, zoom: 1 }

/** Bring any crop back inside its allowed range, replacing nonsense values. */
export function clampCrop(crop: Partial<CustomBackdropCrop> | undefined): CustomBackdropCrop {
  const clamp = (value: unknown, min: number, max: number, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback
  return {
    x: clamp(crop?.x, 0, 1, DEFAULT_CROP.x),
    y: clamp(crop?.y, 0, 1, DEFAULT_CROP.y),
    zoom: clamp(
      crop?.zoom,
      CUSTOM_BACKDROP_LIMITS.minZoom,
      CUSTOM_BACKDROP_LIMITS.maxZoom,
      DEFAULT_CROP.zoom,
    ),
  }
}

export interface CoverGeometry {
  /** Drawn size, always at least covering the frame. */
  width: number
  height: number
  /** Top-left offset within the frame; zero or negative. */
  left: number
  top: number
}

/**
 * Where to draw an image so it covers a frame, honouring the focal point.
 *
 * Recomputed per frame shape rather than baked into the stored pixels, so the
 * same picture can be framed sensibly on a tall phone and a wide desktop.
 */
export function coverGeometry(
  image: { width: number; height: number },
  frame: { width: number; height: number },
  crop: CustomBackdropCrop = DEFAULT_CROP,
): CoverGeometry {
  const safe = clampCrop(crop)
  if (
    !(image.width > 0) ||
    !(image.height > 0) ||
    !(frame.width > 0) ||
    !(frame.height > 0)
  ) {
    return { width: 0, height: 0, left: 0, top: 0 }
  }
  const scale =
    Math.max(frame.width / image.width, frame.height / image.height) * safe.zoom
  const width = image.width * scale
  const height = image.height * scale
  // Negative or zero: the overflow is what the focal point slides through.
  // `+ 0` normalises -0, which Object.is treats as a different value and which
  // would otherwise leak into any comparison a caller makes against zero.
  const left =
    Math.min(0, Math.max(frame.width - width, -(width - frame.width) * safe.x)) + 0
  const top =
    Math.min(0, Math.max(frame.height - height, -(height - frame.height) * safe.y)) + 0
  return { width, height, left, top }
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/** Decoded byte count of a base64 string, without decoding it. */
export function decodedByteLength(base64: string): number {
  if (base64.length === 0) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return (base64.length / 4) * 3 - padding
}

export function isValidBase64(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length % 4 === 0 &&
    BASE64.test(value)
  )
}

/**
 * Whether a record is a usable stored image.
 *
 * Applied to records arriving from a backup as well as ones just created, so
 * a malformed image in a restore is caught rather than quietly dropped from a
 * restore reported as successful.
 */
export function isValidCustomBackdrop(value: unknown): value is CustomBackdrop {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || record.id.length === 0) return false
  if (typeof record.name !== 'string') return false
  if (record.name.length > CUSTOM_BACKDROP_LIMITS.maxNameLength) return false
  if (typeof record.createdAt !== 'string') return false
  if (typeof record.updatedAt !== 'string') return false
  if (!isSupportedMimeType(record.mimeType)) return false
  if (!isValidBase64(record.imageData)) return false

  const { width, height, byteLength } = record
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > CUSTOM_BACKDROP_LIMITS.maxEdge ||
    height > CUSTOM_BACKDROP_LIMITS.maxEdge
  ) {
    return false
  }
  if (
    typeof byteLength !== 'number' ||
    !Number.isFinite(byteLength) ||
    byteLength <= 0 ||
    byteLength > CUSTOM_BACKDROP_LIMITS.maxEncodedBytes
  ) {
    return false
  }
  // The declared size has to match the data, or a quota decision made from it
  // would be based on a number the file simply asserted.
  if (Math.abs(decodedByteLength(record.imageData) - byteLength) > 3) return false

  const crop = record.crop as Record<string, unknown> | undefined
  if (!crop || typeof crop !== 'object') return false
  for (const [key, min, max] of [
    ['x', 0, 1],
    ['y', 0, 1],
    ['zoom', CUSTOM_BACKDROP_LIMITS.minZoom, CUSTOM_BACKDROP_LIMITS.maxZoom],
  ] as const) {
    const value_ = crop[key]
    if (
      typeof value_ !== 'number' ||
      !Number.isFinite(value_) ||
      value_ < min ||
      value_ > max
    ) {
      return false
    }
  }
  return true
}

/**
 * Whether a stored collection is acceptable as a whole.
 *
 * Separate from per-record validity because the count and id uniqueness are
 * properties of the set, and a restore has to be judged before it commits.
 */
export function isValidCustomBackdropCollection(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  if (value.length > CUSTOM_BACKDROP_SLOTS) return false
  if (!value.every(isValidCustomBackdrop)) return false
  const ids = new Set(value.map((record: CustomBackdrop) => record.id))
  return ids.size === value.length
}

export function canAddCustomBackdrop(
  state: Pick<AppState, 'customBackdrops'>,
): CustomBackdropCheck {
  return state.customBackdrops.length >= CUSTOM_BACKDROP_SLOTS
    ? reject(
        'no-slots',
        `You can keep ${CUSTOM_BACKDROP_SLOTS} of your own images. Remove one to add another.`,
      )
    : OK
}

/**
 * Save an image and select it, as one change.
 *
 * The record and the reference to it move together: a state where the profile
 * points at an image that is not there yet, or an image nothing points at, is
 * one the garden should never be observed in.
 */
export function putCustomBackdrop(
  state: AppState,
  record: CustomBackdrop,
  select = true,
): AppState {
  if (!isValidCustomBackdrop(record)) return state
  const existing = state.customBackdrops.findIndex(
    (entry) => entry.id === record.id,
  )
  if (existing < 0 && !canAddCustomBackdrop(state).ok) return state

  const customBackdrops =
    existing >= 0
      ? state.customBackdrops.map((entry) =>
          entry.id === record.id ? record : entry,
        )
      : [...state.customBackdrops, record]

  return {
    ...state,
    customBackdrops,
    profile: state.profile
      ? {
          ...state.profile,
          ...(select ? { selectedCustomBackdropId: record.id } : {}),
        }
      : state.profile,
  }
}

/**
 * Delete an image, and stop pointing at it.
 *
 * Leaving the reference behind would show a garden with no backdrop and no
 * explanation, so the built-in selection underneath takes over.
 */
export function removeCustomBackdrop(state: AppState, id: string): AppState {
  if (!state.customBackdrops.some((entry) => entry.id === id)) return state
  const profile =
    state.profile && state.profile.selectedCustomBackdropId === id
      ? { ...state.profile, selectedCustomBackdropId: undefined }
      : state.profile
  return {
    ...state,
    customBackdrops: state.customBackdrops.filter((entry) => entry.id !== id),
    profile,
  }
}

/** Choose a stored image, or clear the choice with `undefined`. */
export function selectCustomBackdrop(
  state: AppState,
  id: string | undefined,
): AppState {
  if (!state.profile) return state
  if (id !== undefined && !state.customBackdrops.some((entry) => entry.id === id)) {
    return state
  }
  if (state.profile.selectedCustomBackdropId === id) return state
  return {
    ...state,
    profile: { ...state.profile, selectedCustomBackdropId: id },
  }
}

/**
 * The gardener's own image to draw, if there is one to draw.
 *
 * A reference to a missing record resolves to nothing rather than a blank
 * garden; the built-in backdrop remains underneath as the fallback.
 */
export function activeCustomBackdrop(
  state: Pick<AppState, 'customBackdrops' | 'profile'>,
  allowed: boolean,
): CustomBackdrop | undefined {
  if (!allowed) return undefined
  const id = state.profile?.selectedCustomBackdropId
  if (!id) return undefined
  return state.customBackdrops.find((entry) => entry.id === id)
}
