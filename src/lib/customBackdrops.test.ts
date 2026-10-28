import { describe, expect, it } from 'vitest'
import {
  CUSTOM_BACKDROP_LIMITS,
  CUSTOM_BACKDROP_SLOTS,
  activeCustomBackdrop,
  canAddCustomBackdrop,
  checkCustomBackdropRecord,
  chooseNightCustomBackdrop,
  clampCrop,
  coverGeometry,
  decodedByteLength,
  isValidBase64,
  isValidBrightness,
  isValidCustomBackdrop,
  isValidCustomBackdropCollection,
  putCustomBackdrop,
  removeCustomBackdrop,
  selectCustomBackdrop,
} from './customBackdrops'
import { createInitialState } from './progression'
import type { AppState, CustomBackdrop } from '../types'

/** Base64 for `bytes` bytes of data, so declared and actual sizes agree. */
function base64OfLength(bytes: number): string {
  return btoa('a'.repeat(bytes))
}

function image(overrides: Partial<CustomBackdrop> = {}): CustomBackdrop {
  const byteLength = overrides.byteLength ?? 600
  return {
    id: 'image-1',
    name: 'The back garden',
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
    mimeType: 'image/webp',
    width: 1600,
    height: 900,
    byteLength,
    imageData: base64OfLength(byteLength),
    crop: { x: 0.5, y: 0.5, zoom: 1 },
    ...overrides,
  }
}

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createInitialState('Tester', 'Test Garden'), ...overrides }
}

describe('crop maths', () => {
  it('brings any nonsense back into range', () => {
    expect(clampCrop({ x: -3, y: 9, zoom: 100 })).toEqual({
      x: 0,
      y: 1,
      zoom: CUSTOM_BACKDROP_LIMITS.maxZoom,
    })
    expect(clampCrop({ x: Number.NaN, y: Infinity, zoom: 0 })).toEqual({
      x: 0.5,
      y: 0.5,
      zoom: 1,
    })
    expect(clampCrop(undefined)).toEqual({ x: 0.5, y: 0.5, zoom: 1 })
  })

  it('covers the frame whatever shape it is', () => {
    const wide = coverGeometry({ width: 1600, height: 900 }, { width: 400, height: 800 })
    expect(wide.width).toBeGreaterThanOrEqual(400)
    expect(wide.height).toBeGreaterThanOrEqual(800)

    const tall = coverGeometry({ width: 900, height: 1600 }, { width: 1200, height: 400 })
    expect(tall.width).toBeGreaterThanOrEqual(1200)
    expect(tall.height).toBeGreaterThanOrEqual(400)
  })

  it('never leaves a gap at an edge', () => {
    // Offsets are zero or negative, and the far edge always reaches the frame.
    const frame = { width: 400, height: 800 }
    for (const x of [0, 0.25, 0.5, 0.75, 1]) {
      const geometry = coverGeometry({ width: 1600, height: 900 }, frame, {
        x,
        y: 0.5,
        zoom: 1,
      })
      expect(geometry.left).toBeLessThanOrEqual(0)
      expect(geometry.top).toBeLessThanOrEqual(0)
      expect(geometry.left + geometry.width).toBeGreaterThanOrEqual(frame.width - 0.01)
      expect(geometry.top + geometry.height).toBeGreaterThanOrEqual(frame.height - 0.01)
    }
  })

  it('moves the focal point across the overflow', () => {
    const frame = { width: 400, height: 400 }
    const left = coverGeometry({ width: 1600, height: 400 }, frame, {
      x: 0,
      y: 0.5,
      zoom: 1,
    })
    const right = coverGeometry({ width: 1600, height: 400 }, frame, {
      x: 1,
      y: 0.5,
      zoom: 1,
    })
    expect(left.left).toBe(0)
    expect(right.left).toBeLessThan(left.left)
  })

  it('magnifies with zoom', () => {
    const frame = { width: 400, height: 400 }
    const plain = coverGeometry({ width: 800, height: 800 }, frame)
    const zoomed = coverGeometry({ width: 800, height: 800 }, frame, {
      x: 0.5,
      y: 0.5,
      zoom: 2,
    })
    expect(zoomed.width).toBeCloseTo(plain.width * 2)
  })

  it('returns nothing for a frame or image with no size', () => {
    expect(coverGeometry({ width: 0, height: 0 }, { width: 10, height: 10 })).toEqual({
      width: 0,
      height: 0,
      left: 0,
      top: 0,
    })
  })
})

