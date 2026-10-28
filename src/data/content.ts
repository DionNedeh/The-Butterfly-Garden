import type {
  MoodEntry,
  PlantDefinition,
  ReflectionPrompt,
  SpeciesDefinition,
} from '../types'

/**
 * The garden's butterflies. Their facts, and the sources each species was
 * checked against, load with the pages that show them (data/speciesFacts).
 */
export const species: SpeciesDefinition[] = [
  {
    id: 'monarch',
    commonName: 'Monarch',
    scientificName: 'Danaus plexippus',
    hostPlantIds: ['milkweed'],
    wingColors: ['#e87832', '#27231f'],
    visualPattern: 'monarch-veins',
    wingShape: 'rounded',
  },
  {
    id: 'black-swallowtail',
    commonName: 'Black Swallowtail',
    scientificName: 'Papilio polyxenes',
    hostPlantIds: ['parsley'],
    wingColors: ['#252a2d', '#e9c94b'],
    visualPattern: 'swallowtail-gold-spots',
    wingShape: 'swallowtail',
  },
  {
    id: 'tiger-swallowtail',
    commonName: 'Eastern Tiger Swallowtail',
    scientificName: 'Papilio glaucus',
    hostPlantIds: ['tulip-tree'],
    wingColors: ['#f2cf4d', '#282726'],
    visualPattern: 'tiger-stripes',
    wingShape: 'swallowtail',
  },
  {
    id: 'red-admiral',
    commonName: 'Red Admiral',
    scientificName: 'Vanessa atalanta',
    hostPlantIds: ['nettle'],
    wingColors: ['#302b2a', '#d95c3f'],
    visualPattern: 'admiral-red-bands',
    wingShape: 'ragged',
  },
  {
    id: 'painted-lady',
    commonName: 'Painted Lady',
    scientificName: 'Vanessa cardui',
    hostPlantIds: ['thistle'],
    wingColors: ['#d77b43', '#4b3a32'],
    visualPattern: 'painted-mosaic',
    wingShape: 'ragged',
  },
  {
    id: 'cloudless-sulphur',
    commonName: 'Cloudless Sulphur',
    scientificName: 'Phoebis sennae',
    hostPlantIds: ['partridge-pea'],
    wingColors: ['#f3db4e', '#dd8b3c'],
    visualPattern: 'sulphur-blush',
    wingShape: 'broad',
  },
  {
    id: 'blue-morpho',
    commonName: 'Blue Morpho',
    scientificName: 'Morpho peleides',
    hostPlantIds: ['rainforest-legume'],
    wingColors: ['#168bd2', '#203b5c'],
    visualPattern: 'morpho-shimmer',
    wingShape: 'broad',
  },
  {
    id: 'glasswing',
    commonName: 'Glasswing',
    scientificName: 'Greta oto',
    hostPlantIds: ['nightshade'],
    wingColors: ['rgba(224, 242, 235, 0.42)', '#6c5547'],
    visualPattern: 'glasswing-clear',
    wingShape: 'clear',
  },
  {
    id: 'queen',
    commonName: 'Queen',
    scientificName: 'Danaus gilippus',
    hostPlantIds: ['milkweed'],
    wingColors: ['#9f4e2f', '#30251f'],
    visualPattern: 'queen-pale-dots',
    wingShape: 'rounded',
  },
  {
    id: 'gulf-fritillary',
    commonName: 'Gulf Fritillary',
    scientificName: 'Agraulis vanillae',
    hostPlantIds: ['passionflower'],
    wingColors: ['#e66f2c', '#5a3329'],
    visualPattern: 'fritillary-silver',
    wingShape: 'longwing',
  },
  {
    id: 'zebra-longwing',
    commonName: 'Zebra Longwing',
    scientificName: 'Heliconius charithonia',
    hostPlantIds: ['passionflower'],
    wingColors: ['#252525', '#f2d868'],
    visualPattern: 'zebra-long-stripes',
    wingShape: 'longwing',
  },
  {
    id: 'common-buckeye',
    commonName: 'Common Buckeye',
    scientificName: 'Junonia coenia',
    hostPlantIds: ['plantain'],
    wingColors: ['#9b7656', '#4b3429'],
    visualPattern: 'buckeye-eyespots',
    wingShape: 'broad',
  },
  {
    id: 'viceroy',
    commonName: 'Viceroy',
    scientificName: 'Limenitis archippus',
    hostPlantIds: ['willow'],
    wingColors: ['#d66a2e', '#2d2723'],
    visualPattern: 'viceroy-black-line',
    wingShape: 'rounded',
  },
  {
    id: 'mourning-cloak',
    commonName: 'Mourning Cloak',
    scientificName: 'Nymphalis antiopa',
    hostPlantIds: ['willow'],
    wingColors: ['#4b3540', '#e4c56d'],
    visualPattern: 'mourning-gold-border',
    wingShape: 'ragged',
  },
  {
    id: 'spicebush-swallowtail',
    commonName: 'Spicebush Swallowtail',
    scientificName: 'Papilio troilus',
    hostPlantIds: ['spicebush'],
    wingColors: ['#24282a', '#4aa0a1'],
    visualPattern: 'spicebush-blue-dust',
    wingShape: 'swallowtail',
  },
  {
    id: 'giant-swallowtail',
    commonName: 'Giant Swallowtail',
    scientificName: 'Papilio cresphontes',
    hostPlantIds: ['citrus'],
    wingColors: ['#332d28', '#efd56d'],
    visualPattern: 'giant-yellow-sashes',
    wingShape: 'swallowtail',
  },
  {
    id: 'cabbage-white',
    commonName: 'Cabbage White',
    scientificName: 'Pieris rapae',
    hostPlantIds: ['brassica'],
    wingColors: ['#f2f0df', '#55524c'],
    visualPattern: 'cabbage-ink-spots',
    wingShape: 'small',
  },
  {
    id: 'baltimore-checkerspot',
    commonName: 'Baltimore Checkerspot',
    scientificName: 'Euphydryas phaeton',
    hostPlantIds: ['white-turtlehead'],
    wingColors: ['#1f2424', '#f07b36'],
    visualPattern: 'baltimore-checkers',
    wingShape: 'rounded',
  },
  {
    id: 'pipevine-swallowtail',
    commonName: 'Pipevine Swallowtail',
    scientificName: 'Battus philenor',
    hostPlantIds: ['pipevine'],
    wingColors: ['#171c22', '#2274a8'],
    visualPattern: 'pipevine-iridescent',
    wingShape: 'swallowtail',
  },
  {
    id: 'american-lady',
    commonName: 'American Lady',
    scientificName: 'Vanessa virginiensis',
    hostPlantIds: ['pussytoes'],
    wingColors: ['#df7a3d', '#2c2826'],
    visualPattern: 'american-lady-eyes',
    wingShape: 'ragged',
  },
  {
    id: 'great-spangled-fritillary',
    commonName: 'Great Spangled Fritillary',
    scientificName: 'Speyeria cybele',
    hostPlantIds: ['violet'],
    wingColors: ['#d97835', '#553223'],
    visualPattern: 'spangled-fritillary',
    wingShape: 'broad',
  },
  {
    id: 'spring-azure',
    commonName: 'Spring Azure',
    scientificName: 'Celastrina ladon',
    hostPlantIds: ['dogwood'],
    wingColors: ['#a9c9f2', '#536f9b'],
    visualPattern: 'azure-soft-edge',
    wingShape: 'small',
  },
  {
    id: 'red-spotted-purple',
    commonName: 'Red-spotted Purple',
    scientificName: 'Limenitis arthemis astyanax',
    hostPlantIds: ['black-cherry'],
    wingColors: ['#171b2b', '#3156aa'],
    visualPattern: 'red-spotted-purple',
    wingShape: 'broad',
  },
  {
    id: 'california-sister',
    commonName: 'California Sister',
    scientificName: 'Adelpha californica',
    hostPlantIds: ['oak'],
    wingColors: ['#2d241f', '#f0e7c8'],
    visualPattern: 'california-sister-bands',
    wingShape: 'rounded',
  },
  {
    id: 'atala',
    commonName: 'Atala',
    scientificName: 'Eumaeus atala',
    hostPlantIds: ['coontie'],
    wingColors: ['#111827', '#1f9bb4'],
    visualPattern: 'atala-jewel-spots',
    wingShape: 'small',
  },
]

