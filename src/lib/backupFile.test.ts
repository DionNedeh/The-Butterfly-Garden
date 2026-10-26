import { describe, expect, it } from 'vitest'
import { MAX_BACKUP_BYTES, readBackupFile } from './backupFile'

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
