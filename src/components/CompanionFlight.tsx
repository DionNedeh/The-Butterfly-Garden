import { flightPatterns } from '../data/flightPatterns'
import { flightPatternFor } from '../lib/flightPatterns'
import type { AppState, CreatureInstance, FlightPatternId } from '../types'
import './companionFlight.css'

/**
 * How one companion flies in the garden: the garden's pattern, or one of the
 * owned patterns as its own. Choosing a pattern by name keeps it even when
 * the garden's changes; "Garden default" follows the garden.
 */
export function CompanionFlight({
  state,
  creature,
  onChoose,
}: {
  state: Pick<AppState, 'ownedFlightPatternIds' | 'selectedFlightPatternId'>
  creature: CreatureInstance
  onChoose: (creatureId: string, patternId: FlightPatternId | undefined) => void
}) {
  const gardenPattern =
    flightPatterns.find((pattern) => pattern.id === state.selectedFlightPatternId) ??
    flightPatterns[0]
  const owned = flightPatterns.filter((pattern) =>
    state.ownedFlightPatternIds.includes(pattern.id),
  )
  // A pattern of its own that is no longer owned is flown as the garden's,
  // so that is what the choice shows; the stored choice is left alone.
  const flies = flightPatternFor(state, creature)
  const value = creature.flightPatternId === flies ? flies : ''
  const id = `companion-flight-${creature.id}`
  return (
    <div className="companion-flight">
      <label htmlFor={id}>Flight</label>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChoose(
            creature.id,
            event.target.value === '' ? undefined : (event.target.value as FlightPatternId),
          )
        }
      >
        <option value="">Garden default ({gardenPattern.name})</option>
        {owned.map((pattern) => (
          <option key={pattern.id} value={pattern.id}>
            {pattern.name}
          </option>
        ))}
      </select>
    </div>
  )
}
