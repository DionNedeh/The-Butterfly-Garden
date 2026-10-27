import type { AppState, CreatureInstance, Goal } from '../types'
import { retiredOnceGoalIds } from './date'

/**
 * Which goals a companion can be grown alongside, and which companions each
 * goal is growing, as Today and Care show them (plan c.3). The rules that
 * change the garden are in lib/lifecycle; these only read it, and load with
 * the pages that use them rather than with the garden.
 */

/**
 * The goals a companion can be grown alongside, in the gardener's order:
 * those still in use. Not an archived goal, which has been set aside, nor a
 * one-time goal done on an earlier day, which will not come round again.
 */
export function goalsToGrowAlongside(
  state: Pick<AppState, 'goals' | 'completions'>,
  today: string,
): Goal[] {
  const retired = retiredOnceGoalIds(state.completions, today)
  return state.goals.filter(
    (goal) => !goal.archived && !(goal.schedule === 'once' && retired.has(goal.id)),
  )
}

/**
 * The names of the companions each goal is growing, by goal id, in the
 * garden's order. A butterfly has grown, so it is never among them.
 */
export function companionsByGoal(
  creatures: readonly CreatureInstance[],
): Map<string, string[]> {
  const names = new Map<string, string[]>()
  for (const creature of creatures) {
    const goalId = creature.adoptedGoalId
    if (!goalId || creature.stage === 'butterfly') continue
    names.set(goalId, [...(names.get(goalId) ?? []), creature.name])
  }
  return names
}
