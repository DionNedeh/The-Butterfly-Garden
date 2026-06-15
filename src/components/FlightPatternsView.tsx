import { flightPatterns } from '../data/flightPatterns'
import type { AppState, FlightPatternId } from '../types'
import { Icon } from './Icons'

export function FlightPatternsView({
  state,
  onSelect,
}: {
  state: AppState
  onSelect: (patternId: FlightPatternId) => void
}) {
  return (
    <div className="view flight-patterns-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Garden movement</p>
          <h1>Flight Patterns</h1>
          <p>
            Choose one owned pattern for every butterfly in the garden.
            Their timing remains gently staggered.
          </p>
        </div>
      </header>
      <div className="pattern-selector-grid">
        {flightPatterns.map((pattern) => {
          const owned = state.ownedFlightPatternIds.includes(pattern.id)
          const selected = state.selectedFlightPatternId === pattern.id
          return (
            <button
              className={`card pattern-select-card ${selected ? 'selected' : ''}`}
              key={pattern.id}
              disabled={!owned}
              onClick={() => onSelect(pattern.id)}
              aria-pressed={selected}
            >
              <span className={`pattern-preview ${pattern.animationClass}`} aria-hidden="true">
                <span className="preview-flight-dot" />
              </span>
              <span className="pattern-select-copy">
                <strong>{pattern.name}</strong>
                <small>{pattern.description}</small>
                <em>
                  {selected ? 'Selected' : owned ? 'Owned - select pattern' : `Locked - ${pattern.cost} Nectar in Shop`}
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
