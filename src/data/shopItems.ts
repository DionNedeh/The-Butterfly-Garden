import type { OutfitSlot, ShopItemDefinition } from '../types'

/**
 * The 2.0 shop catalog.
 *
 * - Supplies are consumables spent by care actions (steady Nectar sink).
 * - Cosmetics are permanent closet items, equipable per creature and slot.
 * - Stardust items are long-term goals earned through bonds and emergences.
 * - Premium items belong to the future Garden Pass and show "Coming soon".
 */
export const shopItems: ShopItemDefinition[] = [
  // ---- Care supplies -------------------------------------------------
  {
    id: 'leaf-bundle',
    kind: 'supply',
    name: 'Leaf Bundle',
    description: 'Tender host-plant leaves for hungry caterpillars.',
    icon: 'leaf',
    cost: 2,
    currency: 'nectar',
  },
  {
    id: 'berry-treat',
    kind: 'supply',
    name: 'Berry Treat',
    description: 'A sweet snack that makes caterpillar cheeks rounder.',
    icon: 'berry',
    cost: 3,
    currency: 'nectar',
  },
  {
    id: 'spring-water',
    kind: 'supply',
    name: 'Spring Water',
    description: 'Fine mist for eggs and chrysalises.',
    icon: 'droplet',
    cost: 2,
    currency: 'nectar',
  },
  {
    id: 'bath-dew',
    kind: 'supply',
    name: 'Bath Dew',
    description: 'Cool morning dew for baths and puddling parties.',
    icon: 'bath',
    cost: 3,
    currency: 'nectar',
  },
  {
    id: 'nectar-drop',
    kind: 'supply',
    name: 'Nectar Drop',
    description: 'A golden drop, bottled at dawn for butterfly breakfasts.',
    icon: 'nectar',
    cost: 2,
    currency: 'nectar',
  },
  {
    id: 'fruit-slice',
    kind: 'supply',
    name: 'Fruit Slice',
    description: 'Ripe orchard fruit, sliced thin for delicate feet.',
    icon: 'berry',
    cost: 3,
    currency: 'nectar',
  },

  // ---- Headwear ------------------------------------------------------
  {
    id: 'sprout-cap',
    kind: 'cosmetic',
    slot: 'headwear',
    stages: ['caterpillar', 'butterfly'],
    name: 'Sprout Cap',
    description: 'A tiny green cap with one hopeful sprout on top.',
    icon: 'leaf',
    cost: 12,
    currency: 'nectar',
  },
  {
    id: 'flower-crown',
    kind: 'cosmetic',
    slot: 'headwear',
    stages: ['caterpillar', 'butterfly'],
    name: 'Flower Crown',
    description: 'Woven daisies sized for very small royalty.',
    icon: 'flower',
    cost: 20,
    currency: 'nectar',
  },
  {
    id: 'tiny-tophat',
    kind: 'cosmetic',
    slot: 'headwear',
    stages: ['caterpillar', 'butterfly'],
    name: 'Tiny Top Hat',
    description: 'For garden galas and other formal occasions.',
    icon: 'hat',
    cost: 24,
    currency: 'nectar',
  },
  {
    id: 'acorn-beret',
    kind: 'cosmetic',
    slot: 'headwear',
    stages: ['caterpillar', 'butterfly'],
    name: 'Acorn Beret',
    description: 'An artist’s beret pressed from a lucky acorn cap.',
    icon: 'hat',
    cost: 16,
    currency: 'nectar',
  },
  {
    id: 'star-diadem',
    kind: 'cosmetic',
    slot: 'headwear',
    stages: ['butterfly'],
    name: 'Star Diadem',
    description: 'A sliver of starlight that settles between the antennae.',
    icon: 'sparkle',
    cost: 6,
    currency: 'stardust',
  },

  // ---- Accessories ---------------------------------------------------
  {
    id: 'silk-bow',
    kind: 'cosmetic',
    slot: 'accessory',
    stages: ['egg', 'caterpillar', 'chrysalis', 'butterfly'],
    name: 'Silk Bow',
    description: 'Spun from leftover chrysalis silk. Very dignified.',
    icon: 'bow',
    cost: 10,
    currency: 'nectar',
  },
  {
    id: 'leaf-scarf',
    kind: 'cosmetic',
    slot: 'accessory',
    stages: ['caterpillar', 'butterfly'],
    name: 'Leaf Scarf',
    description: 'A cozy wrap for chilly mornings on the milkweed.',
    icon: 'leaf',
    cost: 14,
    currency: 'nectar',
  },
  {
    id: 'dew-pendant',
    kind: 'cosmetic',
    slot: 'accessory',
    stages: ['egg', 'caterpillar', 'chrysalis', 'butterfly'],
    name: 'Dew Pendant',
    description: 'One perfect dewdrop on a grass-blade chain.',
    icon: 'droplet',
    cost: 18,
    currency: 'nectar',
  },
  {
    id: 'seed-satchel',
    kind: 'cosmetic',
    slot: 'accessory',
    stages: ['caterpillar', 'butterfly'],
    name: 'Seed Satchel',
    description: 'A tiny traveling bag for a well-prepared companion.',
    icon: 'seed',
    cost: 16,
    currency: 'nectar',
  },
  {
    id: 'moonstone-charm',
    kind: 'cosmetic',
    slot: 'accessory',
    stages: ['chrysalis', 'butterfly'],
    name: 'Moonstone Charm',
    description: 'Glows faintly on new-moon nights.',
    icon: 'moon',
    cost: 5,
    currency: 'stardust',
  },

  // ---- Auras ----------------------------------------------------------
  {
    id: 'sparkle-aura',
    kind: 'cosmetic',
    slot: 'aura',
    stages: ['egg', 'caterpillar', 'chrysalis', 'butterfly'],
    name: 'Sparkle Aura',
    description: 'A drifting ring of garden glitter.',
    icon: 'sparkle',
    cost: 30,
    currency: 'nectar',
  },
  {
    id: 'petal-swirl',
    kind: 'cosmetic',
    slot: 'aura',
    stages: ['caterpillar', 'chrysalis', 'butterfly'],
    name: 'Petal Swirl',
    description: 'Rose petals orbit like a tiny gentle storm.',
    icon: 'flower',
    cost: 8,
    currency: 'stardust',
  },
  {
    id: 'firefly-glow',
    kind: 'cosmetic',
    slot: 'aura',
    stages: ['egg', 'caterpillar', 'chrysalis', 'butterfly'],
    name: 'Firefly Glow',
    description: 'Two loyal fireflies keep your companion company.',
    icon: 'sun',
    cost: 10,
    currency: 'stardust',
  },

  // ---- Garden Pass exclusives (coming soon) ---------------------------
  {
    id: 'royal-crown',
    kind: 'cosmetic',
    slot: 'headwear',
    stages: ['butterfly'],
    name: 'Royal Monarch Crown',
    description: 'Gilded regalia for the sovereign of the garden.',
    icon: 'crown',
    cost: 0,
    currency: 'stardust',
    premium: true,
  },
  {
    id: 'aurora-aura',
    kind: 'cosmetic',
    slot: 'aura',
    stages: ['butterfly'],
    name: 'Aurora Veil',
    description: 'Northern lights that follow wherever they fly.',
    icon: 'sparkle',
    cost: 0,
    currency: 'stardust',
    premium: true,
  },
  {
    id: 'rainbow-trail',
    kind: 'cosmetic',
    slot: 'aura',
    stages: ['butterfly'],
    name: 'Rainbow Trail',
    description: 'Every wingbeat paints a fading ribbon of color.',
    icon: 'flight',
    cost: 0,
    currency: 'stardust',
    premium: true,
  },
  {
    id: 'celestial-cape',
    kind: 'cosmetic',
    slot: 'accessory',
    stages: ['chrysalis', 'butterfly'],
    name: 'Celestial Cape',
    description: 'A midnight cape stitched with real constellations.',
    icon: 'moon',
    cost: 0,
    currency: 'stardust',
    premium: true,
  },
]

export const supplyItems = shopItems.filter((item) => item.kind === 'supply')
export const cosmeticItems = shopItems.filter(
  (item) => item.kind === 'cosmetic' && !item.premium,
)
export const premiumItems = shopItems.filter((item) => item.premium)

export function getShopItem(itemId: string) {
  return shopItems.find((item) => item.id === itemId)
}

export const outfitSlots: Array<{ id: OutfitSlot; label: string }> = [
  { id: 'headwear', label: 'Headwear' },
  { id: 'accessory', label: 'Accessory' },
  { id: 'aura', label: 'Aura' },
]
