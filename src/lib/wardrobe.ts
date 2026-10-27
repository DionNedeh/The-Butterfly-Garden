import { getShopItem, outfitSlots } from '../data/shopItems'
import {
  canWearItem,
  hasGardenPassFeature,
  type GardenPassProvider,
} from './gardenPass'
import { diaryBegun, noteWorn } from './companionDiary'
import { payFor, refuse, type PurchaseResult } from './purchase'
import type {
  AppState,
  CreatureInstance,
  OutfitSlot,
  ShopItemDefinition,
} from '../types'

/**
 * Buy a shop item, and say how it went. Supplies stack in the inventory and
 * can be bought several at a time, priced exactly; cosmetics are one-time
 * purchases added to the shared closet, so they are bought one at a time.
 *
 * Pass items are still rejected here, and deliberately so: they are reached
 * through pass access, not bought for nothing. Routing a zero-cost pass item
 * through this function would add it to `ownedItemIds` and turn a grant that
 * should end with the pass into permanent ownership.
 */
export function buyShopItem(
  state: AppState,
  itemId: string,
  quantity = 1,
): PurchaseResult {
  const item = getShopItem(itemId)
  if (!item) return refuse(state, { kind: 'unavailable', reason: 'unknown' })
  if (item.premium) return refuse(state, { kind: 'unavailable', reason: 'pass' })
  const supply = item.kind === 'supply'
  if (!Number.isInteger(quantity) || quantity < 1 || (!supply && quantity !== 1))
    return refuse(state, { kind: 'unavailable', reason: 'unknown' })
  if (!supply && state.ownedItemIds.includes(itemId))
    return refuse(state, { kind: 'owned' })
  return payFor(
    state,
    { cost: item.cost * quantity, currency: item.currency, quantity },
    () =>
      supply
        ? {
            inventory: {
              ...state.inventory,
              [itemId]: (state.inventory[itemId] ?? 0) + quantity,
            },
          }
        : { ownedItemIds: [...state.ownedItemIds, itemId] },
  )
}

/** The garden after buying one item, for callers that need no outcome. */
export function purchaseShopItem(state: AppState, itemId: string): AppState {
  return buyShopItem(state, itemId).state
}

type Outfit = Partial<Record<OutfitSlot, string>>

/** Whether two outfits hold the same pieces in the same slots. */
export function sameOutfit(a: Outfit, b: Outfit): boolean {
  const slots = new Set([...Object.keys(a), ...Object.keys(b)] as OutfitSlot[])
  return [...slots].every((slot) => (a[slot] || undefined) === (b[slot] || undefined))
}

/**
 * Whether a piece suits this companion as it is now: a cosmetic with a slot,
 * made for its current stage. Says nothing of ownership; the Boutique's
 * "Fits {name} now" asks this alone, beside its own ownership filter.
 */
export function fitsCreature<T extends Pick<ShopItemDefinition, 'kind' | 'slot' | 'stages'>>(
  item: T,
  creature: Pick<CreatureInstance, 'stage'>,
): item is T & { slot: OutfitSlot } {
  return (
    item.kind === 'cosmetic' &&
    item.slot !== undefined &&
    (item.stages ?? []).includes(creature.stage)
  )
}

/**
 * Equip a cosmetic on a creature, if it fits the stage and is available.
 *
 * "Available" means owned outright for ordinary items, or covered by pass
 * access for pass items -- the same question the shop and the sprite ask.
 * The companion's diary notes the piece among the outfits it has worn. The
 * very same garden comes back when the piece is already on and noted.
 */
