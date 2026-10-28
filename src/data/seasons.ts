import type { MarkedRegion } from '../lib/regionMarks'
import type { Hemisphere, Season } from '../lib/seasons'
import type { OutfitSlot } from '../types'

/*
 * The seasons in the garden (plan c.7): what real butterflies and plants are
 * doing in each season, Marigold's travels, and the art each season will
 * want. Loaded with the garden's line (lib/gardenLines), never in the first
 * load every page waits for.
 */

/** A line about the season where it is said, and where it was checked. */
export interface SeasonLine {
  /** The region it is about, which every line names. */
  region: MarkedRegion
  /** The season it belongs to, in that region's own half of the world. */
  season: Season
  text: string
  sources: readonly string[]
}

const BAMONA = 'https://www.butterfliesandmoths.org/species/'
const EDIS = 'https://edis.ifas.ufl.edu/publication/'
const BC = 'https://butterfly-conservation.org/butterflies/'
const BC_GARDENING =
  'https://butterfly-conservation.org/sites/default/files/habitat-gardening-for-butterflies-and-moths.pdf'
const SA_PAINTED_LADY = 'https://sabutterflies.org.au/nymp/kershawi.html'
const NZ = 'https://www.nzbutterflies.org.nz/species-info/'

/**
 * What the season is doing, in broad and gentle terms. Phenology varies with
 * latitude and with the year, so each line names the place it is true of
 * ("In much of North America…") and says only what its sources say: true on
 * the day it is shown, wherever the gardener is, so a garden whose region is
 * not known can show any of them without guessing its season.
 *
 * Checked in October 2026. Most lines repeat, more briefly, what the garden
 * already says in data/whatToLookFor, data/speciesFacts or data/regions,
 * from the same sources; the rest were read against the source listed with
 * them. Nothing here suggests catching or handling anything. Every line can
 * be shown at night, so none speaks of the sun or the hour.
 */
