import type { Profile } from '../types'

/**
 * How much the garden moves.
 *
 * - `full`: wings, plants and flight as designed.
 * - `calm`: the same garden, slower and quieter. Wings beat and plants sway
 *   at about half speed, flight paths are smaller and slower, and only a few
 *   butterflies are in the air at once; the rest settle. The honest answer
 *   for older phones and battery-saver days.
 * - `reduce`: decorative motion stops.
 */
export type MotionPreference = 'full' | 'calm' | 'reduce'

/** In calm motion, this many butterflies fly; the others settle. */
export const CALM_AIRBORNE = 4

export function motionPreference(
  profile: Pick<Profile, 'reducedMotion' | 'calmMotion'> | undefined,
): MotionPreference {
  if (profile?.reducedMotion) return 'reduce'
  return profile?.calmMotion ? 'calm' : 'full'
}

/** The class the app shell carries for each preference. */
export function motionClass(preference: MotionPreference): string {
  return preference === 'reduce'
    ? 'reduce-motion'
    : preference === 'calm'
      ? 'calm-motion'
      : ''
}
