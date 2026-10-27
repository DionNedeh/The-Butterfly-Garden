import { flightPatterns } from '../data/flightPatterns'
import { payFor, refuse, type PurchaseResult } from './purchase'
import type { AppState, FlightPatternId } from '../types'

export const DEFAULT_FLIGHT_PATTERN_ID: FlightPatternId = 'gentle-drift'

/** Buy a flight pattern, and say how it went. Buying never equips it. */
export function buyFlightPattern(
  state: AppState,
  patternId: FlightPatternId,
): PurchaseResult {
  if (state.ownedFlightPatternIds.includes(patternId))
    return refuse(state, { kind: 'owned' })
  const pattern = flightPatterns.find((item) => item.id === patternId)
  if (!pattern || pattern.cost <= 0)
    return refuse(state, { kind: 'unavailable', reason: 'unknown' })
  return payFor(state, pattern, () => ({
    ownedFlightPatternIds: [...state.ownedFlightPatternIds, patternId],
  }))
}

/** The garden after buying a pattern, for callers that need no outcome. */
export function purchaseFlightPattern(
  state: AppState,
  patternId: FlightPatternId,
): AppState {
  return buyFlightPattern(state, patternId).state
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
