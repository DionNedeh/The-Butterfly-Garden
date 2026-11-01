import { gardenLine } from '../../lib/gardenLines'
import type { Hemisphere } from '../../lib/seasons'
import type { RegionId } from '../../types'

/**
 * The line under the garden's name (lib/gardenLines): by day, by night, or
 * what the season is doing. Loaded with the garden rather than in the first
 * load every page waits for, so none of its words are there.
 */
export function GardenLine(day: {
  localDate: string
  /** The active butterfly's species, if one is flying. */
  speciesId?: string
  /** Whether the theme on screen is night. */
  night: boolean
  region?: RegionId
  /** The half of the world chosen where the region does not say it. */
  hemisphere?: Hemisphere
}) {
  return gardenLine(day)
}
