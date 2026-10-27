import { species } from '../data/content'
import type { AppState, Profile } from '../types'
import { companionStory } from './companionStory'
import { addDaysToLocalDate, localDateToNoon, toLocalDate } from './date'
import { letterQuotesOf, type LetterQuotes, type StarredKind } from './letters'
import { firstLineOfText } from './onThisDay'
import { countedInWords, listed } from './plural'

/**
 * A week of the garden told back: the counts, arrivals and chosen words a
 * letter from Marigold is made of (plan c.4).
 *
 * Pure functions of the garden, worked out whenever a letter is read, so a
 * letter is never stored and always agrees with the journal as it stands: an
 * entry edited, deleted or written later for the week is told as it is now.
 * Days are the gardener's own calendar days, and an entry belongs to the day
 * it is about, so one written later counts for its own week and never for the
 * week it was written in.
 *
 * What a letter never does, by design: analyse, score, advise, or compare one
 * week with another. It says what happened in plain counts and names, and
 * quotes the gardener only where they starred a line and still allow it.
 */

/** A week from Monday to Sunday, as local dates. */
export interface LetterWeek {
  monday: string
  sunday: string
}

/** The week that ends on this Sunday. */
export function weekEndingOn(sunday: string): LetterWeek {
  return { monday: addDaysToLocalDate(sunday, -6), sunday }
}

function inWeek(week: LetterWeek, localDate: string | undefined): localDate is string {
  return localDate !== undefined && localDate >= week.monday && localDate <= week.sunday
}

/** What the gardener did in a week, each thing counted once a day at most. */
export interface WeekCounts {
  /** Days with a check-in, whether written that day or later for it. */
  checkIns: number
  /** Days with a reflection, likewise. */
  reflections: number
  /** Goals finished: a goal counts once for each day it was finished. */
  goals: number
  /** Evenings closed with the Moonlight recap. */
  evenings: number
  /** Companions cared for on a day of the week, by name, in the garden's order. */
  caredFor: string[]
}

/** A moment in a companion's life that a letter tells of. */
export type ArrivalKind = 'welcomed' | 'hatched' | 'chrysalis' | 'emerged'

/** Earliest first, so a companion welcomed and hatched in one day is told in that order. */
const ARRIVAL_KINDS: readonly ArrivalKind[] = ['welcomed', 'hatched', 'chrysalis', 'emerged']

export interface WeekArrival {
  kind: ArrivalKind
  /** The companion's name as it is now. */
  name: string
  speciesName: string
  localDate: string
}

/** A line of the gardener's own, chosen to be quoted back. */
export interface LetterQuote {
  /** The first line of the entry's words, shortened as the journal's card does. */
  text: string
  localDate: string
  kind: StarredKind
}

export interface WeekSummary {
  week: LetterWeek
  counts: WeekCounts
  /** Companions' new beginnings in the week, earliest first. */
  arrivals: WeekArrival[]
  /** A starred line from the week, when quoting is allowed and there is one. */
  quote?: LetterQuote
}

const speciesNames = new Map(species.map((item) => [item.id, item.commonName]))

/**
 * The local day an instant names, or undefined when it names none: a damaged
 * date is repaired to the epoch (validateGarden), which is no real arrival.
 */
function dayOf(instant: string): string | undefined {
  const time = Date.parse(instant)
  return Number.isFinite(time) && time > 0 ? toLocalDate(new Date(time)) : undefined
}

function countsIn(state: AppState, week: LetterWeek): WeekCounts {
  const daysOf = (entries: readonly { localDate: string }[]) =>
    new Set(entries.map((entry) => entry.localDate).filter((date) => inWeek(week, date))).size
  const evenings = new Set(
    [...state.moonlight, ...state.recaps]
      .map((entry) => entry.localDate)
      .filter((date) => inWeek(week, date)),
  )
  return {
    checkIns: daysOf(state.moods),
    reflections: daysOf(state.reflections),
    goals: state.completions.filter((completion) => inWeek(week, completion.localDate)).length,
    evenings: evenings.size,
    caredFor: state.creatures
      .filter((creature) =>
        Object.values(creature.careDates).some((dates) => dates?.some((date) => inWeek(week, date))),
      )
      .map((creature) => creature.name),
  }
}

