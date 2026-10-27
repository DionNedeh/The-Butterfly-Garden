import type { AppState } from '../types'

/**
 * When to suggest a fresh copy of the garden.
 *
 * A backup file is the only way back after a lost phone or cleared browser
 * storage, and nothing else reminds anyone to keep one. But a reminder that
 * keeps asking turns a safety net into a chore, so this decides when a single
 * gentle note in Settings is worth showing, and says nothing otherwise.
 */

/** How old the last copy may grow before it is worth mentioning. */
export const BACKUP_REMINDER_DAYS = 30
/** How much new writing makes a copy worth renewing sooner. */
export const BACKUP_REMINDER_ENTRIES = 50

const DAY_MS = 86_400_000

/**
 * How far ahead of the clock a copy's time may be and still be believed. A
 * copy made a moment ago can read as slightly ahead of a `now` taken just
 * before it; one days ahead was stamped by a clock set wrong, and trusting it
 * would keep the reminder quiet until the real date caught up.
 */
const CLOCK_SLACK_MS = DAY_MS

export interface BackupReminder {
  /** When the last copy was kept; absent when there is none on record. */
  lastBackupAt?: string
  /** What made it due: the copy's age, or how much was written since. */
  reason: 'age' | 'entries'
  /** One plain sentence for the gardener. */
  text: string
}

/** What the rule reads: the profile and the three kinds of entry. */
type Journal = Pick<AppState, 'profile' | 'moods' | 'reflections' | 'recaps'>

/**
 * "March" this year, "March 2025" any other. Built when a note is worded,
 * not when the module loads: the shell needs only whether one is due.
 */
function monthOf(time: Date, now: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    ...(time.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(time)
}

/**
 * Whether at least `enough` check-ins, reflections and recaps were written
 * after `after` (epoch ms). It stops counting once there are enough, so a
 * journal years long costs little on every change to the garden.
 */
function enoughWrittenAfter(journal: Journal, after: number, enough: number): boolean {
  let count = 0
  for (const entries of [journal.moods, journal.reflections, journal.recaps]) {
    for (const entry of entries) {
      if (Date.parse(entry.createdAt) > after && ++count >= enough) return true
    }
  }
  return false
}

/** Why a fresh copy is due, and the copy on record, or undefined: the rule without its words. */
function due(
  journal: Journal,
  now: Date,
): { reason: BackupReminder['reason']; last?: number } | undefined {
  const profile = journal.profile
  if (!profile) return undefined
  const nowMs = now.getTime()
  const last =
    profile.lastBackupAt === undefined ? Number.NaN : Date.parse(profile.lastBackupAt)
  // A time from a clock set wrong is no evidence of a copy; better a note
  // the gardener did not need than silence they were relying on.
  const onRecord = Number.isFinite(last) && last <= nowMs + CLOCK_SLACK_MS
  const since = onRecord ? last : Date.parse(profile.createdAt)
  // A garden of unknown age (a damaged first day) is treated as an old one.
  const age = Number.isFinite(since) ? nowMs - since : Number.POSITIVE_INFINITY
  const reason =
    age >= BACKUP_REMINDER_DAYS * DAY_MS
      ? 'age'
      : enoughWrittenAfter(
            journal,
            onRecord ? last : Number.NEGATIVE_INFINITY,
            BACKUP_REMINDER_ENTRIES,
          )
        ? 'entries'
        : undefined
  if (!reason) return undefined
  return onRecord ? { reason, last } : { reason }
}

/**
 * The note to show in Settings, or undefined when the last copy is recent
 * enough and little has been written since.
 *
 * Due once the last copy is BACKUP_REMINDER_DAYS old (counted from the
 * garden's first day when there has never been one), or once
 * BACKUP_REMINDER_ENTRIES entries have been written since it, whichever comes
 * first. Edits to older entries do not count: they are small, and counting
 * them would make the note appear after an afternoon of tidying the journal.
 */
export function backupReminder(journal: Journal, now: Date): BackupReminder | undefined {
  const found = due(journal, now)
  if (!found) return undefined
  if (found.last === undefined) {
    return { reason: found.reason, text: 'You have not saved a copy yet.' }
  }
  return {
    lastBackupAt: journal.profile?.lastBackupAt,
    reason: found.reason,
    text: `Your last copy is from ${monthOf(new Date(found.last), now)}.`,
  }
}

/**
 * Whether a fresh copy is worth suggesting: for a quiet marker on the way to
 * Settings, which is where the note itself lives. Asked with the same `now`
 * as the note, so the two never disagree.
 */
export function isBackupDue(journal: Journal, now: Date): boolean {
  return due(journal, now) !== undefined
}
