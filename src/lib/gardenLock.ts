import { deriveKey, open, PASSPHRASE_KDF, randomBytes, seal, toBase64 } from './sealing'

/**
 * The garden lock's keys: what they are, and how each opens the next.
 *
 * One random 256-bit data key seals the garden (repository/sealedStores). It
 * is never stored as it is. Each way in -- the passcode, the recovery code
 * and, where one can help, a passkey -- has a key pair of its own: its
 * private half is stored sealed under a key made from that secret, and the
 * data key is stored sealed to its public half. Any one of them opens it.
 *
 * Sealing to a public half needs no secret, so the data key can be replaced
 * whenever a secret is: a new passcode or recovery code, a passkey taken
 * away. The garden is then sealed again under the new key
 * (lib/gardenLockActions), and an old secret -- and any old copy of the lock
 * it opened -- opens nothing written since. Turning the lock off and on makes
 * a new one too.
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

/**
 * One way in: a P-256 key pair whose private half only the secret opens, and
 * the data key sealed to its public half.
 */
interface Slot {
  /** The public half, raw. */
  publicKey: Uint8Array
  /** The private half (PKCS #8), sealed with AES-GCM under the key the secret makes. */
  privateIv: Uint8Array
  privateKey: Uint8Array
  /** The one-time public key the data key was sealed with (ECDH, then HKDF). */
  ephemeral: Uint8Array
  iv: Uint8Array
  /** The data key, sealed with AES-GCM. */
  wrapped: Uint8Array
}

/** A way in that something the gardener knows opens: the passcode, or the recovery code. */
export interface WrappedKey extends Slot {
  /** How the key that opens the private half is made: PBKDF2-HMAC-SHA-256, `iterations` times, from `salt`. */
  kdf: 'PBKDF2-SHA-256'
  iterations: number
  salt: Uint8Array
}

/** A way in that a passkey's PRF answer opens. */
export interface PasskeyWrap extends Slot {
  /** Which passkey, as its authenticator named it. */
  credentialId: Uint8Array
  /** What the passkey is asked to evaluate; the same input always gets the same answer. */
  prfSalt: Uint8Array
}

/**
 * The lock as stored, in a store of its own. Nothing in it is secret: the
 * salts, public keys and sealed keys are useless without the passcode, the
 * recovery code or the passkey.
 */
export interface LockRecord {
  format: typeof LOCK_FORMAT
  version: 1
  /** Names this lock's data key. A new one each time the data key is replaced. */
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

/** A new lock record, with the data key it opens. */
export interface NewLock {
  record: LockRecord
  key: CryptoKey
}

/** Which secret opens a wrapped key. */
export type LockSlot = 'passcode' | 'recovery'
type SlotName = LockSlot | 'passkey'

/** The secret given does not open the lock. Deliberately says nothing more. */
export class WrongSecretError extends Error {
  constructor() {
    super('That did not open the garden.')
    this.name = 'WrongSecretError'
  }
}

const DATA_KEY_BYTES = 32
const SALT_BYTES = 16
const CURVE = { name: 'ECDH', namedCurve: 'P-256' } as const
const encoder = new TextEncoder()

/** Bytes WebCrypto takes everywhere: a copy with a buffer of its own. */
function own(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    bytes.set(part, at)
    at += part.length
  }
  return bytes
}

/** What a recovery code's words become before a key is derived from them. */
function recoverySecret(words: readonly string[]): string {
  return words.join(' ')
}

/**
 * Bound into every sealed data key, so a key sealed for one lock, or for one
 * way in, cannot be passed off as another.
 */
function label(id: string, slot: SlotName): Uint8Array {
  return encoder.encode(`${LOCK_FORMAT}:${id}:${slot}`)
}

/** Bound into a sealed private half: its way in, and its own public half. */
function keyLabel(slot: SlotName, publicKey: Uint8Array): Uint8Array {
  return own(encoder.encode(`${LOCK_FORMAT}:${slot}:`), publicKey)
}

function newStamp(): string {
  return toBase64(randomBytes(9))
}

/**
 * The data key, ready to seal and open with, and impossible to read back out
 * of the page: the CryptoKey is made non-extractable.
 */
function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', own(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function usingRaw<T>(raw: Uint8Array, work: (raw: Uint8Array) => Promise<T>): Promise<T> {
  try {
    return await work(raw)
  } finally {
    raw.fill(0)
  }
}

/**
 * The key one side's private half and the other's public half agree on
 * (ECDH), made into an AES-GCM key bound to this lock and this way in (HKDF).
 */
