import { flightPatterns } from '../data/flightPatterns'
import { currencyLabel } from '../lib/currency'
import { flightPatternFor } from '../lib/flightPatterns'
import { counted, listed } from '../lib/plural'
import type { AppState, FlightPatternId } from '../types'
import { FlightPreview } from './FlyingButterfly'
import { Icon } from './Icons'
import { motionPreference } from '../lib/motion'

export function FlightPatternsView({
  state,
  onSelect,
}: {
  state: AppState
  onSelect: (patternId: FlightPatternId) => void
}) {
  // The companions flying a pattern of their own, by pattern. Those flying
  // the garden's go unlisted: that is everyone else.
  const ownFlyers = new Map<FlightPatternId, string[]>()
  for (const creature of state.creatures) {
    if (creature.stage !== 'butterfly') continue
    const pattern = flightPatternFor(state, creature)
    if (creature.flightPatternId !== pattern) continue
    ownFlyers.set(pattern, [...(ownFlyers.get(pattern) ?? []), creature.name])
  }
  return (
    <div className="view flight-patterns-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Garden movement</p>
          <h1>Flight Patterns</h1>
          <p>
            Choose the pattern the garden flies. Any companion can have one of
            its own instead, chosen on the Care page.
          </p>
        </div>
      </header>
      <div className="pattern-selector-grid">
        {flightPatterns.map((pattern) => {
          const owned = state.ownedFlightPatternIds.includes(pattern.id)
          const selected = state.selectedFlightPatternId === pattern.id
          const flyers = ownFlyers.get(pattern.id) ?? []
          return (
            <button
              className={`card pattern-select-card ${selected ? 'selected' : ''}`}
              key={pattern.id}
              disabled={!owned}
              onClick={() => onSelect(pattern.id)}
              aria-pressed={selected}
            >
              <FlightPreview
                pattern={pattern.id}
                reduced={state.profile?.reducedMotion}
                calm={motionPreference(state.profile) === 'calm'}
              />
              <span className="pattern-select-copy">
                <strong>{pattern.name}</strong>
                <small>{pattern.description}</small>
                {flyers.length > 0 && (
                  <small>
                    Flown by{' '}
                    {flyers.length > 3
                      ? listed([...flyers.slice(0, 2), counted(flyers.length - 2, 'other', 'others')])
                      : listed(flyers)}
                  </small>
                )}
                <em>
                  {selected
                    ? 'Selected'
                    : owned
                      ? 'Owned - select pattern'
                      : `Locked - ${pattern.cost} ${currencyLabel(pattern.currency)} in Shop`}
                </em>
              </span>
              {selected && <Icon name="flight" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
