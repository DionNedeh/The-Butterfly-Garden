import { whatToLookFor, type MonthLine } from '../data/whatToLookFor'
import type { RegionId } from '../types'

/**
 * What to look for this month, where the gardener said they garden, or
 * nothing: without a region, or for "Elsewhere", whose hemisphere, and so
 * whose seasons, the garden cannot know. Each line's season is the one its
 * months are where it is said (lib/seasons; checked by the tests).
 */
export function lookForThisMonth(
  region: RegionId | undefined,
  localDate: string,
): MonthLine | undefined {
  if (region === undefined || region === 'elsewhere') return undefined
  const month = Number(localDate.slice(5, 7))
  return whatToLookFor[region].find((line) => line.months.includes(month))
}
