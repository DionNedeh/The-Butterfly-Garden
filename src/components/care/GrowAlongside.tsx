import { useId, useState } from 'react'
import { goalsToGrowAlongside } from '../../lib/growAlongside'
import { counted } from '../../lib/plural'
import type { AppState, CreatureInstance } from '../../types'

/**
 * Grow a companion alongside one of the gardener's goals (plan c.3): each day
 * the goal is completed on Today counts as a day of care for its stage. Shown
 * while it grows; a butterfly's goal lives on in its story. Choosing acts at
 * once, like the flight a butterfly is given here, and is as easily changed
 * back. Nothing is shown when there is no goal to choose. CareView keys it
 * by companion.
 */
export function GrowAlongside({
  state,
  today,
  creature,
  onAdopt,
}: {
  state: Pick<AppState, 'goals' | 'completions'>
  today: string
  creature: CreatureInstance
  onAdopt: (creatureId: string, goalId: string | undefined) => void
}) {
  const id = useId()
  const offered = goalsToGrowAlongside(state, today)
  const linked = state.goals.find((goal) => goal.id === creature.adoptedGoalId)
  // The goal it is grown alongside stays in the list even once it will not
  // come round again, so the choice always shows what is kept.
  const goals = linked && !offered.includes(linked) ? [...offered, linked] : offered
  // Once offered, the choice stays even when its last goal leaves the list
  // (a one-time goal done before, let go here), so the focus is not lost.
  const [shown, setShown] = useState(goals.length > 0)
  if (goals.length > 0 && !shown) setShown(true)
  if (goals.length === 0 && !shown) return null
  const days = linked
    ? (creature.grownAlongside?.find((entry) => entry.goalId === linked.id)?.dates.length ?? 0)
    : 0

  return (
    <div className="grow-alongside">
      <label htmlFor={id}>Grow alongside a goal</label>
      <select
        id={id}
        value={linked?.id ?? ''}
        aria-describedby={`${id}-note`}
        onChange={(event) => onAdopt(creature.id, event.target.value || undefined)}
      >
        <option value="">None</option>
        {goals.map((goal) => (
          <option key={goal.id} value={goal.id}>
            {goal.title}
          </option>
        ))}
      </select>
      <p className="grow-alongside-note" id={`${id}-note`}>
        {linked
          ? `Each day you complete ${linked.title} on Today counts as a day of care for ${creature.name}.`
          : `Choose a goal, and each day you complete it on Today counts as a day of care for ${creature.name}.`}
        {days > 0 && ` ${counted(days, 'day', 'days')} so far.`}
      </p>
    </div>
  )
}
