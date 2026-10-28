import type { MarkedRegion, RegionMark, RegionMarks } from '../lib/regionMarks'

/**
 * Where the garden's butterflies and plants live in the wild, by the region a
 * gardener can choose in Settings, and what to plant there for real
 * butterflies. Loaded only with the Guide, which is the one page that shows it.
 *
 * Checked in October 2026. A butterfly's sources are listed with its facts
 * (data/speciesFacts); the plants were checked against Kew's World Checklist
 * of Vascular Plants (through GBIF, https://api.gbif.org/v1/species) and,
 * for North America, the USDA PLANTS database
 * (https://plants.usda.gov). Each tip list names its own sources below.
 *
 * The rule for what is marked:
 * - native: it lives there naturally, migrants that arrive on their own each
 *   year included (a painted lady in Britain);
 * - seen: it occurs there but is not native, because people brought it or it
 *   arrives only rarely;
 * - absent: it does not occur there, or no good source says it does, so the
 *   Guide says nothing rather than suggest it could be met.
 */
const NATIVE: RegionMark = { presence: 'native' }
const FROM_MEXICO: RegionMark = { presence: 'native', note: 'Wild only from Mexico south.' }

export const speciesRegions: Readonly<Record<string, RegionMarks>> = {
  monarch: {
    'north-america': NATIVE,
    europe: { presence: 'seen', note: 'A very rare visitor to Britain and Ireland.' },
    australasia: {
      presence: 'seen',
      note: 'It came from America, and now breeds there.',
    },
  },
  'black-swallowtail': { 'north-america': NATIVE },
  'tiger-swallowtail': { 'north-america': NATIVE },
  'red-admiral': { 'north-america': NATIVE, europe: NATIVE },
  'painted-lady': {
    'north-america': NATIVE,
    europe: {
      presence: 'native',
      note: 'A migrant, in numbers that vary greatly from year to year.',
    },
    australasia: {
      presence: 'seen',
      where: 'Australia',
      note: 'Rare, mostly in Western Australia. The Australian painted lady is a different species.',
    },
  },
  'cloudless-sulphur': { 'north-america': NATIVE },
  'blue-morpho': { 'north-america': FROM_MEXICO },
  // Central American. No good source places it farther north, so nothing is
  // marked: silence is safer than suggesting it could be met.
  glasswing: {},
  queen: {
    'north-america': { presence: 'native', note: 'Mostly in the far south of the United States.' },
  },
  'gulf-fritillary': {
    'north-america': { presence: 'native', note: 'Mostly in the southern United States.' },
  },
  'zebra-longwing': {
    'north-america': { presence: 'native', note: 'In Florida and south Texas.' },
  },
  'common-buckeye': { 'north-america': NATIVE },
  viceroy: { 'north-america': NATIVE },
  'mourning-cloak': {
    'north-america': NATIVE,
    europe: { presence: 'native', note: 'Called the Camberwell beauty, and rare in Britain.' },
  },
  'spicebush-swallowtail': { 'north-america': NATIVE },
  'giant-swallowtail': { 'north-america': NATIVE },
  'cabbage-white': {
    'north-america': {
      presence: 'seen',
      note: 'Brought from Europe, and first found at Quebec City in 1860.',
    },
    europe: { presence: 'native', note: 'Known there as the small white.' },
    australasia: {
      presence: 'seen',
      note: 'Brought by people: in Australia since 1929, and in New Zealand too.',
    },
  },
  'baltimore-checkerspot': {
    'north-america': { presence: 'native', note: 'Local, in the East.' },
  },
  'pipevine-swallowtail': { 'north-america': NATIVE },
  'american-lady': {
    'north-america': NATIVE,
    europe: { presence: 'seen', note: 'An occasional visitor.' },
  },
  'great-spangled-fritillary': { 'north-america': NATIVE },
  'spring-azure': { 'north-america': NATIVE },
  'red-spotted-purple': { 'north-america': NATIVE },
  'california-sister': {
    'north-america': { presence: 'native', note: 'In California, southern Oregon and Nevada.' },
  },
  atala: {
    'north-america': { presence: 'native', note: 'In southeast Florida, the Bahamas and Cuba.' },
  },
}