/**
 * Each companion's beginnings that fell in the week: welcomed, hatched,
 * became a chrysalis, emerged. The days are the ones its story on Care tells
 * (lib/companionStory), so the two never disagree, and a day the garden did
 * not keep is left out rather than guessed.
 */
function arrivalsIn(state: AppState, week: LetterWeek): WeekArrival[] {
  const arrivals: WeekArrival[] = []
  for (const creature of state.creatures) {
    const story = companionStory(creature, state.profile)
    const days: Record<ArrivalKind, string | undefined> = {
      welcomed: dayOf(creature.discoveredAt),
      hatched: story.hatchedOn,
      chrysalis: story.chrysalisOn,
      emerged: story.emergedOn,
    }
    for (const kind of ARRIVAL_KINDS) {
      const localDate = days[kind]
      if (!inWeek(week, localDate)) continue
      arrivals.push({
        kind,
        name: creature.name,
        speciesName: speciesNames.get(creature.speciesId) ?? 'butterfly',
        localDate,
      })
    }
  }
  // A stable sort: within a day, the garden's order and then each life's.
  return arrivals.sort((a, b) => a.localDate.localeCompare(b.localDate))
}

/** A line's length in characters as written, not in UTF-16 units. */
function lengthOf(text: string): number {
  return Array.from(text).length
}

/**
 * The line to quote: only from an entry the gardener starred, for a day of
 * this week, and never when they chose not to be quoted. Of several, the
 * longest, as the fullest; then the later day; then a reflection over a
 * check-in's note, so the choice never changes on its own.
 */
function quoteIn(state: AppState, week: LetterWeek, quotes: LetterQuotes): LetterQuote | undefined {
  if (quotes === 'never') return undefined
  const candidates: LetterQuote[] = []
  const consider = (
    entry: { localDate: string; starred?: true },
    words: string,
    kind: StarredKind,
  ) => {
    if (entry.starred !== true || !inWeek(week, entry.localDate)) return
    const text = firstLineOfText(words)
    if (text) candidates.push({ text, localDate: entry.localDate, kind })
  }
  for (const mood of state.moods) consider(mood, mood.note, 'check-in')
  for (const reflection of state.reflections) consider(reflection, reflection.body, 'reflection')
  let best: LetterQuote | undefined
  for (const candidate of candidates) {
    if (!best) {
      best = candidate
      continue
    }
    const longer = lengthOf(candidate.text) - lengthOf(best.text)
    const later = candidate.localDate.localeCompare(best.localDate)
    if (
      longer > 0 ||
      (longer === 0 && later > 0) ||
      (longer === 0 && later === 0 && candidate.kind === 'reflection')
    ) {
      best = candidate
    }
  }
  return best
}

/**
 * The week ending on `sunday`, in counts, arrivals and a quote. `quotes`
 * defaults to the gardener's own choice in Settings.
 */
export function summariseWeek(
  state: AppState,
  sunday: string,
  quotes: LetterQuotes = letterQuotesOf(state.profile),
): WeekSummary {
  const week = weekEndingOn(sunday)
  const quote = quoteIn(state, week, quotes)
  return {
    week,
    counts: countsIn(state, week),
    arrivals: arrivalsIn(state, week),
    ...(quote ? { quote } : {}),
  }
}

/** A letter from Marigold, in the words the Journal shows. */
export interface GardenLetter {
  week: LetterWeek
  /** "Dear Robin," */
  greeting: string
  /** What happened, a sentence or two each. */
  paragraphs: string[]
  quote?: LetterQuote
}

/** Companions named in a letter before it says how many instead, as a day's summary does. */
const NAMED_COMPANIONS = 2

