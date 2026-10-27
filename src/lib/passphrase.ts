/**
 * What a passphrase for a protected backup must be, and how strong it looks,
 * in plain words.
 *
 * Only the length is a rule. Strength is advice: a rough, honest reading of
 * how easily the passphrase could be guessed by someone holding the file,
 * who can try as many as they like without the app ever knowing. It never
 * scores and never claims more certainty than it has; a long phrase of
 * unrelated words is what it steers towards.
 *
 * It errs towards caution. The file names its app (its format, and the name
 * it is saved under), so whoever holds one tries the garden's own words
 * first, run together or apart, then the patterns everyone tries: a word
 * said twice, a keyboard's rows, a run of letters or numbers, a date. Any of
 * those is weak, however it is dressed up; a passphrase that leans on them
 * is fair at best. Only what is long and none of these reads as good, and
 * even then the words say it could be stronger.
 *
 * Loaded with the protected backup's dialog, never with the garden.
 */

/** The shortest passphrase a protected backup takes. */
export const MIN_PASSPHRASE_LENGTH = 8

/** From this length on, a passphrase with no obvious pattern reads as good. */
const STRONG_LENGTH = 14

/**
 * A few of the passphrases tried first by anyone guessing, the garden's own
 * words among them. Not a dictionary: a reminder that the obvious is weak.
 * A word here with an "s" on the end is just as obvious.
 */
const OBVIOUS = new Set([
  'password',
  'passphrase',
  'passcode',
  'iloveyou',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'welcome',
  'letmein',
  'trustno1',
  'qwerty',
  'qwertyuiop',
  'dragon',
  'monkey',
  'shadow',
  'master',
  'hello',
  'freedom',
  'backup',
  'protected',
  'journal',
  'diary',
  // The garden's own words: its name, its guide, its default name, its things.
  'butterfly',
  'butterflies',
  'garden',
  'mygarden',
  'thegarden',
  'secretgarden',
  'monarch',
  'marigold',
  'sunlit',
  'sanctuary',
  'flower',
  'meadow',
  'bloom',
  'seed',
  'nectar',
  'stardust',
  'sunlight',
  'moonlight',
  'caterpillar',
  'chrysalis',
  'wings',
])

/** Little words that add nothing when every other word is obvious too. */
const FILLER = new Set(['my', 'the', 'i', 'love', 'secret', 'a', 'and', 'our', 'your', 'of', 'in', 'to', 'is'])

/** The longest word either set holds, so a split need not look further. */
const LONGEST = Math.max(...[...OBVIOUS, ...FILLER].map((word) => word.length)) + 1

/** Length as the gardener sees it: characters, not UTF-16 units. */
export function passphraseLength(passphrase: string): number {
  return [...passphrase.normalize('NFKC')].length
}

/** An obvious word, or one with an "s" on the end. */
function obviousWord(word: string): boolean {
  return OBVIOUS.has(word) || (word.endsWith('s') && OBVIOUS.has(word.slice(0, -1)))
}

/**
 * Whether letters can be read, from first to last, as nothing but obvious
 * words and little ones, at least one of them obvious: "mybutterflygarden",
 * "marigoldgarden", "passwordpassword". However they were spaced, cased or
 * split by numbers, it is the words a guesser tries.
 */
function madeOfObvious(letters: string): boolean {
  // 0: not reached; 1: reached by little words alone; 2: reached with an obvious one.
  const reached = new Array<number>(letters.length + 1).fill(0)
  reached[0] = 1
  for (let end = 1; end <= letters.length; end += 1) {
    for (let start = Math.max(0, end - LONGEST); start < end; start += 1) {
      if (!reached[start]) continue
      const word = letters.slice(start, end)
      if (obviousWord(word)) reached[end] = 2
      else if (FILLER.has(word)) reached[end] = Math.max(reached[end], reached[start])
    }
  }
  return letters.length > 0 && reached[letters.length] === 2
}

/**
 * Each character a steady step on from the last, either way: "abcd",
 * "4321", "13579", "acegi".
 */
function isRun(text: string): boolean {
  const codes = [...text].map((char) => char.codePointAt(0) ?? 0)
  if (codes.length < 3) return false
  const step = codes[1] - codes[0]
  if (step === 0 || Math.abs(step) > 3) return false
  return codes.every((code, index) => index === 0 || code - codes[index - 1] === step)
}

/** The same short piece over and over: "abcabcabc", "lalalala". */
function isRepeat(text: string): boolean {
  for (let size = 1; size <= text.length / 2; size += 1) {
    if (text.length % size === 0 && text.slice(0, size).repeat(text.length / size) === text)
      return true
  }
  return false
}

/**
 * One word said again, with at most a short ending changed each time:
 * "lanternlanterns", "meadow meadowed", "gardeninggarden".
 */
function isEcho(letters: string): boolean {
  // A stem longer than this said twice is long enough not to matter, and
  // the look stays quick however much is pasted in.
  for (let size = 4; size <= 32 && size * 2 <= letters.length; size += 1) {
    const stem = letters.slice(0, size)
    // Where a telling of the stem, and its ending, can finish; and how many tellings got there.
    const told = new Array<number>(letters.length + 1).fill(0)
    told[0] = 1
    for (let at = 0; at < letters.length; at += 1) {
      if (!told[at] || !letters.startsWith(stem, at)) continue
      for (let ending = 0; ending <= 3 && at + size + ending <= letters.length; ending += 1) {
        told[at + size + ending] = Math.max(told[at + size + ending], told[at] + 1)
      }
    }
    if (told[letters.length] > 2) return true
  }
  return false
}

