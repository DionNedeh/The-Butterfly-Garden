import { whatToLookFor, type MonthLine, type Season } from '../data/whatToLookFor'
import type { RegionId } from '../types'
import type { MarkedRegion } from './regionMarks'

export type Hemisphere = 'north' | 'south'

/** Which half of the world each region's seasons follow. */
export const HEMISPHERES: Readonly<Record<MarkedRegion, Hemisphere>> = {
  'north-america': 'north',
  europe: 'north',
  australasia: 'south',
}

/** The north's seasons, January first, three months each by the calendar. */
const NORTHERN_SEASONS: readonly Season[] = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'autumn',
  'autumn',
  'autumn',
  'winter',
]

const OPPOSITE: Readonly<Record<Season, Season>> = {
  winter: 'summer',
  spring: 'autumn',
  summer: 'winter',
  autumn: 'spring',
}

/** The season a month (1 to 12) falls in, in a hemisphere: June is winter in the south. */
export function seasonOf(month: number, hemisphere: Hemisphere): Season {
  const north = NORTHERN_SEASONS[month - 1]
  return hemisphere === 'north' ? north : OPPOSITE[north]
}

/**
 * What to look for this month, where the gardener said they garden, or
 * nothing: without a region, or for "Elsewhere", whose hemisphere, and so
 * whose seasons, the garden cannot know.
 */
export function lookForThisMonth(
  region: RegionId | undefined,
  localDate: string,
): MonthLine | undefined {
  if (region === undefined || region === 'elsewhere') return undefined
  const month = Number(localDate.slice(5, 7))
  return whatToLookFor[region].find((line) => line.months.includes(month))
}
