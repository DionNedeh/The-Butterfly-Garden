/**
 * How each aura moves, and so the class its art and its layer carry. One
 * table, so the art and the motion cannot drift apart. The aurora ring is
 * the one that holds still.
 */
const AURA_MOTION: Record<string, AuraMotion> = {
  'clover-motes': 'petals',
  'dandelion-drift': 'petals',
  'petal-swirl': 'petals',
  'dew-orbit': 'fireflies',
  'firefly-glow': 'fireflies',
  'sun-pollen': 'sparkle',
  'sparkle-aura': 'sparkle',
  'rainbow-trail': 'rainbow',
  'aurora-aura': 'aurora',
}

export type AuraMotion = 'petals' | 'fireflies' | 'sparkle' | 'rainbow' | 'aurora'

export function auraMotion(itemId: string): AuraMotion | undefined {
  return Object.hasOwn(AURA_MOTION, itemId) ? AURA_MOTION[itemId] : undefined
}
