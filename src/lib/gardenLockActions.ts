import { SYNC_CHANNEL, type SyncMessage } from '../hooks/usePersistence'
import { gardenRepository } from '../repository/gardenRepository'
import { flushDrafts, resetDrafts } from './drafts'
import {
  createLock,
  isAutoLockMinutes,
  openLock,
  openLockWithPasskey,
  withAutoLock,
  withNewPasscode,
  withNewRecoveryCode,
  withoutPasskey,
  withPasskey,
  type AutoLockMinutes,
  type LockRecord,
  type LockSecret,
} from './gardenLock'

/**
 * What the lock's screens do: open the garden, lock it, turn the lock on and
 * off, change its secrets. Each step that touches storage goes through the
 * repository; each that changes what other tabs may read tells them, on the
 * tabs' own channel, so they follow (components/LockGate).
 *
 * Loaded with the lock's screens, never with the garden.
 */

/**
 * Tell the other tabs the lock changed (by default), that the garden was just
 * locked, or that the auto-lock was chosen anew.
 */
function tellOtherTabs(message: SyncMessage = { type: 'garden-lock' }) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(SYNC_CHANNEL)
  channel.postMessage(message)
  channel.close()
}

/** The lock as stored. Throws when it has been turned off in the meantime. */
async function storedLock(): Promise<LockRecord> {
  const record = await gardenRepository.readLock()
  if (!record) {
    await gardenRepository.checkLock()
    throw new Error('The lock has been turned off, in another tab perhaps.')
  }
  return record
}

/**
 * Open the garden in this tab. Throws WrongSecretError for a wrong passcode
 * or recovery code, after the full key derivation, however many tries.
 */
export async function unlockGarden(secret: LockSecret): Promise<void> {
  const record = await storedLock()
  openWithKey(record, await openLock(record, secret))
}

/** Set as the lock screen opens the garden; taken by what lands focus after it. */
let openedFromLockScreen = false

/** Open the garden here with a data key already unwrapped from `record`. */
export function openWithKey(record: LockRecord, key: CryptoKey): void {
  openedFromLockScreen = true
  setAutoLockMinutes(autoLockOf(record))
  gardenRepository.unlock(key, record.id)
}

/**
 * Whether the garden was just opened from the lock screen, which is gone:
 * focus should land on the page that replaces it, once, and then this is
 * `settled`.
 */
export function cameFromLockScreen(): boolean {
  return openedFromLockScreen
}

export function settledFromLockScreen(): void {
  openedFromLockScreen = false
}

/**
 * A new passcode for a gardener who forgot the old one, proven by the
 * recovery code. Stored before the garden opens.
 */
export async function replaceForgottenPasscode(
  record: LockRecord,
  words: readonly string[],
  passcode: string,
): Promise<void> {
  const changed = await withNewPasscode(record, { slot: 'recovery', words }, passcode)
  await gardenRepository.writeLock(changed, record)
}

/** Open the garden with the answer the lock's passkey gave. */
export async function unlockWithPasskey(prfOutput: Uint8Array): Promise<void> {
  const record = await storedLock()
  openWithKey(record, await openLockWithPasskey(record, prfOutput))
}

/**
 * Lock the garden here: unsaved words are written first, sealed while the
 * key is still here, then the key and the garden read with it are forgotten
 * and the drafts held in memory are let go. `everywhere` locks the other
 * tabs too, as "Lock now" should; auto-lock is this tab's alone.
 */
export async function lockGarden(everywhere: boolean): Promise<void> {
  await flushDrafts()
  await gardenRepository.lockNow()
  resetDrafts()
  if (everywhere) tellOtherTabs({ type: 'garden-lock', now: true })
}

/** Turn the lock on: a new lock, and everything stored sealed under it at once. */
export async function turnLockOn(passcode: string, recoveryWords: readonly string[]): Promise<void> {
  const { record, key } = await createLock(passcode, recoveryWords)
  // The words typed a moment ago are stored, so the switch seals them too.
  await flushDrafts()
  await gardenRepository.relock({ record, key })
  setAutoLockMinutes(undefined)
  tellOtherTabs()
}

/** Turn the lock off, once the passcode proves it is the gardener asking. */
export async function turnLockOff(passcode: string): Promise<void> {
  const record = await storedLock()
  await openLock(record, { slot: 'passcode', passcode })
  await flushDrafts()
  await gardenRepository.relock(undefined)
  setAutoLockMinutes(undefined)
  tellOtherTabs()
}

/** A new passcode, proven by the current one. Nothing stored is sealed again. */
export async function changePasscode(current: string, passcode: string): Promise<void> {
  const record = await storedLock()
  const changed = await withNewPasscode(record, { slot: 'passcode', passcode: current }, passcode)
  await gardenRepository.writeLock(changed, record)
}

/** Whether a passcode opens the lock, before a longer step asks for it again. */
export async function checkPasscode(passcode: string): Promise<void> {
  await openLock(await storedLock(), { slot: 'passcode', passcode })
}

/** A new recovery code, proven by the passcode. The old code opens nothing from now on. */
export async function replaceRecoveryCode(passcode: string, words: readonly string[]): Promise<void> {
  const record = await storedLock()
  await gardenRepository.writeLock(await withNewRecoveryCode(record, passcode, words), record)
}

/** A passkey as a further way in, proven by the passcode. */
export async function addPasskey(
  passcode: string,
  passkey: { credentialId: Uint8Array; prfSalt: Uint8Array; prfOutput: Uint8Array },
): Promise<void> {
  const record = await storedLock()
  await gardenRepository.writeLock(await withPasskey(record, passcode, passkey), record)
}

/** No passkey any more. */
export async function removePasskey(): Promise<void> {
  const record = await storedLock()
  await gardenRepository.writeLock(withoutPasskey(record), record)
}

/** The lock's passkey, if it has one, as the lock screen needs it. */
export async function passkeyOf(): Promise<LockRecord['passkey']> {
  return (await gardenRepository.readLock())?.passkey
}

let autoLock: AutoLockMinutes | undefined
const autoLockListeners = new Set<() => void>()

function setAutoLockMinutes(minutes: AutoLockMinutes | undefined) {
  if (minutes === autoLock) return
  autoLock = minutes
  for (const listener of autoLockListeners) listener()
}

/** Minutes hidden before the garden locks itself here, or undefined for never. */
export function autoLockMinutes(): AutoLockMinutes | undefined {
  return autoLock
}

/** Be told when the auto-lock changes. Returns the way to stop. */
export function onAutoLockChange(listener: () => void): () => void {
  autoLockListeners.add(listener)
  return () => {
    autoLockListeners.delete(listener)
  }
}

/** Read the auto-lock from the stored lock, as it may have changed in another tab. */
export async function loadAutoLock(): Promise<void> {
  setAutoLockMinutes(autoLockOf(await gardenRepository.readLock()))
}

/** A stored auto-lock this build offers; anything else, as never. */
function autoLockOf(record: LockRecord | undefined): AutoLockMinutes | undefined {
  return isAutoLockMinutes(record?.autoLockMinutes) ? record.autoLockMinutes : undefined
}

/**
 * Lock by itself after `minutes` hidden, or never: here, and in every other
 * tab with the garden open, which takes the new time at once
 * (components/lock/LockWatch).
 */
export async function chooseAutoLock(minutes: AutoLockMinutes | undefined): Promise<void> {
  const record = await storedLock()
  await gardenRepository.writeLock(withAutoLock(record, minutes), record)
  setAutoLockMinutes(minutes)
  tellOtherTabs({ type: 'garden-auto-lock' })
}
