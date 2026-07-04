import { getShopItem } from '../data/shopItems'
import type { AppState, OutfitSlot } from '../types'

/**
 * Buy a shop item. Supplies stack in the inventory; cosmetics are one-time
 * purchases added to the shared closet. Garden Pass exclusives cannot be
 * bought yet.
 */
export function purchaseShopItem(state: AppState, itemId: string): AppState {
  const item = getShopItem(itemId)
  if (!item || item.premium) return state
  if (item.kind === 'cosmetic' && state.ownedItemIds.includes(itemId)) {
    return state
  }

  const balance = item.currency === 'stardust' ? state.stardust : state.nectar
  if (balance < item.cost) return state
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

/** Equip an owned cosmetic on a creature, if the item fits its stage. */
export function equipOutfitItem(
  state: AppState,
  creatureId: string,
  itemId: string,
): AppState {
  const item = getShopItem(itemId)
  const creature = state.creatures.find((entry) => entry.id === creatureId)
  if (
    !item ||
    !creature ||
    item.kind !== 'cosmetic' ||
    !item.slot ||
    !state.ownedItemIds.includes(itemId) ||
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

/** Items equipped in slots that no longer fit the stage are hidden, not lost. */
export function visibleOutfit(
  state: AppState,
  creatureId: string,
): Partial<Record<OutfitSlot, string>> {
  const creature = state.creatures.find((entry) => entry.id === creatureId)
  if (!creature) return {}
  const result: Partial<Record<OutfitSlot, string>> = {}
  for (const [slot, itemId] of Object.entries(creature.outfit)) {
    if (!itemId) continue
    const item = getShopItem(itemId)
    if (item?.stages?.includes(creature.stage)) {
      result[slot as OutfitSlot] = itemId
    }
  }
  return result
}
