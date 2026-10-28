/**
 * Searching text on the device, the same way everywhere: the Journal's own
 * search (lib/journalSearch) and the Guide's.
 */

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
export function searchWords(query: string): string[] {
  const normalised = normaliseForSearch(query)
  return normalised === '' ? [] : normalised.split(' ')
}

/** Whether every word is somewhere in text already normalised. */
export function hasEveryWord(normalisedText: string, words: readonly string[]): boolean {
  return words.every((word) => normalisedText.includes(word))
}
