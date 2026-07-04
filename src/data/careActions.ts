import type { CareActionDefinition, CreatureStage } from '../types'

/**
 * Pet-care actions, grouped by life stage. Every action may be performed once
 * per creature per local day. Any action counts as that day's care check-in
 * for the creature's current stage; three distinct care days advance the
 * stage (butterflies simply keep deepening their bond).
 */
export const careActions: CareActionDefinition[] = [
  // Egg — quiet, watchful care
  {
    id: 'egg-warm',
    stage: 'egg',
    name: 'Keep warm',
    description: 'Cup your hands around the leaf and share a little warmth.',
    icon: 'sun',
    bond: 1,
  },
  {
    id: 'egg-mist',
    stage: 'egg',
    name: 'Morning mist',
    description: 'A whisper of spring water keeps the egg from drying out.',
    icon: 'droplet',
    bond: 2,
    requiresItemId: 'spring-water',
  },
  {
    id: 'egg-song',
    stage: 'egg',
    name: 'Hum a lullaby',
    description: 'Tiny hearts hear more than we think.',
    icon: 'music',
    bond: 1,
  },
  {
    id: 'egg-watch',
    stage: 'egg',
    name: 'Watch over',
    description: 'Check the leaf, shoo away the ants, and simply be near.',
    icon: 'eye',
    bond: 1,
  },

  // Caterpillar — hungry, playful care
  {
    id: 'cat-feed',
    stage: 'caterpillar',
    name: 'Fresh leaves',
    description: 'Serve a bundle of tender host-plant leaves.',
    icon: 'leaf',
    bond: 2,
    requiresItemId: 'leaf-bundle',
  },
  {
    id: 'cat-snack',
    stage: 'caterpillar',
    name: 'Berry treat',
    description: 'A sweet berry snack for a very hungry caterpillar.',
    icon: 'berry',
    bond: 2,
    requiresItemId: 'berry-treat',
  },
  {
    id: 'cat-bath',
    stage: 'caterpillar',
    name: 'Dew bath',
    description: 'A gentle rinse in cool leaf dew, then a pat dry.',
    icon: 'bath',
    bond: 2,
    requiresItemId: 'bath-dew',
  },
  {
    id: 'cat-play',
    stage: 'caterpillar',
    name: 'Playtime',
    description: 'An obstacle course of twigs — inch, wiggle, victory!',
    icon: 'play',
    bond: 1,
  },
  {
    id: 'cat-tuck',
    stage: 'caterpillar',
    name: 'Tuck in',
    description: 'Fold a soft leaf blanket over a sleepy caterpillar.',
    icon: 'moon',
    bond: 1,
  },

  // Chrysalis — patient, protective care
  {
    id: 'chr-mist',
    stage: 'chrysalis',
    name: 'Gentle mist',
    description: 'Keep the chrysalis silk supple with fine spring water.',
    icon: 'droplet',
    bond: 2,
    requiresItemId: 'spring-water',
  },
  {
    id: 'chr-sun',
    stage: 'chrysalis',
    name: 'Warm sunbeam',
    description: 'Angle a patch of morning light onto the chrysalis.',
    icon: 'sun',
    bond: 1,
  },
  {
    id: 'chr-song',
    stage: 'chrysalis',
    name: 'Words of courage',
    description: 'Big changes are easier with a kind voice nearby.',
    icon: 'music',
    bond: 1,
  },
  {
    id: 'chr-guard',
    stage: 'chrysalis',
    name: 'Stand guard',
    description: 'Keep watch while the quiet work happens inside.',
    icon: 'eye',
    bond: 1,
  },

  // Butterfly — lifelong companionship
  {
    id: 'but-nectar',
    stage: 'butterfly',
    name: 'Nectar sip',
    description: 'Offer a golden drop of flower nectar.',
    icon: 'nectar',
    bond: 2,
    requiresItemId: 'nectar-drop',
  },
  {
    id: 'but-fruit',
    stage: 'butterfly',
    name: 'Fruit slice',
    description: 'Ripe fruit is a butterfly delicacy.',
    icon: 'berry',
    bond: 2,
    requiresItemId: 'fruit-slice',
  },
  {
    id: 'but-puddle',
    stage: 'butterfly',
    name: 'Puddling bath',
    description: 'A shallow mineral puddle for splashing and sipping.',
    icon: 'bath',
    bond: 2,
    requiresItemId: 'bath-dew',
  },
  {
    id: 'but-groom',
    stage: 'butterfly',
    name: 'Groom wings',
    description: 'Dust the wing scales with the softest brush in the shed.',
    icon: 'sparkle',
    bond: 1,
  },
  {
    id: 'but-fly',
    stage: 'butterfly',
    name: 'Fly together',
    description: 'Take a loop around the garden, wing to hand.',
    icon: 'flight',
    bond: 1,
  },
]

export function careActionsForStage(stage: CreatureStage) {
  return careActions.filter((action) => action.stage === stage)
}

export function getCareAction(actionId: string) {
  return careActions.find((action) => action.id === actionId)
}
