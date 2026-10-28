import type { AppState } from '../types'
import { addDaysToLocalDate, formatJournalDate, toLocalDate } from './date'
import { isQuietWrite } from './quietWrites'

/*
 * A backup file kept up to date (plan c.6), on Chromium on a computer: the
 * gardener chooses a file once, and the garden writes the plain backup to it
 * after each day's changes. These are the rules: when a write is due, what a
 * failure means, and the words for where it stands. lib/autoBackupFile does
 * the writing; it loads only where the browser can keep a file.
 *
 * When. Never on every save: a day's changes are written the next time the
 * garden is open on a later day, and the day's own as the page is hidden
 * (closed, or another tab chosen), at most every few minutes. The file is
 * never written while saving is paused, or while the garden lock is on: the
 * file would hold the journal in the clear that the lock keeps sealed.
 */

/** A stream onto the chosen file, which replaces it only once closed. */
export interface WritableBackupFile {
  write(data: string): Promise<void>
  close(): Promise<void>
  abort(reason?: unknown): Promise<void>
}

/**
 * The chosen file, as Chromium hands it over (a FileSystemFileHandle), and
 * as IndexedDB keeps it. The permission calls are Chromium's own.
 */
export interface BackupFileHandle {
  readonly kind: 'file'
  readonly name: string
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  createWritable(): Promise<WritableBackupFile>
}

/**
 * Why the file could not be written: the browser no longer lets the garden
 * write it, it is not where it was, the disk is full, or something else.
 */
export type BackupFileProblem = 'permission' | 'missing' | 'full' | 'other'

/** The file kept up to date, as stored beside the drafts (BACKUP_FILE_KEY). */
export interface BackupFileRecord {
  /** Changes whenever the record is replaced, including a different handle. */
  stamp?: string
  handle: BackupFileHandle
  /** When the copy in the file was made (exported), ISO. */
  writtenAt?: string
  /** When the garden first changed after that copy, ISO; absent while the file is current. */
  changedAt?: string
  /** The last write that could not be made, and why. */
  problem?: { kind: BackupFileProblem; at: string }
  /** What the last copy written had to leave out (a photo that would not read). */
  leftOut?: string
}

/** When a write is looked for: on a later day while open, or as the page is hidden. */
export type WriteMoment = 'daily' | 'hidden'

/**
 * How soon after a write the page being hidden may write again. Switching
 * between tabs all afternoon is not a reason to rewrite a file every time.
 */
export const HIDDEN_WRITE_GAP_MS = 10 * 60_000

/** Whether a stored value is a record this build can write through. */
export function isBackupFileRecord(value: unknown): value is BackupFileRecord {
  const handle = (value as { handle?: Partial<BackupFileHandle> } | null | undefined)?.handle
  return typeof handle?.createWritable === 'function' && typeof handle.name === 'string'
}

/** Whether the garden changed since the copy in the file was made. */
export function hasChangesToWrite(record: BackupFileRecord): boolean {
  return (
    record.changedAt !== undefined &&
    (record.writtenAt === undefined || record.changedAt > record.writtenAt)
  )
}

/**
 * Whether the file is due a write at this moment. A file never written is
 * always due. Otherwise only with changes since: a day's changes once the
 * day is over, and today's as the page is hidden, at most every
 * HIDDEN_WRITE_GAP_MS. A clock set back counts as long enough.
 */
export function fileWriteDue(record: BackupFileRecord, moment: WriteMoment, now: Date): boolean {
  if (record.writtenAt === undefined) return true
  if (!hasChangesToWrite(record)) return false
  if (moment === 'daily') return toLocalDate(new Date(record.changedAt!)) < toLocalDate(now)
  const since = now.getTime() - Date.parse(record.writtenAt)
  return !(since >= 0 && since < HIDDEN_WRITE_GAP_MS)
}

/** What a failed write means, from the error the browser gave. */
export function problemOf(error: unknown): BackupFileProblem {
  const name = (error as { name?: unknown } | null | undefined)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission'
  if (name === 'NotFoundError' || name === 'TypeMismatchError') return 'missing'
  if (name === 'QuotaExceededError') return 'full'
  return 'other'
}

/**
 * Whether a change to the garden is one the file should have. The app's own
 * notes are not: a visit or a letter read (lib/quietWrites), or the backup
 * itself recorded (Profile.lastBackupAt), which a write to the file makes.
 */
export function changedForTheFile(before: AppState, after: AppState): boolean {
  if (before === after || isQuietWrite(after)) return false
  for (const field of Object.keys(after) as Array<keyof AppState>) {
    if (field !== 'profile' && before[field] !== after[field]) return true
  }
  const was = before.profile
  const now = after.profile
  if (was === now) return false
  if (!was || !now) return true
  const fields = new Set([...Object.keys(was), ...Object.keys(now)])
  for (const field of fields) {
    if (field === 'lastBackupAt') continue
    if (was[field as keyof typeof was] !== now[field as keyof typeof now]) return true
  }
  return false
}

const clockFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** "today at 2:05 pm", "yesterday at 21:10", or "on Monday, 26 October 2026". */
export function writtenWhen(iso: string, now: Date): string {
  const time = new Date(iso)
  if (Number.isNaN(time.getTime())) return 'at a time this device could not read'
  const day = toLocalDate(time)
  const today = toLocalDate(now)
  if (day === today) return `today at ${clockFormat.format(time)}`
  if (day === addDaysToLocalDate(today, -1)) return `yesterday at ${clockFormat.format(time)}`
  return `on ${formatJournalDate(day)}`
}

const PROBLEMS: Record<BackupFileProblem, string> = {
  permission: 'this browser needs your permission again.',
  missing: 'it was moved, renamed or deleted.',
  full: 'there was no room left on the disk. It will be tried again.',
  other: 'something went wrong. It will be tried again.',
}

/** Where the file stands, in a sentence or two. */
export function backupFileStatus(record: BackupFileRecord, now: Date): string {
  const name = record.handle.name
  const written = record.writtenAt && `${name} was last written ${writtenWhen(record.writtenAt, now)}.`
  const { problem } = record
  if (problem && (!record.writtenAt || problem.at > record.writtenAt)) {
    const failed = `${name} could not be written ${writtenWhen(problem.at, now)}: ${PROBLEMS[problem.kind]}`
    return written ? `${failed} ${written.replace(`${name} was`, 'It was')}` : failed
  }
  if (!written) return `${name} is written as soon as it can be.`
  return record.leftOut ? `${written} ${record.leftOut}` : written
}