/**
 * Written as rows so the catalogue stays readable at a glance. The tuple is
 * typed, so a row with its fields in the wrong order fails to compile --
 * casting each field out of a loose array, as this used to, would not.
 */
type PlantRow = readonly [
  id: string,
  name: string,
  scientificName: string,
  kind: PlantDefinition['kind'],
  speciesIds: string[],
  color: string,
  description: string,
]

const plantRows: readonly PlantRow[] = [
  ['milkweed', 'Milkweed', 'Asclepias spp.', 'host', ['monarch', 'queen'], '#c884a5', 'A vital nursery for monarch and queen caterpillars.'],
  ['parsley', 'Parsley', 'Petroselinum crispum', 'host', ['black-swallowtail'], '#6e9e57', 'Feathery leaves welcomed by black swallowtails.'],
  ['tulip-tree', 'Tulip Tree', 'Liriodendron tulipifera', 'host', ['tiger-swallowtail'], '#d5a83e', 'A stately native host for tiger swallowtails.'],
  ['nettle', 'Stinging Nettle', 'Urtica dioica', 'host', ['red-admiral'], '#73934a', 'A protected corner for red admiral caterpillars.'],
  ['thistle', 'Native Thistle', 'Cirsium spp.', 'host', ['painted-lady'], '#9e74a8', 'Soft purple blooms and painted lady shelter.'],
  ['partridge-pea', 'Partridge Pea', 'Chamaecrista fasciculata', 'host', ['cloudless-sulphur'], '#e1b73e', 'Sunny native flowers for cloudless sulphurs.'],
  ['rainforest-legume', 'Rainforest Legume', 'Machaerium spp.', 'host', ['blue-morpho'], '#3c89a8', 'A tropical host plant for the shimmering blue morpho.'],
  ['nightshade', 'Tropical Nightshade', 'Cestrum spp.', 'host', ['glasswing'], '#8e729c', 'A shaded tropical nursery for glasswing caterpillars.'],
  ['passionflower', 'Passionflower Vine', 'Passiflora spp.', 'host', ['gulf-fritillary', 'zebra-longwing'], '#8769ae', 'An intricate flowering vine shared by fritillaries and longwings.'],
  ['plantain', 'Native Plantain', 'Plantago spp.', 'host', ['common-buckeye'], '#78945e', 'Low leafy rosettes that welcome common buckeye caterpillars.'],
  ['willow', 'Willow', 'Salix spp.', 'host', ['viceroy', 'mourning-cloak'], '#83a66b', 'Tender willow leaves shelter viceroys and mourning cloaks.'],
  ['spicebush', 'Spicebush', 'Lindera benzoin', 'host', ['spicebush-swallowtail'], '#b6a741', 'A fragrant native shrub and spicebush swallowtail nursery.'],
  ['citrus', 'Citrus Tree', 'Citrus spp.', 'host', ['giant-swallowtail'], '#e0a642', 'Glossy leaves where giant swallowtail caterpillars can grow.'],
  ['brassica', 'Garden Brassica', 'Brassica spp.', 'host', ['cabbage-white'], '#75a36b', 'Mustard-family leaves favored by cabbage white caterpillars.'],
  ['white-turtlehead', 'White Turtlehead', 'Chelone glabra', 'host', ['baltimore-checkerspot'], '#e8dfc8', 'A wet-meadow native where Baltimore checkerspots begin.'],
  ['pipevine', 'Pipevine', 'Aristolochia spp.', 'host', ['pipevine-swallowtail'], '#5f8061', 'Heart-shaped leaves for pipevine swallowtail caterpillars.'],
  ['pussytoes', 'Pussytoes', 'Antennaria spp.', 'host', ['american-lady'], '#b9b2a4', 'Soft silver leaves where American lady caterpillars make shelters.'],
  ['violet', 'Violet', 'Viola spp.', 'host', ['great-spangled-fritillary'], '#805aa6', 'Low violet leaves that support great spangled fritillaries.'],
  ['dogwood', 'Flowering Dogwood', 'Cornus florida', 'host', ['spring-azure'], '#d9d9c5', 'Spring flower buds where small azure caterpillars feed.'],
  ['black-cherry', 'Black Cherry', 'Prunus serotina', 'host', ['red-spotted-purple'], '#6f8b58', 'A native tree that shelters red-spotted purple caterpillars.'],
  ['oak', 'Oak', 'Quercus spp.', 'host', ['california-sister'], '#8f8a42', 'Strong oak leaves for California sister caterpillars.'],
  ['coontie', 'Coontie', 'Zamia integrifolia', 'host', ['atala'], '#527d6c', 'A cycad host that helped the jewel-like atala return.'],
  ['aster', 'Aster', 'Symphyotrichum spp.', 'nectar', [], '#7c70a8', 'Late-season nectar in lavender stars.'],
  ['coneflower', 'Purple Coneflower', 'Echinacea purpurea', 'nectar', [], '#b35f84', 'A broad landing place rich with nectar.'],
  ['zinnia', 'Zinnia', 'Zinnia elegans', 'nectar', [], '#cf654f', 'Cheerful blooms for many visiting butterflies.'],
]

