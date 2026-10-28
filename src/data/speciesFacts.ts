/**
 * Three short facts about each butterfly, and where they were checked.
 *
 * The first is known from the start; the second and third are shared as a
 * companion's bond grows (lib/speciesFacts). Kept apart from the catalogue in
 * data/content, so the garden's first load does not carry seventy-five
 * sentences only Care, the Journal's field notes and the Guide show.
 *
 * Every fact, each species' scientific name and its host pairing were checked
 * in October 2026 against the sources listed with it. A claim no good source
 * supported was left out, so check a new one the same way before adding it.
 */
export interface SpeciesFacts {
  /** Short and plain, in the order a bond shares them. */
  facts: readonly [string, string, string]
  /** Where the facts, the name and the host plant were checked. */
  sources: readonly string[]
}

const BAMONA = 'https://www.butterfliesandmoths.org/species/'
const EDIS = 'https://edis.ifas.ufl.edu/publication/'

export const speciesFacts: Readonly<Record<string, SpeciesFacts>> = {
  monarch: {
    facts: [
      'Monarch caterpillars rely on milkweed, the only plants they can eat.',
      'Milkweed’s bitter chemicals stay in a monarch’s body, and its orange and black warn birds away.',
      'Each fall, some monarchs fly about 4,000 km to spend the winter in the mountain forests of Mexico.',
    ],
    sources: [
      `${BAMONA}Danaus-plexippus`,
      `${EDIS}IN780`,
      'https://butterfly-conservation.org/butterflies/monarch',
      'https://www.nzbutterflies.org.nz/species-info/monarch/',
      'https://www.lepidoptera.butterflyhouse.com.au/nymp/plexippus.html',
    ],
  },
  'black-swallowtail': {
    facts: [
      'Black swallowtail caterpillars eat parsley, dill, fennel and other carrot-family plants.',
      'A startled caterpillar pushes out a bright orange “horn” whose chemicals keep ants away.',
      'A female’s blue-dusted hindwings help her pass for the bad-tasting pipevine swallowtail.',
    ],
    sources: [`${BAMONA}Papilio-polyxenes`, `${EDIS}IN906`],
  },
  'tiger-swallowtail': {
    facts: [
      'Eastern tiger swallowtails are big butterflies, with wings up to 14 cm across.',
      'Some females are dark, almost black, which helps them pass for the bad-tasting pipevine swallowtail.',
      'A tiger swallowtail drawn in 1587 is the first known picture of a North American swallowtail.',
    ],
    sources: [`${BAMONA}Papilio-glaucus`, `${EDIS}IN218`],
  },
  'red-admiral': {
    facts: [
      'Red admiral caterpillars fold nettle leaves into small shelters.',
      'Red admirals prefer tree sap, rotting fruit and bird droppings to flowers.',
      'Red admirals cannot survive the coldest winters, so most of North America is recolonized each spring.',
    ],
    sources: [
      `${BAMONA}Vanessa-atalanta`,
      'https://butterfly-conservation.org/butterflies/red-admiral',
    ],
  },
  'painted-lady': {
    facts: [
      'Painted ladies live on every continent but Antarctica, though in Australia they are rare.',
      'Its caterpillars eat more than 100 kinds of plants, with thistles a favorite.',
      'It is also called the cosmopolitan, since no butterfly is found more widely around the world.',
    ],
    sources: [
      `${BAMONA}Vanessa-cardui`,
      'https://butterfly-conservation.org/butterflies/painted-lady',
      'https://www.lepidoptera.butterflyhouse.com.au/nymp/cardui.html',
      'https://sabutterflies.org.au/nymp/kershawi.html',
    ],
  },
  'cloudless-sulphur': {
    facts: [
      'Cloudless sulphurs migrate south each fall, most flying within a few meters of the ground.',
      'Their long tongues reach nectar in tube-shaped flowers, and red flowers are favorites.',
      'At night they roost alone, often on a yellow or reddish leaf where they all but disappear.',
    ],
    sources: [`${BAMONA}Phoebis-sennae`, `${EDIS}IN929`],
  },
  'blue-morpho': {
    facts: [
      'A morpho’s blue comes from tiny structures on its wing scales that reflect blue light, not from pigment.',
      'Blue morphos sip juice from rotting fruit and tree sap, and do not visit flowers for nectar.',
      'With wings folded, a morpho shows brown undersides and eyespots that help it hide or startle.',
    ],
    sources: [
      `${EDIS}IN1101`,
      'https://www.floridamuseum.ufl.edu/exhibits/butterflies/blue-morpho/',
      'https://www.uvm.edu/~dahammon/Structural_Colors/Structural_Colors/The_Blue_Morpho_Butterfly.html',
    ],
  },
  glasswing: {
    facts: [
      'Most of a glasswing’s wing surface is transparent, edged with warm brown.',
      'Tiny wax pillars on its clear wings cut glare, so they reflect only about 2% of light.',
      'Glasswing caterpillars feed on Cestrum, shrubs of the nightshade family.',
    ],
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC8340268/',
      'https://www.floridamuseum.ufl.edu/exhibits/butterflies/glasswing/',
    ],
  },
  queen: {
    facts: [
      'Queen caterpillars eat milkweed and carry its chemical defenses into adulthood.',
      'Queens often rest together at night in shared roosts.',
      'In Florida and the Southwest, viceroys are brown instead of orange, and look like queens.',
    ],
    sources: [`${BAMONA}Danaus-gilippus`, `${BAMONA}Limenitis-archippus`],
  },
  'gulf-fritillary': {
    facts: [
      'Gulf fritillaries use passionflower vines as nurseries for their caterpillars.',
      'Long silver spots shine on the undersides of a gulf fritillary’s brown wings.',
      'Its chrysalis is mottled brown and looks like a dead leaf.',
    ],
    sources: [`${BAMONA}Agraulis-vanillae`, `${EDIS}IN804`],
  },
  'zebra-longwing': {
    facts: [
      'Zebra longwings can gather pollen as well as nectar, helping them live unusually long lives.',
      'In 1996 the zebra longwing became the state butterfly of Florida.',
      'Zebra longwings gather in small groups to roost together at night.',
    ],
    sources: [`${BAMONA}Heliconius-charithonia`, `${EDIS}IN805`],
  },
  'common-buckeye': {
    facts: [
      'Large eyespots on a common buckeye’s wings may startle would-be predators.',
      'Underneath, summer buckeyes are tan, while those of the dry season turn reddish-brown.',
      'Each fall, huge numbers of buckeyes fly south into peninsular Florida.',
    ],
    sources: [`${BAMONA}Junonia-coenia`, `${EDIS}IN801`],
  },
  viceroy: {
    facts: [
      'A black line across each hindwing helps distinguish a viceroy from a monarch.',
      'Viceroys taste bitter too, thanks to salicylic acid their caterpillars take from willow.',
      'Young caterpillars spend the winter in a tube they make from a willow leaf.',
    ],
    sources: [`${BAMONA}Limenitis-archippus`, `${EDIS}IN828`],
  },
  'mourning-cloak': {
    facts: [
      'Adult mourning cloaks overwinter, so they may appear on the first warm days of spring.',
      'Mourning cloaks can live for nearly a year, far longer than most butterflies.',
      'In Britain, where it is a rare visitor, it is called the Camberwell beauty.',
    ],
    sources: [`${BAMONA}Nymphalis-antiopa`, `${EDIS}IN821`],
  },
  'spicebush-swallowtail': {
    facts: [
      'Young spicebush swallowtail caterpillars fold leaves into shelters with silk.',
      'Big false eyespots may make older caterpillars look like a small snake or tree frog.',
      'The caterpillars hide in their leaf shelters by day and come out to feed at night.',
    ],
    sources: [`${BAMONA}Papilio-troilus`, `${EDIS}IN1107`],
  },
  'giant-swallowtail': {
    facts: [
      'Giant swallowtail caterpillars resemble bird droppings while feeding on citrus relatives.',
      'Citrus growers know its caterpillars as orange dogs.',
      'A female giant swallowtail’s wings can span up to 18 cm.',
    ],
    sources: [`${BAMONA}Papilio-cresphontes`, `${EDIS}IN134`],
  },
  'cabbage-white': {
    facts: [
      'The cabbage white is a familiar garden butterfly whose caterpillars eat mustard-family plants.',
      'First seen in North America at Quebec City in 1860, it soon spread across the continent.',
      'Females have two black spots on each forewing; males have one.',
    ],
    sources: [
      `${BAMONA}Pieris-rapae`,
      `${EDIS}IN283`,
      'https://butterfly-conservation.org/butterflies/small-white',
      'https://www.nzbutterflies.org.nz/species-info/cabbage-white/',
      'https://www.lepidoptera.butterflyhouse.com.au/pier/rapae.html',
    ],
  },
  'baltimore-checkerspot': {
    facts: [
      'Baltimore checkerspot caterpillars feed together on white turtlehead before dispersing.',
      'A female lays her eggs in clusters of 100 to 700 under the leaves of a host plant.',
      'Its caterpillars spend the winter rolled up in leaves on the ground.',
    ],
    sources: [`${BAMONA}Euphydryas-phaeton`],
  },
  'pipevine-swallowtail': {
    facts: [
      'Pipevine swallowtails use pipevine plants and carry their chemical defenses as adults.',
      'Young caterpillars feed in small groups, then go their own way as they grow.',
      'Adults have tough bodies that let them survive being tasted by a bird.',
    ],
    sources: [`${BAMONA}Battus-philenor`, `${EDIS}IN1170`],
  },
  'american-lady': {
    facts: [
      'American lady caterpillars make silk shelters on pussytoes and related everlastings.',
      'Two large eyespots under each hindwing tell it from a painted lady, which has four small ones.',
      'Its caterpillars hide in their nests by day and come out to feed at night.',
    ],
    sources: [`${BAMONA}Vanessa-virginiensis`, `${EDIS}IN823`],
  },
  'great-spangled-fritillary': {
    facts: [
      'Great spangled fritillaries depend on violets for their caterpillars.',
      'Newly hatched caterpillars eat nothing until spring, when young violet leaves appear.',
      'It is the most common fritillary in much of the eastern United States.',
    ],
    sources: [`${BAMONA}Speyeria-cybele`],
  },
  'spring-azure': {
    facts: [
      'Spring azures are small blue butterflies often seen early in the warm season.',
      'Its caterpillars feed on flowers, such as dogwood’s, and are tended by ants.',
      'What was called one species may be several, and scientists are still sorting them out.',
    ],
    sources: [`${BAMONA}Celastrina-ladon`],
  },
  'red-spotted-purple': {
    facts: [
      'Red-spotted purples mimic pipevine swallowtails but do not have swallowtail tails.',
      'Farther north, the same species wears broad white bands and is called the white admiral.',
      'Adults feed more on sap, rotting fruit and dung than on flowers.',
    ],
    sources: [`${BAMONA}Limenitis-arthemis`],
  },
  'california-sister': {
    facts: [
      'California sister caterpillars feed on oaks, especially canyon live oak.',
      'A creamy white band and an orange patch mark its dark forewings.',
      'Adults come to mud, water and rotting fruit, and visit flowers only now and then.',
    ],
    sources: [`${BAMONA}Adelpha-californica`],
  },
  atala: {
    facts: [
      'Once thought gone from Florida, atalas now live where gardeners plant coontie.',
      'Atala caterpillars are bright red with yellow spots, a warning that they are toxic.',
      'Its blue spots shine because of tiny structures in the scales, not pigment.',
    ],
    sources: [`${BAMONA}Eumaeus-atala`, `${EDIS}IN326`],
  },
}

/**
 * Who published each source, in words, so the Guide can say what a species'
 * facts were checked against without sending anyone anywhere.
 */
const PUBLISHERS: ReadonlyArray<readonly [host: string, name: string]> = [
  ['butterfliesandmoths.org', 'Butterflies and Moths of North America'],
  ['edis.ifas.ufl.edu', 'University of Florida Extension'],
  ['floridamuseum.ufl.edu', 'the Florida Museum'],
  ['butterfly-conservation.org', 'Butterfly Conservation'],
  ['nzbutterflies.org.nz', 'the Moths and Butterflies of New Zealand Trust'],
  ['butterflyhouse.com.au', 'Butterfly House'],
  ['sabutterflies.org.au', 'South Australian Butterflies'],
  ['pmc.ncbi.nlm.nih.gov', 'the Journal of Experimental Biology'],
  ['uvm.edu', 'the University of Vermont'],
]

/** The publishers of a species' sources, each once, in the order listed. */
export function publishersOf(sources: readonly string[]): string[] {
  const names: string[] = []
  for (const source of sources) {
    const host = new URL(source).hostname
    const name = PUBLISHERS.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1]
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}
