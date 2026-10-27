/**
 * The protected backup: the ordinary backup file, word for word, locked with
 * a passphrase the gardener chooses.
 *
 *   {
 *     "format": "the-butterfly-garden-sealed",
 *     "formatVersion": 1,
 *     "createdAt": "2026-10-27T09:30:00.000Z",
 *     "appVersion": "3.3.0",
 *     "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64>" },
 *     "cipher": { "name": "AES-GCM", "iv": "<base64>" },
 *     "ciphertext": "<base64>"
 *   }
 *
 * What is locked is exactly the text of a plain backup, so opening one hands
 * back that text and a restore goes on as it would for any backup: the same
 * checks (readImportedState, the images', the preview), the same snapshot,
 * the same undo. Nothing about a garden is decided here.
 *
 * The envelope's own version is `formatVersion`, not `version`, on purpose.
 * Every older build (3.0 to 3.3) reads a file it does not recognise as a
 * garden, and a numeric `version` it knows (1 is one) sends that down the
 * "part of the garden is missing" path: a protected backup would read as a
 * damaged one. With no `version` at all, those builds refuse it as "not a
 * garden this version can read" (3.0: "may be from a newer version"), which
 * is true, and replace nothing.
 *
 * The additional data binds the format and its version, so a file relabelled
 * as anything else will not open. The salt, the count and the nonce need no
 * binding: change any of them and the key or the check is different.
 *
 * What the file does not hide: that it is a garden backup, when it was made,
 * by which version, and roughly how large the garden is.
 *
 * Loaded only when a protected backup is made or opened.
 */
import { MAX_BACKUP_BYTES, SEALED_BACKUP_FORMAT } from './backupFile'
import { deriveKey, fromBase64, open, PASSPHRASE_KDF, randomBytes, seal, toBase64 } from './sealing'

/** The envelope version this build writes and reads. */
export const SEALED_FORMAT_VERSION = 1

/** A fresh salt for every file: two backups with one passphrase share no key. */
const SALT_BYTES = 16

/**
 * The highest count this build will spend time on. A file asking for more
 * would hold the page for minutes on a phone; a later build that raises the
 * count far enough to need more will raise this with it.
 */
const MAX_ITERATIONS = 10_000_000

/** The bytes the cipher is bound to: the format and its version. */
function boundTo(version: number): Uint8Array {
  return new TextEncoder().encode(JSON.stringify([SEALED_BACKUP_FORMAT, version]))
}

/** One step of the slow work, for the words shown while it happens. */
export type SealingStep = 'deriving' | 'locking' | 'opening'

export type SealOutcome = { ok: true; text: string } | { ok: false; problem: 'too-large' }

/**
 * Lock a plain backup's text with a passphrase, as the text of a protected
 * backup file.
 *
 * Refuses, rather than writes, a file this build could not read back: one
 * over the size a chosen backup may be (lib/backupFile). Base64 makes the
 * locked file about a third larger than the plain one.
 *
 * `iterations` is for tests alone. Under any other mode the count is
 * OWASP's minimum, whatever is asked for, so no gardener's file can ever be
 * written weaker by mistake.
 */
export async function sealBackup(
  plainText: string,
  passphrase: string,
  options: {
    iterations?: number
    now?: Date
    onStep?: (step: SealingStep) => void
    /** The largest file to write; a chosen backup's limit unless a test says. */
    maxBytes?: number
  } = {},
): Promise<SealOutcome> {
  const iterations =
    import.meta.env.MODE === 'test'
      ? (options.iterations ?? PASSPHRASE_KDF.iterations)
      : PASSPHRASE_KDF.iterations
  const maxBytes = options.maxBytes ?? MAX_BACKUP_BYTES
  const salt = randomBytes(SALT_BYTES)
  options.onStep?.('deriving')
  const key = await deriveKey(passphrase, salt, iterations)
  options.onStep?.('locking')
  const { iv, ciphertext } = await seal(
    key,
    new TextEncoder().encode(plainText),
    boundTo(SEALED_FORMAT_VERSION),
  )
  // `format` first: it is how a chosen file is recognised (lib/backupFile).
  // The ciphertext last, so the rest can be read at the top of the file.
  const text = JSON.stringify(
    {
      format: SEALED_BACKUP_FORMAT,
      formatVersion: SEALED_FORMAT_VERSION,
      createdAt: (options.now ?? new Date()).toISOString(),
      appVersion: __APP_VERSION__,
      kdf: {
        name: PASSPHRASE_KDF.name,
        hash: PASSPHRASE_KDF.hash,
        iterations,
        salt: toBase64(salt),
      },
      cipher: { name: 'AES-GCM', iv: toBase64(iv) },
      ciphertext: toBase64(ciphertext),
    },
    null,
    2,
  )
  // Every character written is ASCII, so its length is its size in bytes.
  if (text.length > maxBytes) return { ok: false, problem: 'too-large' }
  return { ok: true, text }
}

