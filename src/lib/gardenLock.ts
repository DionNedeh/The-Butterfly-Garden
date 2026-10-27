import { deriveKey, open, PASSPHRASE_KDF, randomBytes, seal, toBase64 } from './sealing'

/**
 * The garden lock's keys: what they are, and how each opens the next.
 *
 * One random 256-bit data key seals the garden (repository/sealedStores). It
 * is never stored as it is. It is stored wrapped -- sealed -- once under a key
 * made from the passcode, once under a key made from the recovery code, and,
 * where a passkey can help, once under a key the passkey gives. Any one of
 * them opens it. Changing the passcode wraps the same data key again, so the
 * garden itself is not touched; turning the lock off and on makes a new one.
 *
 * Wrong secrets fail on AES-GCM's own check, which says only "no": nothing
 * here can tell anyone how close a guess came. And every guess costs the
 * full key derivation (lib/sealing), however many are made.
 *
 * Pure: storage is the repository's, the screens are the components'. Loaded
 * with the lock's screens, never with the garden.
 */

export const LOCK_FORMAT = 'the-butterfly-garden-lock'

/** The minutes a garden may stay hidden before it locks by itself. */
export const AUTO_LOCK_CHOICES = [1, 5, 15, 60] as const
export type AutoLockMinutes = (typeof AUTO_LOCK_CHOICES)[number]

/** The shortest passcode the lock accepts. Longer is stronger, and the copy says so. */
export const MIN_PASSCODE_LENGTH = 6

/**
 * What the lock costs if both secrets are lost, said plainly wherever one is
 * chosen: before the passcode, beside the recovery code, and before either is
 * replaced.
 */
export const NO_WAY_BACK =
  'If you forget your passcode and lose your recovery code, nobody can open your garden: not you, not anyone else, and not the people who made this app.'

/** The data key, wrapped under a key derived from something the gardener knows. */
export interface WrappedKey {
  /** How the wrapping key is made: PBKDF2-HMAC-SHA-256, `iterations` times, from `salt`. */
  kdf: 'PBKDF2-SHA-256'
  iterations: number
  salt: Uint8Array
  iv: Uint8Array
  /** The data key, sealed with AES-GCM. */
  wrapped: Uint8Array
}

/** The data key, wrapped under the answer a passkey's PRF gives. */
export interface PasskeyWrap {
  /** Which passkey, as its authenticator named it. */
  credentialId: Uint8Array
  /** What the passkey is asked to evaluate; the same input always gets the same answer. */
  prfSalt: Uint8Array
  iv: Uint8Array
  wrapped: Uint8Array
}

/**
 * The lock as stored, in a store of its own. Nothing in it is secret: the
 * salts and wrapped keys are useless without the passcode, the recovery code
 * or the passkey.
 */
export interface LockRecord {
  format: typeof LOCK_FORMAT
  version: 1
  /** Names this lock. A new one each time the lock is turned on. */
  id: string
  createdAt: string
  /**
   * Changes with every change to this record, so a tab writing a change made
   * from an older copy is refused rather than undoing another tab's.
   */
  stamp: string
  passcode: WrappedKey
  recovery: WrappedKey
  passkey?: PasskeyWrap
  /** Minutes hidden before the garden locks by itself; absent when it never does. */
  autoLockMinutes?: AutoLockMinutes
}

/** Which secret opens a wrapped key. */
export type LockSlot = 'passcode' | 'recovery'

/** The secret given does not open the lock. Deliberately says nothing more. */
export class WrongSecretError extends Error {
  constructor() {
    super('That did not open the garden.')
    this.name = 'WrongSecretError'
  }
}

const DATA_KEY_BYTES = 32
const SALT_BYTES = 16

/** What a recovery code's words become before a key is derived from them. */
function recoverySecret(words: readonly string[]): string {
  return words.join(' ')
}

/**
 * Bound into every wrapped key, so a key wrapped for one lock, or for one
 * slot, cannot be passed off as another.
 */
