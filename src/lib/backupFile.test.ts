import { describe, expect, it } from 'vitest'
import { isSealedBackup, MAX_BACKUP_BYTES, readBackupFile, SEALED_BACKUP_FORMAT } from './backupFile'

const chosen = (size: number, text: () => Promise<string>) => ({ size, text }) as unknown as File

describe('reading a chosen backup', () => {
  it('reads a file of a sensible size', async () => {
    expect(await readBackupFile(new File(['{"a":1}'], 'backup.json'))).toEqual({
      ok: true,
      text: '{"a":1}',
    })
  })

  it('refuses a file too large to be a backup without reading it', async () => {
    let read = false
    const result = await readBackupFile(
      chosen(MAX_BACKUP_BYTES + 1, () => {
        read = true
        return Promise.resolve('')
      }),
    )
    expect(result).toEqual({ ok: false, message: 'That file is too large to be a garden backup.' })
    expect(read).toBe(false)
  })

  it('says so when a file can no longer be read', async () => {
    const result = await readBackupFile(
      chosen(10, () => Promise.reject(new DOMException('gone', 'NotReadableError'))),
    )
    expect(result).toEqual({ ok: false, message: 'That file could not be read. Try choosing it again.' })
  })
})

describe('recognising a protected backup', () => {
  it('knows one by its first field, however it is spaced', () => {
    expect(isSealedBackup(`{"format":"${SEALED_BACKUP_FORMAT}","formatVersion":1}`)).toBe(true)
    expect(isSealedBackup(`{\n  "format": "${SEALED_BACKUP_FORMAT}",\n  "formatVersion": 1\n}`)).toBe(true)
    expect(isSealedBackup(`\uFEFF \n{ "format" : "${SEALED_BACKUP_FORMAT}" }`)).toBe(true)
  })

  it('never mistakes a plain backup for one, even one whose journal names the format', () => {
    const plain = JSON.stringify(
      {
        format: 'the-butterfly-garden',
        exportedAt: '2026-10-27T09:00:00.000Z',
        garden: { moods: [{ note: `"format": "${SEALED_BACKUP_FORMAT}"` }] },
      },
      null,
      2,
    )
    expect(isSealedBackup(plain)).toBe(false)
    expect(isSealedBackup(`{"garden":{},"format":"${SEALED_BACKUP_FORMAT}"}`)).toBe(false)
    expect(isSealedBackup(`{"format":"${SEALED_BACKUP_FORMAT}-2"}`)).toBe(false)
    expect(isSealedBackup(`[{"format":"${SEALED_BACKUP_FORMAT}"}]`)).toBe(false)
    expect(isSealedBackup('')).toBe(false)
  })

  it('looks only at the beginning of a large file', () => {
    const huge = `{"format":"the-butterfly-garden","garden":"${'x'.repeat(5_000_000)}"}`
    expect(isSealedBackup(huge)).toBe(false)
  })
})
