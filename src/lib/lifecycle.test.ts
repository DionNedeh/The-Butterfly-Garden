import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance, Goal } from '../types'
import { createEmptyState } from './progression'
import { createInitialState } from './progression'
import { gardenEvents } from './gardenEvents'
import {
  adoptGoal,
  BOND_LEVEL_NECTAR,
  BOND_LEVEL_STARDUST,
  BOND_PER_LEVEL,
  careFromGoal,
  EMERGENCE_NECTAR_REWARD,
  EMERGENCE_SEED_REWARD,
  EMERGENCE_STARDUST_REWARD,
  HATCH_NECTAR_REWARD,
  nextBondMilestone,
  performCare,
  readyToAdvance,
  releaseGoal,
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

describe('growing alongside a goal', () => {
  const walk: Goal = {
    id: 'walk',
    title: 'Walk outside',
    schedule: 'daily',
    weekdays: [],
    createdDate: '2026-06-01',
    archived: false,
  }
  const water: Goal = { ...walk, id: 'water', title: 'Drink water' }
  const on = (day: number) => new Date(2026, 5, day, 9)

  /** Sol, an egg grown alongside Walk outside, in a garden whose diary began. */
  function growing(overrides: Partial<CreatureInstance> = {}, rest: Partial<AppState> = {}) {
    const profile = createInitialState('Tester', 'Goals').profile!
    return makeState({
      profile: { ...profile, activeCompanionId: undefined },
      goals: [walk, water],
      creatures: [makeCreature({ adoptedGoalId: 'walk', ...overrides })],
      ...rest,
    })
  }

  it('counts a completed goal as a day of care for the current stage, and notes it', () => {
    const state = growing()
    const after = careFromGoal(state, 'walk', on(10))
    const sol = after.creatures[0]
    expect(sol.careDates).toEqual({ egg: ['2026-06-10'] })
    expect(sol.grownAlongside).toEqual([
      { goalId: 'walk', title: 'Walk outside', dates: ['2026-06-10'] },
    ])
    // A day of care, and nothing else: no bond, no act counted, nothing paid.
    expect(sol.bond).toBe(0)
    expect(sol.actionLog).toEqual({})
    expect(sol).not.toHaveProperty('careCounts')
    expect(after.nectar).toBe(state.nectar)
    expect(after.stardust).toBe(state.stardust)
    expect(after.seeds).toBe(state.seeds)
    expect(after.goals).toBe(state.goals)
  })

  it('counts a day once, however often it comes and whichever way', () => {
    const once = careFromGoal(growing(), 'walk', on(10))
    // The same day again, as after an Undo on Today: the very same garden.
    expect(careFromGoal(once, 'walk', on(10))).toBe(once)
    // Care from the menu that day adds no second care day.
    const both = performCare(once, 'creature-1', 'egg-warm', on(10)).state
    expect(both.creatures[0].careDates.egg).toEqual(['2026-06-10'])

    // And the other way round: cared for first, then the goal.
    const cared = performCare(growing(), 'creature-1', 'egg-warm', on(10)).state
    const then = careFromGoal(cared, 'walk', on(10)).creatures[0]
    expect(then.careDates.egg).toEqual(['2026-06-10'])
    // The goal was done for it that day all the same, so its story says so.
    expect(then.grownAlongside?.[0].dates).toEqual(['2026-06-10'])
  })

  it('advances the stage on the day it needs, as care does, and celebrates it', () => {
    const state = growing({ careDates: { egg: ['2026-06-01', '2026-06-03'] } })
    const after = careFromGoal(state, 'walk', on(10))
    const sol = after.creatures[0]
    expect(sol.stage).toBe('caterpillar')
    expect(sol.careDates.egg).toHaveLength(STAGE_CARE_DAYS)
    expect(sol.hatchedAt).toBe(on(10).toISOString())
    expect(after.nectar).toBe(state.nectar + HATCH_NECTAR_REWARD)
    // Still grown alongside the goal, now as a caterpillar.
    expect(sol.adoptedGoalId).toBe('walk')
    expect(gardenEvents(state, after)).toEqual([
      { kind: 'stage-advanced', creatureName: 'Sol', stage: 'caterpillar' },
    ])
    // Completed again that day, after an Undo: no day for the new stage.
    expect(careFromGoal(after, 'walk', on(10))).toBe(after)
  })

  it('emerges with what emerging brings, and lets go of the goal, keeping the story', () => {
    const state = growing({
      stage: 'chrysalis',
      careDates: { chrysalis: ['2026-06-07', '2026-06-08'] },
      grownAlongside: [{ goalId: 'walk', title: 'Walk outside', dates: ['2026-06-08'] }],
    })
    const after = careFromGoal(state, 'walk', on(9))
    const sol = after.creatures[0]
    expect(sol.stage).toBe('butterfly')
    expect(sol.emergedAt).toBe(on(9).toISOString())
    expect(sol).not.toHaveProperty('adoptedGoalId')
    expect(sol.grownAlongside).toEqual([
      { goalId: 'walk', title: 'Walk outside', dates: ['2026-06-08', '2026-06-09'] },
    ])
    expect(after.nectar).toBe(state.nectar + EMERGENCE_NECTAR_REWARD)
    expect(after.stardust).toBe(state.stardust + EMERGENCE_STARDUST_REWARD)
    expect(after.seeds).toBe(state.seeds + EMERGENCE_SEED_REWARD)
    expect(after.profile?.activeCompanionId).toBe('creature-1')
  })

  it('lets go of the goal when care from the menu brings emergence, too', () => {
    const state = growing({ stage: 'chrysalis', careDates: { chrysalis: ['2026-06-07', '2026-06-08'] } })
    const sol = performCare(state, 'creature-1', 'chr-sun', on(9)).state.creatures[0]
    expect(sol.stage).toBe('butterfly')
    expect(sol).not.toHaveProperty('adoptedGoalId')
  })

  it('never counts for a butterfly, which has no stage left to grow', () => {
    const state = growing({ stage: 'butterfly' })
    expect(careFromGoal(state, 'walk', on(10))).toBe(state)
  })

  it('counts for no one once the goal is archived, deleted or let go', () => {
    const state = growing()
    const archived = { ...state, goals: [{ ...walk, archived: true }, water] }
    expect(careFromGoal(archived, 'walk', on(10))).toBe(archived)
    const deleted = { ...state, goals: [water] }
    expect(careFromGoal(deleted, 'walk', on(10))).toBe(deleted)
    const released = releaseGoal(state, 'walk')
    expect(careFromGoal(released, 'walk', on(10))).toBe(released)
    // A goal no one is grown alongside changes nothing.
    expect(careFromGoal(state, 'water', on(10))).toBe(state)
  })

  it('counts for every companion grown alongside the goal, each its own day', () => {
    const state = growing({}, {
      creatures: [
        makeCreature({ adoptedGoalId: 'walk' }),
        makeCreature({ id: 'creature-2', name: 'Pip', stage: 'caterpillar', adoptedGoalId: 'walk' }),
        makeCreature({ id: 'creature-3', name: 'Wren', adoptedGoalId: 'water' }),
      ],
    })
    const [sol, pip, wren] = careFromGoal(state, 'walk', on(10)).creatures
    expect(sol.careDates).toEqual({ egg: ['2026-06-10'] })
    expect(pip.careDates).toEqual({ caterpillar: ['2026-06-10'] })
    expect(wren).toBe(state.creatures[2])
  })

  it('writes each goal down under its own name, the newest one, and one goal a day', () => {
    let state = careFromGoal(growing(), 'walk', on(1))
    state = adoptGoal(state, 'creature-1', 'water')
    // Drink water, done the same day, adds nothing: the day was counted.
    expect(careFromGoal(state, 'water', on(1))).toBe(state)
    state = careFromGoal(state, 'water', on(2))
    state = adoptGoal(state, 'creature-1', 'walk')
    state = { ...state, goals: [{ ...walk, title: 'Walk in the park' }, water] }
    state = careFromGoal(state, 'walk', on(4))
    expect(state.creatures[0].grownAlongside).toEqual([
      { goalId: 'walk', title: 'Walk in the park', dates: ['2026-06-01', '2026-06-04'] },
      { goalId: 'water', title: 'Drink water', dates: ['2026-06-02'] },
    ])
  })

  it('begins the diary of an older garden with the first day a goal gives', () => {
    const state = growing()
    const older = { ...state, profile: { ...state.profile! } }
    delete older.profile.diarySince
    const after = careFromGoal(older, 'walk', on(10))
    expect(after.profile?.diarySince).toBe(on(10).toISOString())
  })

  it('grows a companion alongside a goal in use, and alongside none again', () => {
    const state = growing({ adoptedGoalId: undefined })
    const adopted = adoptGoal(state, 'creature-1', 'water')
    expect(adopted.creatures[0].adoptedGoalId).toBe('water')
    expect(adopted.goals).toBe(state.goals)
    // Choosing what is already chosen changes nothing.
    expect(adoptGoal(adopted, 'creature-1', 'water')).toBe(adopted)
    const none = adoptGoal(adopted, 'creature-1', undefined)
    expect(none.creatures[0]).not.toHaveProperty('adoptedGoalId')
    expect(adoptGoal(none, 'creature-1', undefined)).toBe(none)
  })

  it('refuses a goal set aside or unknown, a butterfly and a companion not here', () => {
    const state = growing({ adoptedGoalId: undefined }, {
      goals: [walk, { ...water, archived: true }],
    })
    expect(adoptGoal(state, 'creature-1', 'water')).toBe(state)
    expect(adoptGoal(state, 'creature-1', 'nowhere')).toBe(state)
    expect(adoptGoal(state, 'nobody', 'walk')).toBe(state)
    const butterfly = growing({ stage: 'butterfly', adoptedGoalId: undefined })
    expect(adoptGoal(butterfly, 'creature-1', 'walk')).toBe(butterfly)
  })

  it('lets go of every companion grown alongside a goal, and only those', () => {
    const state = growing({}, {
      creatures: [
        makeCreature({ adoptedGoalId: 'walk', grownAlongside: [{ goalId: 'walk', title: 'Walk outside', dates: ['2026-06-01'] }] }),
        makeCreature({ id: 'creature-2', adoptedGoalId: 'water' }),
      ],
    })
    const released = releaseGoal(state, 'walk')
    expect(released.creatures[0]).not.toHaveProperty('adoptedGoalId')
    // Nothing lost: the days it gave stay in the diary.
    expect(released.creatures[0].grownAlongside).toEqual(state.creatures[0].grownAlongside)
    expect(released.creatures[1]).toBe(state.creatures[1])
    expect(releaseGoal(released, 'walk')).toBe(released)
  })
})
