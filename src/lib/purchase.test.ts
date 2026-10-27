import { describe, expect, it } from 'vitest'
import { JAR_CAPACITY, JAR_PRICE } from '../data/jars'
import type { AppState } from '../types'
import { buyFlightPattern } from './flightPatterns'
import { buyJar } from './jars'
import { createEmptyState } from './progression'
import { payFor, refuse } from './purchase'
import { buyShopItem } from './wardrobe'

function garden(overrides: Partial<AppState> = {}): AppState {
  return { ...createEmptyState(), ...overrides }
}

describe('paying for something', () => {
  it('takes the price from the right balance and hands over the goods', () => {
    const state = garden({ nectar: 10, stardust: 10 })
    const nectar = payFor(state, { cost: 4, currency: 'nectar' }, () => ({ seeds: 1 }))
    expect(nectar.state).toMatchObject({ nectar: 6, stardust: 10, seeds: 1 })
    expect(nectar.outcome).toEqual({ kind: 'bought', quantity: 1, spent: 4, currency: 'nectar' })

    const stardust = payFor(state, { cost: 10, currency: 'stardust', quantity: 2 }, () => ({}))
    expect(stardust.state).toMatchObject({ nectar: 10, stardust: 0 })
    expect(stardust.outcome).toMatchObject({ quantity: 2, spent: 10 })
  })

  it('refuses the whole of a price it cannot cover, before making anything', () => {
    const state = garden({ nectar: 3 })
    let made = false
    const result = payFor(state, { cost: 5, currency: 'nectar' }, () => {
      made = true
      return {}
    })
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({ kind: 'short', currency: 'nectar', needed: 2 })
    expect(made).toBe(false)
  })

  it('refuses with the very same garden', () => {
    const state = garden()
    expect(refuse(state, { kind: 'owned' })).toEqual({ state, outcome: { kind: 'owned' } })
    expect(refuse(state, { kind: 'owned' }).state).toBe(state)
  })
})

describe('buying from the shop', () => {
  it('buys one supply into the satchel', () => {
    const { state, outcome } = buyShopItem(garden({ nectar: 10 }), 'leaf-bundle')
    expect(state.inventory['leaf-bundle']).toBe(1)
    expect(state.nectar).toBe(8)
    expect(outcome).toEqual({ kind: 'bought', quantity: 1, spent: 2, currency: 'nectar' })
  })

  it('buys three or five supplies at once, priced exactly', () => {
    const three = buyShopItem(garden({ nectar: 9, inventory: { 'berry-treat': 2 } }), 'berry-treat', 3)
    expect(three.state.inventory['berry-treat']).toBe(5)
    expect(three.state.nectar).toBe(0)
    expect(three.outcome).toEqual({ kind: 'bought', quantity: 3, spent: 9, currency: 'nectar' })

    const five = buyShopItem(garden({ nectar: 10 }), 'leaf-bundle', 5)
    expect(five.state.inventory['leaf-bundle']).toBe(5)
    expect(five.state.nectar).toBe(0)
  })

  it('refuses the whole lot, not part of it, when the balance falls short', () => {
    const state = garden({ nectar: 9 })
    const result = buyShopItem(state, 'leaf-bundle', 5)
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({ kind: 'short', currency: 'nectar', needed: 1 })
  })

  it('says which currency a Stardust piece needs, and how much more', () => {
    const state = garden({ nectar: 999, stardust: 2 })
    const result = buyShopItem(state, 'star-diadem')
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({ kind: 'short', currency: 'stardust', needed: 4 })
  })

  it('buys a cosmetic once, and says so when asked again', () => {
    const once = buyShopItem(garden({ nectar: 100 }), 'silk-bow')
    expect(once.outcome).toMatchObject({ kind: 'bought', quantity: 1, spent: 10 })
    const twice = buyShopItem(once.state, 'silk-bow')
    expect(twice.state).toBe(once.state)
    expect(twice.outcome).toEqual({ kind: 'owned' })
  })

  it('sells a cosmetic one at a time', () => {
    const state = garden({ nectar: 100 })
    const result = buyShopItem(state, 'silk-bow', 3)
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({ kind: 'unavailable', reason: 'unknown' })
  })

  it('says a Garden Pass piece comes with the Pass, whatever the balance', () => {
    const state = garden({ nectar: 999, stardust: 999 })
    const result = buyShopItem(state, 'royal-crown')
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({ kind: 'unavailable', reason: 'pass' })
  })

  it('refuses what the shop does not sell, and quantities that are not whole', () => {
    const state = garden({ nectar: 999 })
    for (const [id, quantity] of [
      ['no-such-thing', 1],
      ['leaf-bundle', 0],
      ['leaf-bundle', -3],
      ['leaf-bundle', 1.5],
    ] as const) {
      const result = buyShopItem(state, id, quantity)
      expect(result.state).toBe(state)
      expect(result.outcome).toEqual({ kind: 'unavailable', reason: 'unknown' })
    }
  })
})

