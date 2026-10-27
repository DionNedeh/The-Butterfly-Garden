import { useId, useState } from 'react'
import { getSpecies, nameInUse, nameToOffer } from '../lib/progression'
import type { CreatureInstance, Goal } from '../types'

/**
 * An offer to name an egg the garden has just found. It sits in the page
 * rather than over it: the egg already has a name no other companion has, so
 * doing nothing is a fine answer, and the offer lapses by itself once the egg
 * hatches. Either button answers it, so it is never made twice.
 *
 * With goals on Today, it also offers to grow the egg alongside one (plan
 * c.3). Either button takes that choice with the name; "Not now" leaves the
 * egg to the care menu, and Care offers the same choice whenever it grows.
 */
export function NameArrival({
  arrival,
  creatures,
  goals = [],
  onName,
  onGrowAlongside,
}: {
  arrival: CreatureInstance
  creatures: readonly CreatureInstance[]
  /** The goals it could be grown alongside; none, and nothing is offered. */
  goals?: readonly Pick<Goal, 'id' | 'title'>[]
  /** Called with the chosen name, which is the arrival's own when it is kept. */
  onName: (name: string) => void
  /** Called before onName with a goal chosen to grow it alongside, if any. */
  onGrowAlongside?: (goalId: string) => void
}) {
  const [draft, setDraft] = useState(() => nameToOffer(creatures, arrival.id))
  const [goalId, setGoalId] = useState('')
  const id = useId()
  // A goal chosen goes with whichever answer is given, so keeping the name
  // does not quietly drop it.
  const answer = (name: string) => {
    if (goalId && goals.some((goal) => goal.id === goalId)) onGrowAlongside?.(goalId)
    onName(name)
  }
  const species = getSpecies(arrival.speciesId)?.commonName.toLowerCase() ?? 'butterfly'
  const chosen = draft.trim()
  // Two companions may share a name if the gardener wants that; this only
  // makes sure it is a choice, not an accident.
  const shared = chosen !== '' && nameInUse(creatures, chosen, arrival.id)

  return (
    <section className="card arrival-card" aria-labelledby={`${id}-title`}>
      <p className="eyebrow">A new arrival</p>
      <h2 id={`${id}-title`}>Would you like to name your {species} egg?</h2>
      <p className="section-explainer">
        For now it is called {arrival.name}. Choose a name of your own or keep
        this one; you can change it whenever you like.
      </p>
      <form
        className="arrival-form"
        onSubmit={(event) => {
          event.preventDefault()
          // An emptied field keeps the name the egg already has.
          answer(chosen || arrival.name)
        }}
      >
        <label>
          Name
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={40}
            autoComplete="off"
            aria-describedby={shared ? `${id}-shared` : undefined}
          />
        </label>
        {goals.length > 0 && onGrowAlongside && (
          <>
            <label>
              Grow alongside a goal
              <select
                value={goalId}
                onChange={(event) => setGoalId(event.target.value)}
                aria-describedby={`${id}-grow`}
              >
                <option value="">Not now</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="arrival-note" id={`${id}-grow`}>
              Each day you complete it on Today counts as a day of care, beside
              the care menu.
            </p>
          </>
        )}
        <div className="arrival-actions">
          <button className="primary-button" type="submit">
            Save name
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => answer(arrival.name)}
          >
            Keep {arrival.name}
          </button>
        </div>
        {shared && (
          <p className="arrival-note" id={`${id}-shared`}>
            Another companion is already called {chosen}. Two can share a name
            if you like.
          </p>
        )}
      </form>
    </section>
  )
}