async function agreedKey(
  privateKey: CryptoKey,
  publicKey: Uint8Array,
  salt: Uint8Array,
  id: string,
  slot: SlotName,
): Promise<CryptoKey> {
  const subtle = crypto.subtle
  const peer = await subtle.importKey('raw', own(publicKey), CURVE, false, [])
  const shared = await subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256)
  const material = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: own(salt), info: own(label(id, slot)) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

type DataKeyFields = 'ephemeral' | 'iv' | 'wrapped'
type Unsealed<T extends Slot> = Omit<T, DataKeyFields>

/** A new key pair for a way in, its private half sealed under `wrappingKey`. */
async function newKeyPair(
  wrappingKey: CryptoKey,
  slot: SlotName,
): Promise<Pick<Slot, 'publicKey' | 'privateIv' | 'privateKey'>> {
  const pair = await crypto.subtle.generateKey(CURVE, true, ['deriveBits'])
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  return usingRaw(pkcs8, async (bytes) => {
    const { iv, ciphertext } = await seal(wrappingKey, bytes, keyLabel(slot, publicKey))
    return { publicKey, privateIv: iv, privateKey: ciphertext }
  })
}

/** A way in for a passcode or a recovery code, without the data key sealed to it yet. */
async function secretSlot(secret: string, slot: LockSlot, iterations: number): Promise<Unsealed<WrappedKey>> {
  const salt = randomBytes(SALT_BYTES)
  const keys = await newKeyPair(await deriveKey(secret, salt, iterations), slot)
  return { kdf: 'PBKDF2-SHA-256', iterations, salt, ...keys }
}

/** The data key sealed to a way in's public half, with a one-time key pair. */
async function sealTo<T extends Slot>(
  slot: Unsealed<T>,
  raw: Uint8Array,
  id: string,
  name: SlotName,
): Promise<T> {
  const pair = await crypto.subtle.generateKey(CURVE, false, ['deriveBits'])
  const ephemeral = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const key = await agreedKey(pair.privateKey, slot.publicKey, own(ephemeral, slot.publicKey), id, name)
  const { iv, ciphertext } = await seal(key, raw, label(id, name))
  return { ...slot, ephemeral, iv, wrapped: ciphertext } as T
}

/** The data key's bytes, opened through a way in with the key its secret makes. */
async function openSlot(slot: Slot, wrappingKey: CryptoKey, id: string, name: SlotName): Promise<Uint8Array> {
  try {
    const pkcs8 = await open(
      wrappingKey,
      { iv: slot.privateIv, ciphertext: slot.privateKey },
      keyLabel(name, slot.publicKey),
    )
    const privateKey = await usingRaw(pkcs8, (bytes) =>
      crypto.subtle.importKey('pkcs8', own(bytes), CURVE, false, ['deriveBits']),
    )
    const key = await agreedKey(privateKey, slot.ephemeral, own(slot.ephemeral, slot.publicKey), id, name)
    return await open(key, { iv: slot.iv, ciphertext: slot.wrapped }, label(id, name))
  } catch {
    throw new WrongSecretError()
  }
}

/**
 * The data key's bytes, opened with a secret. Held only for as long as the
 * work with them takes; callers wipe them.
 */
async function unwrapRaw(record: LockRecord, slot: LockSlot, secret: string): Promise<Uint8Array> {
  const wrapped = record[slot]
  const wrappingKey = await deriveKey(secret, wrapped.salt, wrapped.iterations)
  return openSlot(wrapped, wrappingKey, record.id, slot)
}

/** The secret a slot is opened with: the passcode itself, or the recovery code's words. */
export type LockSecret =
  | { slot: 'passcode'; passcode: string }
  | { slot: 'recovery'; words: readonly string[] }

function secretOf(secret: LockSecret): string {
  return secret.slot === 'passcode' ? secret.passcode : recoverySecret(secret.words)
}

/** Throws WrongSecretError unless the secret opens the lock; keeps nothing. */
async function prove(record: LockRecord, slot: LockSlot, secret: string): Promise<void> {
  ;(await unwrapRaw(record, slot, secret)).fill(0)
}

interface Slots {
  passcode: Unsealed<WrappedKey>
  recovery: Unsealed<WrappedKey>
  passkey?: Unsealed<PasskeyWrap>
}

/**
 * The lock with a new data key, sealed to every way in it keeps: a new id
 * and stamp, and the key to seal the garden again with. No secret is needed
 * for this; the change that calls for it has already been proved.
 */
