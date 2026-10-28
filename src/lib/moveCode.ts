import { RECOVERY_WORDS } from '../data/recoveryWords'
import { randomBytes } from './sealing'

/**
 * The one-time code that opens a move file (components/move): 12 words from
 * the garden lock's list of 2,048 (data/recoveryWords), shown once on the old
 * device and typed on the new one.
 *
 * Twelve words of 11 bits carry 132 bits: 128 of them are fresh randomness,
 * and the last 4 are a check, the first 4 bits of the SHA-256 of those 128,
 * as BIP-39 lays out its 12-word phrases. The check catches a word typed as
 * another word on the list, or two swapped, at once, before the slow work of
 * opening the file starts. It adds nothing to the strength, which stays at
 * 128 bits: beyond guessing by anyone, with or without the file.
 *
 * The file's key is made from the words themselves, in lower case with one
 * space between them, by the protected backup's own derivation
 * (lib/sealedBackup: PBKDF2-HMAC-SHA-256, 600,000 rounds, a fresh salt, then
 * AES-GCM 256). So the move file is an ordinary protected backup, and a
 * protected backup's passphrase prompt opens it too, given the words exactly.
 *
 * Nothing here stores anything.
 */

export const MOVE_CODE_LENGTH = 12

/** The randomness in a code: 128 bits. */
const KEY_BYTES = 16
/** Bits each word carries: log2 of the list's 2,048 words. */
const BITS_PER_WORD = 11

const positions = new Map(RECOVERY_WORDS.map((word, index) => [word, index]))

/** The 4-bit check for 16 bytes: the top of the first byte of their SHA-256. */
async function checkOf(key: Uint8Array): Promise<number> {
  const copy = new Uint8Array(key.length)
  copy.set(key)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', copy))
  return hash[0] >>> 4
}

/** Bytes and a 4-bit check, as 12 words: the bits read 11 at a time, in order. */
function toWords(key: Uint8Array, check: number): string[] {
  const words: string[] = []
  let pending = 0
  let bits = 0
  const take = (value: number, width: number) => {
    pending = (pending << width) | value
    bits += width
    while (bits >= BITS_PER_WORD) {
      bits -= BITS_PER_WORD
      words.push(RECOVERY_WORDS[(pending >>> bits) & 0x7ff])
      pending &= (1 << bits) - 1
    }
  }
  for (const byte of key) take(byte, 8)
  take(check, 4)
  return words
}

/** Twelve known words back to their 16 bytes and their check. */
function fromWords(words: readonly string[]): { key: Uint8Array; check: number } {
  const key = new Uint8Array(KEY_BYTES)
  let pending = 0
  let bits = 0
  let at = 0
  for (const word of words) {
    pending = (pending << BITS_PER_WORD) | (positions.get(word) ?? 0)
    bits += BITS_PER_WORD
    while (bits >= 8 && at < KEY_BYTES) {
      bits -= 8
      key[at] = (pending >>> bits) & 0xff
      at += 1
      pending &= (1 << bits) - 1
    }
  }
  return { key, check: pending & 0xf }
}

/** A new one-time code, from the platform's cryptographic randomness. */
export async function newMoveCode(): Promise<string[]> {
  const key = randomBytes(KEY_BYTES)
  return toWords(key, await checkOf(key))
}

/** Whether 12 known words carry their own check: a code as it was made. */
export async function codeHoldsTogether(words: readonly string[]): Promise<boolean> {
  if (words.length !== MOVE_CODE_LENGTH || words.some((word) => !positions.has(word))) return false
  const { key, check } = fromWords(words)
  return (await checkOf(key)) === check
}

/** The secret the move file is locked with: the words, lower case, one space apart. */
export function moveSecret(words: readonly string[]): string {
  return words.join(' ')
}

/**
 * Edits between two words, a swap of neighbouring letters counting as one
 * (optimal string alignment), stopping early once past `limit`.
 */
function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let before: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let best = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, before[j - 2] + 1)
      current.push(value)
      best = Math.min(best, value)
    }
    if (best > limit) return limit + 1
    before = previous
    previous = current
  }
  return previous[b.length]
}

/** Up to three words on the list closest to one that is not, within two edits. */
export function nearestWords(word: string): string[] {
  let closest = 3
  let found: string[] = []
  for (const candidate of RECOVERY_WORDS) {
    const edits = distance(word, candidate, Math.min(closest, 2))
    if (edits < closest) {
      closest = edits
      found = [candidate]
    } else if (edits === closest && edits <= 2) {
      found.push(candidate)
    }
  }
  return found.slice(0, 3)
}

function quoted(words: readonly string[]): string {
  const marked = words.map((word) => `“${word}”`)
  return marked.length === 1 ? marked[0] : `${marked.slice(0, -1).join(', ')} or ${marked[marked.length - 1]}`
}

export type MoveCodeReading = { ok: true; words: string[] } | { ok: false; problem: string }

/**
 * Read a code as it was typed or pasted: in any case, across lines
 * or on one, with numbers or without, and with as many spaces as anyone
 * likes. A word not on the list is named, with the nearest that are; how
 * many words there are is said. None of this helps anyone without the
 * code: the list is in the app for anyone to read.
 *
 * Whether the words carry their check is a second, slower question
 * (`codeHoldsTogether`), asked once they all read.
 */
export function readMoveCode(text: string): MoveCodeReading {
  const words = text
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
  if (words.length === 0)
    return { ok: false, problem: `Type the ${MOVE_CODE_LENGTH} words your other device shows.` }
  const stranger = words.find((word) => !positions.has(word))
  if (stranger !== undefined) {
    const near = nearestWords(stranger)
    return {
      ok: false,
      problem: near.length
        ? `“${stranger}” is not one of the code’s words. Did you mean ${quoted(near)}?`
        : `“${stranger}” is not one of the code’s words. Check it against your other device.`,
    }
  }
  if (words.length !== MOVE_CODE_LENGTH) {
    return {
      ok: false,
      problem: `That is ${words.length} ${words.length === 1 ? 'word' : 'words'}. The code has ${MOVE_CODE_LENGTH}.`,
    }
  }
  return { ok: true, words }
}