export function equipOutfitItem(
  state: AppState,
  creatureId: string,
  itemId: string,
  provider?: GardenPassProvider | null,
  now = new Date(),
): AppState {
  const item = getShopItem(itemId)
  const index = state.creatures.findIndex((entry) => entry.id === creatureId)
  const creature = index === -1 ? undefined : state.creatures[index]
  if (
    !item ||
    !creature ||
    !fitsCreature(item, creature) ||
    !canWearItem(state.ownedItemIds, item, provider)
  ) {
    return state
  }
  const outfitsWorn = noteWorn(creature.outfitsWorn, [itemId])
  if (creature.outfit[item.slot] === itemId && outfitsWorn === creature.outfitsWorn) {
    return state
  }
  const creatures = [...state.creatures]
  creatures[index] = {
    ...creature,
    outfit: { ...creature.outfit, [item.slot]: itemId },
    outfitsWorn,
  }
  return { ...state, creatures, profile: diaryBegun(state.profile, now) }
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

/**
 * Who is wearing each piece right now, by name, in the garden's own order:
 * what the Boutique says beside a piece ("Worn by Sol and Fern"). Read from
 * what each companion visibly wears, so a piece waiting for a fitting stage,
 * or a Pass piece while the Pass is closed, is not claimed as worn.
 */
export function wearersByItem(
  creatures: readonly CreatureInstance[],
  passCosmeticsAllowed = hasGardenPassFeature('pass-cosmetics'),
): Map<string, string[]> {
  const wearers = new Map<string, string[]>()
  for (const creature of creatures) {
    for (const itemId of Object.values(visibleOutfitFor(creature, passCosmeticsAllowed))) {
      if (!itemId) continue
      const names = wearers.get(itemId)
      if (names) names.push(creature.name)
      else wearers.set(itemId, [creature.name])
    }
  }
  return wearers
}

/**
 * Why a piece of a look was left off: it does not fit the companion's stage
 * yet, it comes with the Garden Pass and the Pass is not open, or it is not
 * in the closet.
 */
export type LookSkipReason = 'stage' | 'pass' | 'closet'

export interface LookSkip {
  itemId: string
  reason: LookSkipReason
}

export interface WearLookResult {
  state: AppState
  /** Pieces now on the companion. */
  worn: string[]
  /** Pieces left off, and why. */
  skipped: LookSkip[]
}

/**
 * Put a saved look on a companion: each piece the gardener can wear (owned,
 * or a Pass piece while the Pass is open) and that fits the companion's
 * stage, the same rules as the wardrobe (equipOutfitItem). A slot the look
 * leaves empty is emptied, so the companion wears the look and not half of
 * another; a slot whose piece is left off keeps what it had. When nothing in
 * the look can be worn, nothing changes at all.
 */
export function wearOutfitPreset(
  state: AppState,
  creatureId: string,
  presetId: string,
  provider?: GardenPassProvider | null,
  now = new Date(),
): WearLookResult {
  const index = state.creatures.findIndex((entry) => entry.id === creatureId)
  const creature = index === -1 ? undefined : state.creatures[index]
  const preset = state.outfitPresets?.find((entry) => entry.id === presetId)
  if (!creature || !preset) return { state, worn: [], skipped: [] }

  const worn: string[] = []
  const skipped: LookSkip[] = []
  const outfit = { ...creature.outfit }
  for (const { id: slot } of outfitSlots) {
    const itemId = preset.outfit[slot]
    if (!itemId) {
      delete outfit[slot]
      continue
    }
    const item = getShopItem(itemId)
    // validateGarden keeps only pieces the catalogue knows; one it does not
    // has nothing to show or say, so it is passed over.
    if (!item) continue
    if (!canWearItem(state.ownedItemIds, item, provider)) {
      skipped.push({ itemId, reason: item.premium ? 'pass' : 'closet' })
    } else if (!fitsCreature(item, creature)) {
      skipped.push({ itemId, reason: 'stage' })
    } else {
      outfit[slot] = itemId
      worn.push(itemId)
    }
  }
  if (worn.length === 0) return { state, worn, skipped }

  const outfitsWorn = noteWorn(creature.outfitsWorn, worn)
  if (sameOutfit(outfit, creature.outfit) && outfitsWorn === creature.outfitsWorn) {
    return { state, worn, skipped }
  }
  const creatures = [...state.creatures]
  creatures[index] = { ...creature, outfit, outfitsWorn }
  return {
    state: { ...state, creatures, profile: diaryBegun(state.profile, now) },
    worn,
    skipped,
  }
}