async function withNewDataKey(
  base: Pick<LockRecord, 'format' | 'version' | 'createdAt' | 'autoLockMinutes'>,
  slots: Slots,
): Promise<NewLock> {
  const id = toBase64(randomBytes(12))
  return usingRaw(randomBytes(DATA_KEY_BYTES), async (bytes) => {
    const [passcode, recovery, passkey, key] = await Promise.all([
      sealTo<WrappedKey>(slots.passcode, bytes, id, 'passcode'),
      sealTo<WrappedKey>(slots.recovery, bytes, id, 'recovery'),
      slots.passkey && sealTo<PasskeyWrap>(slots.passkey, bytes, id, 'passkey'),
      importDataKey(bytes),
    ])
    const record: LockRecord = { ...base, id, stamp: newStamp(), passcode, recovery }
    if (passkey) record.passkey = passkey
    else delete record.passkey
    return { record, key }
  })
}

/**
 * A new lock: a fresh data key, opened by the passcode and by the recovery
 * code. Two full key derivations, so it takes a moment.
 *
 * `iterations` is for tests; the app always uses PASSPHRASE_KDF's count.
 */
export async function createLock(
  passcode: string,
  recoveryWords: readonly string[],
  iterations: number = PASSPHRASE_KDF.iterations,
): Promise<NewLock> {
  const [passcodeSlot, recoverySlot] = await Promise.all([
    secretSlot(passcode, 'passcode', iterations),
    secretSlot(recoverySecret(recoveryWords), 'recovery', iterations),
  ])
  return withNewDataKey(
    { format: LOCK_FORMAT, version: 1, createdAt: new Date().toISOString() },
    { passcode: passcodeSlot, recovery: recoverySlot },
  )
}

/** The data key, opened with the passcode or the recovery code. */
export async function openLock(record: LockRecord, secret: LockSecret): Promise<CryptoKey> {
  return usingRaw(await unwrapRaw(record, secret.slot, secretOf(secret)), importDataKey)
}

/**
 * The lock with a new passcode, proven by the current passcode or, when it
 * was forgotten, the recovery code. The data key is replaced too, so the old
 * passcode opens nothing sealed from now on; the garden is sealed again
 * under the new key returned.
 */
export async function withNewPasscode(
  record: LockRecord,
  proof: LockSecret,
  passcode: string,
  iterations: number = PASSPHRASE_KDF.iterations,
): Promise<NewLock> {
  await prove(record, proof.slot, secretOf(proof))
  return withNewDataKey(record, {
    passcode: await secretSlot(passcode, 'passcode', iterations),
    recovery: record.recovery,
    passkey: record.passkey,
  })
}

/**
 * The lock with a new recovery code, proven by the passcode. The data key is
 * replaced too, so the old code opens nothing sealed from now on.
 */
export async function withNewRecoveryCode(
  record: LockRecord,
  passcode: string,
  words: readonly string[],
  iterations: number = PASSPHRASE_KDF.iterations,
): Promise<NewLock> {
  await prove(record, 'passcode', passcode)
  return withNewDataKey(record, {
    passcode: record.passcode,
    recovery: await secretSlot(recoverySecret(words), 'recovery', iterations),
    passkey: record.passkey,
  })
}

/**
 * The key a passkey's PRF answer stands for. HKDF with a label of its own,
 * so the answer is never used as a key for anything else as it is.
 */
async function passkeyWrappingKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', own(prfOutput), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: encoder.encode(`${LOCK_FORMAT}:passkey`),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * The lock with a passkey as a further way in, proven by the passcode. Nothing
 * is taken away, so the data key stays as it is.
 */
export async function withPasskey(
  record: LockRecord,
  passcode: string,
  passkey: { credentialId: Uint8Array; prfSalt: Uint8Array; prfOutput: Uint8Array },
): Promise<LockRecord> {
  const raw = await unwrapRaw(record, 'passcode', passcode)
  return usingRaw(raw, async (bytes) => {
    const keys = await newKeyPair(await passkeyWrappingKey(passkey.prfOutput), 'passkey')
    return {
      ...record,
      stamp: newStamp(),
      passkey: await sealTo<PasskeyWrap>(
        { credentialId: passkey.credentialId, prfSalt: passkey.prfSalt, ...keys },
        bytes,
        record.id,
        'passkey',
      ),
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
  const raw = await openSlot(passkey, await passkeyWrappingKey(prfOutput), record.id, 'passkey')
  return usingRaw(raw, importDataKey)
}

/**
 * The lock without its passkey. The data key is replaced, so the passkey --
 * on this device or wherever it is synced -- opens nothing sealed from now on.
 */
export function withoutPasskey(record: LockRecord): Promise<NewLock> {
  return withNewDataKey(record, { passcode: record.passcode, recovery: record.recovery })
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
