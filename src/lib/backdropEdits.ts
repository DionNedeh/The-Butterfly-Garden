import type { CustomBackdrop, CustomBackdropCrop } from '../types'

/**
 * The editor's small rules for a gardener's own image: turning it, and
 * lightening or darkening it. Kept apart from `customBackdrops`, which the
 * garden needs on its first load, since only the editor asks these.
 */

/** A quarter turn to the right is 1, to the left -1. */
export type TurnStep = 1 | -1

/** Quarter turns to the right, 0 to 3, after one more step either way. */
export function addQuarterTurn(turns: number, step: TurnStep): number {
  return (((turns + step) % 4) + 4) % 4
}

/**
 * The far side of a focal point, kept to four places: 1 - 0.9 is not quite
 * 0.1 in floating point, and a turn and its undoing should frame the picture
 * exactly as before.
 */
const opposite = (value: number) => Math.round((1 - value) * 10_000) / 10_000

/**
 * The framing after a quarter turn. The focal point turns with the picture,
 * so the part the gardener framed stays in view; the zoom is unchanged.
 */
export function turnCrop(
  crop: CustomBackdropCrop,
  step: TurnStep,
): CustomBackdropCrop {
  return step === 1
    ? { ...crop, x: opposite(crop.y), y: crop.x }
    : { ...crop, x: crop.y, y: opposite(crop.x) }
}

/** A brightness in words, for the slider to say and to show. */
export function brightnessWords(brightness: number | undefined): string {
  if (!brightness) return 'As taken'
  return brightness < 0
    ? `${-brightness}% darker`
    : `${brightness}% brighter`
}

/**
 * The image with this brightness. "As taken" keeps no field at all, so an
 * image never adjusted stays exactly the record an older build wrote.
 */
export function withBrightness(
  image: CustomBackdrop,
  brightness: number,
): CustomBackdrop {
  const next = { ...image }
  if (brightness) next.brightness = brightness
  else delete next.brightness
  return next
}
