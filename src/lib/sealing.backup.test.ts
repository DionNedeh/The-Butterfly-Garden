import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deriveKey,
  fromBase64,
  open,
  PASSPHRASE_KDF,
  randomBytes,
  seal,
  toBase64,
} from './sealing'

// Kept low so each case takes milliseconds; the production count is checked
// on its own below, and in lib/sealedBackup's tests.
const FAST = 1_000
const encode = (text: string) => new TextEncoder().encode(text)
const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const salt = Uint8Array.from({ length: 16 }, (_, index) => index)

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the passphrase function', () => {
  it('is PBKDF2-HMAC-SHA-256 at OWASP’s 600,000 iterations', () => {
    expect(PASSPHRASE_KDF).toEqual({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000 })
  })

  it('uses that count unless told otherwise', async () => {
    const derive = vi.spyOn(globalThis.crypto.subtle, 'deriveKey')
    await deriveKey('a long passphrase', salt)
    expect(derive).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000 }),
      expect.anything(),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
    )
  })

  it('makes an AES-GCM 256 key that can never be exported', async () => {
    const key = await deriveKey('a long passphrase', salt, FAST)
    expect(key.extractable).toBe(false)
    expect(key.algorithm).toEqual({ name: 'AES-GCM', length: 256 })
    expect([...key.usages].sort()).toEqual(['decrypt', 'encrypt', 'unwrapKey', 'wrapKey'])
    await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })

  it('refuses a count that is not a positive whole number', async () => {
    for (const count of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(deriveKey('a long passphrase', salt, count)).rejects.toThrow(RangeError)
    }
  })

  it('makes the same key from the same words typed another way', async () => {
    // Full-width letters, and an accent composed of two code points.
    const typed = await deriveKey('Ｇａｒｄｅｎ café', salt, FAST)
    const plain = await deriveKey('Garden café', salt, FAST)
    const sealed = await seal(typed, encode('kept'))
    expect(decode(await open(plain, sealed))).toBe('kept')
  })

  it('makes a different key from another salt or another secret', async () => {
    const key = await deriveKey('a long passphrase', salt, FAST)
    const sealed = await seal(key, encode('kept'))
    const otherSalt = await deriveKey('a long passphrase', randomBytes(16), FAST)
    const otherSecret = await deriveKey('a long passphrasf', salt, FAST)
    await expect(open(otherSalt, sealed)).rejects.toThrow()
    await expect(open(otherSecret, sealed)).rejects.toThrow()
  })

  it('says plainly when the browser has no WebCrypto here', async () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
    await expect(deriveKey('a long passphrase', salt, FAST)).rejects.toThrow(
      'This browser cannot lock or open files here.',
    )
  })
})

describe('sealing and opening', () => {
  it('opens what it sealed, with its additional data', async () => {
    const key = await deriveKey('a long passphrase', salt, FAST)
    const aad = encode('bound')
    const sealed = await seal(key, encode('Dear diary'), aad)
    expect(sealed.iv).toHaveLength(12)
    // The tag: sixteen bytes on top of the text.
    expect(sealed.ciphertext).toHaveLength(encode('Dear diary').length + 16)
    expect(decode(await open(key, sealed, aad))).toBe('Dear diary')
  })

  it('takes a fresh nonce every time, so the same text never looks the same twice', async () => {
    const key = await deriveKey('a long passphrase', salt, FAST)
    const one = await seal(key, encode('same words'))
    const two = await seal(key, encode('same words'))
    expect(toBase64(one.iv)).not.toBe(toBase64(two.iv))
    expect(toBase64(one.ciphertext)).not.toBe(toBase64(two.ciphertext))
  })

  it('refuses a changed byte anywhere, or different additional data', async () => {
    const key = await deriveKey('a long passphrase', salt, FAST)
    const aad = encode('bound')
    const sealed = await seal(key, encode('Dear diary'), aad)
    const flipped = (bytes: Uint8Array, at: number) => {
      const copy = bytes.slice()
      copy[at] ^= 1
      return copy
    }
    await expect(open(key, { ...sealed, ciphertext: flipped(sealed.ciphertext, 0) }, aad)).rejects.toThrow()
    // The last byte is the tag's.
    await expect(
      open(key, { ...sealed, ciphertext: flipped(sealed.ciphertext, sealed.ciphertext.length - 1) }, aad),
    ).rejects.toThrow()
    await expect(open(key, { ...sealed, iv: flipped(sealed.iv, 3) }, aad)).rejects.toThrow()
    await expect(open(key, sealed, encode('other'))).rejects.toThrow()
    await expect(open(key, sealed)).rejects.toThrow()
  })

  it('takes bytes that are a view onto a larger buffer', async () => {
    const key = await deriveKey('a long passphrase', salt.subarray(0, 16), FAST)
    const buffer = encode('xxDear diaryxx')
    const sealed = await seal(key, buffer.subarray(2, 12))
    expect(decode(await open(key, sealed))).toBe('Dear diary')
  })
})

describe('random bytes', () => {
  it('are as many as asked for, and different each time', () => {
    const one = randomBytes(16)
    expect(one).toHaveLength(16)
    expect(toBase64(one)).not.toBe(toBase64(randomBytes(16)))
    expect(randomBytes(0)).toHaveLength(0)
  })
})

describe('base64', () => {
  it('goes there and back, empty or larger than one slice', () => {
    const big = Uint8Array.from({ length: 0x8000 * 2 + 5 }, (_, index) => index % 256)
    expect(fromBase64(toBase64(big))).toEqual(big)
    expect(fromBase64(toBase64(new Uint8Array()))).toEqual(new Uint8Array())
    expect(toBase64(encode('Ma'))).toBe('TWE=')
    expect([...fromBase64('TWE=')]).toEqual([...encode('Ma')])
  })

  it('refuses anything toBase64 could not have written', () => {
    for (const text of ['TWE', 'TW E=', 'T*E=', 'TWE=TWE=', '=TWE', 'TWE===', 'TWE-', 'TWE_']) {
      expect(() => fromBase64(text)).toThrow(SyntaxError)
    }
  })
})