function label(id: string, slot: LockSlot | 'passkey'): Uint8Array {
  return new TextEncoder().encode(`${LOCK_FORMAT}:${id}:${slot}`)
}

function newStamp(): string {
  return toBase64(randomBytes(9))
}

/**
 * The data key, ready to seal and open with, and impossible to read back out
 * of the page: the CryptoKey is made non-extractable.
 */
function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw as Uint8Array<ArrayBuffer>,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function wrapWithSecret(
  id: string,
  slot: LockSlot,
  raw: Uint8Array,
  secret: string,
  iterations: number,
): Promise<WrappedKey> {
  const salt = randomBytes(SALT_BYTES)
  const wrappingKey = await deriveKey(secret, salt, iterations)
  const { iv, ciphertext } = await seal(wrappingKey, raw, label(id, slot))
  return { kdf: 'PBKDF2-SHA-256', iterations, salt, iv, wrapped: ciphertext }
}

/**
 * The data key's bytes, unwrapped with a secret. Held only for as long as a
 * new wrap of them takes; callers wipe them.
 */
async function unwrapRaw(record: LockRecord, slot: LockSlot, secret: string): Promise<Uint8Array> {
  const wrapped = record[slot]
  const wrappingKey = await deriveKey(secret, wrapped.salt, wrapped.iterations)
  try {
    return await open(wrappingKey, { iv: wrapped.iv, ciphertext: wrapped.wrapped }, label(record.id, slot))
  } catch {
    throw new WrongSecretError()
  }
}

async function usingRaw<T>(raw: Uint8Array, work: (raw: Uint8Array) => Promise<T>): Promise<T> {
  try {
    return await work(raw)
  } finally {
    raw.fill(0)
  }
}

/** The secret a slot is opened with: the passcode itself, or the recovery code's words. */
export type LockSecret =
  | { slot: 'passcode'; passcode: string }
  | { slot: 'recovery'; words: readonly string[] }

function secretOf(secret: LockSecret): string {
  return secret.slot === 'passcode' ? secret.passcode : recoverySecret(secret.words)
}

/**
 * A new lock: a fresh data key, wrapped by the passcode and by the recovery
 * code. Two full key derivations, so it takes a moment.
 *
 * `iterations` is for tests; the app always uses PASSPHRASE_KDF's count.
 */
export async function createLock(
  passcode: string,
  recoveryWords: readonly string[],
  iterations: number = PASSPHRASE_KDF.iterations,
): Promise<{ record: LockRecord; key: CryptoKey }> {
  const id = toBase64(randomBytes(12))
  const raw = randomBytes(DATA_KEY_BYTES)
  return usingRaw(raw, async (bytes) => {
    const [passcodeWrap, recoveryWrap, key] = await Promise.all([
      wrapWithSecret(id, 'passcode', bytes, passcode, iterations),
      wrapWithSecret(id, 'recovery', bytes, recoverySecret(recoveryWords), iterations),
      importDataKey(bytes),
    ])
    const now = new Date().toISOString()
    return {
      record: {
        format: LOCK_FORMAT,
        version: 1,
        id,
        createdAt: now,
        stamp: newStamp(),
        passcode: passcodeWrap,
        recovery: recoveryWrap,
      },
      key,
    }
  })
}

/** The data key, opened with the passcode or the recovery code. */
export async function openLock(record: LockRecord, secret: LockSecret): Promise<CryptoKey> {
  return usingRaw(await unwrapRaw(record, secret.slot, secretOf(secret)), importDataKey)
}

/**
 * The lock with a new passcode, proven by the current passcode or, when it
 * was forgotten, the recovery code. The data key is unchanged, so nothing
 * stored has to be sealed again.
 */
