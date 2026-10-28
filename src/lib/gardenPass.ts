import type { ShopItemDefinition } from '../types'
import { passStatus } from './passEntitlement'
import { isAndroidApp } from './platform'

/**
 * Things the Garden Pass covers.
 *
 * Named per capability rather than per item so a later provider grants
 * features, not a list of catalog ids that would have to be edited every time
 * the shop grows.
 */
export type GardenPassFeature =
  | 'pass-cosmetics'
  | 'pass-backdrops'
  | 'custom-backdrops'

export const GARDEN_PASS_FEATURES: readonly GardenPassFeature[] = [
  'pass-cosmetics',
  'pass-backdrops',
  'custom-backdrops',
]

/**
 * Where access came from.
 *
 * `pwa-preview` is the PWA giving the features away and saying so.
 * `verified-provider` is a purchase Google Play has confirmed on this device,
 * and only playProvider -- the Android app's -- ever produces it. Keeping the
 * two apart is the whole point: a preview can never pass itself off as a
 * purchase.
 */
export type GardenPassSource = 'pwa-preview' | 'verified-provider' | 'none'

export interface GardenPassAccess {
  allowed: boolean
  source: GardenPassSource
  /** Plain user-facing wording. Never a receipt, renewal date or countdown. */
  reason: string
}

export interface GardenPassProvider {
  readonly source: Exclude<GardenPassSource, 'none'>
  access(feature: GardenPassFeature): GardenPassAccess
}

/** Shown wherever pass features are offered. */
export const GARDEN_PASS_PREVIEW_NOTICE =
  'Garden Pass preview — included in this PWA release. Try special outfits, ' +
  'extra backdrops, and your own garden image. No subscription or payment is active.'

const PREVIEW_REASON = 'Included free in this release as a preview.'
const NO_ACCESS_REASON = 'Garden Pass features are not available in this release.'

/**
 * The provider this release ships with.
 *
 * Grants every feature and is honest about why. It reads nothing but its own
 * constants: no network, no storage, no clock, so it behaves identically
 * offline and cannot be affected by anything a gardener imports.
 */
export const previewProvider: GardenPassProvider = {
  source: 'pwa-preview',
  access: () => ({
    allowed: true,
    source: 'pwa-preview',
    reason: PREVIEW_REASON,
  }),
}

const PASS_REASON = 'Included with your Garden Pass.'
const NOT_SUBSCRIBED_REASON = 'Part of the Garden Pass.'

/**
 * The Android app's provider: open exactly while Google Play, asked on this
 * device, says the Garden Pass is active (passEntitlement.ts). It reads
 * nothing from the garden, so a backup cannot open it either.
 */
export const playProvider: GardenPassProvider = {
  source: 'verified-provider',
  access: () =>
    passStatus().state === 'active'
      ? { allowed: true, source: 'verified-provider', reason: PASS_REASON }
      : {
          allowed: false,
          source: 'verified-provider',
          reason: NOT_SUBSCRIBED_REASON,
        },
}

function previewEnabled(): boolean {
  // Release configuration, not user state. Absent means on: the 3.0 PWA ships
  // the preview, and a build can turn it off by setting this to "off".
  const env = import.meta.env as Record<string, unknown> | undefined
  return env?.VITE_GARDEN_PASS_PREVIEW !== 'off'
}

/**
 * The provider in force, decided by how this build was configured: Google
 * Play in the Android app (where the preview never applies), otherwise the
 * PWA preview unless the build turned it off.
 *
 * Deliberately not derived from AppState. Reading entitlement out of the
 * garden would mean a hand-edited backup could grant it, and a backup is a
 * file the gardener owns and can write anything into.
 */
export function releasePassProvider(): GardenPassProvider | undefined {
  if (isAndroidApp()) return playProvider
  return previewEnabled() ? previewProvider : undefined
}

const NO_ACCESS: GardenPassAccess = {
  allowed: false,
  source: 'none',
  reason: NO_ACCESS_REASON,
}

/**
 * The one place anything asks whether a pass feature is available.
 *
 * Every caller -- equipping, rendering, backdrop selection, the shop -- goes
 * through here, so there is a single answer to change when a real provider
 * arrives rather than several access checks that could disagree.
 */
export function gardenPassAccess(
  feature: GardenPassFeature,
  // Omitted means "whatever this release configured". `null` means "no
  // provider at all", which a default parameter cannot express -- passing
  // undefined would silently fall back to the release provider and make a
  // build without the pass impossible to represent or test.
  provider?: GardenPassProvider | null,
): GardenPassAccess {
  const resolved = provider === undefined ? releasePassProvider() : provider
  if (!resolved) return NO_ACCESS
  const result = resolved.access(feature)
  // A provider that claims a source it is not cannot be allowed to launder a
  // preview into a verified purchase.
  if (result.source !== resolved.source) return NO_ACCESS
  return result
}

/** Whether a feature is usable right now. */
export function hasGardenPassFeature(
  feature: GardenPassFeature,
  provider?: GardenPassProvider | null,
): boolean {
  return gardenPassAccess(feature, provider).allowed
}

/**
 * The feature a shop item needs, if any.
 *
 * Keeps the existing `premium` flag meaningful without a catalog migration:
 * the flag says "this is pass content", and the mapping says which feature
 * that corresponds to.
 */
export function passFeatureForItem(
  item: Pick<ShopItemDefinition, 'premium'>,
): GardenPassFeature | undefined {
  return item.premium ? 'pass-cosmetics' : undefined
}

/**
 * Whether a gardener may wear an item.
 *
 * Ordinary cosmetics are owned permanently, which is a fact about their
 * garden. Pass cosmetics are available while access is, which is a fact about
 * the release -- so they are never written into `ownedItemIds`. Minting
 * permanent ownership from a temporary grant is exactly the thing that would
 * survive the pass ending and quietly become a free item forever.
 */
export function canWearItem(
  ownedItemIds: readonly string[],
  item: Pick<ShopItemDefinition, 'id' | 'premium'>,
  provider?: GardenPassProvider | null,
): boolean {
  const feature = passFeatureForItem(item)
  if (feature) return hasGardenPassFeature(feature, provider)
  return ownedItemIds.includes(item.id)
}
