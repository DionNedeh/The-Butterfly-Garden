import type { RegionId } from '../types'

/** A region the Guide can mark butterflies and plants in; not "Elsewhere". */
export type MarkedRegion = Exclude<RegionId, 'elsewhere'>

/**
 * Whether a butterfly or plant lives in a region, and how (data/regions says
 * what counts as which).
 */
export interface RegionMark {
  presence: 'native' | 'seen'
  /** A narrower place than the region, when the region would overstate it. */
  where?: string
  /** One short line that keeps the mark honest. */
  note?: string
}

export type RegionMarks = Readonly<Partial<Record<MarkedRegion, RegionMark>>>

/** What Settings offers, in the order it offers them. */
export const REGION_CHOICES: ReadonlyArray<{ value: RegionId; label: string }> = [
  { value: 'north-america', label: 'North America' },
  { value: 'europe', label: 'UK and Europe' },
  { value: 'australasia', label: 'Australia and New Zealand' },
  { value: 'elsewhere', label: 'Elsewhere' },
]

/** The region as the middle of a sentence: "Native to the UK and Europe". */
const PLACES: Record<MarkedRegion, string> = {
  'north-america': 'North America',
  europe: 'the UK and Europe',
  australasia: 'Australia and New Zealand',
}

/** The name Settings gives a region. */
export function regionName(region: RegionId): string {
  return REGION_CHOICES.find((choice) => choice.value === region)?.label ?? region
}

/** A mark as the Guide says it: "Native to North America", "Seen in Australia". */
export interface MarkInWords {
  presence: RegionMark['presence']
  label: string
  note?: string
}

/**
 * A butterfly's or plant's mark for the gardener's region, in words, or
 * nothing: for one that does not live there, and for "Elsewhere", which
 * marks nothing at all.
 */
export function regionMark(
  marks: RegionMarks | undefined,
  region: RegionId | undefined,
): MarkInWords | undefined {
  if (!marks || region === undefined || region === 'elsewhere') return undefined
  const mark = marks[region]
  if (!mark) return undefined
  const label = `${mark.presence === 'native' ? 'Native to' : 'Seen in'} ${mark.where ?? PLACES[region]}`
  return { presence: mark.presence, label, note: mark.note }
}
