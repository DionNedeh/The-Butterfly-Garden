import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance } from '../types'
import { createEmptyState } from './progression'
import {
  BOND_PER_LEVEL,
  EMERGENCE_SEED_REWARD,
  EMERGENCE_STARDUST_REWARD,
  performCare,
  readyToAdvance,
  STAGE_CARE_DAYS,
} from './lifecycle'
import {
  equipOutfitItem,
  purchaseShopItem,
  unequipOutfitSlot,
  visibleOutfit,
} from './wardrobe'

function makeCreature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: 'creature-1',
    speciesId: 'monarch',
    name: 'Sol',
    stage: 'egg',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...createEmptyState(),
    creatures: [makeCreature()],
    ...overrides,
  }
}

describe('life cycle care', () => {
  it('records one care day per local date no matter how many actions run', () => {
    const day = new Date(2026, 5, 10, 9)
    let state = makeState()
    state = performCare(state, 'creature-1', 'egg-warm', day).state
    state = performCare(state, 'creature-1', 'egg-song', day).state
    state = performCare(state, 'creature-1', 'egg-watch', day).state
    expect(state.creatures[0].careDates.egg).toEqual(['2026-06-10'])
    expect(state.creatures[0].stage).toBe('egg')
  })

  it('blocks repeating the same action on the same day', () => {
    const day = new Date(2026, 5, 10, 9)
    const once = performCare(makeState(), 'creature-1', 'egg-warm', day)
    const twice = performCare(once.state, 'creature-1', 'egg-warm', day)
    expect(once.performed).toBe(true)
    expect(twice.performed).toBe(false)
  })

  it('rejects actions from a different life stage', () => {
    const result = performCare(
      makeState(),
      'creature-1',
      'cat-feed',
      new Date(2026, 5, 10, 9),
    )
    expect(result.performed).toBe(false)
  })

  it('advances after three care days, even with gaps between them', () => {
    let state = makeState()
    state = performCare(state, 'creature-1', 'egg-warm', new Date(2026, 5, 1)).state
    state = performCare(state, 'creature-1', 'egg-warm', new Date(2026, 5, 4)).state
    expect(state.creatures[0].stage).toBe('egg')
    expect(readyToAdvance(state.creatures[0])).toBe(false)
    const third = performCare(
      state,
      'creature-1',
      'egg-warm',
      new Date(2026, 5, 9),
    )
    expect(third.advancedTo).toBe('caterpillar')
    expect(third.state.creatures[0].stage).toBe('caterpillar')
    expect(third.state.creatures[0].careDates.egg).toHaveLength(STAGE_CARE_DAYS)
  })

  it('walks the full cycle egg to butterfly with rewards on emergence', () => {
    let state = makeState()
    const care = (actionId: string, day: number) => {
      state = performCare(
        state,
        'creature-1',
        actionId,
        new Date(2026, 5, day),
      ).state
    }
    care('egg-warm', 1)
    care('egg-warm', 2)
    care('egg-warm', 3)
    expect(state.creatures[0].stage).toBe('caterpillar')
    care('cat-play', 4)
    care('cat-play', 5)
    care('cat-play', 6)
    expect(state.creatures[0].stage).toBe('chrysalis')
    care('chr-sun', 7)
    care('chr-sun', 8)
    const beforeSeeds = state.seeds
    const beforeStardust = state.stardust
    care('chr-sun', 9)
    expect(state.creatures[0].stage).toBe('butterfly')
    expect(state.creatures[0].emergedAt).toBeDefined()
    expect(state.seeds).toBe(beforeSeeds + EMERGENCE_SEED_REWARD)
    expect(state.stardust).toBe(beforeStardust + EMERGENCE_STARDUST_REWARD)
  })

  it('butterflies keep collecting care days without advancing', () => {
    let state = makeState({
      creatures: [makeCreature({ stage: 'butterfly' })],
    })
    for (let day = 1; day <= 5; day += 1) {
      state = performCare(
        state,
        'creature-1',
        'but-groom',
        new Date(2026, 5, day),
      ).state
    }
    expect(state.creatures[0].stage).toBe('butterfly')
    expect(state.creatures[0].careDates.butterfly).toHaveLength(5)
  })

  it('consumes a supply for supply-based actions and blocks when out', () => {
    const day = new Date(2026, 5, 10, 9)
    const state = makeState({
      creatures: [makeCreature({ stage: 'caterpillar' })],
      inventory: { 'leaf-bundle': 1 },
    })
    const fed = performCare(state, 'creature-1', 'cat-feed', day)
    expect(fed.performed).toBe(true)
    expect(fed.state.inventory['leaf-bundle']).toBe(0)
    const hungryAgain = performCare(
      fed.state,
      'creature-1',
      'cat-feed',
      new Date(2026, 5, 11, 9),
    )
    expect(hungryAgain.performed).toBe(false)
  })

  it('grants Stardust and Nectar at each bond level', () => {
    const state = makeState({
      creatures: [
        makeCreature({ stage: 'butterfly', bond: BOND_PER_LEVEL - 1 }),
      ],
    })
    const result = performCare(
      state,
      'creature-1',
      'but-groom',
      new Date(2026, 5, 10, 9),
    )
    expect(result.bondLevelsGained).toBe(1)
    expect(result.state.stardust).toBe(1)
    expect(result.state.nectar).toBeGreaterThan(state.nectar)
  })
})

describe('shop purchases and wardrobe', () => {
  it('buys supplies into the inventory and spends Nectar', () => {
    const state = makeState({ nectar: 10 })
    const bought = purchaseShopItem(state, 'leaf-bundle')
    expect(bought.inventory['leaf-bundle']).toBe(1)
    expect(bought.nectar).toBeLessThan(10)
  })

  it('refuses purchases without enough currency', () => {
    const state = makeState({ nectar: 0 })
    expect(purchaseShopItem(state, 'leaf-bundle')).toBe(state)
  })

  it('buys a cosmetic once and never twice', () => {
    const state = makeState({ nectar: 100 })
    const once = purchaseShopItem(state, 'silk-bow')
    const twice = purchaseShopItem(once, 'silk-bow')
    expect(once.ownedItemIds).toContain('silk-bow')
    expect(twice).toBe(once)
  })

  it('never sells Garden Pass exclusives yet', () => {
    const state = makeState({ nectar: 999, stardust: 999 })
    expect(purchaseShopItem(state, 'royal-crown')).toBe(state)
  })

  it('equips owned cosmetics that fit the stage and hides ones that stop fitting', () => {
    let state = makeState({
      nectar: 100,
      creatures: [makeCreature({ stage: 'caterpillar' })],
    })
    state = purchaseShopItem(state, 'sprout-cap')
    state = equipOutfitItem(state, 'creature-1', 'sprout-cap')
    expect(state.creatures[0].outfit.headwear).toBe('sprout-cap')
    expect(visibleOutfit(state, 'creature-1').headwear).toBe('sprout-cap')

    const asChrysalis = {
      ...state,
      creatures: [{ ...state.creatures[0], stage: 'chrysalis' as const }],
    }
    expect(visibleOutfit(asChrysalis, 'creature-1').headwear).toBeUndefined()

    const cleared = unequipOutfitSlot(state, 'creature-1', 'headwear')
    expect(cleared.creatures[0].outfit.headwear).toBeUndefined()
  })

  it('refuses equipping unowned items', () => {
    const state = makeState({
      creatures: [makeCreature({ stage: 'caterpillar' })],
    })
    expect(equipOutfitItem(state, 'creature-1', 'sprout-cap')).toBe(state)
  })
})
