import { describe, expect, it } from 'vitest'
import { shopItems } from '../data/shopItems'
import {
  GARDEN_PASS_FEATURES,
  GARDEN_PASS_PREVIEW_NOTICE,
  canWearItem,
  gardenPassAccess,
  hasGardenPassFeature,
  passFeatureForItem,
  previewProvider,
  type GardenPassProvider,
} from './gardenPass'
import { createEmptyState } from './progression'
import { equipOutfitItem, unequipOutfitSlot, visibleOutfitFor } from './wardrobe'
import type { AppState, CreatureInstance } from '../types'

/** No provider at all: what a build without the preview looks like. */
const noProvider = null

/** A provider that lies about its source, to prove the check is real. */
const impostor: GardenPassProvider = {
  source: 'pwa-preview',
  access: () => ({
    allowed: true,
    source: 'verified-provider',
    reason: 'Thanks for subscribing!',
  }),
}

const passItem = shopItems.find((item) => item.premium && item.kind === 'cosmetic')
const ordinaryItem = shopItems.find(
  (item) => !item.premium && item.kind === 'cosmetic',
)

function creature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: 'creature-1',
    speciesId: 'monarch',
    name: 'Sol',
    stage: 'butterfly',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function garden(creatures: CreatureInstance[], ownedItemIds: string[] = []): AppState {
  return { ...createEmptyState(), creatures, ownedItemIds }
}

describe('Garden Pass access', () => {
  it('grants every feature through the preview provider', () => {
    for (const feature of GARDEN_PASS_FEATURES) {
      const access = gardenPassAccess(feature, previewProvider)
      expect(access.allowed).toBe(true)
      expect(access.source).toBe('pwa-preview')
    }
  })

  it('never claims a subscription, receipt, renewal or trial', () => {
    // Nothing here is paid for. Copy that implies otherwise would be a lie to
    // gardeners and a problem in a store listing.
    const wording = [
      GARDEN_PASS_PREVIEW_NOTICE,
      ...GARDEN_PASS_FEATURES.map(
        (feature) => gardenPassAccess(feature, previewProvider).reason,
      ),
    ].join(' ')
    for (const forbidden of [
      'subscribed',
      'subscription is active',
      'receipt',
      'renews',
      'renewal',
      'trial',
      'days left',
      'billed',
    ]) {
      expect(wording.toLowerCase()).not.toContain(forbidden)
    }
    expect(GARDEN_PASS_PREVIEW_NOTICE).toContain('No subscription or payment is active')
  })

  it('refuses everything when the release ships no provider', () => {
    for (const feature of GARDEN_PASS_FEATURES) {
      const access = gardenPassAccess(feature, noProvider)
      expect(access.allowed).toBe(false)
      expect(access.source).toBe('none')
    }
  })

  it('never lets a provider launder a preview into a verified purchase', () => {
    // A source is a claim about how access was obtained. If a provider can
    // return one it does not own, "verified-provider" stops meaning anything.
    const access = gardenPassAccess('pass-cosmetics', impostor)
    expect(access.allowed).toBe(false)
    expect(access.source).toBe('none')
  })

  it('produces verified-provider from nothing in this codebase', () => {
    // There is no billing here. Anything reporting a verified purchase would
    // be a fake one.
    for (const feature of GARDEN_PASS_FEATURES) {
      expect(gardenPassAccess(feature, previewProvider).source).not.toBe(
        'verified-provider',
      )
      expect(gardenPassAccess(feature, noProvider).source).not.toBe(
        'verified-provider',
      )
    }
  })

  it('maps pass catalog items to the cosmetics feature', () => {
    expect(passFeatureForItem({ premium: true })).toBe('pass-cosmetics')
    expect(passFeatureForItem({ premium: false })).toBeUndefined()
    expect(passFeatureForItem({})).toBeUndefined()
  })
})

