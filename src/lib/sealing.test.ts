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

/*
 * Node's WebCrypto stands in for the browser's here (Vitest's jsdom keeps
 * Node's crypto global). A low iteration count keeps the derivations quick;
 * one test checks the app's own count is the one used by default.
 */
const FAST = 1_000
const text = (value: string) => new TextEncoder().encode(value)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('random bytes', () => {
  it('are as many as asked for, and differ each time', () => {
    const a = randomBytes(32)
    const b = randomBytes(32)
    expect(a).toHaveLength(32)
    expect(toBase64(a)).not.toBe(toBase64(b))
  })

  it('fill more than one call to the random source can', () => {
    const many = randomBytes(70_000)
    expect(many).toHaveLength(70_000)
    // The tail is filled too, not left as zeros.
    expect(many.subarray(66_000).some((byte) => byte !== 0)).toBe(true)
  })
})

describe('keys from a secret', () => {
  it('uses PBKDF2-SHA-256 at OWASP’s 600,000 iterations unless a test asks otherwise', async () => {
    expect(PASSPHRASE_KDF).toEqual({ name: 'PBKDF2', hash: 'SHA-256', iterations: 600_000 })
    const derive = vi.spyOn(crypto.subtle, 'deriveKey')
    await deriveKey('a long passphrase', randomBytes(16))
    expect(derive.mock.calls[0][0]).toMatchObject({
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 600_000,
    })
  })

  it('makes the same key from the same secret and salt, and a key nobody can export', async () => {
    const salt = randomBytes(16)
    const first = await deriveKey('willow and wren', salt, FAST)
    const second = await deriveKey('willow and wren', salt, FAST)
    expect(first.extractable).toBe(false)
    expect(first.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 })
    const sealed = await seal(first, text('a quiet morning'))
    expect(new TextDecoder().decode(await open(second, sealed))).toBe('a quiet morning')
    await expect(crypto.subtle.exportKey('raw', first)).rejects.toThrow()
  })

  it('treats the same words typed with composed or decomposed accents alike', async () => {
    const salt = randomBytes(16)
    const composed = await deriveKey('café au lait', salt, FAST)
    const decomposed = await deriveKey('café au lait', salt, FAST)
    const sealed = await seal(composed, text('same key'))
    await expect(open(decomposed, sealed)).resolves.toBeDefined()
  })

  it('makes a different key from another salt or another secret', async () => {
    const salt = randomBytes(16)
    const key = await deriveKey('meadow', salt, FAST)
    const sealed = await seal(key, text('private'))
    await expect(open(await deriveKey('meadow', randomBytes(16), FAST), sealed)).rejects.toThrow()
    await expect(open(await deriveKey('Meadow', salt, FAST), sealed)).rejects.toThrow()
  })
})

describe('sealing', () => {
  async function key() {
    return deriveKey('a garden key', randomBytes(16), FAST)
  }

  it('round-trips bytes, with and without additional data', async () => {
    const k = await key()
    const bytes = randomBytes(5_000)
    expect(await open(k, await seal(k, bytes))).toEqual(bytes)
    const bound = await seal(k, bytes, text('moods'))
    expect(await open(k, bound, text('moods'))).toEqual(bytes)
    expect(await open(k, await seal(k, new Uint8Array(0)))).toEqual(new Uint8Array(0))
  })

  it('uses a fresh 96-bit IV every time, so the same words never look the same twice', async () => {
    const k = await key()
    const a = await seal(k, text('the same words'))
    const b = await seal(k, text('the same words'))
    expect(a.iv).toHaveLength(12)
    expect(toBase64(a.iv)).not.toBe(toBase64(b.iv))
    expect(toBase64(a.ciphertext)).not.toBe(toBase64(b.ciphertext))
  })

  it('refuses a wrong key', async () => {
    const sealed = await seal(await key(), text('not yours'))
    await expect(open(await key(), sealed)).rejects.toThrow()
  })

  it('refuses anything changed by a single bit', async () => {
    const k = await key()
    const sealed = await seal(k, text('every word counts'), text('reflections'))
    const flipped = sealed.ciphertext.slice()
    flipped[3] ^= 1
    await expect(open(k, { ...sealed, ciphertext: flipped }, text('reflections'))).rejects.toThrow()
    const tag = sealed.ciphertext.slice()
    tag[tag.length - 1] ^= 0x80
    await expect(open(k, { ...sealed, ciphertext: tag }, text('reflections'))).rejects.toThrow()
    const iv = sealed.iv.slice()
    iv[0] ^= 1
    await expect(open(k, { ...sealed, iv }, text('reflections'))).rejects.toThrow()
    await expect(
      open(k, { ...sealed, ciphertext: sealed.ciphertext.subarray(1) }, text('reflections')),
    ).rejects.toThrow()
  })

  it('refuses other additional data, or none, than it was sealed with', async () => {
    const k = await key()
    const sealed = await seal(k, text('a check-in'), text('moods'))
    await expect(open(k, sealed, text('reflections'))).rejects.toThrow()
    await expect(open(k, sealed)).rejects.toThrow()
    const unbound = await seal(k, text('a check-in'))
    await expect(open(k, unbound, text('moods'))).rejects.toThrow()
  })
})

describe('base64', () => {
  it('round-trips every byte value, and more than one slice of them', () => {
    const every = Uint8Array.from({ length: 256 }, (_, index) => index)
    expect(fromBase64(toBase64(every))).toEqual(every)
    const large = randomBytes(100_000)
    expect(fromBase64(toBase64(large))).toEqual(large)
    expect(toBase64(new Uint8Array(0))).toBe('')
    expect(toBase64(text('Man'))).toBe('TWFu')
  })

  it('refuses text that is not base64', () => {
    expect(() => fromBase64('not base64!')).toThrow()
  })
})
