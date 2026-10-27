import { RECOVERY_WORDS } from '../data/recoveryWords'
import { randomBytes } from './sealing'

/**
 * The garden lock's recovery code: 24 words the gardener writes down, which
 * open the garden when the passcode is forgotten.
 *
 * Each word is one of 2,048 (data/recoveryWords), so it carries 11 bits, and
 * the 24 words carry 264 bits of fresh randomness: far more than anyone can
 * guess, which is why the code is the gardener's to keep safe rather than a
 * second secret to remember.
 *
 * Loaded with the lock's setup and "Use my recovery code", never before.
 */

export const RECOVERY_CODE_LENGTH = 24

/** Bits each word carries: log2 of the list's 2,048 words. */
const BITS_PER_WORD = 11

const known = new Set(RECOVERY_WORDS)

/**
 * A new recovery code. 33 random bytes are exactly 264 bits, read 11 at a
 * time, so every word is equally likely and nothing is wasted or biased.
 */
export function newRecoveryCode(): string[] {
  const words: string[] = []
  let pending = 0
  let bits = 0
  for (const byte of randomBytes((RECOVERY_CODE_LENGTH * BITS_PER_WORD) / 8)) {
    pending = (pending << 8) | byte
    bits += 8
    if (bits >= BITS_PER_WORD) {
      bits -= BITS_PER_WORD
      words.push(RECOVERY_WORDS[(pending >> bits) & 0x7ff])
      pending &= (1 << bits) - 1
    }
  }
  return words
}

export type RecoveryReading =
  | { ok: true; words: string[] }
  | { ok: false; problem: string }

/**
 * Read a recovery code as the gardener typed or pasted it: in any case, with
 * the sheet's numbers or without, across lines or on one. Saying which word
 * is not on the list, or how many words there are, gives nothing away: the
 * gardener holds the code, and the list is in the app for anyone to read.
 */
export function readRecoveryCode(text: string): RecoveryReading {
  const words = text
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
  if (words.length === 0) {
    return { ok: false, problem: 'Type the 24 words of your recovery code.' }
  }
  const stranger = words.find((word) => !known.has(word))
  if (stranger !== undefined) {
    return {
      ok: false,
      problem: `“${stranger}” is not one of the recovery words. Check its spelling against your sheet.`,
    }
  }
  if (words.length !== RECOVERY_CODE_LENGTH) {
    return {
      ok: false,
      problem: `That is ${words.length} ${words.length === 1 ? 'word' : 'words'}. A recovery code has ${RECOVERY_CODE_LENGTH}.`,
    }
  }
  return { ok: true, words }
}

/**
 * Two different word positions (counted from 1) to ask for before the lock
 * turns on, in order. Proof that the code was written down, not a secret.
 */
export function positionsToConfirm(): [number, number] {
  const [a, b] = randomBytes(2)
  const first = a % RECOVERY_CODE_LENGTH
  // A step of 1 to 23 from the first, so the two always differ.
  const second = (first + 1 + (b % (RECOVERY_CODE_LENGTH - 1))) % RECOVERY_CODE_LENGTH
  return first < second ? [first + 1, second + 1] : [second + 1, first + 1]
}

/** Whether a word typed for a position is the one written there. */
export function confirmsWord(
  words: readonly string[],
  position: number,
  typed: string,
): boolean {
  return typed.normalize('NFKC').trim().toLowerCase() === words[position - 1]
}

/**
 * The recovery sheet, as plain text: the words numbered in three columns,
 * and what they are for, in words that still make sense to someone finding
 * the sheet in a drawer years later.
 */
export function recoverySheet(words: readonly string[], madeOn: Date): string {
  const rows = RECOVERY_CODE_LENGTH / 3
  const cell = (index: number) => `${String(index + 1).padStart(2)}. ${words[index]}`.padEnd(16)
  const grid = Array.from({ length: rows }, (_, row) =>
    [row, row + rows, row + 2 * rows].map(cell).join('  ').trimEnd(),
  )
  const day = madeOn.toLocaleDateString(undefined, { dateStyle: 'long' })
  return [
    'The Butterfly Garden: recovery code',
    '',
    `Made on ${day}.`,
    '',
    'These 24 words open your locked garden if you forget its passcode.',
    'Type them in order, after "Use my recovery code" on the lock screen.',
    '',
    ...grid,
    '',
    'Keep this sheet somewhere private and safe, away from the device.',
    'Anyone who has these words and the device can open your garden.',
    '',
    'If the passcode is forgotten and these words are lost, nobody can open',
    'the garden: not you, not anyone else, and not the people who made the',
    'app. There is no other way in.',
    '',
    'Making a new recovery code in Settings stops this one opening the',
    'garden, though not copies of the garden saved before then.',
    '',
  ].join('\n')
}