describe('validating a stored image', () => {
  it('measures decoded bytes without decoding', () => {
    for (const bytes of [1, 2, 3, 24, 600, 1023]) {
      expect(decodedByteLength(base64OfLength(bytes))).toBeCloseTo(bytes, 0)
    }
    expect(decodedByteLength('')).toBe(0)
  })

  it('recognises base64 and rejects anything else', () => {
    expect(isValidBase64(base64OfLength(9))).toBe(true)
    expect(isValidBase64('not base64!')).toBe(false)
    expect(isValidBase64('QUJD')).toBe(true)
    // Length has to be a multiple of four to be complete.
    expect(isValidBase64('QUJDR')).toBe(false)
    expect(isValidBase64(42)).toBe(false)
  })

  it('accepts a well-formed record', () => {
    expect(isValidCustomBackdrop(image())).toBe(true)
  })

  it('refuses a record whose declared size does not match its data', () => {
    // Quota decisions are made from byteLength. If a file can simply assert a
    // small number while carrying a large image, that check means nothing.
    expect(
      isValidCustomBackdrop(
        image({ byteLength: 10, imageData: base64OfLength(600) }),
      ),
    ).toBe(false)
  })

  it('refuses records that break each limit', () => {
    expect(isValidCustomBackdrop(image({ mimeType: 'image/gif' as never }))).toBe(false)
    expect(isValidCustomBackdrop(image({ width: 4000 }))).toBe(false)
    expect(isValidCustomBackdrop(image({ height: 0 }))).toBe(false)
    expect(isValidCustomBackdrop(image({ imageData: 'not base64!' }))).toBe(false)
    expect(isValidCustomBackdrop(image({ crop: { x: 2, y: 0.5, zoom: 1 } }))).toBe(false)
    expect(isValidCustomBackdrop(image({ crop: { x: 0.5, y: 0.5, zoom: 9 } }))).toBe(false)
    expect(
      isValidCustomBackdrop(image({ name: 'x'.repeat(CUSTOM_BACKDROP_LIMITS.maxNameLength + 1) })),
    ).toBe(false)
    expect(isValidCustomBackdrop(image({ id: '' }))).toBe(false)
    expect(isValidCustomBackdrop(undefined)).toBe(false)
    expect(isValidCustomBackdrop({})).toBe(false)
  })

  it('takes a brightness only as a number within its range', () => {
    for (const brightness of [-40, -12.5, 0, 20]) {
      expect(isValidBrightness(brightness)).toBe(true)
      expect(isValidCustomBackdrop(image({ brightness }))).toBe(true)
    }
    for (const brightness of [-41, 21, Number.NaN, Infinity, '10', null]) {
      expect(isValidBrightness(brightness)).toBe(false)
      expect(isValidCustomBackdrop(image({ brightness: brightness as number }))).toBe(false)
    }
    // An image never adjusted has none at all, and is as valid as ever.
    expect(isValidCustomBackdrop(image())).toBe(true)
  })

  it('refuses a record larger than a slot allows', () => {
    const big = CUSTOM_BACKDROP_LIMITS.maxEncodedBytes + 8
    expect(isValidCustomBackdrop(image({ byteLength: big }))).toBe(false)
    expect(isValidCustomBackdrop(image({ byteLength: 1024 }))).toBe(true)
  })

  it('judges the collection as a whole', () => {
    expect(isValidCustomBackdropCollection([])).toBe(true)
    expect(isValidCustomBackdropCollection([image()])).toBe(true)
    // More than the shelf holds.
    expect(
      isValidCustomBackdropCollection(
        Array.from({ length: CUSTOM_BACKDROP_SLOTS + 1 }, (_, index) =>
          image({ id: `image-${index}` }),
        ),
      ),
    ).toBe(false)
    // Duplicate ids: a reference would be ambiguous.
    expect(isValidCustomBackdropCollection([image(), image()])).toBe(false)
    expect(isValidCustomBackdropCollection('nope')).toBe(false)
  })
})

