import { useSyncExternalStore } from 'react'
import { DATABASE_NAME, gardenRepository } from '../repository/gardenRepository'
import {
  hasChangesToWrite,
  isBackupFileRecord,
  problemOf,
  type BackupFileHandle,
  type BackupFileProblem,
  type BackupFileRecord,
} from './autoBackup'
import type { FileCopy } from './sightingPhotos'

/*
 * The backup file kept up to date: choosing it, asking to write it, writing
 * it, and the record of how that went (lib/autoBackup has the rules). Shared
 * by the writer that runs while the garden is open
 * (components/backup/AutoBackupKeeper) and the setting that shows it, and
 * loaded only where the browser has a save screen that hands the page a file
 * to keep: Chromium on a computer. Never in the Android app, nor in Safari or
 * Firefox, where the ordinary download stays.
 *
 * The file's handle is kept in IndexedDB beside the drafts (BACKUP_FILE_KEY),
 * so it is forgotten with the garden. The browser's permission to write it
 * may not outlive the visit: it is asked about before every write, and asked
 * for only when the gardener taps to give it, never on its own. Chrome can
 * remember it ("Allow on every visit"), and nothing here relies on that.
 */

/** One file, written over each time, so not dated like a download. */
const SUGGESTED_NAME = 'butterfly-garden-backup.json'

/** Two tabs never write the file at once: the second waits, then finds it current. */
const FILE_LOCK = 'the-butterfly-garden-backup-file'

type SaveFilePicker = (options: {
  suggestedName: string
  types: Array<{ description: string; accept: Record<string, string[]> }>
}) => Promise<BackupFileHandle>

