import type { AppState } from '../types'
import { breathSource } from './gardenActions'
import { countedInWords, listed } from './plural'

/** Companions named in a summary before it says how many instead. */
const NAMED_COMPANIONS = 2

/**
 * One day, said in words: "You checked in, finished two goals and cared for
 * Sol."
 *
 * The evening recap ends on this rather than a run of days in a row. The
 * evening is when a broken streak hurts most, and what happened today is
 * what the gardener can actually look back on. A day with none of it is
 * still a day got through, and is said so.
 */
export function describeDay(state: AppState, localDate: string): string {
  const parts: string[] = []
  // An entry written later for this day was written on another one: it
  // describes the day, but it is not something done that day.
  const doneThatDay = (entry: { localDate: string; writtenLater?: true }) =>
    entry.localDate === localDate && entry.writtenLater !== true
  if (state.moods.some(doneThatDay)) parts.push('checked in')
  if (state.reflections.some(doneThatDay)) parts.push('wrote a reflection')
  // A breathing session run to its end, as its Sunlight records it.
  if (state.sunlight.some((award) => award.source === breathSource(localDate)))
    parts.push('took time to breathe')
  const goals = state.completions.filter((item) => item.localDate === localDate).length
  if (goals > 0) parts.push(`finished ${countedInWords(goals, 'goal', 'goals')}`)
  const cared = state.creatures
    .filter((creature) =>
      Object.values(creature.careDates).some((dates) => dates?.includes(localDate)),
    )
    .map((creature) => creature.name)
  if (cared.length > 0)
    parts.push(
      `cared for ${
        cared.length <= NAMED_COMPANIONS
          ? listed(cared)
          : countedInWords(cared.length, 'companion', 'companions')
      }`,
    )
  return parts.length > 0
    ? `You ${listed(parts)}.`
    : 'You made it to the end of the day, and that counts.'
}
