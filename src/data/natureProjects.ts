import type { MarkedRegion } from '../lib/regionMarks'

/**
 * Citizen-science projects a gardener could share their sightings with,
 * entirely optionally. The app never contacts them: each is a link that
 * opens in the browser, and nothing from the field book goes with it.
 *
 * Each page was checked on the date below to be the project's own page, to
 * say what the line beside it says, and (where it speaks of nets at all) to
 * ask for watching and photographing rather than catching. Check them again
 * before each release, as the support numbers are.
 */
export const NATURE_PROJECTS_CHECKED_ON = '2026-10-27'

export interface NatureProject {
  name: string
  href: string
  /** One plain line: what taking part is, and where. */
  about: string
}

/**
 * Everywhere, the one any gardener can use: a free, worldwide record of
 * living things, where the community helps confirm what each photo shows
 * (https://www.inaturalist.org/pages/community).
 */
export const INATURALIST: NatureProject = {
  name: 'iNaturalist',
  href: 'https://www.inaturalist.org/',
  about: 'Anywhere in the world: share a photo of a living thing, and its community helps name it.',
}

/** A project closer to home, for a region that has one. */
export const regionalNatureProjects: Readonly<Record<MarkedRegion, NatureProject>> = {
  // https://www.naba.org/butterfly-counts/: one-day counts, mostly in June
  // and July, which "strongly encourages all counts to avoid the use of nets".
  'north-america': {
    name: 'NABA Butterfly Counts',
    href: 'https://www.naba.org/butterfly-counts/',
    about: 'In the United States and Canada: one-day summer counts, with binoculars and cameras rather than nets.',
  },
  // Butterfly Conservation's count of UK butterflies, 15 minutes in the sun,
  // each July and August.
  europe: {
    name: 'Big Butterfly Count',
    href: 'https://bigbutterflycount.butterfly-conservation.org/',
    about: 'In the UK, each summer: fifteen minutes in the sun, counting the butterflies you see.',
  },
  // A citizen-science project for recording butterfly sightings in
  // Australia, with a free app and field guide. It does not cover New
  // Zealand, where iNaturalist does.
  australasia: {
    name: 'Butterflies Australia',
    href: 'https://www.butterflies.org.au/',
    about: 'In Australia: record the butterflies you see, with a free app and field guide.',
  },
}
