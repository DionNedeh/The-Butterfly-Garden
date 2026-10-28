import { nightLines } from '../data/nightLines'
import { observations } from '../data/observations'
import { marigoldLines, seasonLines } from '../data/seasons'
import type { RegionId } from '../types'
import { daysBetweenLocalDates, getDailyPromptIndex } from './date'
import type { MarkedRegion } from './regionMarks'
import { currentSeason, hemisphereOf } from './seasons'

/*
 * The garden's line under its name: the day's own (data/observations), the
 * night's (plan b G5), and one day in three what the season is doing (plan
 * c.7). Loaded with the garden's line (components/garden/GardenLine), not in
 * the first load every page waits for.
 */

const MARKED_REGIONS: readonly MarkedRegion[] = ['north-america', 'europe', 'australasia']

/**
 * Whether the line speaks of the season on this day: one day in three, so
 * the other days keep the lines they have always had.
 */
export function isSeasonDay(localDate: string): boolean {
  return getDailyPromptIndex(localDate, 3) === 0
}

/**
 * The day's own line, chosen as it always has been: from the active
 * butterfly's lines and those any garden says, one a day.
 */
export function dayLine(speciesId: string | undefined, localDate: string): string {
  const choices = observations.filter(
    (item) => item.speciesId === 'all' || item.speciesId === speciesId,
  )
  return choices[getDailyPromptIndex(localDate, choices.length)].text
}

/**
 * The night's line: the active butterfly's own and those any garden says,
 * chosen by the day as the day's lines are, so it holds still all night.
 */
export function nightLine(speciesId: string | undefined, localDate: string): string {
  const choices = nightLines.filter(([id]) => id === 'all' || id === speciesId)
  return choices[getDailyPromptIndex(localDate, choices.length)][1]
}

/**
 * Marigold in her season, by the gardener's half of the world: getting
 * ready to travel in autumn, back in spring. Words only; she never leaves.
 * With no region known she follows the north, where her kind's long flight
 * is, and says nothing of the gardener's own season.
 */
export function marigoldLine(region: RegionId | undefined, localDate: string): string | undefined {
  const hemisphere = hemisphereOf(region)
  return marigoldLines[hemisphere][currentSeason(localDate, hemisphere)]
}

/**
 * Every line the season could bring on a day: the gardener's region's, in its
 * own season, and Marigold's. Without a region, or for Elsewhere, the lines of
 * every region in each one's own season: each names its place, so each is
 * true wherever the gardener is, and none guesses their season.
 */
export function seasonLinesFor(region: RegionId | undefined, localDate: string): string[] {
  const places = region === undefined || region === 'elsewhere' ? MARKED_REGIONS : [region]
  const lines = seasonLines
    .filter(
      (line) =>
        places.includes(line.region) &&
        line.season === currentSeason(localDate, hemisphereOf(line.region)),
    )
    .map((line) => line.text)
  const marigold = marigoldLine(region, localDate)
  return marigold ? [...lines, marigold] : lines
}

/**
 * The season's line for a day. Season days come every third day, so they are
 * counted in threes: each one moves on to the next line, rather than landing
 * on the same few as the day count would.
 */
export function seasonLine(region: RegionId | undefined, localDate: string): string {
  const choices = seasonLinesFor(region, localDate)
  const turn = Math.floor(daysBetweenLocalDates('1970-01-01', localDate) / 3)
  return choices[turn % choices.length]
}

/**
 * The garden's line: the season's on a season day, by day and by night (none
 * of them speaks of the sun), else the night's at night and the day's by day.
 */
export function gardenLine({
  localDate,
  speciesId,
  night,
  region,
}: {
  localDate: string
  /** The active butterfly's species, if one is flying. */
  speciesId?: string
  /** Whether the theme on screen is night. */
  night: boolean
  region?: RegionId
}): string {
  if (isSeasonDay(localDate)) return seasonLine(region, localDate)
  return night ? nightLine(speciesId, localDate) : dayLine(speciesId, localDate)
}
