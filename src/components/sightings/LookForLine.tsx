import { localDateToNoon } from '../../lib/date'
import { lookForThisMonth } from '../../lib/whatToLookFor'
import type { RegionId } from '../../types'

const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' })

/**
 * "What to look for in October": one gentle, sourced line for the month
 * where the gardener said they garden (data/whatToLookFor). Nothing without
 * a region, or for Elsewhere, whose seasons the garden cannot know.
 */
export function LookForLine({ region, today }: { region?: RegionId; today: string }) {
  const line = lookForThisMonth(region, today)
  if (!line) return null
  return (
    <p className="look-for">
      <span className="eyebrow">What to look for in {monthName.format(localDateToNoon(today))}</span>
      {line.text}
    </p>
  )
}
