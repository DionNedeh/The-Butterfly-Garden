import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance, FlightPatternId } from '../types'
import { createEmptyState, createInitialState } from './progression'
import { flightPatterns } from '../data/flightPatterns'
import {
  chooseCompanionFlight,
  flightPatternFor,
  purchaseFlightPattern,
  selectFlightPattern,
} from './flightPatterns'

describe('flight pattern ownership', () => {
  it('purchases an affordable pattern without equipping it', () => {
    const state = { ...createEmptyState(), nectar: 18 }
    const purchased = purchaseFlightPattern(state, 'petal-hop')
    expect(purchased.nectar).toBe(9)
    expect(purchased.ownedFlightPatternIds).toContain('petal-hop')
    expect(purchased.selectedFlightPatternId).toBe('gentle-drift')
  })

  it('rejects insufficient funds and duplicate purchases', () => {
    const poor = purchaseFlightPattern(createEmptyState(), 'figure-eight')
    expect(poor).toEqual(createEmptyState())

    const owned = {
      ...createEmptyState(),
      nectar: 20,
      ownedFlightPatternIds: [
        'gentle-drift',
        'petal-hop',
      ] as FlightPatternId[],
    }
    expect(purchaseFlightPattern(owned, 'petal-hop')).toBe(owned)
  })

  it('prices premium patterns in Stardust and never Nectar', () => {
    const richInNectar = { ...createEmptyState(), nectar: 500, stardust: 0 }
    expect(purchaseFlightPattern(richInNectar, 'spiral-rise')).toBe(richInNectar)
    expect(purchaseFlightPattern(richInNectar, 'garden-waltz')).toBe(richInNectar)

    const stargazer = { ...createEmptyState(), nectar: 0, stardust: 8 }
    const bought = purchaseFlightPattern(stargazer, 'spiral-rise')
    expect(bought.ownedFlightPatternIds).toContain('spiral-rise')
    expect(bought.stardust).toBe(1)
    expect(bought.nectar).toBe(0)
  })

  it('selects only an owned pattern', () => {
    const state = { ...createEmptyState(), nectar: 9 }
    expect(selectFlightPattern(state, 'petal-hop')).toBe(state)
    const purchased = purchaseFlightPattern(state, 'petal-hop')
    expect(selectFlightPattern(purchased, 'petal-hop').selectedFlightPatternId).toBe(
      'petal-hop',
    )
  })
})

describe('the patterns added in 3.0', () => {
  const added: FlightPatternId[] = [
    'clover-meander',
    'breeze-glide',
    'blossom-bounce',
    'ribbon-loop',
    'moonbeam-float',
    'canopy-dance',
  ]

  it('buys each one with the currency it is priced in', () => {
    for (const id of added) {
      const pattern = flightPatterns.find((item) => item.id === id)
      expect(pattern).toBeDefined()
      const wallet =
        pattern?.currency === 'stardust'
          ? { stardust: pattern.cost, nectar: 0 }
          : { nectar: pattern?.cost ?? 0, stardust: 0 }
      const state = { ...createEmptyState(), ...wallet }
      const bought = purchaseFlightPattern(state, id)
      expect(bought.ownedFlightPatternIds).toContain(id)
      expect(bought.nectar + bought.stardust).toBe(0)
      // Buying never equips: the gardener chooses when to change.
      expect(bought.selectedFlightPatternId).toBe('gentle-drift')
    }
  })

  it('refuses each one a penny short', () => {
    for (const id of added) {
      const pattern = flightPatterns.find((item) => item.id === id)
      const short = Math.max(0, (pattern?.cost ?? 1) - 1)
      const wallet =
        pattern?.currency === 'stardust'
          ? { stardust: short, nectar: 999 }
          : { nectar: short, stardust: 999 }
      const state = { ...createEmptyState(), ...wallet }
      expect(purchaseFlightPattern(state, id)).toBe(state)
    }
  })

  it('selects and keeps each one', () => {
    for (const id of added) {
      const owned = {
        ...createEmptyState(),
        ownedFlightPatternIds: ['gentle-drift', id] as FlightPatternId[],
      }
      expect(selectFlightPattern(owned, id).selectedFlightPatternId).toBe(id)
    }
  })
})


