import { getShopItem } from '../data/shopItems'
import { balanceFor } from './currency'
import {
  canWearItem,
  hasGardenPassFeature,
  type GardenPassProvider,
} from './gardenPass'
import type { AppState, CreatureInstance, OutfitSlot } from '../types'

/**
 * Buy a shop item. Supplies stack in the inventory; cosmetics are one-time
 * purchases added to the shared closet.
 *
 * Pass items are still rejected here, and deliberately so: they are reached
 * through pass access, not bought for nothing. Routing a zero-cost pass item
 * through this function would add it to `ownedItemIds` and turn a grant that
 * should end with the pass into permanent ownership.
 */
export function purchaseShopItem(state: AppState, itemId: string): AppState {
  const item = getShopItem(itemId)
  if (!item || item.premium) return state
  if (item.kind === 'cosmetic' && state.ownedItemIds.includes(itemId)) {
    return state
  }

  if (balanceFor(state, item.currency) < item.cost) return state
  const paid =
    item.currency === 'stardust'
      ? { stardust: state.stardust - item.cost }
      : { nectar: state.nectar - item.cost }

  if (item.kind === 'supply') {
    return {
      ...state,
      ...paid,
      inventory: {
        ...state.inventory,
        [itemId]: (state.inventory[itemId] ?? 0) + 1,
      },
    }
  }
  return {
    ...state,
    ...paid,
    ownedItemIds: [...state.ownedItemIds, itemId],
  }
}

/**
 * Equip a cosmetic on a creature, if it fits the stage and is available.
 *
 * "Available" means owned outright for ordinary items, or covered by pass
 * access for pass items -- the same question the shop and the sprite ask.
 */
export function equipOutfitItem(
  state: AppState,
  creatureId: string,
  itemId: string,
  provider?: GardenPassProvider | null,
): AppState {
  const item = getShopItem(itemId)
  const creature = state.creatures.find((entry) => entry.id === creatureId)
  if (
    !item ||
    !creature ||
    item.kind !== 'cosmetic' ||
    !item.slot ||
    !canWearItem(state.ownedItemIds, item, provider) ||
    !(item.stages ?? []).includes(creature.stage)
  ) {
    return state
  }
  return {
    ...state,
    creatures: state.creatures.map((entry) =>
      entry.id === creatureId
        ? { ...entry, outfit: { ...entry.outfit, [item.slot as OutfitSlot]: itemId } }
        : entry,
    ),
  }
}

export function unequipOutfitSlot(
  state: AppState,
  creatureId: string,
  slot: OutfitSlot,
): AppState {
  return {
    ...state,
    creatures: state.creatures.map((entry) => {
      if (entry.id !== creatureId || !entry.outfit[slot]) return entry
      const outfit = { ...entry.outfit }
      delete outfit[slot]
      return { ...entry, outfit }
    }),
  }
}

/**
 * What a creature is actually wearing right now.
 *
 * Items that no longer fit the stage are hidden, not lost, and pass items are
 * hidden the same way when access is unavailable. In both cases the saved slot
 * is untouched: losing access must not quietly undress a companion and throw
 * away a choice the gardener made, and restoring access brings the outfit
 * straight back.
 */
export function visibleOutfitFor(
  creature: CreatureInstance,
  passCosmeticsAllowed = hasGardenPassFeature('pass-cosmetics'),
): Partial<Record<OutfitSlot, string>> {
  const result: Partial<Record<OutfitSlot, string>> = {}
  for (const [slot, itemId] of Object.entries(creature.outfit)) {
    if (!itemId) continue
    const item = getShopItem(itemId)
    if (item?.premium && !passCosmeticsAllowed) continue
    if (item?.stages?.includes(creature.stage)) {
      result[slot as OutfitSlot] = itemId
    }
  }
  return result
}

export function visibleOutfit(
  state: AppState,
  creatureId: string,
  passCosmeticsAllowed?: boolean,
): Partial<Record<OutfitSlot, string>> {
  const creature = state.creatures.find((entry) => entry.id === creatureId)
  return creature ? visibleOutfitFor(creature, passCosmeticsAllowed) : {}
}

/**
 * Every creature's visible outfit, built in one pass.
 *
 * Calling visibleOutfit once per creature is quadratic -- each call scans the
 * whole list to find its creature -- and it hands back a fresh object every
 * time, which defeats memoization on the sprite that receives it. Views that
 * draw more than one creature should index once and look up from here.
 */
export function visibleOutfits(
  creatures: readonly CreatureInstance[],
  passCosmeticsAllowed = hasGardenPassFeature('pass-cosmetics'),
): Map<string, Partial<Record<OutfitSlot, string>>> {
  const outfits = new Map<string, Partial<Record<OutfitSlot, string>>>()
  for (const creature of creatures) {
    outfits.set(creature.id, visibleOutfitFor(creature, passCosmeticsAllowed))
  }
  return outfits
}