describe('buying a flight pattern', () => {
  it('buys one not owned yet', () => {
    const { state, outcome } = buyFlightPattern(garden({ stardust: 8 }), 'spiral-rise')
    expect(state.ownedFlightPatternIds).toContain('spiral-rise')
    expect(outcome).toEqual({ kind: 'bought', quantity: 1, spent: 7, currency: 'stardust' })
  })

  it('says how much more one needs', () => {
    const state = garden({ nectar: 5 })
    const result = buyFlightPattern(state, 'petal-hop')
    expect(result.state).toBe(state)
    expect(result.outcome).toEqual({ kind: 'short', currency: 'nectar', needed: 4 })
  })

  it('says when one is owned already, the free one included', () => {
    const state = garden({ nectar: 100 })
    expect(buyFlightPattern(state, 'gentle-drift')).toEqual({ state, outcome: { kind: 'owned' } })
  })

  it('refuses one the shop does not sell', () => {
    const state = garden({ nectar: 100, ownedFlightPatternIds: [] })
    expect(buyFlightPattern(state, 'gentle-drift').outcome).toEqual({
      kind: 'unavailable',
      reason: 'unknown',
    })
  })
})

describe('buying a jar', () => {
  const now = new Date('2026-06-03T12:00:00.000Z')

  it('buys one for its price', () => {
    const { state, outcome } = buyJar(garden({ nectar: JAR_PRICE }), 'q', 'pink', now)
    expect(state.jars).toMatchObject([{ character: 'Q', colorId: 'pink' }])
    expect(outcome).toEqual({ kind: 'bought', quantity: 1, spent: JAR_PRICE, currency: 'nectar' })
  })

  it('says how much more Nectar one needs', () => {
    const state = garden({ nectar: 2 })
    expect(buyJar(state, 'A', 'blue', now)).toEqual({
      state,
      outcome: { kind: 'short', currency: 'nectar', needed: JAR_PRICE - 2 },
    })
  })

  it('says when the shelf is full, before counting the Nectar', () => {
    const jars = Array.from({ length: JAR_CAPACITY }, (_, index) => ({
      id: `j${index}`,
      character: 'A',
      colorId: 'blue' as const,
      purchasedAt: now.toISOString(),
    }))
    const state = garden({ nectar: 0, jars })
    expect(buyJar(state, 'A', 'blue', now)).toEqual({
      state,
      outcome: { kind: 'unavailable', reason: 'full' },
    })
  })

  it('refuses a letter or colour the shop does not make', () => {
    const state = garden({ nectar: 100 })
    expect(buyJar(state, '~', 'blue', now).outcome).toEqual({ kind: 'unavailable', reason: 'unknown' })
    expect(buyJar(state, 'A', 'tartan' as 'blue', now).state).toBe(state)
  })
})
