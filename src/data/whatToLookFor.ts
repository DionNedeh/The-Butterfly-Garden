import type { MarkedRegion } from '../lib/regionMarks'

/**
 * A gentle line for each month, of what a gardener in a region might look
 * for outdoors: "Monarchs are on the move south this month." Shown where
 * sightings are logged, and only once a region is chosen, since the seasons
 * of Australia and New Zealand are the reverse of the north's.
 *
 * Checked in October 2026, each line against the sources listed with it.
 * Every line says only what its source says; where a source speaks of one
 * country, so does the line. Nothing here suggests catching or handling.
 */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

export interface MonthLine {
  /** The months it is said in, 1 for January to 12 for December. */
  months: readonly number[]
  /** The season those months are, where the region is (lib/whatToLookFor checks it). */
  season: Season
  text: string
  sources: readonly string[]
}

const BAMONA = 'https://www.butterfliesandmoths.org/species/'
const BC = 'https://butterfly-conservation.org/butterflies/'

export const whatToLookFor: Readonly<Record<MarkedRegion, readonly MonthLine[]>> = {
  'north-america': [
    {
      months: [12, 1, 2],
      season: 'winter',
      text: 'Monarchs are spending the winter along the California coast and in central Mexico, where they roost together in trees.',
      sources: [`${BAMONA}Danaus-plexippus`],
    },
    {
      months: [3],
      season: 'spring',
      text: 'Mourning cloaks that spent the winter as adults are about again: look for them perching in sunny openings in the afternoon.',
      sources: [`${BAMONA}Nymphalis-antiopa`],
    },
    {
      months: [4, 5],
      season: 'spring',
      text: 'Monarchs are heading north from their winter roosts, laying eggs on milkweed along the way.',
      sources: [`${BAMONA}Danaus-plexippus`],
    },
    {
      months: [6, 7],
      season: 'summer',
      text: 'Summer brings new generations of monarchs: watch the milkweed for caterpillars eating its leaves.',
      sources: [`${BAMONA}Danaus-plexippus`],
    },
    {
      months: [8],
      season: 'summer',
      text: 'Monarchs begin their long flight south this month, and cloudless sulphurs may reach the northern states.',
      sources: [`${BAMONA}Danaus-plexippus`, `${BAMONA}Phoebis-sennae`],
    },
    {
      months: [9, 10],
      season: 'autumn',
      text: 'Monarchs are on the move south this month, stopping at flowers to feed and roosting together at night.',
      sources: [`${BAMONA}Danaus-plexippus`],
    },
    {
      months: [11],
      season: 'autumn',
      text: 'Painted ladies fly in South Texas from October to April, when their season in the East is over.',
      sources: [`${BAMONA}Vanessa-cardui`],
    },
  ],
  europe: [
    {
      months: [12, 1, 2],
      season: 'winter',
      text: 'Commas spend the winter as adults, their scalloped wings hidden among dead leaves.',
      sources: [`${BC}comma`],
    },
    {
      months: [3],
      season: 'spring',
      text: 'The small tortoiseshell is one of the first butterflies to be seen in spring.',
      sources: [`${BC}small-tortoiseshell`],
    },
    {
      months: [4],
      season: 'spring',
      text: 'Holly blues are out early in spring, flying high around holly and other bushes.',
      sources: [`${BC}holly-blue`],
    },
    {
      months: [5],
      season: 'spring',
      text: 'Red admirals start arriving from the south in spring, flying north from Africa and the continent.',
      sources: [`${BC}red-admiral`],
    },
    {
      months: [6],
      season: 'summer',
      text: 'More red admirals arrive through the summer, in numbers that change from year to year.',
      sources: [`${BC}red-admiral`],
    },
    {
      months: [7],
      season: 'summer',
      text: 'Fresh red admirals emerge from about July, raised from the eggs of spring’s arrivals.',
      sources: [`${BC}red-admiral`],
    },
    {
      months: [8],
      season: 'summer',
      text: 'Peacocks visit garden buddleias in late summer, and in some years painted ladies fill gardens too.',
      sources: [`${BC}peacock`, `${BC}painted-lady`],
    },
    {
      months: [9, 10, 11],
      season: 'autumn',
      text: 'Red admirals feed on ivy flowers and rotting fruit into the autumn, and small tortoiseshells visit garden flowers.',
      sources: [`${BC}red-admiral`, `${BC}small-tortoiseshell`],
    },
  ],
  australasia: [
    {
      months: [12, 1],
      season: 'summer',
      text: 'In eastern Australia, caper whites often fly south in summer, sometimes in great numbers.',
      sources: ['https://www.lepidoptera.butterflyhouse.com.au/pier/java.html'],
    },
    {
      months: [2],
      season: 'summer',
      text: 'In New Zealand, the kahukura, a red admiral found nowhere else, is most often seen in summer.',
      sources: ['https://www.nzbutterflies.org.nz/species-info/red-admiral/'],
    },
    {
      months: [3, 4, 5],
      season: 'autumn',
      text: 'In autumn, Australian painted ladies make a smaller migration north.',
      sources: ['https://sabutterflies.org.au/nymp/kershawi.html'],
    },
    {
      months: [6, 7, 8],
      season: 'winter',
      text: 'In New Zealand, monarchs spend the winter as adults, resting in conifer trees.',
      sources: ['https://www.nzbutterflies.org.nz/species-info/monarch/'],
    },
    {
      months: [9, 10, 11],
      season: 'spring',
      text: 'Australian painted ladies are migrating with the spring, mostly heading south.',
      sources: ['https://sabutterflies.org.au/nymp/kershawi.html'],
    },
  ],
}
