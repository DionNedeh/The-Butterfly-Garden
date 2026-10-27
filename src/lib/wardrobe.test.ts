import { describe, expect, it } from 'vitest'
import { getShopItem, shopItems } from '../data/shopItems'
import type { AppState, CreatureInstance, OutfitPreset, ShopItemDefinition } from '../types'
import { previewProvider } from './gardenPass'
import { createEmptyState, createInitialState } from './progression'
import {
  equipOutfitItem,
  fitsCreature,
  sameOutfit,
  wearersByItem,
  wearOutfitPreset,
} from './wardrobe'

const NOW = new Date('2026-10-27T12:00:00Z')
const passHat = shopItems.find(
  (item) => item.premium && item.slot === 'headwear',
) as ShopItemDefinition & { slot: 'headwear' }

function creature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: 'sol',
    speciesId: 'monarch',
    name: 'Sol',
    stage: 'butterfly',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-06-01T09:00:00.000Z',
    ...overrides,
  }
}

/**
 * A garden made before the diary, owning a few ordinary pieces, with these
 * looks kept in its profile, where they are stored.
 */
function garden({ looks, ...overrides }: Partial<AppState> & { looks?: OutfitPreset[] } = {}): AppState {
  const made = createInitialState('Tester', 'Test Garden')
  return {
    ...createEmptyState(),
    profile: { ...made.profile!, diarySince: undefined, ...(looks ? { outfitPresets: looks } : {}) },
    creatures: [creature()],
    ownedItemIds: ['sprout-cap', 'silk-bow', 'sparkle-aura', 'star-diadem'],
    ...overrides,
  }
}

describe('what fits a companion now', () => {
  it('asks the stage and the slot, not ownership', () => {
    const cap = getShopItem('sprout-cap')!
    expect(fitsCreature(cap, { stage: 'caterpillar' })).toBe(true)
    expect(fitsCreature(cap, { stage: 'chrysalis' })).toBe(false)
    expect(fitsCreature(getShopItem('leaf-bundle')!, { stage: 'butterfly' })).toBe(false)
  })

  it('compares outfits by their pieces, ignoring empty slots', () => {
    expect(sameOutfit({ headwear: 'sprout-cap' }, { headwear: 'sprout-cap', aura: undefined })).toBe(true)
    expect(sameOutfit({ headwear: 'sprout-cap' }, { aura: 'sparkle-aura' })).toBe(false)
  })
})

describe('wearing a piece writes it in the diary', () => {
  it('notes the piece and begins the diary', () => {
    const dressed = equipOutfitItem(garden(), 'sol', 'sprout-cap', undefined, NOW)
    expect(dressed.creatures[0].outfit.headwear).toBe('sprout-cap')
    expect(dressed.creatures[0].outfitsWorn).toEqual(['sprout-cap'])
    expect(dressed.profile?.diarySince).toBe(NOW.toISOString())
  })

  it('changes nothing when the piece is already on and noted', () => {
    const dressed = equipOutfitItem(garden(), 'sol', 'sprout-cap', undefined, NOW)
    expect(equipOutfitItem(dressed, 'sol', 'sprout-cap', undefined, NOW)).toBe(dressed)
  })

  it('notes a piece put on before the diary began, when it is chosen again', () => {
    const state = garden({ creatures: [creature({ outfit: { headwear: 'sprout-cap' } })] })
    const noted = equipOutfitItem(state, 'sol', 'sprout-cap', undefined, NOW)
    expect(noted).not.toBe(state)
    expect(noted.creatures[0].outfitsWorn).toEqual(['sprout-cap'])
  })
})

