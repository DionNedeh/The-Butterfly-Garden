import type { MoodChoice, MoodEntry, RecapEntry, ReflectionEntry } from '../types'
import { describeCheckInDetails } from './feelings'
import { moodChoiceOf } from './mood'

/** The three things a journal day can hold. */
export type JournalKind = 'check-in' | 'reflection' | 'recap'

/** Every kind, in the order the timeline shows them within a day. */
export const JOURNAL_KINDS: readonly JournalKind[] = ['check-in', 'reflection', 'recap']

/**
 * What the gardener is looking for in their journal.
 *
 * Kept as plain data so the Journal can hold it in state, defer it while
 * someone types, and hand it to `filterJournalDates` unchanged.
 */
export interface JournalFilter {
  /** Words to find, in any order; spacing, case and accents do not matter. */
  query: string
  /** Kinds of entry to look in. Empty means every kind. */
  kinds: readonly JournalKind[]
  /** The day's check-in weather. Absent means any weather. */
  weather?: MoodChoice
}

export const EMPTY_FILTER: JournalFilter = { query: '', kinds: [] }

/** The journal's entries, indexed by local date the way the Journal holds them. */
export interface JournalDays {
  moodByDate: ReadonlyMap<string, MoodEntry>
  reflectionByDate: ReadonlyMap<string, ReflectionEntry>
  recapByDate: ReadonlyMap<string, RecapEntry>
}

/**
 * One day's writing, already normalised for search, by kind. A kind the day
 * has no entry of is absent rather than empty, so presence can be read here
 * without going back to the entries.
 */
export type DayText = Readonly<Partial<Record<JournalKind, string>>>

/** Every day's normalised writing, by local date. */
export type JournalTextIndex = ReadonlyMap<string, DayText>

/** Whether the filter would narrow the journal at all. */
export function isFilterActive(filter: JournalFilter): boolean {
  return (
    filter.query.trim() !== '' ||
    filter.kinds.length > 0 ||
    filter.weather !== undefined
  )
}

/**
 * Text as search compares it: lower case, accents taken off, curly quotes
 * made straight, and any run of whitespace (a line break in a recap
 * included) read as one space.
 *
 * NFKD splits an accented letter from its marks and folds look-alike forms
 * such as ligatures, full-width and "fancy font" letters into ordinary ones,
 * so "cafe" finds "Café", "fine" a pasted "ﬁne" and "hello" a pasted
 * "𝐇𝐞𝐥𝐥𝐨"; it runs before lower-casing, since some of those fold to
 * capitals. Only the combining accents of the Latin, Greek and Cyrillic
 * alphabets are dropped: in Devanagari or Japanese a mark is part of the
 * letter, and "がっこう" (school) must not find "かっこう" (cuckoo). "ß"
 * is read as "ss", so "strasse" finds "Straße".
 * Quotes are folded because a phone keyboard often curls an apostrophe that
 * a desktop one leaves straight, and "don't" should find what was written as
 * "don’t". Both sides of every comparison go through here, so they agree.
 */
/** Combining accents (U+0300–036F and their supplements), and no other marks. */
const ACCENT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0300, 0x036f],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x20d0, 0x20ff],
  [0xfe20, 0xfe2f],
]

function withoutAccent(mark: string): string {
  const code = mark.codePointAt(0) ?? 0
  return ACCENT_RANGES.some(([from, to]) => code >= from && code <= to) ? '' : mark
}

export function normaliseForSearch(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, withoutAccent)
    .replace(/ß/g, 'ss')
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The words of a query, each normalised; none for a blank query. */
function searchWords(query: string): string[] {
  const normalised = normaliseForSearch(query)
  return normalised === '' ? [] : normalised.split(' ')
}

/** Each kind's entries, so the same question can be asked of any of them. */
function entriesOf(days: JournalDays, kind: JournalKind): ReadonlyMap<string, unknown> {
  if (kind === 'check-in') return days.moodByDate
  if (kind === 'reflection') return days.reflectionByDate
  return days.recapByDate
}

/**
 * A day's writing of one kind, as written; undefined without an entry. A
 * check-in's feelings and energy are found by the same words the journal
 * shows them in, so "hopeful" finds a day tagged hopeful.
 */
function writingOf(days: JournalDays, kind: JournalKind, date: string): string | undefined {
  if (kind === 'check-in') {
    const mood = days.moodByDate.get(date)
    // On separate lines, so a word cannot run from the note into the tags.
    return mood && `${mood.note}\n${describeCheckInDetails(mood)}`
  }
  if (kind === 'reflection') return days.reflectionByDate.get(date)?.body
  const recap = days.recapByDate.get(date)
  // On separate lines, so a word cannot run from one answer into the next.
  return recap && `${recap.wentWell}\n${recap.settingDown}\n${recap.forTomorrow}`
}

/** One day's writing of the given kinds, each normalised once. */
function dayTextOf(days: JournalDays, date: string, kinds: readonly JournalKind[]): DayText {
  const text: Partial<Record<JournalKind, string>> = {}
  for (const kind of kinds) {
    const writing = writingOf(days, kind, date)
    if (writing !== undefined) text[kind] = normaliseForSearch(writing)
  }
  return text
}

/**
 * Every day's writing, normalised once, for `filterJournalDates` to search.
 *
 * Normalising is the costly part of a search, and the words being typed
 * change far more often than the entries do. Build this in a `useMemo` on
 * the three maps, and each keystroke only compares strings; it is rebuilt
 * only when an entry is written, edited or deleted.
 */
export function indexJournalText(days: JournalDays): JournalTextIndex {
  const index = new Map<string, DayText>()
  for (const kind of JOURNAL_KINDS) {
    for (const date of entriesOf(days, kind).keys()) {
      if (!index.has(date)) index.set(date, dayTextOf(days, date, JOURNAL_KINDS))
    }
  }
  return index
}

/**
 * The days that match a filter, in the order they were given.
 *
 * A day matches when it has an entry of at least one of the kinds asked for;
 * when its check-in has the weather asked for, if one is; and when every word
 * of the query is somewhere in its writing of those kinds -- the words may be
 * spread across a day's check-in note and its recap, say. A "Not sure"
 * check-in is only found by asking for "Not sure", never by the middle
 * weather it is stored with.
 *
 * Pass `index` (from `indexJournalText`) to keep typing fast over years of
 * entries. Without it, each day is normalised once per call, and only for the
 * kinds asked for. A day the index has not caught up with yet is normalised
 * on the spot rather than missed.
 */
export function filterJournalDates(
  dates: readonly string[],
  days: JournalDays,
  filter: JournalFilter,
  index?: JournalTextIndex,
): string[] {
  const kinds = filter.kinds.length > 0 ? filter.kinds : JOURNAL_KINDS
  const words = searchWords(filter.query)
  const { weather } = filter
  return dates.filter((date) => {
    if (!kinds.some((kind) => entriesOf(days, kind).has(date))) return false
    if (weather !== undefined) {
      const mood = days.moodByDate.get(date)
      if (mood === undefined || moodChoiceOf(mood) !== weather) return false
    }
    if (words.length === 0) return true
    const text = index?.get(date) ?? dayTextOf(days, date, kinds)
    return words.every((word) =>
      kinds.some((kind) => text[kind]?.includes(word) === true),
    )
  })
}
