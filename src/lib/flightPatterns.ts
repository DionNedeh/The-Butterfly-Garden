import { flightPatterns } from '../data/flightPatterns'
import type { AppState, FlightPatternId } from '../types'

export const DEFAULT_FLIGHT_PATTERN_ID: FlightPatternId = 'gentle-drift'

export function purchaseFlightPattern(
  state: AppState,
  patternId: FlightPatternId,
): AppState {
  if (state.ownedFlightPatternIds.includes(patternId)) return state
  const pattern = flightPatterns.find((item) => item.id === patternId)
  if (!pattern || pattern.cost <= 0 || state.nectar < pattern.cost) return state
  return {
    ...state,
    nectar: state.nectar - pattern.cost,
    ownedFlightPatternIds: [...state.ownedFlightPatternIds, patternId],
  }
}

export function selectFlightPattern(
  state: AppState,
  patternId: FlightPatternId,
): AppState {
  if (!state.ownedFlightPatternIds.includes(patternId)) return state
  return state.selectedFlightPatternId === patternId
    ? state
    : { ...state, selectedFlightPatternId: patternId }
}
