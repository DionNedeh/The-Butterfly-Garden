import { afterEach, describe, expect, it, vi } from 'vitest'
import { RECOVERY_WORDS } from '../data/recoveryWords'
import * as sealing from './sealing'
import {
  confirmsWord,
  newRecoveryCode,
  positionsToConfirm,
  readRecoveryCode,
  RECOVERY_CODE_LENGTH,
  recoverySheet,
} from './recoveryCode'

// The random source, watched: real unless a test hands it bytes of its own.
vi.mock('./sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sealing')>()
  return { ...actual, randomBytes: vi.fn(actual.randomBytes) }
})

afterEach(() => {
  vi.mocked(sealing.randomBytes).mockClear()
})

describe('the recovery words', () => {
  it('are 2,048 different short plain words, so each carries exactly 11 bits', () => {
    expect(RECOVERY_WORDS).toHaveLength(2048)
    expect(new Set(RECOVERY_WORDS).size).toBe(2048)
    for (const word of RECOVERY_WORDS) expect(word).toMatch(/^[a-z]{3,8}$/)
  })

  it('never change: a code written down today must open the garden in every later build', async () => {
    // If this fails, a word was changed, moved or removed. Put it back:
    // every recovery code already written down depends on the list as it is.
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(RECOVERY_WORDS.join(' ')))
    const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
    expect(digest).toBe('15b0bae898e37cbe4288d3d3231e72b30ea55eefa6099d0abb8c1fe89b4ad52d')
  })

  it('hold no plural beside its own singular', () => {
    const words = new Set(RECOVERY_WORDS)
    expect(RECOVERY_WORDS.filter((word) => word.endsWith('s') && words.has(word.slice(0, -1)))).toEqual([])
  })
})

describe('a new recovery code', () => {
  it('is 24 words from the list, 264 bits from the random source', () => {
    const words = newRecoveryCode()
    expect(words).toHaveLength(RECOVERY_CODE_LENGTH)
    for (const word of words) expect(RECOVERY_WORDS).toContain(word)
    expect(sealing.randomBytes).toHaveBeenCalledWith(33)
  })

  it('reads the random bits 11 at a time, from the first word to the last', () => {
    // All ones, then all zeros: the first word is the list's last, and the
    // pattern of bits decides every word after it.
    const bytes = new Uint8Array(33)
    bytes.fill(0xff, 0, 11)
    vi.mocked(sealing.randomBytes).mockReturnValueOnce(bytes)
    const words = newRecoveryCode()
    expect(words.slice(0, 8)).toEqual(Array(8).fill(RECOVERY_WORDS[2047]))
    expect(words.slice(8)).toEqual(Array(16).fill(RECOVERY_WORDS[0]))
  })

  it('differs every time', () => {
    expect(newRecoveryCode().join(' ')).not.toBe(newRecoveryCode().join(' '))
  })
})

describe('reading a recovery code as typed', () => {
  const code = newRecoveryCode()

  it('accepts the words in any case, numbered or not, over lines or on one', () => {
    expect(readRecoveryCode(code.join(' '))).toEqual({ ok: true, words: code })
    const numbered = code.map((word, index) => `${index + 1}. ${word.toUpperCase()}`).join('\n')
    expect(readRecoveryCode(numbered)).toEqual({ ok: true, words: code })
    expect(readRecoveryCode(`  ${code.join(',   ')}  `)).toEqual({ ok: true, words: code })
  })

  it('names a word that is not on the list', () => {
    const typo = [...code.slice(0, 23), 'zzzzz']
    expect(readRecoveryCode(typo.join(' '))).toEqual({
      ok: false,
      problem: '“zzzzz” is not one of the recovery words. Check its spelling against your sheet.',
    })
  })

  it('says how many words there are when it is not 24', () => {
    expect(readRecoveryCode(code.slice(0, 23).join(' '))).toEqual({
      ok: false,
      problem: 'That is 23 words. A recovery code has 24.',
    })
    expect(readRecoveryCode(code[0])).toMatchObject({ problem: 'That is 1 word. A recovery code has 24.' })
    expect(readRecoveryCode('   ')).toMatchObject({ ok: false, problem: 'Type the 24 words of your recovery code.' })
  })
})

describe('confirming the code was written down', () => {
  it('asks for two different positions, in order', () => {
    for (let round = 0; round < 200; round += 1) {
      const [first, second] = positionsToConfirm()
      expect(first).toBeGreaterThanOrEqual(1)
      expect(second).toBeLessThanOrEqual(24)
      expect(first).toBeLessThan(second)
    }
  })

  it('accepts the word at a position however it is typed, and only that word', () => {
    const code = newRecoveryCode()
    expect(confirmsWord(code, 5, ` ${code[4].toUpperCase()} `)).toBe(true)
    expect(confirmsWord(code, 5, code[5] === code[4] ? 'zzz' : code[5])).toBe(false)
    expect(confirmsWord(code, 5, '')).toBe(false)
  })
})

describe('the recovery sheet', () => {
  it('numbers every word and says plainly what losing it means', () => {
    const code = newRecoveryCode()
    const sheet = recoverySheet(code, new Date(2026, 9, 27))
    code.forEach((word, index) => {
      expect(sheet).toMatch(new RegExp(`\\b${index + 1}\\. ${word}\\b`))
    })
    expect(sheet).toContain('nobody can open')
    expect(sheet).toContain('not the people who made the')
    expect(sheet).toContain('Use my recovery code')
    expect(sheet).toContain('2026')
    // Three columns of eight, nothing more.
    expect(sheet.split('\n').filter((line) => /^\s*\d+\. /.test(line))).toHaveLength(8)
  })
})
