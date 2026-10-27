/**
 * Locking bytes with a secret, on the device, with the browser's own
 * WebCrypto (`crypto.subtle`) and nothing else: no dependency, no
 * WebAssembly, and nothing sent anywhere. Shared by the protected backup
 * (lib/sealedBackup) and the garden lock.
 *
 * Loaded only when one of them is used, never with the garden.
 */

/**
 * How a passphrase becomes a key: PBKDF2-HMAC-SHA-256 at 600,000 iterations,
 * OWASP's minimum for that function.
 *
 * The plan prefers Argon2id, which resists guessing on graphics cards far
 * better, but no browser offers it natively and this app will not ship a
 * WebAssembly module or a dependency to get it. PBKDF2 is what WebCrypto
 * has. A stored count is read back with the data it locked, so a later
 * build can raise it without breaking anything already written.
 */
export const PASSPHRASE_KDF = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 600_000,
} as const

/** AES-GCM's recommended nonce: 96 bits, fresh for every message. */
const IV_BYTES = 12

/** WebCrypto, or a plain refusal where the page is not a secure context. */
function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle
  if (!api) throw new Error('This browser cannot lock or open files here.')
  return api
}

/**
 * Bytes as WebCrypto takes them. A Uint8Array may be a view onto part of a
 * larger buffer, or come from another realm (a test's jsdom), which some
 * engines refuse; a copy with its own buffer is accepted everywhere.
 */
function own(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length)
  copy.set(bytes)
  return copy
}

/** Cryptographically random bytes, from the browser's generator. */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

/**
 * The AES-GCM 256 key a secret and salt make, through PBKDF2.
 *
 * The secret is normalised (NFKC) first, so the same words typed on another
 * keyboard, with another way of composing an accent, make the same key.
 *
 * The key cannot be exported: it lives in memory, for as long as whoever
 * asked for it holds it, and is never written anywhere. It may encrypt and
 * decrypt, or wrap and unwrap another key, which is what the garden lock
 * does with it.
 *
 * `iterations` is for reading what was locked at another count, and for
 * tests, which would otherwise spend seconds on every case. Anything that
 * writes leaves it at the default.
 */
export async function deriveKey(
  secret: string,
  salt: Uint8Array,
  iterations: number = PASSPHRASE_KDF.iterations,
): Promise<CryptoKey> {
  if (!Number.isSafeInteger(iterations) || iterations < 1)
    throw new RangeError('The iteration count must be a positive whole number.')
  const api = subtle()
  const material = await api.importKey(
    'raw',
    own(new TextEncoder().encode(secret.normalize('NFKC'))),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return api.deriveKey(
    { name: 'PBKDF2', hash: PASSPHRASE_KDF.hash, salt: own(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
  )
}

/** What `seal` makes: the nonce it chose, and the ciphertext with its tag. */
export interface Sealed {
  iv: Uint8Array
  ciphertext: Uint8Array
}

/**
 * Encrypt and authenticate with AES-GCM, under a nonce chosen at random for
 * this call alone: GCM reusing a nonce under one key gives the key away.
 * `additionalData` is not hidden, but opening fails if it differs.
 */
export async function seal(
  key: CryptoKey,
  plaintext: Uint8Array,
  additionalData?: Uint8Array,
): Promise<Sealed> {
  const iv = randomBytes(IV_BYTES)
  const ciphertext = await subtle().encrypt(
    {
      name: 'AES-GCM',
      iv: own(iv),
      ...(additionalData ? { additionalData: own(additionalData) } : {}),
    },
    key,
    own(plaintext),
  )
  return { iv, ciphertext: new Uint8Array(ciphertext) }
}

/**
 * Decrypt what `seal` made. Throws on a wrong key, a changed byte anywhere
 * (ciphertext, nonce or tag) or different additional data, and never hands
 * back a partial or unchecked result: GCM checks the whole before releasing
 * any of it.
 */
export async function open(
  key: CryptoKey,
  sealed: Sealed,
  additionalData?: Uint8Array,
): Promise<Uint8Array> {
  const plaintext = await subtle().decrypt(
    {
      name: 'AES-GCM',
      iv: own(sealed.iv),
      ...(additionalData ? { additionalData: own(additionalData) } : {}),
    },
    key,
    own(sealed.ciphertext),
  )
  return new Uint8Array(plaintext)
}

/** Bytes as base64, a slice at a time so no argument list grows too long. */
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  }
  return btoa(binary)
}

/**
 * Standard base64's alphabet with its padding at the end. One character
 * class, so a backup's tens of megabytes are checked in a single pass.
 */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Base64 back to bytes. Strict: anything toBase64 could not have written
 * (spaces, a missing pad, another alphabet) throws, rather than being
 * forgiven into different bytes.
 */
export function fromBase64(text: string): Uint8Array {
  if (text.length % 4 !== 0 || !BASE64.test(text))
    throw new SyntaxError('That is not base64.')
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
