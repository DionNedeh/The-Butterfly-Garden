import type { OutfitSlot } from '../types'

/**
 * Every piece the closet can hold, by id, and the slot it is worn in: the
 * shop's cosmetics (data/shopItems), listed again on their own. Storage
 * checks a stored outfit or saved look against this (validateGarden); were
 * it to load the whole shop instead, the shop and the sprites would move
 * into the app's first chunk. catalog.test.ts keeps the two in step.
 */
export const closetSlots: Readonly<Record<string, OutfitSlot>> = {
  'sprout-cap': 'headwear',
  'flower-crown': 'headwear',
  'tiny-tophat': 'headwear',
  'acorn-beret': 'headwear',
  'star-diadem': 'headwear',
  'moonlit-halo': 'headwear',
  'silk-bow': 'accessory',
  'leaf-scarf': 'accessory',
  'dew-pendant': 'accessory',
  'seed-satchel': 'accessory',
  'moonstone-charm': 'accessory',
  'comet-brooch': 'accessory',
  'sparkle-aura': 'aura',
  'petal-swirl': 'aura',
  'firefly-glow': 'aura',
  'daisy-bonnet': 'headwear',
  'mushroom-cap': 'headwear',
  'fern-tiara': 'headwear',
  'dewdrop-circlet': 'headwear',
  'pollen-pouch': 'accessory',
  'petal-collar': 'accessory',
  'acorn-locket': 'accessory',
  'starlace-ribbon': 'accessory',
  'clover-motes': 'aura',
  'dandelion-drift': 'aura',
  'dew-orbit': 'aura',
  'sun-pollen': 'aura',
  'royal-crown': 'headwear',
  'aurora-aura': 'aura',
  'rainbow-trail': 'aura',
  'celestial-cape': 'accessory',
}
