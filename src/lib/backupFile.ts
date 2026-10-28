/** Largest backup file read into memory, in bytes. */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024

export type BackupFileText =
  | { ok: true; text: string }
  | { ok: false; message: string }

/**
 * The text of a backup file the gardener chose, or why it could not be read.
 *
 * The size is checked before anything is read, so choosing a huge file by
 * mistake never pulls it into memory. Reading can still fail after a file was
 * chosen: it was moved or deleted in the meantime, or Android withdrew access.
 */
export async function readBackupFile(file: File): Promise<BackupFileText> {
  if (file.size > MAX_BACKUP_BYTES)
    return { ok: false, message: 'That file is too large to be a garden backup.' }
  try {
    return { ok: true, text: await file.text() }
  } catch {
    return {
      ok: false,
      message: 'That file could not be read. Try choosing it again.',
    }
  }
}

/** The format a protected backup names (lib/sealedBackup). */
export const SEALED_BACKUP_FORMAT = 'the-butterfly-garden-sealed'

/**
 * How every protected backup begins, and every copy of everything stored
 * (safe mode's "Download what's stored"): the app writes its format first.
 *
 * Recognised by that beginning alone, before anything is parsed. A plain
 * backup can be tens of megabytes, and its journal may well hold these very
 * words, so neither parsing it twice nor searching it would do: only a file
 * whose first field is one of these formats matches.
 */
const SEALED_START = /^\uFEFF?\s*\{\s*"format"\s*:\s*"the-butterfly-garden-(sealed|raw)"/

/**
 * A garden lock's record (lib/gardenLock), as a copy of everything stored
 * holds it. Matched only as JSON writes a key and its value: the same words
 * in anything a gardener wrote have their quotes escaped, so cannot match.
 */
const LOCK_RECORD = /"format"\s*:\s*"the-butterfly-garden-lock"/

/**
 * Whether a chosen file is sealed, and needs a secret before it can be
 * restored: a protected backup (`backup`), opened with its passphrase, or
 * safe mode's copy of a garden that had the lock on (`copy`, lib/lockedCopy),
 * opened with the lock's passcode or recovery code. Nothing for any other
 * file, which is restored as it is. A copy is searched for its lock only
 * once it has begun as a copy, and copies are rare.
 */
export function sealedKind(text: string): 'backup' | 'copy' | undefined {
  const format = SEALED_START.exec(text.slice(0, 256))?.[1]
  if (format === 'sealed') return 'backup'
  return format && LOCK_RECORD.test(text) ? 'copy' : undefined
}