describe('wearing a saved look', () => {
  const sunday = {
    id: 'sunday',
    name: 'Sunday best',
    outfit: { headwear: 'sprout-cap', accessory: 'silk-bow' },
  }

  it('puts on every piece, empties what the look leaves empty, and notes them', () => {
    const state = garden({
      creatures: [creature({ outfit: { aura: 'sparkle-aura' } })],
      looks: [sunday],
    })
    const result = wearOutfitPreset(state, 'sol', 'sunday', undefined, NOW)
    expect(result.worn).toEqual(['sprout-cap', 'silk-bow'])
    expect(result.skipped).toEqual([])
    expect(result.state.creatures[0].outfit).toEqual({ headwear: 'sprout-cap', accessory: 'silk-bow' })
    expect(result.state.creatures[0].outfitsWorn).toEqual(['sprout-cap', 'silk-bow'])
    expect(result.state.profile?.diarySince).toBe(NOW.toISOString())
    // Nothing else of the garden moves, the looks in the profile among it.
    expect(result.state.profile?.outfitPresets).toBe(state.profile?.outfitPresets)
    expect(result.state.ownedItemIds).toBe(state.ownedItemIds)
  })

  it('leaves out what does not fit the stage, keeping what that slot had', () => {
    const state = garden({
      creatures: [creature({ stage: 'chrysalis', outfit: { headwear: 'moonlit-halo' } })],
      ownedItemIds: ['sprout-cap', 'silk-bow', 'moonlit-halo'],
      looks: [sunday],
    })
    const result = wearOutfitPreset(state, 'sol', 'sunday', undefined, NOW)
    expect(result.worn).toEqual(['silk-bow'])
    expect(result.skipped).toEqual([{ itemId: 'sprout-cap', reason: 'stage' }])
    expect(result.state.creatures[0].outfit).toEqual({
      headwear: 'moonlit-halo',
      accessory: 'silk-bow',
    })
  })

  it('leaves out a piece not in the closet, and a Pass piece while the Pass is closed', () => {
    const look = {
      id: 'mixed',
      name: 'Mixed',
      outfit: { headwear: passHat.id, accessory: 'leaf-scarf', aura: 'sparkle-aura' },
    }
    const state = garden({ looks: [look] })
    const closed = wearOutfitPreset(state, 'sol', 'mixed', null, NOW)
    expect(closed.worn).toEqual(['sparkle-aura'])
    expect(closed.skipped).toEqual([
      { itemId: passHat.id, reason: 'pass' },
      { itemId: 'leaf-scarf', reason: 'closet' },
    ])
    // Open, the Pass piece goes on; it is still never owned.
    const open = wearOutfitPreset(state, 'sol', 'mixed', previewProvider, NOW)
    expect(open.worn).toEqual([passHat.id, 'sparkle-aura'])
    expect(open.state.ownedItemIds).not.toContain(passHat.id)
  })

  it('changes nothing at all when nothing in the look can be worn', () => {
    const cap = { id: 'cap', name: 'Cap', outfit: { headwear: 'sprout-cap' } }
    const state = garden({
      creatures: [creature({ stage: 'egg', outfit: { aura: 'sparkle-aura' } })],
      looks: [cap],
    })
    const result = wearOutfitPreset(state, 'sol', 'cap', undefined, NOW)
    expect(result.state).toBe(state)
    expect(result.worn).toEqual([])
    expect(result.skipped.map((skip) => skip.reason)).toEqual(['stage'])
  })

  it('hands back the same garden when the look is already on and noted', () => {
    const state = garden({ looks: [sunday] })
    const once = wearOutfitPreset(state, 'sol', 'sunday', undefined, NOW).state
    const twice = wearOutfitPreset(once, 'sol', 'sunday', undefined, NOW)
    expect(twice.state).toBe(once)
    expect(twice.worn).toEqual(['sprout-cap', 'silk-bow'])
  })

  it('passes over a look or a companion that is not there, and a piece the catalogue lost', () => {
    const state = garden({
      looks: [{ id: 'old', name: 'Old', outfit: { headwear: 'retired-hat', aura: 'sparkle-aura' } }],
    })
    expect(wearOutfitPreset(state, 'sol', 'nope').state).toBe(state)
    expect(wearOutfitPreset(state, 'nobody', 'old').state).toBe(state)
    const result = wearOutfitPreset(state, 'sol', 'old', undefined, NOW)
    expect(result.worn).toEqual(['sparkle-aura'])
    expect(result.skipped).toEqual([])
  })
})

describe('who is wearing what', () => {
  it('names each piece’s wearers in the garden’s order', () => {
    const wearers = wearersByItem(
      [
        creature({ id: 'a', name: 'Sol', outfit: { headwear: 'sprout-cap' } }),
        creature({ id: 'b', name: 'Fern', outfit: { headwear: 'sprout-cap', aura: 'sparkle-aura' } }),
        creature({ id: 'c', name: 'Moss', outfit: {} }),
      ],
      true,
    )
    expect(wearers.get('sprout-cap')).toEqual(['Sol', 'Fern'])
    expect(wearers.get('sparkle-aura')).toEqual(['Fern'])
    expect(wearers.has('silk-bow')).toBe(false)
  })

  it('counts only what shows: not a piece waiting for a stage, nor a closed Pass piece', () => {
    const wearers = wearersByItem(
      [
        creature({ stage: 'chrysalis', outfit: { headwear: 'sprout-cap' } }),
        creature({ id: 'b', name: 'Fern', outfit: { headwear: passHat.id } }),
      ],
      false,
    )
    expect(wearers.size).toBe(0)
  })
})
