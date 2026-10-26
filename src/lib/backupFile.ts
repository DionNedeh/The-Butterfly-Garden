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