export const seasonLines: readonly SeasonLine[] = [
  // North America: Butterflies and Moths of North America, as data/whatToLookFor
  // and data/speciesFacts cite it, and data/regions' planting tips.
  {
    region: 'north-america',
    season: 'spring',
    text: 'In much of North America, monarchs are heading north again, laying eggs on milkweed as they go.',
    sources: [`${BAMONA}Danaus-plexippus`],
  },
  {
    region: 'north-america',
    season: 'spring',
    text: 'In much of North America, mourning cloaks that spent the winter as adults come out on the first warm days.',
    sources: [`${BAMONA}Nymphalis-antiopa`, `${EDIS}IN821`],
  },
  {
    region: 'north-america',
    season: 'spring',
    text: 'In much of North America, small blue spring azures are out early in the warm season.',
    sources: [`${BAMONA}Celastrina-ladon`],
  },
  {
    region: 'north-america',
    season: 'spring',
    text: 'In the eastern United States, great spangled fritillary caterpillars that waited all winter start on young violet leaves.',
    sources: [`${BAMONA}Speyeria-cybele`],
  },
  {
    region: 'north-america',
    season: 'summer',
    text: 'In much of North America, summer brings new generations of monarchs to the milkweed.',
    sources: [`${BAMONA}Danaus-plexippus`],
  },
  {
    region: 'north-america',
    season: 'summer',
    text: 'In much of North America, late summer is when monarchs begin their long flight south.',
    sources: [`${BAMONA}Danaus-plexippus`],
  },
  {
    region: 'north-america',
    season: 'summer',
    text: 'In North America, cloudless sulphurs may wander as far as the northern states by late summer.',
    sources: [`${BAMONA}Phoebis-sennae`, `${EDIS}IN929`],
  },
  {
    region: 'north-america',
    season: 'autumn',
    text: 'In much of North America, monarchs are on the move south, roosting together at night.',
    sources: [`${BAMONA}Danaus-plexippus`],
  },
  {
    region: 'north-america',
    season: 'autumn',
    // As data/regions' North American planting tips have it ("Asters and
    // goldenrods in the fall"), from the extension guides it lists.
    text: 'In much of North America, asters and goldenrods feed butterflies late into the fall.',
    sources: [`${EDIS}IN1107`, `${EDIS}IN1170`, `${EDIS}IN804`, `${EDIS}IN823`],
  },
  {
    region: 'north-america',
    season: 'autumn',
    text: 'In much of North America, cloudless sulphurs fly south in the fall, low over the ground.',
    sources: [`${BAMONA}Phoebis-sennae`, `${EDIS}IN929`],
  },
  {
    region: 'north-america',
    season: 'autumn',
    text: 'In Florida, huge numbers of common buckeyes arrive from the north each fall.',
    sources: [`${BAMONA}Junonia-coenia`, `${EDIS}IN801`],
  },
  {
    region: 'north-america',
    season: 'winter',
    text: 'In much of North America, monarchs are spending the winter in central Mexico and along the California coast.',
    sources: [`${BAMONA}Danaus-plexippus`],
  },
  {
    region: 'north-america',
    season: 'winter',
    text: 'In much of North America, mourning cloaks spend the winter as adults, tucked away until spring.',
    sources: [`${BAMONA}Nymphalis-antiopa`, `${EDIS}IN821`],
  },
  {
    region: 'north-america',
    season: 'winter',
    text: 'In much of North America, young viceroy caterpillars spend the winter in a rolled willow leaf.',
    sources: [`${BAMONA}Limenitis-archippus`, `${EDIS}IN828`],
  },
  {
    region: 'north-america',
    season: 'winter',
    text: 'In eastern North America, Baltimore checkerspot caterpillars spend the winter rolled up in fallen leaves.',
    sources: [`${BAMONA}Euphydryas-phaeton`],
  },

  // The UK: Butterfly Conservation, which speaks of Britain, so the lines do too.
  {
    region: 'europe',
    season: 'spring',
    text: 'In the UK, small tortoiseshells are one of the first butterflies to be seen in spring.',
    sources: [`${BC}small-tortoiseshell`],
  },
  {
    region: 'europe',
    season: 'spring',
    text: 'In the UK, holly blues are out early in spring, flying high around holly and other bushes.',
    sources: [`${BC}holly-blue`],
  },
  {
    region: 'europe',
    season: 'spring',
    text: 'In the UK, red admirals start arriving from the south, from North Africa and the continent.',
    sources: [`${BC}red-admiral`],
  },
  {
    region: 'europe',
    season: 'spring',
    text: 'In the UK, primroses and cuckooflower are spring nectar for butterflies.',
    sources: [BC_GARDENING],
  },
  {
    region: 'europe',
    season: 'summer',
    text: 'In the UK, more red admirals arrive from the south through the summer.',
    sources: [`${BC}red-admiral`],
  },
  {
    region: 'europe',
    season: 'summer',
    text: 'In the UK, fresh red admirals emerge from about July, raised from the spring’s arrivals.',
    sources: [`${BC}red-admiral`],
  },
  {
    region: 'europe',
    season: 'summer',
    text: 'In the UK, peacocks are familiar visitors to garden buddleias in late summer.',
    sources: [`${BC}peacock`],
  },
  {
    region: 'europe',
    season: 'summer',
    text: 'In the UK, knapweed, marjoram, scabious and thyme are late summer nectar for butterflies.',
    sources: [BC_GARDENING],
  },
  {
    region: 'europe',
    season: 'autumn',
    text: 'In the UK, red admirals feed on ivy flowers and rotting fruit into the autumn.',
    sources: [`${BC}red-admiral`],
  },
  {
    region: 'europe',
    season: 'autumn',
    text: 'In the UK, small tortoiseshells often visit garden flowers in large numbers in autumn.',
    sources: [`${BC}small-tortoiseshell`],
  },
  {
    region: 'europe',
    season: 'autumn',
    text: 'In the UK, commas roam more widely, often into gardens, before they settle for the winter.',
    sources: [`${BC}comma`],
  },
  {
    region: 'europe',
    season: 'winter',
    text: 'In the UK, commas spend the winter as adults, their ragged wings hidden among dead leaves.',
    sources: [`${BC}comma`],
  },
  {
    region: 'europe',
    season: 'winter',
    text: 'In the far south of England, red admirals have been known to survive the winter.',
    sources: [`${BC}red-admiral`],
  },

  // Australia and New Zealand: the South Australian Butterflies site, Butterfly
  // House and the Moths and Butterflies of New Zealand Trust. Each line names
  // the country, or the state, its source speaks of.
  {
    region: 'australasia',
    season: 'spring',
    text: 'In Australia, Australian painted ladies migrate with the spring, mostly heading south.',
    sources: [SA_PAINTED_LADY],
  },
  {
    region: 'australasia',
    season: 'spring',
    text: 'In southern parts of South Australia, spring is one of the best times to see Australian painted ladies.',
    sources: [SA_PAINTED_LADY],
  },
  {
    region: 'australasia',
    season: 'summer',
    text: 'In eastern Australia, caper whites often fly south in summer, sometimes in great numbers.',
    sources: ['https://www.lepidoptera.butterflyhouse.com.au/pier/java.html'],
  },
  {
    region: 'australasia',
    season: 'summer',
    text: 'In New Zealand, the kahukura, a red admiral found nowhere else, is most often seen in summer.',
    sources: [`${NZ}red-admiral/`],
  },
  {
    region: 'australasia',
    season: 'autumn',
    text: 'In Australia, Australian painted ladies make a smaller migration north in autumn.',
    sources: [SA_PAINTED_LADY],
  },
  {
    region: 'australasia',
    season: 'autumn',
    text: 'In southern parts of South Australia, autumn is one of the best times to see Australian painted ladies.',
    sources: [SA_PAINTED_LADY],
  },
  {
    region: 'australasia',
    season: 'winter',
    text: 'In New Zealand, monarchs spend the winter as adults, resting in conifer trees.',
    sources: [`${NZ}monarch/`],
  },
  {
    region: 'australasia',
    season: 'winter',
    text: 'In New Zealand, the kahukura spends the winter as an adult, and can live for up to nine months.',
    sources: [`${NZ}red-admiral/`],
  },
  {
    region: 'australasia',
    season: 'winter',
    text: 'In southern parts of South Australia, Australian painted ladies sometimes rest through the winter as adults.',
    sources: [SA_PAINTED_LADY],
  },
]