/** A protected backup, checked and decoded, ready to be opened. */
export interface SealedBackup {
  iterations: number
  salt: Uint8Array
  iv: Uint8Array
  ciphertext: Uint8Array
}

/**
 * Why a protected backup cannot be opened before any passphrase is asked for.
 *
 * - `newer`   made by a later version, in a form this one does not know;
 * - `damaged` not a whole protected backup: cut short, or changed by hand.
 */
export type SealedProblem = 'newer' | 'damaged'

export type SealedRead = { ok: true; backup: SealedBackup } | { ok: false; problem: SealedProblem }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function decoded(value: unknown): Uint8Array | undefined {
  if (typeof value !== 'string') return undefined
  try {
    return fromBase64(value)
  } catch {
    return undefined
  }
}

/**
 * Check a protected backup's envelope, without its passphrase.
 *
 * Everything the cipher needs is checked here, so a file that could never
 * open says so at once, rather than after the gardener has typed their
 * passphrase and waited. Anything this version does not know of (a later
 * envelope, another algorithm, a count beyond what it will spend) is a
 * newer version's file; anything malformed is damage.
 */
export function readSealedBackup(text: string): SealedRead {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, problem: 'damaged' }
  }
  if (!isRecord(value) || value.format !== SEALED_BACKUP_FORMAT)
    return { ok: false, problem: 'damaged' }
  const version = value.formatVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return { ok: false, problem: 'damaged' }
  if (version > SEALED_FORMAT_VERSION) return { ok: false, problem: 'newer' }

  const { kdf, cipher } = value
  if (!isRecord(kdf) || !isRecord(cipher)) return { ok: false, problem: 'damaged' }
  if (
    kdf.name !== PASSPHRASE_KDF.name ||
    kdf.hash !== PASSPHRASE_KDF.hash ||
    cipher.name !== 'AES-GCM'
  )
    return { ok: false, problem: 'newer' }
  const { iterations } = kdf
  if (typeof iterations !== 'number' || !Number.isSafeInteger(iterations) || iterations < 1)
    return { ok: false, problem: 'damaged' }
  if (iterations > MAX_ITERATIONS) return { ok: false, problem: 'newer' }

  const salt = decoded(kdf.salt)
  const iv = decoded(cipher.iv)
  const ciphertext = decoded(value.ciphertext)
  // A salt of at least the size this build writes, a nonce of exactly
  // AES-GCM's, and at least the 16-byte tag every ciphertext ends with.
  if (!salt || salt.length < SALT_BYTES || !iv || iv.length !== 12 || !ciphertext || ciphertext.length < 16)
    return { ok: false, problem: 'damaged' }
  return { ok: true, backup: { iterations, salt, iv, ciphertext } }
}

/**
 * Open a checked protected backup with a passphrase: the plain backup's text
 * it holds, or `undefined` when the passphrase does not open it.
 *
 * A wrong passphrase and a file changed since it was made look exactly the
 * same to AES-GCM, and neither says how near it came, so neither does this.
 * Nothing partial is ever handed back.
 */
export async function openSealedBackup(
  backup: SealedBackup,
  passphrase: string,
  onStep?: (step: SealingStep) => void,
): Promise<string | undefined> {
  onStep?.('deriving')
  const key = await deriveKey(passphrase, backup.salt, backup.iterations)
  onStep?.('opening')
  let bytes: Uint8Array
  try {
    bytes = await open(
      key,
      { iv: backup.iv, ciphertext: backup.ciphertext },
      boundTo(SEALED_FORMAT_VERSION),
    )
  } catch {
    return undefined
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // Authenticated, so written exactly so; but not text this app wrote.
    return undefined
  }
}
