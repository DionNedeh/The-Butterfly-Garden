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

  it('calls the garden’s own words weak, run together, dressed up or said twice', () => {
    for (const weak of [
      // The app's own name, which the file itself gives away.
      'butterflygarden',
      'mybutterflygarden',
      'thebutterflygarden',
      'ButterflyGarden1',
      'Butterfly Garden',
      'The Butterfly Garden!',
      'BUTTERFLY-GARDEN-2026',
      'marigoldgarden',
      'Sunlit Sanctuary',
      'monarch butterflies',
      'my2butterfly4garden',
      // Repeated words, or words with only an ending changed.
      'passwordpassword1',
      'lanternlanterns',
      'meadow meadowed!',
      'kettlekettlekettle',
    ]) {
      expect(passphraseStrength(weak), weak).toBe('weak')
    }
  })

  it('calls keyboard walks, runs and sequences weak, across rows and parts', () => {
    for (const weak of [
      'qwertyuiopasdf',
      'qwertyuiopasdfghjkl',
      'poiuytrewq',
      'mnbvcxzlkjhgfdsa',
      '1qaz2wsx3edc',
      '!@#$%^&*()',
      'qwerty123456',
      '1234567890abcd',
      'abcdefgh12345678',
      'abcdefgh!',
      'a1b2c3d4e5f6g7h8',
      '13579bdfh',
      'acegikmoq',
      '0987654321zyxw',
    ]) {
      expect(passphraseStrength(weak), weak).toBe('weak')
    }
  })

  it('calls dates and years weak, written any common way, beside obvious words', () => {
    for (const weak of [
      '27/10/1987',
      '1987-10-27',
      '10.27.1987 ',
      'Garden 2026',
      'Marigold 27/10/1987',
      'butterfly 1987 2026',
      'password 271087',
      'sunshine0427',
    ]) {
      expect(passphraseStrength(weak), weak).toBe('weak')
    }
  })

  it('never calls a passphrase good that leans on obvious words, or is numbers alone', () => {
    // The obvious words add nothing; only the rest counts, and that is short.
    expect(passphraseStrength('butterfly83749261')).toBe('fair')
    expect(passphraseStrength('abcdefgh83749261')).toBe('fair')
    // Numbers are guessed as numbers: a phone number is no passphrase.
    expect(passphraseStrength('0790 846 2235 117')).toBe('weak')
    expect(passphraseStrength('(0790) 846-2235 #117')).toBe('fair')
    expect(passphraseStrength('🦋🌼🌿🐝🍃🌸🌻🌙🐞🌷🍀🌾🌺🌱')).toBe('fair')
  })

  it('calls a short passphrase with no pattern fair, and a long one strong', () => {
    expect(passphraseStrength('Tr0ub4dor&3')).toBe('fair')
    expect(passphraseStrength('quiet lantern')).toBe('fair')
    expect(passphraseStrength('quiet meadow lantern')).toBe('strong')
    expect(passphraseStrength('correct horse battery staple')).toBe('strong')
    expect(passphraseStrength('violet harbor 72 kite')).toBe('strong')
    // An obvious word among unrelated ones is not the whole phrase.
    expect(passphraseStrength('butterfly kettle orbit')).toBe('strong')
    expect(passphraseStrength('garden party on mars')).toBe('strong')
    // Two words that only begin alike are two words.
    expect(passphraseStrength('tango tangerine pebble')).toBe('strong')
  })

  it('stays quick however much is pasted in', () => {
    const started = performance.now()
    expect(passphraseStrength('quiet meadow lantern '.repeat(500))).toBe('weak')
    expect(passphraseStrength(Array.from({ length: 2000 }, (_, i) => String.fromCharCode(97 + ((i * 7) % 26))).join(''))).not.toBe('too-short')
    expect(performance.now() - started).toBeLessThan(2_000)
  })

  it('says each in plain words', () => {
    expect(strengthWords('too-short', 0)).toBe(
      'At least 8 characters. A few unrelated words are easy to remember and hard to guess.',
    )
    expect(strengthWords('too-short', 3)).toBe('Too short: at least 8 characters.')
    expect(strengthWords('weak', 8)).toMatch(/^Weak: /)
    expect(strengthWords('fair', 10)).toBe(
      'Fair. Longer and less guessable is stronger: four unrelated words are much harder to guess.',
    )
    // Humble even at its best: it cannot know everything a guesser tries.
    expect(strengthWords('strong', 20)).toBe(
      'Good: long, with no pattern this check can see. Longer and less guessable is stronger still.',
    )
    expect(strengthWords('strong', 20)).not.toMatch(/strong:/i)
  })
})
