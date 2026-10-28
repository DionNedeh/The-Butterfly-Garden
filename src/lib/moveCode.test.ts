import { afterEach, describe, expect, it, vi } from 'vitest'
import { RECOVERY_WORDS } from '../data/recoveryWords'
import {
  codeHoldsTogether,
  MOVE_CODE_LENGTH,
  moveSecret,
  nearestWords,
  newMoveCode,
  readMoveCode,
} from './moveCode'
import * as sealing from './sealing'

// The random source, watched: real unless a test hands it bytes of its own.
vi.mock('./sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sealing')>()
  return { ...actual, randomBytes: vi.fn(actual.randomBytes) }
})

afterEach(() => {
  vi.mocked(sealing.randomBytes).mockClear()
})

/** The 11-bit number each word stands for. */
const indexOf = (word: string) => RECOVERY_WORDS.indexOf(word)

/** A code's 132 bits as a string of 0s and 1s. */
const bitsOf = (words: readonly string[]) =>
  words.map((word) => indexOf(word).toString(2).padStart(11, '0')).join('')

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))
}

describe('a new move code', () => {
  it('is 12 words from the lock’s list, from 128 random bits', async () => {
    const words = await newMoveCode()
    expect(words).toHaveLength(MOVE_CODE_LENGTH)
    for (const word of words) expect(RECOVERY_WORDS).toContain(word)
    expect(sealing.randomBytes).toHaveBeenCalledWith(16)
  })

  it('carries the 128 bits in order, then the first four bits of their SHA-256', async () => {
    const key = Uint8Array.from({ length: 16 }, (_, index) => index * 17 + 3)
    vi.mocked(sealing.randomBytes).mockReturnValueOnce(key)
    const words = await newMoveCode()
    const bits = bitsOf(words)
    expect(bits).toHaveLength(132)
    const keyBits = Array.from(key, (byte) => byte.toString(2).padStart(8, '0')).join('')
    expect(bits.slice(0, 128)).toBe(keyBits)
    const check = (await sha256(key))[0] >>> 4
    expect(bits.slice(128)).toBe(check.toString(2).padStart(4, '0'))
  })

  it('is all the list’s first word for nothing but zeros, but for the check', async () => {
    vi.mocked(sealing.randomBytes).mockReturnValueOnce(new Uint8Array(16))
    const words = await newMoveCode()
    // SHA-256 of 16 zero bytes begins 0x37: the check is 0b0011.
    expect(words.slice(0, 11)).toEqual(Array(11).fill(RECOVERY_WORDS[0]))
    expect(words[11]).toBe(RECOVERY_WORDS[0b0011])
  })

  it('is new every time', async () => {
    const codes = new Set<string>()
    for (let round = 0; round < 20; round += 1) codes.add((await newMoveCode()).join(' '))
    expect(codes.size).toBe(20)
  })
})

describe('words and key', () => {
  it('go round: every new code holds together, and reads back as itself', async () => {
    for (let round = 0; round < 25; round += 1) {
      const words = await newMoveCode()
      expect(await codeHoldsTogether(words)).toBe(true)
      expect(readMoveCode(words.join(' '))).toEqual({ ok: true, words })
    }
  })

  it('lock the file with the words, lower case, one space apart', async () => {
    const words = await newMoveCode()
    expect(moveSecret(words)).toBe(words.join(' '))
    expect(moveSecret(words)).toMatch(/^[a-z]+( [a-z]+){11}$/)
  })

  it('refuse a word changed to another word on the list, by its check', async () => {
    const words = await newMoveCode()
    let refused = 0
    // Each of the other 2,047 words in the last place: the check lets
    // through only the few that happen to share it, one in sixteen.
    for (const other of RECOVERY_WORDS) {
      if (other === words[11]) continue
      if (!(await codeHoldsTogether([...words.slice(0, 11), other]))) refused += 1
    }
    expect(refused).toBeGreaterThan(1800)
  })

  it('refuse two words swapped, almost always', async () => {
    let refused = 0
    for (let round = 0; round < 32; round += 1) {
      const words = await newMoveCode()
      if (words[0] === words[1]) continue
      if (!(await codeHoldsTogether([words[1], words[0], ...words.slice(2)]))) refused += 1
    }
    expect(refused).toBeGreaterThan(20)
  })

  it('refuse the wrong number of words, or a word not on the list', async () => {
    const words = await newMoveCode()
    expect(await codeHoldsTogether(words.slice(1))).toBe(false)
    expect(await codeHoldsTogether([...words.slice(1), 'zzz'])).toBe(false)
  })
})

describe('reading a code as it was typed', () => {
  const code = 'acorn meadow lantern willow tulip harbor wren velvet cactus bamboo zinnia almond'.split(' ')

  it('forgives capitals, extra spaces, line breaks and the numbers beside the words', () => {
    const messy = '  1. ACORN\n2.  meadow   Lantern willow\r\n\t5) tulip ,harbor  wren\nVelvet cactus bamboo zinnia almond  '
    expect(readMoveCode(messy)).toEqual({ ok: true, words: code })
  })

  it('names a misspelt word and offers the nearest on the list', () => {
    expect(readMoveCode('acorn medow')).toEqual({
      ok: false,
      problem: '“medow” is not one of the code’s words. Did you mean “meadow”?',
    })
    // Two letters swapped count as one slip.
    expect(nearestWords('aocrn')).toContain('acorn')
    expect(nearestWords('meadow')).toEqual(['meadow'])
  })

  it('offers up to three near words, and says so plainly when none is near', () => {
    expect(nearestWords('bat').length).toBeLessThanOrEqual(3)
    expect(nearestWords('bat').length).toBeGreaterThan(0)
    const far = readMoveCode('acorn qqqqqqqqqqqq')
    expect(far).toEqual({
      ok: false,
      problem: '“qqqqqqqqqqqq” is not one of the code’s words. Check it against your other device.',
    })
    const several = readMoveCode('acorn bakr')
    expect(several.ok).toBe(false)
    if (!several.ok) expect(several.problem).toMatch(/^“bakr” is not one of the code’s words\. Did you mean “[a-z]+”(, “[a-z]+”)*( or “[a-z]+”)?\?$/)
  })

  it('counts the words when there are too few or too many', () => {
    expect(readMoveCode('')).toEqual({ ok: false, problem: 'Type the 12 words your other device shows.' })
    expect(readMoveCode('  \n ')).toEqual({ ok: false, problem: 'Type the 12 words your other device shows.' })
    expect(readMoveCode('acorn')).toEqual({ ok: false, problem: 'That is 1 word. The code has 12.' })
    expect(readMoveCode(Array(13).fill('acorn').join(' '))).toEqual({
      ok: false,
      problem: 'That is 13 words. The code has 12.',
    })
  })

  it('reads letters made another way the same (NFKC)', () => {
    // Fullwidth letters, as some keyboards type them, are the same words.
    expect(readMoveCode('ａｃｏｒｎ')).toEqual({ ok: false, problem: 'That is 1 word. The code has 12.' })
  })
})
