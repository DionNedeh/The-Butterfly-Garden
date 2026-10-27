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
 * Loaded with the protected backup's dialog, never with the garden.
 */

/** The shortest passphrase a protected backup takes. */
export const MIN_PASSPHRASE_LENGTH = 8

/** From this length on, a passphrase with no obvious pattern reads as strong. */
const STRONG_LENGTH = 14

/**
 * A few of the passphrases tried first by anyone guessing, the garden's own
 * words among them. Not a dictionary: a reminder that the obvious is weak.
 */
const OBVIOUS = new Set([
  'password',
  'passphrase',
  'iloveyou',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'welcome',
  'letmein',
  'trustno1',
  'qwertyuiop',
  'butterfly',
  'butterflies',
  'mygarden',
  'thegarden',
  'secretgarden',
  'monarch',
  'marigold',
  'garden',
])

/** Little words that add nothing when every other word is obvious too. */
const FILLER = new Set(['my', 'the', 'i', 'love', 'secret', 'a', 'and'])

/** Length as the gardener sees it: characters, not UTF-16 units. */
export function passphraseLength(passphrase: string): number {
  return [...passphrase.normalize('NFKC')].length
}

/** Each character one step on from the last, either way: "abcd", "4321". */
function isRun(text: string): boolean {
  const codes = [...text].map((char) => char.codePointAt(0) ?? 0)
  const step = codes[1] - codes[0]
  if (Math.abs(step) !== 1) return false
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

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890']

/** Whether a passphrase is one a guesser would try early. */
function isObvious(passphrase: string): boolean {
  const folded = passphrase.normalize('NFKC').toLowerCase()
  // Spaces, digits and marks tacked on change little: "Password 123!".
  const core = folded.replace(/[\s\d\p{P}\p{S}]+$/u, '').replace(/^[\s\d\p{P}\p{S}]+/u, '')
  if (OBVIOUS.has(folded) || OBVIOUS.has(core.replace(/\s+/g, ''))) return true
  // "my butterfly garden": every word obvious, so the whole is too.
  const words = core.split(/[\s\d\p{P}\p{S}]+/u).filter(Boolean)
  if (words.some((word) => OBVIOUS.has(word)) && words.every((word) => OBVIOUS.has(word) || FILLER.has(word)))
    return true
  if (/^\d+$/.test(folded)) return true
  if (isRun(folded) || isRepeat(folded)) return true
  if (KEYBOARD_ROWS.some((row) => row.includes(folded))) return true
  return new Set(folded).size <= 3
}

export type PassphraseStrength = 'too-short' | 'weak' | 'fair' | 'strong'

/** How a passphrase looks to someone trying to guess it. */
export function passphraseStrength(passphrase: string): PassphraseStrength {
  const length = passphraseLength(passphrase)
  if (length < MIN_PASSPHRASE_LENGTH) return 'too-short'
  if (isObvious(passphrase)) return 'weak'
  return length >= STRONG_LENGTH ? 'strong' : 'fair'
}

/** The strength in words, shown under the field as it is typed. */
export function strengthWords(strength: PassphraseStrength, length: number): string {
  switch (strength) {
    case 'too-short':
      return length === 0
        ? `At least ${MIN_PASSPHRASE_LENGTH} characters. A few unrelated words are easy to remember and hard to guess.`
        : `Too short: at least ${MIN_PASSPHRASE_LENGTH} characters.`
    case 'weak':
      return 'Weak: this is one of the first things anyone would try. A few unrelated words are much harder to guess.'
    case 'fair':
      return 'Fair. Longer is stronger: four unrelated words are much harder to guess.'
    case 'strong':
      return 'Strong: long, and not an obvious pattern.'
  }
}
