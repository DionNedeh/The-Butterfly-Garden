import { describe, expect, it } from 'vitest'
import type { FlightPatternId } from '../types'
import { createEmptyState } from './progression'
import { purchaseFlightPattern, selectFlightPattern } from './flightPatterns'

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

  it('selects only an owned pattern', () => {
    const state = { ...createEmptyState(), nectar: 9 }
    expect(selectFlightPattern(state, 'petal-hop')).toBe(state)
    const purchased = purchaseFlightPattern(state, 'petal-hop')
    expect(selectFlightPattern(purchased, 'petal-hop').selectedFlightPatternId).toBe(
      'petal-hop',
    )
  })
})