export const plants: PlantDefinition[] = plantRows.map(
  ([id, name, scientificName, kind, speciesIds, color, description]) => ({
    id,
    name,
    scientificName,
    kind,
    speciesIds,
    color,
    description,
  }),
)

/** The prompt shown when the gardener chooses to write without one. */
export const freeWritingPrompt: ReflectionPrompt = {
  id: 'free',
  text: 'Write freely',
  family: 'free',
}

/**
 * The five inner-weather levels, named in one place.
 *
 * Today asks for one in the morning, the Moonlight recap asks again at the end
 * of the day, and the journal renders both -- so the names have three readers
 * and belong here rather than being spelled out in each of them.
 */
export const moodLevels: Array<{
  level: MoodEntry['level']
  name: string
  weather: string
}> = [
  { level: 1, name: 'Stormy', weather: 'Heavy clouds' },
  { level: 2, name: 'Rainy', weather: 'Gentle rain' },
  { level: 3, name: 'Overcast', weather: 'Soft gray sky' },
  { level: 4, name: 'Bright', weather: 'Sun through leaves' },
  { level: 5, name: 'Radiant', weather: 'Clear warm light' },
]

/** Just the names, in level order, for places that only label a level. */
export const moodNames = moodLevels.map((mood) => mood.name)

export const butterflyNames = [
  'Juniper',
  'Clover',
  'Sol',
  'Poppy',
  'Willow',
  'Ember',
  'Lumen',
  'Fern',
  'Dawn',
  'Briar',
  'Mallow',
  'Saffron',
  'Hazel',
  'Indigo',
  'Maple',
  'Petal',
  'River',
  'Skye',
  'Wren',
  'Meadow',
  'Aster',
  'Opal',
  'Cedar',
  'Sunny',
  'Iris',
  'Marisol',
  'Rowan',
  'Bluebell',
  'Copper',
  'Sage',
  'Dahlia',
  'Robin',
]
