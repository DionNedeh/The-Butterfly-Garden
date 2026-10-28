import type { RegionId } from '../types'

/**
 * The regions a gardener can choose in Settings. Chosen by hand, never worked
 * out from a location: the app asks for none, and the choice stays on this
 * device with the rest of the garden. Kept apart from their names and marks
 * (lib/regionMarks), since checking a stored garden needs only the ids.
 */
export const REGION_IDS: readonly RegionId[] = [
  'north-america',
  'europe',
  'australasia',
  'elsewhere',
]

export function isRegionId(value: unknown): value is RegionId {
  return (REGION_IDS as readonly unknown[]).includes(value)
}