/**
 * Plants are marked only where they are native: a plant grown everywhere as
 * a crop or an ornamental is no guide to what local butterflies need.
 *
 * The stinging nettle is not marked in North America: the USDA counts its
 * native nettle as Urtica dioica, but Kew's checklist names it a species of
 * its own, so the Guide claims neither.
 */
export const plantRegions: Readonly<Record<string, RegionMarks>> = {
  milkweed: { 'north-america': NATIVE },
  parsley: {
    europe: { presence: 'native', where: 'Greece', note: 'Grown as a herb almost everywhere.' },
  },
  'tulip-tree': { 'north-america': NATIVE },
  nettle: { europe: NATIVE },
  thistle: { 'north-america': NATIVE, europe: NATIVE },
  'partridge-pea': { 'north-america': NATIVE },
  'rainforest-legume': { 'north-america': FROM_MEXICO },
  nightshade: { 'north-america': FROM_MEXICO },
  passionflower: { 'north-america': NATIVE, australasia: NATIVE },
  plantain: { 'north-america': NATIVE, europe: NATIVE, australasia: NATIVE },
  willow: { 'north-america': NATIVE, europe: NATIVE },
  spicebush: { 'north-america': NATIVE },
  citrus: {
    australasia: { presence: 'native', where: 'Australia', note: 'Finger limes are Australian citrus.' },
  },
  brassica: { europe: NATIVE },
  'white-turtlehead': { 'north-america': NATIVE },
  pipevine: {
    'north-america': NATIVE,
    europe: { presence: 'native', note: 'Not wild in Britain.' },
    australasia: { presence: 'native', where: 'Australia' },
  },
  pussytoes: { 'north-america': NATIVE, europe: NATIVE },
  violet: { 'north-america': NATIVE, europe: NATIVE, australasia: NATIVE },
  dogwood: { 'north-america': NATIVE },
  'black-cherry': { 'north-america': NATIVE },
  oak: { 'north-america': NATIVE, europe: NATIVE },
  coontie: { 'north-america': { presence: 'native', note: 'Wild in Florida and Georgia.' } },
  aster: { 'north-america': NATIVE },
  coneflower: { 'north-america': NATIVE },
  zinnia: { 'north-america': { presence: 'native', note: 'Wild in Mexico.' } },
}

/**
 * Each plant's entry in Kew's World Checklist of Vascular Plants, as GBIF
 * numbers it (https://www.gbif.org/species/{number}): where its native and
 * introduced ranges above were read. A genus where the catalogue names one.
 */
export const plantChecklist: Readonly<Record<string, number>> = {
  milkweed: 3170229,
  parsley: 7828157,
  'tulip-tree': 3152861,
  nettle: 7960979,
  thistle: 3112554,
  'partridge-pea': 2949728,
  'rainforest-legume': 2959589,
  nightshade: 2928784,
  passionflower: 2874172,
  plantain: 3189695,
  willow: 3039576,
  spicebush: 5371740,
  citrus: 3190155,
  brassica: 3042506,
  'white-turtlehead': 5414935,
  pipevine: 2873978,
  pussytoes: 3087998,
  violet: 2874237,
  dogwood: 3082240,
  'black-cherry': 3021850,
  oak: 2877951,
  coontie: 5284049,
  aster: 3151391,
  coneflower: 3150935,
  zinnia: 3111754,
}

/** One short list of things to plant or do. */
export interface TipGroup {
  heading: string
  items: readonly string[]
}

/** What a gardener there could plant for real butterflies. */
export interface RegionTips {
  intro: string
  groups: readonly TipGroup[]
  /** A caution worth a line of its own. */
  note?: string
  /** Who the advice comes from, in words. */
  credit: string
  sources: readonly string[]
}

