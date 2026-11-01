import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readImportedState } from '../repository/gardenRepository'
import { migrateState, storedVersionOf } from '../repository/validateGarden'
import type { AppState, Sighting } from '../types'
import { ArrayBufferFileReader } from '../test/fileReader'
import { backupCopy, gardenDigest, integrityOf, type PlainBackup } from './backupIntegrity'
import { previewBackupFile } from './backupPreview'
import { createInitialState } from './progression'

const PHOTO = [82, 73, 70, 70, 9, 8, 7, 6]

beforeEach(() => {
  // A Blob with arrayBuffer(), as a browser's has, and a FileReader that
  // reads it, as a backup's photos are written to text by one.
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('FileReader', ArrayBufferFileReader)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function garden(): AppState {
  const sighting = {
    id: 'sighting-1',
    date: '2026-10-20',
    kind: 'butterfly',
    speciesId: 'monarch',
    createdAt: '2026-10-20T09:00:00.000Z',
    photo: new Blob([new Uint8Array(PHOTO)], { type: 'image/webp' }),
  } as Sighting
  return {
    ...createInitialState('Tester', 'Checked Garden'),
    version: storedVersionOf(),
    sightings: [sighting],
  }
}

function plain(state: AppState = garden()): PlainBackup {
  return {
    format: 'the-butterfly-garden',
    exportedAt: '2026-11-01T10:00:00.000Z',
    appVersion: '3.7.0',
    revision: 12,
    garden: state,
  }
}

describe('4.3 a plain backup’s check on itself', () => {
  it('carries its revision and the SHA-256 of its garden as written, photos and all', async () => {
    const file = JSON.parse((await backupCopy(plain())).text) as Record<string, unknown> & {
      garden: { sightings: Array<{ photo: unknown }> }
    }
    expect(Object.keys(file)).toEqual(['format', 'exportedAt', 'appVersion', 'revision', 'sha256', 'garden'])
    expect(file.revision).toBe(12)
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/)
    // Taken after the photo was written as text, so over what the file holds.
    expect(file.garden.sightings[0].photo).toEqual({
      mimeType: 'image/webp',
      imageData: btoa(String.fromCharCode(...PHOTO)),
    })
    expect(file.sha256).toBe(await gardenDigest(file.garden))
  })

  it('reads a file made here as unchanged, however it is laid out', async () => {
    const { text } = await backupCopy(plain())
    expect(await integrityOf(JSON.parse(text))).toBe('ok')
    // Written again without the indenting, as a tool might: still the same garden.
    expect(await integrityOf(JSON.parse(JSON.stringify(JSON.parse(text))))).toBe('ok')
    expect((await previewBackupFile(text)).integrity).toBe('ok')
  })

  it('flags a file changed by one character, and still describes it to restore', async () => {
    const { text } = await backupCopy(plain())
    const edited = text.replace('Checked Garden', 'Checked Gardem')
    expect(edited).not.toBe(text)
    expect(await integrityOf(JSON.parse(edited))).toBe('changed')
    const preview = await previewBackupFile(edited)
    expect(preview).toMatchObject({ ok: true, integrity: 'changed', gardenName: 'Checked Gardem' })
    // Nor is a check edited to match another garden taken on trust.
    const { sha256 } = JSON.parse(text) as { sha256: string }
    expect(await integrityOf({ ...(JSON.parse(text) as object), sha256: sha256.replace(/^./, sha256[0] === 'a' ? 'b' : 'a') })).toBe('changed')
  })

  it('accepts a file without the fields, as every earlier one is', async () => {
    const older = JSON.stringify({
      format: 'the-butterfly-garden',
      exportedAt: '2026-10-01T10:00:00.000Z',
      appVersion: '3.6.0',
      garden: createInitialState('Tester', 'Older Garden'),
    })
    expect(await integrityOf(JSON.parse(older))).toBe('absent')
    expect(await previewBackupFile(older)).toMatchObject({
      ok: true,
      integrity: 'absent',
      gardenName: 'Older Garden',
    })
    expect(readImportedState(JSON.parse(older))?.profile?.gardenName).toBe('Older Garden')
  })

  it('reads as any backup to a build that knows nothing of the fields', async () => {
    const value = JSON.parse((await backupCopy(plain())).text) as Record<string, unknown>
    // Every build since 3.0 takes the garden from the envelope and reads
    // only that; nothing else in the envelope is looked at.
    const payload = 'garden' in value ? value.garden : value
    expect(migrateState(payload)?.profile?.gardenName).toBe('Checked Garden')
    expect(readImportedState(value)?.sightings).toHaveLength(1)
  })

  it('is written without a check, and read as having none, where the browser cannot make one', async () => {
    vi.spyOn(crypto.subtle, 'digest').mockRejectedValue(new Error('Not in an insecure page.'))
    const { text } = await backupCopy(plain())
    expect(JSON.parse(text)).not.toHaveProperty('sha256')
    expect(await integrityOf({ sha256: 'ab', garden: {} })).toBe('absent')
  })

  it('makes a file for no garden at all without a check', async () => {
    const file = JSON.parse((await backupCopy({ ...plain(), garden: undefined })).text) as Record<string, unknown>
    expect(file).toEqual({
      format: 'the-butterfly-garden',
      exportedAt: '2026-11-01T10:00:00.000Z',
      appVersion: '3.7.0',
      revision: 12,
    })
  })
})
