import { describe, expect, it } from 'vitest'
import { sealedKind } from './backupFile'
import { newMoveCode, moveSecret } from './moveCode'
import { openSealedBackup, readSealedBackup, sealBackup } from './sealedBackup'

const PLAIN = '{"format":"the-butterfly-garden","garden":{"note":"Brought across"}}'

describe('a move file’s envelope', () => {
  it('is a protected backup, marked as opened by a move code, the mark after the format', async () => {
    const words = await newMoveCode()
    const outcome = await sealBackup(PLAIN, moveSecret(words), { iterations: 1_000, opensWith: 'move-code' })
    if (!outcome.ok) throw new Error('Not sealed')
    expect(sealedKind(outcome.text)).toBe('backup')
    const envelope = JSON.parse(outcome.text) as Record<string, unknown>
    expect(Object.keys(envelope)[0]).toBe('format')
    expect(envelope.opensWith).toBe('move-code')
    // The ciphertext stays last, so the rest can be read at the top of the file.
    expect(Object.keys(envelope).at(-1)).toBe('ciphertext')
    const read = readSealedBackup(outcome.text)
    expect(read.ok && read.backup.opensWith).toBe('move-code')
    if (read.ok) expect(await openSealedBackup(read.backup, moveSecret(words))).toBe(PLAIN)
  })

  it('carries no mark for a passphrase, and an unknown mark is read as none', async () => {
    const outcome = await sealBackup(PLAIN, 'quiet meadow lantern', { iterations: 1_000 })
    if (!outcome.ok) throw new Error('Not sealed')
    expect(outcome.text).not.toContain('opensWith')
    const read = readSealedBackup(outcome.text)
    expect(read.ok && 'opensWith' in read.backup).toBe(false)

    const marked = outcome.text.replace('"formatVersion": 1,', '"formatVersion": 1,\n  "opensWith": "something-else",')
    const other = readSealedBackup(marked)
    expect(other.ok && 'opensWith' in other.backup).toBe(false)
  })

  it('binds nothing to the mark: taking it off leaves a file the words still open', async () => {
    const words = await newMoveCode()
    const outcome = await sealBackup(PLAIN, moveSecret(words), { iterations: 1_000, opensWith: 'move-code' })
    if (!outcome.ok) throw new Error('Not sealed')
    const unmarked = outcome.text.replace(/\n {2}"opensWith": "move-code",/, '')
    expect(unmarked).not.toContain('opensWith')
    const read = readSealedBackup(unmarked)
    if (!read.ok) throw new Error('Not read')
    expect(read.backup.opensWith).toBeUndefined()
    expect(await openSealedBackup(read.backup, moveSecret(words))).toBe(PLAIN)
  })
})
