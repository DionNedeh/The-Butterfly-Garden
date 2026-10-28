import { plants, species } from '../data/content'
import { plantRegions, speciesRegions } from '../data/regions'
import type { RegionId, SightingSubject } from '../types'
import { regionMark, type MarkInWords, type RegionMarks } from './regionMarks'
import { subjectKey } from './sightings'
import { hasEveryWord, normaliseForSearch } from './searchText'

/** One butterfly or plant the sighting form offers. */
export interface SubjectChoice {
  subject: SightingSubject
  /** subjectKey(subject): the radio button's value. */
  key: string
  name: string
  scientificName: string
  /** Native to, or seen in, the gardener's region, when it is either. */
  mark?: MarkInWords
  /** What the form's search finds it by, already normalised. */
  searchText: string
}

/** Native first, then seen, then the rest: a choice's place in the list. */
function rank(mark: MarkInWords | undefined): number {
  if (!mark) return 2
  return mark.presence === 'native' ? 0 : 1
}

function choice(
  subject: SightingSubject,
  name: string,
  scientificName: string,
  marks: RegionMarks | undefined,
  region: RegionId | undefined,
): SubjectChoice {
  const mark = regionMark(marks, region)
  return {
    subject,
    key: subjectKey(subject),
    name,
    scientificName,
    mark,
    searchText: normaliseForSearch(`${name} ${scientificName} ${mark?.label ?? ''}`),
  }
}

/**
 * The field guide's butterflies, or its plants, as the form lists them.
 * With a region chosen, the ones native there come first and then the ones
 * seen there (data/regions), each in the guide's own order, so the likeliest
 * are nearest to hand; without one, simply the guide's order.
 */
export function subjectChoices(
  kind: SightingSubject['kind'],
  region: RegionId | undefined,
): SubjectChoice[] {
  const choices =
    kind === 'butterfly'
      ? species.map((item) =>
          choice(
            { kind: 'butterfly', speciesId: item.id },
            item.commonName,
            item.scientificName,
            speciesRegions[item.id],
            region,
          ),
        )
      : plants.map((item) =>
          choice(
            { kind: 'plant', plantId: item.id },
            item.name,
            item.scientificName,
            plantRegions[item.id],
            region,
          ),
        )
  // A stable sort, so the guide's order holds within each group.
  return choices.sort((a, b) => rank(a.mark) - rank(b.mark))
}

/** The choices a search's words all find, in the list's order. */
export function matchingChoices(
  choices: readonly SubjectChoice[],
  words: readonly string[],
): SubjectChoice[] {
  return choices.filter((item) => hasEveryWord(item.searchText, words))
}