describe('what a garden file can and cannot grant', () => {
  it('ignores forged entitlement fields in an imported garden', () => {
    // A backup is a file the gardener owns and can write anything into. If
    // access came from it, editing one line would be a free subscription.
    const forged = {
      ...createEmptyState(),
      premium: true,
      subscription: { active: true, tier: 'lifetime' },
      isPremium: true,
      gardenPass: { allowed: true, source: 'verified-provider' },
    } as unknown as AppState

    expect(Object.keys(forged)).toContain('subscription')
    // Access does not read state at all, so the forged fields change nothing.
    expect(gardenPassAccess('pass-cosmetics', noProvider).allowed).toBe(false)
    expect(gardenPassAccess('pass-cosmetics', noProvider).source).toBe('none')
  })

  it('does not grant pass items through ordinary ownership', () => {
    if (!passItem) throw new Error('Expected a pass cosmetic in the catalog')
    // Someone could add the id to ownedItemIds in a backup. Ownership is not
    // the question asked for pass content.
    expect(canWearItem([passItem.id], passItem, noProvider)).toBe(false)
    expect(canWearItem([], passItem, previewProvider)).toBe(true)
  })

  it('still requires real ownership for ordinary items', () => {
    if (!ordinaryItem) throw new Error('Expected an ordinary cosmetic')
    expect(canWearItem([], ordinaryItem, previewProvider)).toBe(false)
    expect(canWearItem([ordinaryItem.id], ordinaryItem, noProvider)).toBe(true)
  })
})

describe('wearing pass cosmetics', () => {
  it('equips a pass item without minting permanent ownership', () => {
    if (!passItem) throw new Error('Expected a pass cosmetic in the catalog')
    const stage = passItem.stages?.[0] ?? 'butterfly'
    const state = garden([creature({ stage })])

    const equipped = equipOutfitItem(state, 'creature-1', passItem.id, previewProvider)
    expect(equipped.creatures[0].outfit[passItem.slot!]).toBe(passItem.id)
    // The grant is the release's, not the garden's: it must not be recorded
    // as something owned that would outlive the pass.
    expect(equipped.ownedItemIds).toEqual([])
  })

  it('refuses to equip a pass item without access', () => {
    if (!passItem) throw new Error('Expected a pass cosmetic in the catalog')
    const stage = passItem.stages?.[0] ?? 'butterfly'
    const state = garden([creature({ stage })])
    expect(equipOutfitItem(state, 'creature-1', passItem.id, noProvider)).toBe(state)
  })

  it('hides a pass item when access goes, and keeps the choice', () => {
    if (!passItem) throw new Error('Expected a pass cosmetic in the catalog')
    const stage = passItem.stages?.[0] ?? 'butterfly'
    const wearing = creature({ stage, outfit: { [passItem.slot!]: passItem.id } })

    expect(visibleOutfitFor(wearing, false)).toEqual({})
    // The saved slot survives, so restoring access restores the outfit.
    expect(wearing.outfit[passItem.slot!]).toBe(passItem.id)
    expect(visibleOutfitFor(wearing, true)).toEqual({ [passItem.slot!]: passItem.id })
  })

  it('lets a gardener unequip a pass item they can no longer see', () => {
    if (!passItem) throw new Error('Expected a pass cosmetic in the catalog')
    const stage = passItem.stages?.[0] ?? 'butterfly'
    const state = garden([creature({ stage, outfit: { [passItem.slot!]: passItem.id } })])

    const bare = unequipOutfitSlot(state, 'creature-1', passItem.slot!)
    expect(bare.creatures[0].outfit[passItem.slot!]).toBeUndefined()
  })

  it('leaves ordinary outfits alone when pass access is unavailable', () => {
    if (!ordinaryItem) throw new Error('Expected an ordinary cosmetic')
    const stage = ordinaryItem.stages?.[0] ?? 'butterfly'
    const wearing = creature({ stage, outfit: { [ordinaryItem.slot!]: ordinaryItem.id } })
    expect(visibleOutfitFor(wearing, false)).toEqual({
      [ordinaryItem.slot!]: ordinaryItem.id,
    })
  })

  it('reports feature availability through one helper', () => {
    expect(hasGardenPassFeature('custom-backdrops', previewProvider)).toBe(true)
    expect(hasGardenPassFeature('custom-backdrops', noProvider)).toBe(false)
  })
})