/**
 * Keys side by side, along a keyboard's rows (one after the next, as a
 * finger runs on) or down its columns.
 */
const KEYBOARD_WALKS = [
  'qwertyuiopasdfghjklzxcvbnm',
  '1234567890',
  '!@#$%^&*()',
  'qazwsxedcrfvtgbyhnujmikolp',
  '1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p',
]

function isWalk(text: string): boolean {
  if (text.length < 3) return false
  const backwards = [...text].reverse().join('')
  return KEYBOARD_WALKS.some((walk) => walk.includes(text) || walk.includes(backwards))
}

/** A real month and day, as numbers. */
function isDay(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/**
 * A year, or a day written the ways people write them (day, month, year in
 * any common order, two or four digits for the year), or two years.
 */
function isDate(digits: string): boolean {
  const n = (from: number, to: number) => Number(digits.slice(from, to))
  const year = (text: string) => /^(19|20)\d\d$/.test(text)
  switch (digits.length) {
    case 4:
      return year(digits) || isDay(n(0, 2), n(2, 4)) || isDay(n(2, 4), n(0, 2))
    case 6:
      return isDay(n(2, 4), n(0, 2)) || isDay(n(0, 2), n(2, 4)) || isDay(n(2, 4), n(4, 6))
    case 8:
      return (
        (year(digits.slice(4)) && (isDay(n(2, 4), n(0, 2)) || isDay(n(0, 2), n(2, 4)))) ||
        (year(digits.slice(0, 4)) && (isDay(n(4, 6), n(6, 8)) || year(digits.slice(4))))
      )
    default:
      return false
  }
}

/**
 * Whether a piece of a passphrase adds little or nothing: absent, a
 * character or two, or a pattern.
 */
function isPattern(text: string): boolean {
  return (
    text.length <= 2 ||
    new Set(text).size <= 2 ||
    isRun(text) ||
    isRepeat(text) ||
    isWalk(text) ||
    (/^\d+$/.test(text) && isDate(text))
  )
}

/** A passphrase in its parts: its letters, its digits, and everything else but spaces. */
function partsOf(passphrase: string) {
  const folded = passphrase.normalize('NFKC').toLowerCase()
  return {
    folded,
    compact: folded.replace(/\s+/gu, ''),
    letters: folded.replace(/[^\p{L}]+/gu, ''),
    digits: folded.replace(/\D+/g, ''),
    marks: folded.replace(/[\p{L}\d\s]+/gu, ''),
  }
}

/** Whether its words are the garden's own, the obvious ones, a pattern, or one said twice. */
function leansOnTheObvious(letters: string): boolean {
  return madeOfObvious(letters) || isEcho(letters) || (letters.length > 0 && isPattern(letters))
}

/** Whether a passphrase is one a guesser would try early. */
function isObvious(passphrase: string): boolean {
  const { folded, compact, letters, digits, marks } = partsOf(passphrase)
  if (OBVIOUS.has(compact) || /^\d+$/.test(compact)) return true
  if (isPattern(compact) || isEcho(compact) || new Set(folded).size <= 3) return true
  // Every part obvious or a pattern: "ButterflyGarden1", "Password 123!",
  // "abcdefgh12345678", "Marigold 27/10/1987".
  return (letters === '' || leansOnTheObvious(letters)) && isPattern(digits) && isPattern(marks)
}

export type PassphraseStrength = 'too-short' | 'weak' | 'fair' | 'strong'

/** How a passphrase looks to someone trying to guess it. */
export function passphraseStrength(passphrase: string): PassphraseStrength {
  const length = passphraseLength(passphrase)
  if (length < MIN_PASSPHRASE_LENGTH) return 'too-short'
  if (isObvious(passphrase)) return 'weak'
  // Obvious words with a few unguessable characters added are only as
  // strong as those characters, and numbers alone (a phone number, a
  // date) are guessed as numbers: fair, however long.
  const { letters } = partsOf(passphrase)
  if (length < STRONG_LENGTH || letters === '' || leansOnTheObvious(letters)) return 'fair'
  return 'strong'
}

/** The strength in words, shown under the field as it is typed. */
export function strengthWords(strength: PassphraseStrength, length: number): string {
  switch (strength) {
    case 'too-short':
      return length === 0
        ? `At least ${MIN_PASSPHRASE_LENGTH} characters. A few unrelated words are easy to remember and hard to guess.`
        : `Too short: at least ${MIN_PASSPHRASE_LENGTH} characters.`
    case 'weak':
      return 'Weak: this is close to what anyone guessing would try first. A few unrelated words are much harder to guess.'
    case 'fair':
      return 'Fair. Longer and less guessable is stronger: four unrelated words are much harder to guess.'
    case 'strong':
      return 'Good: long, with no pattern this check can see. Longer and less guessable is stronger still.'
  }
}
