import { flightPatterns } from '../data/flightPatterns'
import { payFor, refuse, type PurchaseResult } from './purchase'
import type { AppState, CreatureInstance, FlightPatternId } from '../types'

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

/**
 * The pattern a butterfly flies: its own while the garden owns it, otherwise
 * the garden's. Asked whenever the garden is drawn rather than settled when
 * it is stored, so a companion's choice outlasts a pattern going unowned (a
 * restored or edited backup) and comes back with it.
 */
export function flightPatternFor(
  state: Pick<AppState, 'ownedFlightPatternIds' | 'selectedFlightPatternId'>,
  creature: Pick<CreatureInstance, 'flightPatternId'> | undefined,
): FlightPatternId {
  const own = creature?.flightPatternId
  return own !== undefined && state.ownedFlightPatternIds.includes(own)
    ? own
    : state.selectedFlightPatternId
}

/**
 * Give one companion a pattern of its own, or, with none, let it fly the
 * garden's again. Only a pattern the garden owns can be chosen; anything
 * else, or a companion that is not there, leaves the garden as it was.
 */
export function chooseCompanionFlight(
  state: AppState,
  creatureId: string,
  patternId: FlightPatternId | undefined,
): AppState {
  if (
    patternId !== undefined &&
    (!flightPatterns.some((pattern) => pattern.id === patternId) ||
      !state.ownedFlightPatternIds.includes(patternId))
  )
    return state
  const creature = state.creatures.find((item) => item.id === creatureId)
  if (!creature || creature.flightPatternId === patternId) return state
  const chosen = { ...creature, flightPatternId: patternId }
  // Back to the garden's pattern leaves no field behind, as before a choice.
  if (patternId === undefined) delete chosen.flightPatternId
  return {
    ...state,
    creatures: state.creatures.map((item) => (item === creature ? chosen : item)),
  }
}
