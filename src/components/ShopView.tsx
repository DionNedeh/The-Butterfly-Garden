import { flightPatterns } from '../data/flightPatterns'
import type { AppState, FlightPatternId } from '../types'
import { Icon } from './Icons'

export function ShopView({
  state,
  onPurchase,
}: {
  state: AppState
  onPurchase: (patternId: FlightPatternId) => void
}) {
  const patterns = flightPatterns.filter((pattern) => pattern.cost > 0)
  return (
    <div className="view shop-view">
      <header className="page-header">
        <div>
          <p className="eyebrow">Nectar shop</p>
          <h1>Collect new ways to fly</h1>
          <p>
            Every Sunlight earns 3 Nectar. Purchased patterns stay in this
            garden and can be equipped from Flight Patterns.
          </p>
        </div>
        <div className="nectar-wallet large" aria-label={`${state.nectar} Nectar`}>
          <Icon name="nectar" />
          <strong>{state.nectar}</strong>
          <span>Nectar</span>
        </div>
      </header>

      <div className="shop-grid">
        {patterns.map((pattern) => {
          const owned = state.ownedFlightPatternIds.includes(pattern.id)
          const affordable = state.nectar >= pattern.cost
          return (
            <article className="card pattern-card" key={pattern.id}>
              <div className={`pattern-preview ${pattern.animationClass}`} aria-hidden="true">
                <span className="preview-flight-dot" />
              </div>
              <p className="eyebrow">Flight pattern</p>
              <h2>{pattern.name}</h2>
              <p>{pattern.description}</p>
              <div className="pattern-card-footer">
                <span className="pattern-cost">
                  <Icon name="nectar" size={18} />
                  {pattern.cost}
                </span>
                <button
                  className={owned ? 'secondary-button' : 'primary-button'}
                  disabled={owned || !affordable}
                  onClick={() => onPurchase(pattern.id)}
                >
                  {owned ? 'Owned' : affordable ? `Buy ${pattern.name}` : 'Not enough Nectar'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
