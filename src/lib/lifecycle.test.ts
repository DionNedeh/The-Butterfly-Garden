import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance } from '../types'
import { createEmptyState } from './progression'
import { createInitialState } from './progression'
import {
  BOND_LEVEL_NECTAR,
  BOND_LEVEL_STARDUST,
  BOND_PER_LEVEL,
  EMERGENCE_SEED_REWARD,
  EMERGENCE_STARDUST_REWARD,
  nextBondMilestone,
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

describe('the diary care writes', () => {
  it('counts each act of care and records the day an egg hatched', () => {
    let state = makeState()
    for (const day of [1, 2, 3]) {
      state = performCare(state, 'creature-1', 'egg-warm', new Date(2026, 5, day, 9)).state
    }
    state = performCare(state, 'creature-1', 'cat-play', new Date(2026, 5, 4, 9)).state
    const pip = state.creatures[0]
    expect(pip.careCounts).toEqual({ 'egg-warm': 3, 'cat-play': 1 })
    expect(pip.hatchedAt).toBe(new Date(2026, 5, 3, 9).toISOString())
  })

  it('records a hatching only, never a later change, as hatched', () => {
    let state = makeState({ creatures: [makeCreature({ stage: 'caterpillar' })] })
    for (const day of [1, 2, 3]) {
      state = performCare(state, 'creature-1', 'cat-play', new Date(2026, 5, day, 9)).state
    }
    expect(state.creatures[0].stage).toBe('chrysalis')
    expect('hatchedAt' in state.creatures[0]).toBe(false)
  })

  it('begins the diary of an older garden with its first act of care, once', () => {
    const made = createInitialState('Tester', 'Test Garden')
    const older = makeState({
      profile: { ...made.profile!, diarySince: undefined },
      creatures: [makeCreature({ stage: 'butterfly' })],
    })
    const first = performCare(older, 'creature-1', 'but-groom', new Date(2026, 5, 10, 9)).state
    expect(first.profile?.diarySince).toBe(new Date(2026, 5, 10, 9).toISOString())
    const next = performCare(first, 'creature-1', 'but-fly', new Date(2026, 5, 12, 9)).state
    expect(next.profile).toBe(first.profile)
  })

  it('earns exactly what it earned before the diary', () => {
    // Counts never feed a reward: a companion with a long diary and one with
    // none are paid the same for the same care.
    const counted = makeCreature({
      stage: 'butterfly',
      bond: BOND_PER_LEVEL - 1,
      careCounts: { 'but-groom': 500 },
    })
    const plain = makeCreature({ stage: 'butterfly', bond: BOND_PER_LEVEL - 1 })
    const day = new Date(2026, 5, 10, 9)
    const a = performCare(makeState({ creatures: [counted] }), 'creature-1', 'but-groom', day)
    const b = performCare(makeState({ creatures: [plain] }), 'creature-1', 'but-groom', day)
    expect([a.state.nectar, a.state.stardust, a.state.seeds, a.bondLevelsGained]).toEqual([
      b.state.nectar,
      b.state.stardust,
      b.state.seeds,
      b.bondLevelsGained,
    ])
  })
})

describe('the next bond level', () => {
  it('says what is left to earn and what the level brings, from the rules', () => {
    expect(nextBondMilestone(0)).toEqual({
      level: 2,
      bondToGo: BOND_PER_LEVEL,
      stardust: BOND_LEVEL_STARDUST,
      nectar: BOND_LEVEL_NECTAR,
    })
    expect(nextBondMilestone(BOND_PER_LEVEL + 3)).toMatchObject({
      level: 3,
      bondToGo: BOND_PER_LEVEL - 3,
    })
    // On the very point a level is reached, the whole next one lies ahead.
    expect(nextBondMilestone(BOND_PER_LEVEL * 2).bondToGo).toBe(BOND_PER_LEVEL)
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

  it('sells Stardust pieces only for Stardust, never Nectar', () => {
    const richInNectar = makeState({ nectar: 999, stardust: 0 })
    expect(purchaseShopItem(richInNectar, 'star-diadem')).toBe(richInNectar)
    expect(purchaseShopItem(richInNectar, 'moonlit-halo')).toBe(richInNectar)

    const stargazer = makeState({ nectar: 0, stardust: 7 })
    const bought = purchaseShopItem(stargazer, 'star-diadem')
    expect(bought.ownedItemIds).toContain('star-diadem')
    expect(bought.stardust).toBe(1)
    expect(bought.nectar).toBe(0)
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
