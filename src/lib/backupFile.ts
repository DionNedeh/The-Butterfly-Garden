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
 * How every protected backup begins: the app writes its format first.
 *
 * Recognised by that beginning alone, before anything is parsed. A plain
 * backup can be tens of megabytes, and its journal may well hold these very
 * words, so neither parsing it twice nor searching it would do: only a file
 * whose first field is this format matches.
 */
const SEALED_START = /^\uFEFF?\s*\{\s*"format"\s*:\s*"the-butterfly-garden-sealed"\s*[,}]/

/** Whether a chosen file's text is a protected backup, which needs its passphrase. */
export function isSealedBackup(text: string): boolean {
  return SEALED_START.test(text.slice(0, 256))
}