export const regionTips: Readonly<Record<MarkedRegion | 'elsewhere', RegionTips>> = {
  'north-america': {
    intro: 'Plant for caterpillars as well as for butterflies. These natives do both.',
    groups: [
      {
        heading: 'For caterpillars',
        items: [
          'Milkweeds, for monarchs and queens',
          'Violets, for fritillaries',
          'Spicebush and sassafras, for spicebush swallowtails',
          'Black cherry, for tiger swallowtails and red-spotted purples',
          'Pussytoes, for American ladies',
          'Maypop passionflower, for gulf fritillaries',
        ],
      },
      {
        heading: 'For nectar',
        items: [
          'Milkweed flowers',
          'Purple coneflower',
          'Blazing stars and Joe-Pye weed',
          'Asters and goldenrods in the fall',
        ],
      },
    ],
    note: 'Skip exotic pipevines such as Aristolochia elegans: pipevine swallowtails lay eggs on them, but the caterpillars rarely survive.',
    credit: 'From Butterflies and Moths of North America and University of Florida Extension.',
    sources: [
      'https://www.butterfliesandmoths.org/species/Danaus-plexippus',
      'https://www.butterfliesandmoths.org/species/Speyeria-cybele',
      'https://www.butterfliesandmoths.org/species/Vanessa-cardui',
      'https://www.butterfliesandmoths.org/species/Papilio-glaucus',
      'https://edis.ifas.ufl.edu/publication/IN1107',
      'https://edis.ifas.ufl.edu/publication/IN1170',
      'https://edis.ifas.ufl.edu/publication/IN804',
      'https://edis.ifas.ufl.edu/publication/IN823',
    ],
  },
  europe: {
    intro: 'Grow plants for caterpillars, and flowers from spring into the fall.',
    groups: [
      {
        heading: 'For caterpillars',
        items: [
          'Stinging nettles, for red admirals and commas',
          'Holly and ivy, for holly blues',
          'Buckthorn and alder buckthorn, for brimstones',
          'Cuckooflower and garlic mustard, for orange-tips',
          'Bird’s-foot trefoil, for common blues',
          'A patch of long grass, for meadow browns and gatekeepers',
        ],
      },
      {
        heading: 'For nectar',
        items: [
          'Primroses and cuckooflower in spring',
          'Knapweed, marjoram, scabious and thyme in late summer',
          'Ivy flowers late in the year',
        ],
      },
    ],
    note: 'Many seeds sold as wildflowers are not native. Look for genuine native wildflower seed.',
    credit: 'From Butterfly Conservation.',
    sources: [
      'https://butterfly-conservation.org/sites/default/files/habitat-gardening-for-butterflies-and-moths.pdf',
    ],
  },
  australasia: {
    intro: 'Plants for caterpillars do more than nectar flowers: they raise the next butterflies.',
    groups: [
      {
        heading: 'In Australia, for caterpillars',
        items: [
          'Native grasses, which feed about 50 Australian butterflies',
          'Finger lime, for orchard swallowtails',
          'Climbing senna, for yellow migrants and grass-yellows',
          'Native mulberry, for yellow admirals',
          'Thornless caper, for caper whites',
        ],
      },
      {
        heading: 'In New Zealand, for caterpillars',
        items: [
          'Ongaonga and other native nettles, for red and yellow admirals',
          'Pōhuehue (Muehlenbeckia), for coppers',
          'Native broom (Carmichaelia), for blues',
        ],
      },
      {
        heading: 'In New Zealand, for nectar',
        items: ['Hebes, kōwhai, pōhutukawa and lacebark', 'Mānuka and kānuka'],
      },
    ],
    note: 'New Zealand’s own red admiral, the kahukura, lives nowhere else.',
    credit: 'From Butterfly House and the Moths and Butterflies of New Zealand Trust.',
    sources: [
      'https://www.lepidoptera.butterflyhouse.com.au/faqs/garden.html',
      'https://www.nzbutterflies.org.nz/how-to-create-a-habitat-brian-patrick/',
      'https://www.nzbutterflies.org.nz/wp-content/uploads/Planting-for-Lepidoptera.pdf',
      'https://www.nzbutterflies.org.nz/species-info/red-admiral/',
      'https://www.nzbutterflies.org.nz/species-info/yellow-admiral/',
    ],
  },
  elsewhere: {
    intro: 'Butterflies do best with the plants that grow wild where you live.',
    groups: [
      {
        heading: 'Wherever you garden',
        items: [
          'Grow the plants local caterpillars eat, not only flowers for nectar',
          'Keep something in flower through the seasons',
          'Let a corner grow wild, with long grass',
          'Leave out insecticides',
        ],
      },
    ],
    note: 'A native plant society, botanic garden or butterfly group nearby can say which plants are native to your area.',
    credit: 'From Butterfly Conservation and Butterfly House.',
    sources: [
      'https://butterfly-conservation.org/sites/default/files/habitat-gardening-for-butterflies-and-moths.pdf',
      'https://www.lepidoptera.butterflyhouse.com.au/faqs/garden.html',
    ],
  },
}