describe('a flight of their own', () => {
  function gardenWith(
    creatures: Array<Partial<CreatureInstance>>,
    owned: FlightPatternId[] = ['gentle-drift', 'petal-hop', 'ribbon-loop'],
  ): AppState {
    const seed = createInitialState('Tester', 'Test Garden')
    return {
      ...seed,
      ownedFlightPatternIds: owned,
      selectedFlightPatternId: 'gentle-drift',
      creatures: creatures.map((creature, index) => ({
        ...seed.creatures[0],
        id: `c${index}`,
        name: `Flyer ${index}`,
        stage: 'butterfly',
        ...creature,
      })),
    }
  }

  it('flies its own pattern while the garden owns it, and the garden\'s otherwise', () => {
    const state = gardenWith([{ flightPatternId: 'petal-hop' }, {}])
    expect(flightPatternFor(state, state.creatures[0])).toBe('petal-hop')
    expect(flightPatternFor(state, state.creatures[1])).toBe('gentle-drift')
    expect(flightPatternFor(state, undefined)).toBe('gentle-drift')
  })

  it('keeps an unowned choice but flies the garden\'s until it is owned again', () => {
    const lapsed = gardenWith([{ flightPatternId: 'canopy-dance' }])
    expect(flightPatternFor(lapsed, lapsed.creatures[0])).toBe('gentle-drift')
    // Nothing is deleted: owning it again brings the choice back.
    const regained = {
      ...lapsed,
      ownedFlightPatternIds: [...lapsed.ownedFlightPatternIds, 'canopy-dance' as const],
    }
    expect(flightPatternFor(regained, regained.creatures[0])).toBe('canopy-dance')
  })

  it('gives one companion an owned pattern and leaves the others as they were', () => {
    const state = gardenWith([{}, {}])
    const next = chooseCompanionFlight(state, 'c1', 'ribbon-loop')
    expect(next).not.toBe(state)
    expect(next.creatures[1].flightPatternId).toBe('ribbon-loop')
    expect(next.creatures[0]).toBe(state.creatures[0])
    // Never in place: the garden it came from is untouched.
    expect(state.creatures[1]).not.toHaveProperty('flightPatternId')
    expect(next.selectedFlightPatternId).toBe('gentle-drift')
  })

  it('can choose the garden\'s own pattern, which then stays when the garden changes', () => {
    const state = gardenWith([{}])
    const pinned = chooseCompanionFlight(state, 'c0', 'gentle-drift')
    expect(pinned.creatures[0].flightPatternId).toBe('gentle-drift')
    const changed = selectFlightPattern(pinned, 'petal-hop')
    expect(flightPatternFor(changed, changed.creatures[0])).toBe('gentle-drift')
  })

  it('returns a companion to the garden\'s pattern without leaving a field behind', () => {
    const state = gardenWith([{ flightPatternId: 'petal-hop' }])
    const next = chooseCompanionFlight(state, 'c0', undefined)
    expect(next.creatures[0]).not.toHaveProperty('flightPatternId')
    expect(flightPatternFor(next, next.creatures[0])).toBe('gentle-drift')
  })

  it('refuses an unowned or unknown pattern, and changes nothing that is already so', () => {
    const state = gardenWith([{ flightPatternId: 'petal-hop' }, {}])
    expect(chooseCompanionFlight(state, 'c0', 'canopy-dance')).toBe(state)
    expect(chooseCompanionFlight(state, 'c0', 'loop-the-loop' as FlightPatternId)).toBe(state)
    // Unknown even when a hand-edited garden claims to own it.
    const claimed = gardenWith([{}], ['gentle-drift', 'loop-the-loop' as FlightPatternId])
    expect(chooseCompanionFlight(claimed, 'c0', 'loop-the-loop' as FlightPatternId)).toBe(claimed)
    expect(chooseCompanionFlight(state, 'missing', 'petal-hop')).toBe(state)
    expect(chooseCompanionFlight(state, 'c0', 'petal-hop')).toBe(state)
    expect(chooseCompanionFlight(state, 'c1', undefined)).toBe(state)
  })
})
