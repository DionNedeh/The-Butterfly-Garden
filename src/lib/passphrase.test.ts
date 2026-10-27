import { describe, expect, it } from 'vitest'
import {
  MIN_PASSPHRASE_LENGTH,
  passphraseLength,
  passphraseStrength,
  strengthWords,
} from './passphrase'

describe('a passphrase’s length', () => {
  it('needs at least eight characters, counted as they are seen', () => {
    expect(MIN_PASSPHRASE_LENGTH).toBe(8)
    // Eight emoji are eight characters, not sixteen UTF-16 units.
    expect(passphraseLength('🦋🌼🌿🐝🍃🌸🌻🌙')).toBe(8)
    expect(passphraseLength('café')).toBe(4)
    expect(passphraseStrength('seven c')).toBe('too-short')
    expect(passphraseStrength('🦋🌼🌿🐝🍃🌸🌻🌙')).not.toBe('too-short')
  })
})

describe('how strong a passphrase looks', () => {
  it('calls the first guesses weak, however they are dressed up', () => {
    for (const weak of [
      'password',
      'Password 123!',
      'PASSWORD',
      'butterfly',
      'my butterfly garden',
      'the secret garden',
      '12345678',
      '20261027',
      'abcdefgh',
      'hgfedcba',
      'qwertyuiop',
      'asdfghjk',
      'aaaaaaaaaaaaaaaa',
      'lalalalalalalala',
      'abcabcabcabc',
      'ababbaba',
    ]) {
      expect(passphraseStrength(weak), weak).toBe('weak')
    }
  })

  it('calls a short passphrase with no pattern fair, and a long one strong', () => {
    expect(passphraseStrength('Tr0ub4dor&3')).toBe('fair')
    expect(passphraseStrength('quiet lantern')).toBe('fair')
    expect(passphraseStrength('quiet meadow lantern')).toBe('strong')
    expect(passphraseStrength('correct horse battery staple')).toBe('strong')
    // An obvious word among unrelated ones is not the whole phrase.
    expect(passphraseStrength('butterfly kettle orbit')).toBe('strong')
  })

  it('says each in plain words', () => {
    expect(strengthWords('too-short', 0)).toBe(
      'At least 8 characters. A few unrelated words are easy to remember and hard to guess.',
    )
    expect(strengthWords('too-short', 3)).toBe('Too short: at least 8 characters.')
    expect(strengthWords('weak', 8)).toMatch(/^Weak: /)
    expect(strengthWords('fair', 10)).toMatch(/^Fair\. Longer is stronger/)
    expect(strengthWords('strong', 20)).toBe('Strong: long, and not an obvious pattern.')
  })
})