export async function withNewPasscode(
  record: LockRecord,
  proof: LockSecret,
  passcode: string,
  iterations: number = PASSPHRASE_KDF.iterations,
): Promise<LockRecord> {
  const raw = await unwrapRaw(record, proof.slot, secretOf(proof))
  return usingRaw(raw, async (bytes) => ({
    ...record,
    stamp: newStamp(),
    passcode: await wrapWithSecret(record.id, 'passcode', bytes, passcode, iterations),
  }))
}

/**
 * The lock with a new recovery code, proven by the passcode. The old code's
 * wrap is replaced, so from the moment this is stored it opens nothing.
 */
export async function withNewRecoveryCode(
  record: LockRecord,
  passcode: string,
  words: readonly string[],
  iterations: number = PASSPHRASE_KDF.iterations,
): Promise<LockRecord> {
  const raw = await unwrapRaw(record, 'passcode', passcode)
  return usingRaw(raw, async (bytes) => ({
    ...record,
    stamp: newStamp(),
    recovery: await wrapWithSecret(record.id, 'recovery', bytes, recoverySecret(words), iterations),
  }))
}

/**
 * The key a passkey's PRF answer stands for. HKDF with a label of its own,
 * so the answer is never used as a key for anything else as it is.
 */
async function passkeyWrappingKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    prfOutput as Uint8Array<ArrayBuffer>,
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(`${LOCK_FORMAT}:passkey`),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** The lock with a passkey as a further way in, proven by the passcode. */
export async function withPasskey(
  record: LockRecord,
  passcode: string,
  passkey: { credentialId: Uint8Array; prfSalt: Uint8Array; prfOutput: Uint8Array },
): Promise<LockRecord> {
  const raw = await unwrapRaw(record, 'passcode', passcode)
  return usingRaw(raw, async (bytes) => {
    const { iv, ciphertext } = await seal(
      await passkeyWrappingKey(passkey.prfOutput),
      bytes,
      label(record.id, 'passkey'),
    )
    return {
      ...record,
      stamp: newStamp(),
      passkey: {
        credentialId: passkey.credentialId,
        prfSalt: passkey.prfSalt,
        iv,
        wrapped: ciphertext,
      },
    }
  })
}

/** The data key, opened with what the lock's passkey answered. */
export async function openLockWithPasskey(
  record: LockRecord,
  prfOutput: Uint8Array,
): Promise<CryptoKey> {
  const passkey = record.passkey
  if (!passkey) throw new WrongSecretError()
  let raw: Uint8Array
  try {
    raw = await open(
      await passkeyWrappingKey(prfOutput),
      { iv: passkey.iv, ciphertext: passkey.wrapped },
      label(record.id, 'passkey'),
    )
  } catch {
    throw new WrongSecretError()
  }
  return usingRaw(raw, importDataKey)
}

/** The lock without its passkey. */
export function withoutPasskey(record: LockRecord): LockRecord {
  const next: LockRecord = { ...record, stamp: newStamp() }
  delete next.passkey
  return next
}

/** The lock with auto-lock after `minutes` hidden, or never. */
export function withAutoLock(
  record: LockRecord,
  minutes: AutoLockMinutes | undefined,
): LockRecord {
  const next: LockRecord = { ...record, stamp: newStamp() }
  if (minutes === undefined) delete next.autoLockMinutes
  else next.autoLockMinutes = minutes
  return next
}

/** Whether a stored value is an auto-lock this build offers. */
export function isAutoLockMinutes(value: unknown): value is AutoLockMinutes {
  return AUTO_LOCK_CHOICES.includes(value as AutoLockMinutes)
}

/**
 * Why a new passcode cannot be used, in the gardener's words, or undefined
 * when it can. Counted in characters as a person counts them.
 */
export function passcodeProblem(passcode: string, again: string): string | undefined {
  if ([...passcode].length < MIN_PASSCODE_LENGTH) {
    return `A passcode needs at least ${MIN_PASSCODE_LENGTH} characters.`
  }
  if (passcode !== again) return 'The two passcodes are not the same.'
  return undefined
}
