import type {
  AppState,
  AppearanceTheme,
  CustomBackdrop,
  CustomBackdropCrop,
  CustomBackdropMimeType,
  Sighting,
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
  /** Brightness, in percent: darker for a light heading, lighter for a dark one. */
  minBrightness: -40,
  maxBrightness: 20,
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

export const DEFAULT_CROP: CustomBackdropCrop = { x: 0.5, y: 0.5, zoom: 1 }

/** Bring any crop back inside its allowed range, replacing nonsense values. */
export function clampCrop(
  crop: Partial<CustomBackdropCrop> | undefined,
): CustomBackdropCrop {
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
    Math.min(
      0,
      Math.max(frame.width - width, -(width - frame.width) * safe.x),
    ) + 0
  const top =
    Math.min(
      0,
      Math.max(frame.height - height, -(height - frame.height) * safe.y),
    ) + 0
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

/** A brightness the garden can show: a number within its range. */
export function isValidBrightness(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    value >= CUSTOM_BACKDROP_LIMITS.minBrightness &&
    value <= CUSTOM_BACKDROP_LIMITS.maxBrightness
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
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
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
  if (decodedByteLength(record.imageData) !== byteLength) return false
  if (record.brightness !== undefined && !isValidBrightness(record.brightness))
    return false

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

/**
 * Why a record cannot be saved, if it cannot.
 *
 * `putCustomBackdrop` returns the state untouched when a record is invalid,
 * which is indistinguishable from a save that worked. Callers that need to
 * tell a gardener what went wrong should ask here first rather than inferring
 * failure from a state that did not change.
 */
export function checkCustomBackdropRecord(
  record: unknown,
): CustomBackdropCheck {
  return isValidCustomBackdrop(record)
    ? OK
    : reject('invalid', 'That image could not be saved. Try choosing it again.')
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
  // By day or by night: either choice that named it goes back to the default.
  const forget = (chosen: string | undefined) => (chosen === id ? undefined : chosen)
  const profile =
    state.profile &&
    (state.profile.selectedCustomBackdropId === id ||
      state.profile.nightCustomBackdropId === id)
      ? {
          ...state.profile,
          selectedCustomBackdropId: forget(state.profile.selectedCustomBackdropId),
          nightCustomBackdropId: forget(state.profile.nightCustomBackdropId),
        }
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
  if (
    id !== undefined &&
    !state.customBackdrops.some((entry) => entry.id === id)
  ) {
    return state
  }
  if (state.profile.selectedCustomBackdropId === id) return state
  return {
    ...state,
    profile: { ...state.profile, selectedCustomBackdropId: id },
  }
}

/**
 * Choose an image to show while the garden is at night, or `undefined` for
 * the same as by day. An image that is not there is refused.
 */
export function chooseNightCustomBackdrop(
  state: AppState,
  id: string | undefined,
): AppState {
  if (!state.profile || state.profile.nightCustomBackdropId === id) return state
  if (
    id !== undefined &&
    !state.customBackdrops.some((entry) => entry.id === id)
  ) {
    return state
  }
  return {
    ...state,
    profile: { ...state.profile, nightCustomBackdropId: id },
  }
}

/**
 * The gardener's own image to draw, if there is one to draw.
 *
 * At night (the theme on screen, which the caller knows), the night image
 * when one is chosen and still there; otherwise, and by day, the selected one.
 * A reference to a missing record resolves to nothing rather than a blank
 * garden; the built-in backdrop remains underneath as the fallback.
 */
export function activeCustomBackdrop(
  state: Pick<AppState, 'customBackdrops' | 'profile'>,
  allowed: boolean,
  theme?: AppearanceTheme,
): CustomBackdrop | undefined {
  if (!allowed) return undefined
  const find = (id: string | undefined) =>
    id ? state.customBackdrops.find((entry) => entry.id === id) : undefined
  return (
    (theme === 'night' ? find(state.profile?.nightCustomBackdropId) : undefined) ??
    find(state.profile?.selectedCustomBackdropId)
  )
}

/*
 * The field book's photos (lib/sightings), and how many sightings it keeps.
 * Kept here, beside the personal images' limits, because one pipeline makes
 * both kinds of picture (lib/imageImport), and checking a stored garden
 * needs both limits before any page that shows a sighting has loaded.
 */

/**
 * Sightings a field book keeps. Generous: years of noticing, written down
 * most days, still fit. A sighting without a photo is a few dozen bytes.
 */
export const MAX_SIGHTINGS = 2000

/**
 * Photos a field book keeps. Each is carried in every backup, so this keeps
 * an ordinary backup small enough to send and to restore.
 */
export const MAX_SIGHTING_PHOTOS = 50

/**
 * A photo's longest edge, in pixels: enough to see what was seen, and half
 * the edge a personal image keeps, since it is never a whole screen's backdrop.
 */
export const SIGHTING_PHOTO_MAX_EDGE = 1024

/** A photo's largest size once re-encoded. */
export const SIGHTING_PHOTO_MAX_BYTES = 400 * 1024

/**
 * Whether a value is a photo the field book can keep: a Blob in one of the
 * formats a personal image may be, of a size a re-encoded photo can be.
 */
export function isSightingPhoto(value: unknown): value is Blob {
  return (
    value instanceof Blob &&
    isSupportedMimeType(value.type) &&
    value.size > 0 &&
    value.size <= SIGHTING_PHOTO_MAX_BYTES
  )
}

/** How many of these sightings have a photo, and how many bytes they take. */
export function photosIn(sightings: readonly Sighting[]): { count: number; bytes: number } {
  let count = 0
  let bytes = 0
  for (const sighting of sightings) {
    if (!sighting.photo) continue
    count += 1
    bytes += sighting.photo.size
  }
  return { count, bytes }
}

/**
 * Whether a garden brings pictures of the gardener's own, a personal image
 * or a sighting's photo, which a restore checks as pictures before anything
 * is replaced (lib/imageImport).
 */
export function hasPictures(garden: Pick<AppState, 'customBackdrops' | 'sightings'>): boolean {
  return garden.customBackdrops.length > 0 || garden.sightings.some((sighting) => sighting.photo)
}
