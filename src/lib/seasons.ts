import type { RegionId } from '../types'

/*
 * The garden's seasons (plan c.7). Kept small, since the garden reads it as it
 * first draws: the season's lines and the art each season will want are in
 * data/seasons, loaded with the garden's line (lib/gardenLines).
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type Hemisphere = 'north' | 'south'

/** In the order a year turns, from December's winter in the north. */
const SEASONS: readonly Season[] = ['winter', 'spring', 'summer', 'autumn']

/**
 * The season a month (1 to 12) falls in. Meteorological seasons, three whole
 * months each, as weather services count them: in the north, winter is
 * December to February and spring March to May. They turn on the first of a
 * month, never on a solstice or equinox that moves by a day from year to
 * year. The south's are the north's six months on: June is summer in the
 * north and winter in the south.
 */
export function seasonOf(month: number, hemisphere: Hemisphere): Season {
  return SEASONS[Math.floor(((month + (hemisphere === 'south' ? 6 : 0)) % 12) / 3)]
}

/** The season on a local calendar day ('2026-10-27', the app's one date shape). */
export function currentSeason(localDate: string, hemisphere: Hemisphere): Season {
  return seasonOf(Number(localDate.slice(5, 7)), hemisphere)
}

/**
 * Which half of the world a gardener's seasons follow, from the region they
 * chose by hand (lib/region): Australia and New Zealand are southern. With
 * no region, or Elsewhere, the garden cannot know, so it takes the north's.
 * That guess decides only what the scene shows (GardenView's `data-season`
 * for the art, and whether fireflies come out) and when Marigold, a monarch,
 * travels; no words say it of the gardener's own season (see knownSeason).
 */
export function hemisphereOf(region: RegionId | undefined): Hemisphere {
  return region === 'australasia' ? 'south' : 'north'
}

/**
 * The gardener's own season, for words that speak of it ("What is the first
 * sign of spring…?"), or nothing where the region does not say which half of
 * the world they garden in.
 */
export function knownSeason(region: RegionId | undefined, localDate: string): Season | undefined {
  return region === undefined || region === 'elsewhere'
    ? undefined
    : currentSeason(localDate, hemisphereOf(region))
}
