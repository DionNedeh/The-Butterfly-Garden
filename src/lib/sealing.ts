/**
 * Sealing bytes with a key made from something only the gardener knows.
 *
 * WebCrypto alone (crypto.subtle): no dependency and no WebAssembly, so it
 * works the same in every browser the garden supports and in the Android
 * app's WebView. Nothing here touches the network.
 *
 * Loaded only by what needs it (the garden lock, a protected backup), never
 * with the garden itself.
 */

/**
 * How a passcode or passphrase becomes a key.
 *
 * PBKDF2-HMAC-SHA-256 at 600,000 iterations, OWASP's minimum for it. The plan
 * prefers Argon2id, which makes guessing costlier on graphics cards, but the
 * browser has no Argon2 of its own and this app ships no WebAssembly, so
 * PBKDF2 it is. The count is written beside every key derived with it, so a
 * later build can raise it without stranding anything made with this one.
 */
export const PASSPHRASE_KDF = {
  name: 'PBKDF2',
  hash: 'SHA-256',
  iterations: 600_000,
} as const

/** AES-GCM's usual nonce: 96 bits, fresh for every seal. */
const IV_BYTES = 12

/** The most getRandomValues will fill in one call. */
const RANDOM_CHUNK = 65_536

/** Bytes from the platform's cryptographic random source. */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let start = 0; start < length; start += RANDOM_CHUNK) {
    crypto.getRandomValues(bytes.subarray(start, start + RANDOM_CHUNK))
  }
  return bytes
}

/**
 * WebCrypto's types want bytes backed by a plain ArrayBuffer; everything
 * here is, since nothing in the app shares memory between threads.
 */
function buffer(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes as Uint8Array<ArrayBuffer>
}

function gcm(iv: Uint8Array, additionalData?: Uint8Array): AesGcmParams {
  return additionalData
    ? { name: 'AES-GCM', iv: buffer(iv), additionalData: buffer(additionalData) }
    : { name: 'AES-GCM', iv: buffer(iv) }
}

/**
 * An AES-GCM key derived from a passcode, passphrase or recovery code.
 *
 * The secret is normalised (NFKC) first, so the same words typed on another
 * keyboard, with composed or decomposed accents, still make the same key. The
 * key cannot be exported: it lives only in this page's memory.
 *
 * `iterations` is there so tests can run quickly; nothing in the app passes
 * a lower count than PASSPHRASE_KDF's.
 */
export async function deriveKey(
  secret: string,
  salt: Uint8Array,
  iterations: number = PASSPHRASE_KDF.iterations,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: PASSPHRASE_KDF.name, hash: PASSPHRASE_KDF.hash, salt: buffer(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Seal bytes with AES-GCM under a fresh random IV. `additionalData` is not
 * hidden but is bound in: opening with different additional data fails.
 */
export async function seal(
  key: CryptoKey,
  plaintext: Uint8Array,
  additionalData?: Uint8Array,
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = randomBytes(IV_BYTES)
  const ciphertext = await crypto.subtle.encrypt(
    gcm(iv, additionalData),
    key,
    buffer(plaintext),
  )
  return { iv, ciphertext: new Uint8Array(ciphertext) }
}

/**
 * Open what `seal` made. Throws when the key is wrong, the additional data
 * differs, or a single bit of it was changed: AES-GCM checks all three.
 */
export async function open(
  key: CryptoKey,
  sealed: { iv: Uint8Array; ciphertext: Uint8Array },
  additionalData?: Uint8Array,
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    gcm(sealed.iv, additionalData),
    key,
    buffer(sealed.ciphertext),
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

/** Base64 back to bytes. Throws on text that is not base64. */
export function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
