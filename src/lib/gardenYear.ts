import { species } from '../data/content'
import type { AppState } from '../types'
import { companionStory } from './companionStory'
import { letterQuotesOf, type LetterQuotes } from './letters'
import { countedInWords, listed } from './plural'
import {
  arrivalsIn,
  countsIn,
  starredLinesIn,
  withArticle,
  type DayRange,
  type LetterQuote,
} from './summaries'

/**
 * "Your garden's year" (plan c.4): the year told back, worked out from the
 * garden whenever the page is opened, so nothing of it is ever stored.
 *
 * It is counted by the weekly letter's own rules (lib/summaries): a day is
 * the gardener's own calendar day, an entry belongs to the day it is about,
 * and the gardener's words are quoted only where they starred a line and
 * still allow it. Like the letter it describes and never judges: no scores,
 * no comparison with another year, no advice, and nothing that can be
 * broken, so it speaks of days cared for and never of a streak.
 */

/** Lines of the gardener's own the year keeps, at most: a few, not a digest. */
export const YEAR_LINES = 3

/** Butterflies a postcard shows, at most: a handful, so each can be seen. */
export const POSTCARD_BUTTERFLIES = 5

/** Species named in the year before the rest are summed up. */
const NAMED_SPECIES = 6

/** Companions named as emerging before the rest are summed up. */
const NAMED_EMERGED = 6

const speciesNames = new Map(species.map((item) => [item.id, item.commonName]))

/** The year as four digits, as a local date writes it. */
function yearText(year: number): string {
  return String(year).padStart(4, '0')
}

/**
 * The year's days, both ends included. The current year runs only as far as
 * today, so nothing dated ahead of the device's clock is counted, as the
 * rhythm does (lib/rhythm).
 */
export function yearRange(year: number, today: string): DayRange {
  const last = `${yearText(year)}-12-31`
  return { first: `${yearText(year)}-01-01`, last: today < last ? today : last }
}

function inRange(range: DayRange, localDate: string | undefined): localDate is string {
  return localDate !== undefined && localDate >= range.first && localDate <= range.last
}

/** What the year held, in plain counts and names. */
export interface GardenYear {
  year: number
  /** Days with a check-in, written that day or later for it. */
  checkIns: number
  /** Days with a reflection, likewise. */
  reflections: number
  /** Evenings closed with the Moonlight recap. */
  evenings: number
  /**
   * Days cared for: days that earned any Sunlight, the rhythm's own measure
   * (lib/rhythm). An entry written later earns none, so it is not one.
   */
  daysCaredFor: number
  /** The species of the companions welcomed in the year, each once, first welcomed first. */
  speciesWelcomed: string[]
  /** Companions that emerged as butterflies in the year, first first. */
  emerged: Array<{ name: string; speciesName: string }>
  /**
   * A few starred lines, chosen by the letter's rule (the fullest first)
   * and kept in the order they were written. None when the gardener chose
   * never to be quoted.
   */
  lines: LetterQuote[]
}

/**
 * The year's facts. `quotes` defaults to the gardener's own choice in
 * Settings, the one the letters follow.
 */
export function gardenYear(
  state: AppState,
  year: number,
  today: string,
  quotes: LetterQuotes = letterQuotesOf(state.profile),
): GardenYear {
  const range = yearRange(year, today)
  const counts = countsIn(state, range)
  const arrivals = arrivalsIn(state, range)
  const welcomed = new Set(
    arrivals.filter((arrival) => arrival.kind === 'welcomed').map((arrival) => arrival.speciesName),
  )
  return {
    year,
    checkIns: counts.checkIns,
    reflections: counts.reflections,
    evenings: counts.evenings,
    daysCaredFor: new Set(
      state.sunlight.map((award) => award.localDate).filter((date) => inRange(range, date)),
    ).size,
    speciesWelcomed: [...welcomed],
    emerged: arrivals
      .filter((arrival) => arrival.kind === 'emerged')
      .map(({ name, speciesName }) => ({ name, speciesName })),
    lines: starredLinesIn(state, range, quotes)
      .slice(0, YEAR_LINES)
      .sort((a, b) => a.localDate.localeCompare(b.localDate)),
  }
}

const YEAR_OF_DATE = /^(\d{4})-\d{2}-\d{2}$/

/**
 * The years the page offers: this one always, a quiet year included, then
 * every earlier year with anything written or cared for in it, newest
 * first. A year ahead of the device's clock is never offered.
 */
export function yearsToLookBack(state: AppState, today: string): number[] {
  const current = Number(today.slice(0, 4))
  const years = new Set([current])
  const note = (entries: readonly { localDate: string }[]) => {
    for (const entry of entries) {
      const year = Number(YEAR_OF_DATE.exec(entry.localDate)?.[1])
      if (year > 0 && year < current) years.add(year)
    }
  }
  note(state.moods)
  note(state.reflections)
  note(state.recaps)
  note(state.sunlight)
  return [...years].sort((a, b) => b - a)
}