/** Whether this browser can keep a file to write to: Chromium on a computer. */
export function canKeepBackupFile(): boolean {
  return typeof (window as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
}

/** What this tab knows of the record: `loaded` once it has been read. */
interface Known {
  record?: BackupFileRecord
  loaded: boolean
}

let known: Known = { loaded: false }
const listeners = new Set<() => void>()

function show(record: BackupFileRecord | undefined) {
  known = { record, loaded: true }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The record as this tab last read or wrote it. */
export function useBackupFile(): Known {
  return useSyncExternalStore(subscribe, () => known)
}

/** Read the record again: another tab may have written the file since. */
export async function loadBackupFile(): Promise<BackupFileRecord | undefined> {
  let stored: unknown
  try {
    stored = await gardenRepository.readBackupFile()
  } catch {
    stored = undefined
  }
  show(isBackupFileRecord(stored) ? stored : undefined)
  return known.record
}

async function keep(record: BackupFileRecord | undefined): Promise<void> {
  await gardenRepository.writeBackupFile(record)
  show(record)
}

/**
 * Choose the file on the browser's save screen, which also lets the garden
 * write it for now. 'cancelled' when the screen was closed.
 */
export async function chooseBackupFile(): Promise<'chosen' | 'cancelled'> {
  const pick = (window as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker
  if (!pick) return 'cancelled'
  let handle: BackupFileHandle
  try {
    handle = await pick({
      suggestedName: SUGGESTED_NAME,
      types: [{ description: 'Garden backup', accept: { 'application/json': ['.json'] } }],
    })
  } catch (error) {
    if ((error as { name?: unknown } | null)?.name === 'AbortError') return 'cancelled'
    throw error
  }
  await keep({ handle })
  return 'chosen'
}

/** Stop writing the file. It stays where it is, as last written. */
export async function forgetBackupFile(): Promise<void> {
  await keep(undefined)
}

/** One step at a time in this tab: a change noted, a write. */
let queue: Promise<unknown> = Promise.resolve()

function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work)
  queue = run.catch(() => undefined)
  return run
}

/**
 * The garden changed (`at`): mark the file as behind, once, so the change
 * is written at the next moment one is due, in this tab or another. In turn
 * with the writes, so a write just after it knows of it.
 */
export function noteChange(at = new Date()): Promise<void> {
  return inTurn(async () => {
    const record = await loadBackupFile()
    if (!record || record.writtenAt === undefined || hasChangesToWrite(record)) return
    await keep({ ...record, changedAt: at.toISOString() })
  })
}

/** How a write went: written, not due, paused (locked or read-only), or a problem. */
export type WriteOutcome = 'written' | 'not-due' | 'paused' | BackupFileProblem

export interface WriteResult {
  outcome: WriteOutcome
  /** When the copy written was made, which is when it counts as a backup from. */
  madeAt?: Date
}

/** The backup's text, or undefined while the garden is read-only. */
type MakeCopy = () => FileCopy | undefined | Promise<FileCopy | undefined>

/**
 * Remember why a write could not be made, and say so. The same problem met
 * again is not stored again: the first time it was met is what is said.
 */
async function failed(kind: BackupFileProblem): Promise<WriteResult> {
  const record = known.record
  if (record && record.problem?.kind !== kind)
    await keep({ ...record, problem: { kind, at: new Date().toISOString() } })
  return { outcome: kind }
}

/** Whether the garden lock is on here, which pauses the file. */
function locked(): boolean {
  return gardenRepository.lockState() !== 'none'
}

async function write(make: MakeCopy, due?: (record: BackupFileRecord) => boolean, allowed = () => true): Promise<WriteResult> {
  const record = await loadBackupFile()
  if (!record || (due && !due(record))) return { outcome: 'not-due' }
  if (locked() || !allowed()) return { outcome: 'paused' }
  const permission = await record.handle
    .queryPermission({ mode: 'readwrite' })
    .catch((): PermissionState => 'prompt')
  if (permission !== 'granted') return failed('permission')
  const madeAt = new Date()
  const copy = await make()
  if (!copy || !allowed()) return { outcome: 'paused' }
  try {
    const file = await record.handle.createWritable()
    try {
      await file.write(copy.text)
      // Locked while the copy was being made: the plain copy must not land.
      // Until it is closed, the file on disk is untouched.
      const latest = await loadBackupFile()
      if (locked() || !allowed() || await gardenRepository.readLock() || !latest || latest.stamp !== record.stamp) {
        await file.abort()
        return { outcome: 'paused' }
      }
      await file.close()
    } catch (error) {
      await file.abort().catch(() => undefined)
      throw error
    }
  } catch (error) {
    return failed(problemOf(error))
  }
  // Read again: a change noted while writing is kept if it came after the copy.
  const latest = await loadBackupFile()
  if (latest) {
    const writtenAt = madeAt.toISOString()
    const next: BackupFileRecord = { handle: latest.handle, writtenAt }
    if (latest.changedAt && latest.changedAt > writtenAt) next.changedAt = latest.changedAt
    if (copy.leftOut) next.leftOut = copy.leftOut
    await keep(next)
  }
  return { outcome: 'written', madeAt }
}

/**
 * Write the backup to the file, if `due` says it is due (always, without
 * it). Waits for any write already under way here or in another tab.
 */
export function writeBackupFile(
  make: MakeCopy,
  due?: (record: BackupFileRecord) => boolean,
  allowed = () => true,
): Promise<WriteResult> {
  const locks = (navigator as { locks?: LockManager }).locks
  return inTurn(() =>
    locks ? locks.request(FILE_LOCK, () =>
      locks.request(`${DATABASE_NAME}-switch`, { mode: 'shared' }, () => write(make, due, allowed)))
      : write(make, due, allowed),
  )
}

/**
 * The gardener tapped to keep the file written: ask the browser, inside that
 * tap, and write it now if it agrees.
 */
export async function askToKeepWriting(make: MakeCopy): Promise<WriteResult> {
  const record = known.record
  if (!record) return { outcome: 'not-due' }
  const answer = await record.handle
    .requestPermission({ mode: 'readwrite' })
    .catch((): PermissionState => 'denied')
  if (answer !== 'granted') return failed('permission')
  return writeBackupFile(make)
}