describe('keeping images and the selection together', () => {
  it('saves and selects in one change', () => {
    const saved = putCustomBackdrop(garden(), image())
    expect(saved.customBackdrops).toHaveLength(1)
    expect(saved.profile?.selectedCustomBackdropId).toBe('image-1')
  })

  it('replaces an existing image without taking another slot', () => {
    const first = putCustomBackdrop(garden(), image())
    const replaced = putCustomBackdrop(first, image({ name: 'Renamed' }))
    expect(replaced.customBackdrops).toHaveLength(1)
    expect(replaced.customBackdrops[0].name).toBe('Renamed')
  })

  it('refuses a fourth image and an invalid one', () => {
    let state = garden()
    for (let index = 0; index < CUSTOM_BACKDROP_SLOTS; index += 1) {
      state = putCustomBackdrop(state, image({ id: `image-${index}` }))
    }
    expect(canAddCustomBackdrop(state).ok).toBe(false)
    expect(putCustomBackdrop(state, image({ id: 'one-too-many' }))).toBe(state)

    const base = garden()
    expect(putCustomBackdrop(base, image({ imageData: 'not base64!' }))).toBe(base)
  })

  it('falls back to the built-in scene when the active image is deleted', () => {
    const saved = putCustomBackdrop(garden(), image())
    const removed = removeCustomBackdrop(saved, 'image-1')
    expect(removed.customBackdrops).toHaveLength(0)
    // Left pointing at a missing record, the garden would draw nothing.
    expect(removed.profile?.selectedCustomBackdropId).toBeUndefined()
    expect(removed.profile?.selectedBackdropId).toBe('sunlit-meadow')
  })

  it('leaves the selection alone when a different image is deleted', () => {
    let state = putCustomBackdrop(garden(), image({ id: 'keep' }))
    state = putCustomBackdrop(state, image({ id: 'drop' }))
    state = selectCustomBackdrop(state, 'keep')
    const removed = removeCustomBackdrop(state, 'drop')
    expect(removed.profile?.selectedCustomBackdropId).toBe('keep')
  })

  it('refuses to select an image that is not there', () => {
    const state = garden()
    expect(selectCustomBackdrop(state, 'missing')).toBe(state)
  })

  it('resolves the active image only when access allows it', () => {
    const saved = putCustomBackdrop(garden(), image())
    expect(activeCustomBackdrop(saved, true)?.id).toBe('image-1')
    // Access withheld: the record stays, but nothing custom is drawn.
    expect(activeCustomBackdrop(saved, false)).toBeUndefined()
    expect(saved.customBackdrops).toHaveLength(1)
  })

  it('says why a record cannot be saved', () => {
    // Saving returns the state untouched when a record is invalid, which on
    // its own is indistinguishable from a save that worked.
    expect(checkCustomBackdropRecord(image()).ok).toBe(true)
    const bad = checkCustomBackdropRecord(image({ imageData: 'not base64!' }))
    expect(bad.ok).toBe(false)
    expect(bad.reason).toBe('invalid')
    expect(bad.message).toBeTruthy()
  })

  it('resolves nothing for a dangling reference', () => {
    const dangling = garden({
      customBackdrops: [],
      profile: { ...garden().profile!, selectedCustomBackdropId: 'gone' },
    })
    expect(activeCustomBackdrop(dangling, true)).toBeUndefined()
  })

  it('saves an image without choosing it, when asked to', () => {
    const state = putCustomBackdrop(garden(), image({ id: 'day' }))
    const saved = putCustomBackdrop(state, image({ id: 'night' }), false)
    expect(saved.customBackdrops).toHaveLength(2)
    expect(saved.profile?.selectedCustomBackdropId).toBe('day')
  })
})

describe('an image by day and another by night', () => {
  function pictured() {
    let state = putCustomBackdrop(garden(), image({ id: 'day' }))
    state = putCustomBackdrop(state, image({ id: 'night' }), false)
    return chooseNightCustomBackdrop(state, 'night')
  }

  it('shows the night image while the garden is at night, and the day image otherwise', () => {
    const state = pictured()
    expect(activeCustomBackdrop(state, true, 'night')?.id).toBe('night')
    expect(activeCustomBackdrop(state, true, 'sunlight')?.id).toBe('day')
    // A caller that knows no theme gets the day's, as every garden did.
    expect(activeCustomBackdrop(state, true)?.id).toBe('day')
    expect(activeCustomBackdrop(state, false, 'night')).toBeUndefined()
  })

  it('shows the same by night as by day when no night image is chosen', () => {
    const state = putCustomBackdrop(garden(), image({ id: 'day' }))
    expect(activeCustomBackdrop(state, true, 'night')?.id).toBe('day')
  })

  it('shows the night image over a built-in scene by day', () => {
    let state = putCustomBackdrop(garden(), image({ id: 'night' }), false)
    state = chooseNightCustomBackdrop(state, 'night')
    expect(state.profile?.selectedCustomBackdropId).toBeUndefined()
    expect(activeCustomBackdrop(state, true, 'sunlight')).toBeUndefined()
    expect(activeCustomBackdrop(state, true, 'night')?.id).toBe('night')
  })

  it('falls back to the day image when the night one is not there', () => {
    const state = pictured()
    const dangling = {
      ...state,
      customBackdrops: state.customBackdrops.filter((entry) => entry.id !== 'night'),
    }
    expect(activeCustomBackdrop(dangling, true, 'night')?.id).toBe('day')
  })

  it('chooses and clears the night image, refusing one that is not there', () => {
    const state = pictured()
    expect(state.profile?.nightCustomBackdropId).toBe('night')
    // Nothing to change: the very same garden.
    expect(chooseNightCustomBackdrop(state, 'night')).toBe(state)
    expect(chooseNightCustomBackdrop(state, 'missing')).toBe(state)
    expect(chooseNightCustomBackdrop(state, undefined).profile?.nightCustomBackdropId).toBeUndefined()
    const empty = garden({ profile: undefined })
    expect(chooseNightCustomBackdrop(empty, 'night')).toBe(empty)
  })

  it('stops pointing at a removed image, by day or by night, and at nothing else', () => {
    const state = pictured()
    const withoutNight = removeCustomBackdrop(state, 'night')
    expect(withoutNight.profile?.nightCustomBackdropId).toBeUndefined()
    expect(withoutNight.profile?.selectedCustomBackdropId).toBe('day')
    const withoutDay = removeCustomBackdrop(state, 'day')
    expect(withoutDay.profile?.selectedCustomBackdropId).toBeUndefined()
    expect(withoutDay.profile?.nightCustomBackdropId).toBe('night')
  })

  it('keeps the profile as it was when the image removed was neither', () => {
    let state = pictured()
    state = putCustomBackdrop(state, image({ id: 'spare' }), false)
    expect(removeCustomBackdrop(state, 'spare').profile).toBe(state.profile)
  })
})