/**
 * Marigold's own seasons. She is a monarch, so in autumn she gets ready to
 * travel and in spring she is back. Words only: she never leaves, never stops
 * guiding, and no rule of the garden changes with them. In the south, where
 * monarchs move to winter roosts rather than to Mexico, she travels without
 * a direction.
 */
export const marigoldLines: Readonly<Record<Hemisphere, Partial<Record<Season, string>>>> = {
  north: {
    autumn: 'Marigold is getting ready to travel south, as monarchs do. She will stay to guide you all the same.',
    spring: 'Marigold is back from the south, and glad to be in the garden again.',
  },
  south: {
    autumn: 'Marigold is getting ready to travel, as monarchs do. She will stay to guide you all the same.',
    spring: 'Marigold is back from her travels, and glad to be in the garden again.',
  },
}

/** One piece of a season's art, named before it is drawn. */
interface ArtPiece {
  /** Stable, since a keepsake or outfit id is stored once it is given. */
  id: string
  name: string
  /** What the art should show, for whoever draws it. */
  brief: string
}

/**
 * The art each season will want, for the art PR to draw: nothing here has an
 * image yet, and nothing in the app reads this list. The scene already carries
 * the hooks it needs, so the art only adds pictures and CSS:
 * `.garden-hero[data-season="autumn"]` for the season, and `.theme-night`
 * around it at night (GardenView).
 *
 * - The overlay is a layer over the scene, drawn by CSS from that hook: the
 *   falling petals (`.hero-petal`, by day only) can be dressed as each
 *   season's, and `.hero-petals::before` is free for a still layer such as
 *   frost. At night the fireflies (components/garden/Fireflies) take the
 *   petals' place, as now.
 * - The keepsake is free, one each season, for every gardener: wellbeing and
 *   seasons are never paywalled.
 * - The outfit is the Garden Pass's for the season: cosmetic, like the rest.
 */
export interface SeasonArt {
  overlay: ArtPiece
  keepsake: ArtPiece
  passOutfit: ArtPiece & { slot: OutfitSlot }
}

export const seasonArt: Readonly<Record<Season, SeasonArt>> = {
  spring: {
    overlay: {
      id: 'overlay-spring-blossom',
      name: 'Spring blossom',
      brief: 'Pale blossom petals drifting down through the scene.',
    },
    keepsake: {
      id: 'keepsake-spring-nest',
      name: 'Spring Nest',
      brief: 'A small woven nest with a sprig of new leaves.',
    },
    passOutfit: {
      id: 'season-spring-blossom-crown',
      name: 'Blossom Crown',
      brief: 'A light crown of fruit-tree blossom.',
      slot: 'headwear',
    },
  },
  summer: {
    overlay: {
      id: 'overlay-summer-petals',
      name: 'Summer petals',
      brief: 'Warm-coloured petals and a little pollen on the breeze.',
    },
    keepsake: {
      id: 'keepsake-summer-seed-head',
      name: 'Summer Seed Head',
      brief: 'A round seed head, ready to blow.',
    },
    passOutfit: {
      id: 'season-summer-sun-hat',
      name: 'Meadow Sun Hat',
      brief: 'A wide straw hat with a poppy at the band.',
      slot: 'headwear',
    },
  },
  autumn: {
    overlay: {
      id: 'overlay-autumn-leaves',
      name: 'Falling leaves',
      brief: 'Amber and red leaves turning slowly as they fall.',
    },
    keepsake: {
      id: 'keepsake-autumn-acorn',
      name: 'Autumn Acorn',
      brief: 'A polished acorn with its cap.',
    },
    passOutfit: {
      id: 'season-autumn-leaf-scarf',
      name: 'Leaf Scarf',
      brief: 'A scarf of russet leaves for a traveller.',
      slot: 'accessory',
    },
  },
  winter: {
    overlay: {
      id: 'overlay-winter-frost',
      name: 'Frost',
      brief: 'Frost at the scene’s edges and a few slow snowflakes.',
    },
    keepsake: {
      id: 'keepsake-winter-holly',
      name: 'Winter Holly',
      brief: 'A sprig of holly with two berries.',
    },
    passOutfit: {
      id: 'season-winter-knit-cap',
      name: 'Knitted Cap',
      brief: 'A soft knitted cap with a pompom.',
      slot: 'headwear',
    },
  },
}
