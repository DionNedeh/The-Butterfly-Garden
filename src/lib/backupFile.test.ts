import { describe, expect, it } from 'vitest'
import { MAX_BACKUP_BYTES, readBackupFile, SEALED_BACKUP_FORMAT, sealedKind } from './backupFile'

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
    expect(sealedKind(`{"format":"${SEALED_BACKUP_FORMAT}","formatVersion":1}`)).toBe('backup')
    expect(sealedKind(`{\n  "format": "${SEALED_BACKUP_FORMAT}",\n  "formatVersion": 1\n}`)).toBe('backup')
    expect(sealedKind(`\uFEFF \n{ "format" : "${SEALED_BACKUP_FORMAT}" }`)).toBe('backup')
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
    expect(sealedKind(plain)).toBeUndefined()
    expect(sealedKind(`{"garden":{},"format":"${SEALED_BACKUP_FORMAT}"}`)).toBeUndefined()
    expect(sealedKind(`{"format":"${SEALED_BACKUP_FORMAT}-2"}`)).toBeUndefined()
    expect(sealedKind(`[{"format":"${SEALED_BACKUP_FORMAT}"}]`)).toBeUndefined()
    expect(sealedKind('')).toBeUndefined()
  })

  it('looks only at the beginning of a large file', () => {
    const huge = `{"format":"the-butterfly-garden","garden":"${'x'.repeat(5_000_000)}"}`
    expect(sealedKind(huge)).toBeUndefined()
  })
})

describe('recognising safe mode’s copy of a locked garden', () => {
  /** A copy of everything stored, as lib/storedCopy writes one. */
  const copy = (stores: Record<string, unknown>) =>
    JSON.stringify(
      { format: 'the-butterfly-garden-raw', exportedAt: '2026-10-27T09:00:00.000Z', databaseVersion: 8, stores },
      null,
      2,
    )

  it('knows one by its beginning and the lock’s record inside it', () => {
    const sealed = { sealed: 1, iv: { base64: 'AAAA' }, data: { base64: 'AAAA' } }
    expect(
      sealedKind(
        copy({
          goals: { current: sealed },
          lock: { current: { format: 'the-butterfly-garden-lock', version: 1, id: 'lock' } },
          meta: { current: { version: 9, ...sealed } },
        }),
      ),
    ).toBe('copy')
  })

  it('leaves a copy of a garden without the lock to be restored as it is, whatever its words say', () => {
    expect(sealedKind(copy({ meta: { current: { profile: { gardenName: 'Open' } } } }))).toBeUndefined()
    // A gardener's words naming the lock's format are escaped, so are never its record.
    expect(
      sealedKind(copy({ moods: { current: [{ note: '"format": "the-butterfly-garden-lock"' }] } })),
    ).toBeUndefined()
    // Nor is a plain backup holding a copy's words.
    expect(
      sealedKind(
        JSON.stringify({ format: 'the-butterfly-garden', garden: { note: 'the-butterfly-garden-raw' } }),
      ),
    ).toBeUndefined()
  })
})
