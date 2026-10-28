/**
 * The garden's line under its name at night (plan b G5): "The milkweed is
 * resting under the moon", where the day says it is "warm in the morning
 * light". The day's lines (data/observations) stay exactly as they are; these
 * are chosen by the same rule, the gardener's active butterfly or any garden,
 * so every species has its own, each naming its host plant (lib/gardenLines).
 * Loaded with the garden's line, never in the first load.
 *
 * Butterflies fly by day and rest at night, so no line has one flying, and
 * none speaks of the sun or the hour. Where a line says what a butterfly or
 * caterpillar does, it is one of its checked facts in data/speciesFacts:
 * cloudless sulphurs roost alone, queens and zebra longwings together, and
 * spicebush and American lady caterpillars come out to feed at night.
 */
export const nightLines: ReadonlyArray<readonly [speciesId: string, text: string]> = [
  ['monarch', 'The milkweed is resting under the moon.'],
  ['monarch', 'A monarch hangs still beneath a leaf, wings folded for the night.'],
  ['black-swallowtail', 'The parsley patch is quiet under the stars.'],
  ['black-swallowtail', 'A swallowtail rests with its dark wings folded tight.'],
  ['tiger-swallowtail', 'The tulip tree keeps its green room dark and still tonight.'],
  ['tiger-swallowtail', 'Yellow stripes are folded away until the garden warms again.'],
  ['red-admiral', 'Dew gathers on the nettle leaves tonight.'],
  ['red-admiral', 'The red admiral has folded its scarlet bands away for the night.'],
  ['painted-lady', 'The thistle stands silver in the moonlight.'],
  ['painted-lady', 'A painted lady rests low among the leaves, her travels paused.'],
  ['cloudless-sulphur', 'The partridge pea is still beneath the stars.'],
  ['cloudless-sulphur', 'A sulphur roosts alone tonight, all but lost against a yellow leaf.'],
  ['blue-morpho', 'Night air settles over the rainforest legume.'],
  ['blue-morpho', 'The morpho rests with its wings closed, brown as the shadows.'],
  ['glasswing', 'The nightshade keeps its shaded corner quiet tonight.'],
  ['glasswing', 'A glasswing rests beneath a leaf, almost invisible in the dark.'],
  ['queen', 'Queens rest together tonight in a shared roost near the milkweed.'],
  ['queen', 'Chestnut wings are folded away until the garden warms.'],
  ['gulf-fritillary', 'The passionflower vine curls quietly in the dark.'],
  ['gulf-fritillary', 'Silver spots catch a little moonlight on folded wings.'],
  ['zebra-longwing', 'Zebra longwings gather in a small group to roost together for the night.'],
  ['zebra-longwing', 'The passionflowers rest under a quiet moon.'],
  ['common-buckeye', 'The plantain leaves are cool and still tonight.'],
  ['common-buckeye', 'A buckeye rests with its watchful eyespots closed away.'],
  ['viceroy', 'The willow’s branches sway softly in the night air.'],
  ['viceroy', 'A viceroy rests among the willow leaves until the garden warms.'],
  ['mourning-cloak', 'The willow bark holds the night’s quiet.'],
  ['mourning-cloak', 'The mourning cloak rests, as dark and still as the bark around it.'],
  ['spicebush-swallowtail', 'The spicebush stands quiet in the cool night air.'],
  ['spicebush-swallowtail', 'Spicebush caterpillars leave their folded leaves to feed in the dark.'],
  ['giant-swallowtail', 'The citrus leaves shine a little under the moon.'],
  ['giant-swallowtail', 'The garden’s largest visitor rests, folded small for the night.'],
  ['cabbage-white', 'Night dew beads the brassica leaves.'],
  ['cabbage-white', 'A cabbage white rests, a pale shape among the leaves.'],
  ['baltimore-checkerspot', 'The turtlehead patch is still under the stars.'],
  ['baltimore-checkerspot', 'Checkered wings are folded away until the garden warms.'],
  ['pipevine-swallowtail', 'The pipevine’s heart-shaped leaves rest in the dark.'],
  ['pipevine-swallowtail', 'A pipevine swallowtail hangs still, its blue sheen waiting for the light.'],
  ['american-lady', 'The pussytoes glow softly silver under the moon.'],
  ['american-lady', 'An American lady caterpillar slips out of its silk shelter to feed tonight.'],
  ['great-spangled-fritillary', 'The violets keep their nursery close to the soil tonight.'],
  ['great-spangled-fritillary', 'A fritillary rests with silver spangles on its folded wings.'],
  ['spring-azure', 'The dogwood stands pale in the moonlight.'],
  ['spring-azure', 'A tiny azure rests with its wings closed, pale as the moon.'],
  ['red-spotted-purple', 'The black cherry leaves rustle softly in the night breeze.'],
  ['red-spotted-purple', 'Red-orange spots rest along a folded wing in the dark.'],
  ['california-sister', 'The oak keeps watch over the garden through the night.'],
  ['california-sister', 'A California sister rests among the oak leaves for the night.'],
  ['atala', 'The coontie’s leaves stand dark and glossy under the moon.'],
  ['atala', 'An atala rests, a few blue spots glinting on its folded wings.'],
  ['all', 'The garden is resting under the moon.'],
  ['all', 'Something is still growing tonight, even in the dark.'],
  ['all', 'Butterflies rest through the night, folded under leaves and in tall grass.'],
  ['all', 'A quiet garden can hold the night gently.'],
]