/** Arrivals told by name before the rest are summed up. */
const NAMED_ARRIVALS = 4

function times(count: number): string {
  if (count === 1) return 'once'
  if (count === 2) return 'twice'
  return countedInWords(count, 'time', 'times')
}

/**
 * "checked in four times, finished eleven goals and closed three evenings",
 * or, for a gardener who keeps the journal free of numbers (Settings → Your
 * rhythm), the same acts without them.
 */
function actsOf(counts: WeekCounts, numbers: boolean): string[] {
  const acts: string[] = []
  // "a goal" for one; "two goals", or plain "goals" without numbers, for more.
  const some = (count: number, one: string, other: string) =>
    count === 1 ? withArticle(one) : numbers ? countedInWords(count, one, other) : other
  if (counts.checkIns > 0) acts.push(numbers ? `checked in ${times(counts.checkIns)}` : 'checked in')
  if (counts.reflections > 0)
    acts.push(`wrote ${some(counts.reflections, 'reflection', 'reflections')}`)
  if (counts.goals > 0) acts.push(`finished ${some(counts.goals, 'goal', 'goals')}`)
  const cared = counts.caredFor
  if (cared.length > 0)
    acts.push(
      `cared for ${
        cared.length <= NAMED_COMPANIONS
          ? listed(cared)
          : numbers
            ? countedInWords(cared.length, 'companion', 'companions')
            : 'your companions'
      }`,
    )
  if (counts.evenings > 0) acts.push(`closed ${some(counts.evenings, 'evening', 'evenings')}`)
  return acts
}

/** "a Monarch", "an American Lady". */
function withArticle(name: string): string {
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`
}

function arrivalWords(arrival: WeekArrival): string {
  switch (arrival.kind) {
    case 'welcomed':
      return `${arrival.name}, ${withArticle(arrival.speciesName)}, was welcomed`
    case 'hatched':
      return `${arrival.name} hatched`
    case 'chrysalis':
      return `${arrival.name} became a chrysalis`
    case 'emerged':
      return `${arrival.name} emerged as a butterfly`
  }
}

/** "Fern hatched; Sol, a Red Admiral, was welcomed." */
function arrivalsLine(arrivals: readonly WeekArrival[]): string {
  const named = arrivals.slice(0, NAMED_ARRIVALS).map(arrivalWords)
  const rest = arrivals.length - named.length
  if (rest > 0)
    named.push(`and ${countedInWords(rest, 'other change', 'other changes')} among your companions`)
  return `${named.join('; ')}.`
}

/**
 * The letter for the week ending on `sunday`: what the gardener did, said
 * plainly; what began among their companions; and a line of their own when
 * they starred one and allow it. A week with nothing in it still gets a
 * letter, and a true one: nothing was asked of that week.
 */
export function weeklyLetter(state: AppState, sunday: string): GardenLetter {
  const summary = summariseWeek(state, sunday)
  const profile: Profile | undefined = state.profile
  const name = profile?.name.trim()
  const acts = actsOf(summary.counts, profile?.hideDayCounts !== true)
  const paragraphs: string[] = []
  if (acts.length > 0) paragraphs.push(`This week you ${listed(acts)}.`)
  if (summary.arrivals.length > 0) {
    if (acts.length === 0) paragraphs.push('A quiet week.')
    paragraphs.push(arrivalsLine(summary.arrivals))
  } else if (acts.length === 0) {
    paragraphs.push('A quiet week. The garden kept your place.')
  }
  return {
    week: summary.week,
    greeting: `Dear ${name || 'gardener'},`,
    paragraphs,
    ...(summary.quote ? { quote: summary.quote } : {}),
  }
}

/** Built once: constructing an Intl formatter is the costly part. */
const weekFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' })

/** A week as the gardener's locale writes a range: "19–25 October", "October 19 – 25". */
export function formatWeek(week: LetterWeek): string {
  return weekFormat.formatRange(localDateToNoon(week.monday), localDateToNoon(week.sunday))
}
