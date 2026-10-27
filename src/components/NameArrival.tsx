import { useId, useState } from 'react'
import { getSpecies, nameInUse, nameToOffer } from '../lib/progression'
import type { CreatureInstance } from '../types'

/**
 * An offer to name an egg the garden has just found. It sits in the page
 * rather than over it: the egg already has a name no other companion has, so
 * doing nothing is a fine answer, and the offer lapses by itself once the egg
 * hatches. Either button answers it, so it is never made twice.
 */
export function NameArrival({
  arrival,
  creatures,
  onName,
}: {
  arrival: CreatureInstance
  creatures: readonly CreatureInstance[]
  /** Called with the chosen name, which is the arrival's own when it is kept. */
  onName: (name: string) => void
}) {
  const [draft, setDraft] = useState(() => nameToOffer(creatures, arrival.id))
  const id = useId()
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
          onName(chosen || arrival.name)
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
        <div className="arrival-actions">
          <button className="primary-button" type="submit">
            Save name
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onName(arrival.name)}
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