/**
 * The year the Journal offers to look back on as one year turns into the
 * next: this year through December, and the year just gone through January.
 * Undefined for the rest of the year, when the page is still a quiet link
 * away.
 */
export function turningYear(today: string): number | undefined {
  const year = Number(today.slice(0, 4))
  const month = today.slice(5, 7)
  if (month === '12') return year
  if (month === '01') return year - 1
  return undefined
}

/** The year in words, a sentence or two for each part of the page. */
export interface YearWords {
  /** What the journal held, or that the year was a quiet one. */
  journal: string
  /**
   * Days cared for, as the rhythm says it; or that day counts are hidden.
   * Absent for a year with none, which the journal's line already speaks for.
   */
  care?: string
  /** The garden's new arrivals, or that there were none. */
  garden: string[]
}

/**
 * The year told plainly. With `numbers` false (Settings → Your rhythm keeps
 * the journal free of day counts) the same acts are said without them, as a
 * letter says them. A year with nothing in it still gets a true, kind page:
 * nothing was asked of it.
 */
export function yearInWords(facts: GardenYear, numbers: boolean): YearWords {
  // "a reflection" for one; "40 reflections", or plain "reflections" without numbers.
  const some = (count: number, one: string, other: string) =>
    count === 1 ? withArticle(one) : numbers ? countedInWords(count, one, other) : other
  const acts: string[] = []
  if (facts.checkIns > 0)
    acts.push(numbers ? `checked in on ${countedInWords(facts.checkIns, 'day', 'days')}` : 'checked in')
  if (facts.reflections > 0)
    acts.push(`wrote ${some(facts.reflections, 'reflection', 'reflections')}`)
  if (facts.evenings > 0) acts.push(`closed ${some(facts.evenings, 'evening', 'evenings')}`)
  const journal =
    acts.length > 0
      ? `In ${yearText(facts.year)} you ${listed(acts)}.`
      : 'A quiet year in the journal. Nothing was asked of it, and the garden kept your place.'

  const care = !numbers
    ? 'Day counts are hidden, as you chose. Every act of care still grew your garden.'
    : facts.daysCaredFor > 0
      ? `Days you cared for yourself: ${facts.daysCaredFor}.`
      : undefined

  const garden: string[] = []
  const named = facts.speciesWelcomed.slice(0, NAMED_SPECIES).map(withArticle)
  const moreSpecies = facts.speciesWelcomed.length - named.length
  if (moreSpecies > 0) named.push(countedInWords(moreSpecies, 'other species', 'other species'))
  if (named.length > 0) garden.push(`You welcomed ${listed(named)}.`)
  const emerged = facts.emerged.slice(0, NAMED_EMERGED).map((each) => each.name)
  const moreEmerged = facts.emerged.length - emerged.length
  if (moreEmerged > 0) emerged.push(countedInWords(moreEmerged, 'other', 'others'))
  if (emerged.length > 0)
    garden.push(
      `${listed(emerged)} emerged as ${facts.emerged.length === 1 ? 'a butterfly' : 'butterflies'}.`,
    )
  if (garden.length === 0) garden.push('No new arrivals this year. Marigold kept the garden company.')

  return { journal, ...(care ? { care } : {}), garden }
}

/** One butterfly on a postcard: the species drawn, and who it is. */
export interface PostcardButterfly {
  speciesId: string
  name: string
  speciesName: string
}

/** Marigold, the garden's guide, who flies in every garden. */
const MARIGOLD: PostcardButterfly = {
  speciesId: 'monarch',
  name: 'Marigold',
  speciesName: speciesNames.get('monarch') ?? 'Monarch',
}

/**
 * The butterflies a year's postcard shows: the gardener's own, those that
 * emerged in that year first, then the rest in the garden's order, each
 * species once before any twice, and a handful at most. A garden with no
 * butterfly yet has Marigold, who is in every garden scene.
 */
export function postcardButterflies(
  state: AppState,
  year: number,
  today: string,
): PostcardButterfly[] {
  const range = yearRange(year, today)
  const flying = state.creatures.filter((creature) => creature.stage === 'butterfly')
  const thisYear = flying.filter((creature) =>
    inRange(range, companionStory(creature, state.profile).emergedOn),
  )
  const ordered = [...thisYear, ...flying.filter((creature) => !thisYear.includes(creature))]
  const seen = new Set<string>()
  const firsts = ordered.filter((creature) => {
    if (seen.has(creature.speciesId)) return false
    seen.add(creature.speciesId)
    return true
  })
  const chosen = [...firsts, ...ordered.filter((creature) => !firsts.includes(creature))]
    .slice(0, POSTCARD_BUTTERFLIES)
    .map((creature) => ({
      speciesId: creature.speciesId,
      name: creature.name,
      speciesName: speciesNames.get(creature.speciesId) ?? 'butterfly',
    }))
  return chosen.length > 0 ? chosen : [MARIGOLD]
}
