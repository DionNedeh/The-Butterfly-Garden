import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectImportedState, readImportedState } from '../repository/gardenRepository'
import { migrateState } from '../repository/validateGarden'
import { ArrayBufferFileReader } from '../test/fileReader'
import type { AppState, Sighting } from '../types'
import { SEALED_BACKUP_FORMAT, sealedKind } from './backupFile'
import { previewBackup } from './backupPreview'
import { createInitialState } from './progression'
import {
  openSealedBackup,
  readSealedBackup,
  sealBackup,
  SEALED_FORMAT_VERSION,
  type SealedBackup,
  type SealingStep,
} from './sealedBackup'
import { deriveKey, fromBase64, seal, toBase64 } from './sealing'
import { withPhotosAsText } from './sightingPhotos'

// Fast for every case but the one that checks the real count.
const FAST = 1_000
const PASSPHRASE = 'quiet meadow lantern'
const PHOTO = [82, 73, 70, 70, 9, 8, 7, 6]

beforeEach(() => {
  // A Blob with arrayBuffer(), as a browser's has, and a FileReader that
  // reads it, as a photo is read into a file.
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('FileReader', ArrayBufferFileReader)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function sighting(extra: Partial<Sighting> = {}): Sighting {
  return {
    id: 'sighting-1',
    date: '2026-10-20',
    kind: 'butterfly',
    speciesId: 'monarch',
    note: 'Two of them over the allotments',
    createdAt: '2026-10-20T09:00:00.000Z',
    ...extra,
  } as Sighting
}

/** A garden with words and a field-book photo, as a plain backup file's text. */
async function plainBackup(): Promise<string> {
  const base = createInitialState('Tester', 'Wild Garden')
  const garden: AppState = {
    ...base,
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-21',
        level: 4,
        note: 'A secret only the file should keep',
        createdAt: '2026-10-21T08:00:00.000Z',
        updatedAt: '2026-10-21T08:00:00.000Z',
      },
    ],
    sightings: [sighting({ photo: new Blob([new Uint8Array(PHOTO)], { type: 'image/webp' }) })],
  }
  return JSON.stringify(
    {
      format: 'the-butterfly-garden',
      exportedAt: '2026-10-27T09:00:00.000Z',
      appVersion: '3.3.0',
      garden: (await withPhotosAsText(garden)).value,
    },
    null,
    2,
  )
}

async function sealed(text: string, passphrase = PASSPHRASE): Promise<string> {
  const outcome = await sealBackup(text, passphrase, { iterations: FAST })
  if (!outcome.ok) throw new Error('Not sealed')
  return outcome.text
}

function checked(text: string): SealedBackup {
  const read = readSealedBackup(text)
  if (!read.ok) throw new Error(read.problem)
  return read.backup
}

/** The envelope's encoded fields, to compare two files. */
const envelope = (text: string) =>
  JSON.parse(text) as { kdf: { salt: string }; cipher: { iv: string }; ciphertext: string }

describe('a protected backup', () => {
  it('holds the plain backup word for word, photos and all, and opens to exactly it', async () => {
    const plain = await plainBackup()
    const file = await sealed(plain)

    // Nothing of the garden shows: not its words, not its name, not its photo.
    expect(file).not.toContain('A secret only the file should keep')
    expect(file).not.toContain('Wild Garden')
    expect(file).not.toContain(btoa(String.fromCharCode(...PHOTO)))
    expect(file).not.toContain(PASSPHRASE)

    const opened = await openSealedBackup(checked(file), PASSPHRASE)
    expect(opened).toBe(plain)

    // What opens restores through the usual checks, the photo a Blob again.
    const preview = previewBackup(opened!)
    expect(preview).toMatchObject({
      ok: true,
      gardenName: 'Wild Garden',
      appVersion: '3.3.0',
      counts: expect.objectContaining({ checkIns: 1, sightings: 1, photos: 1 }),
    })
    const restored = readImportedState(JSON.parse(opened!))!
    const photo = restored.sightings[0].photo!
    expect(photo.type).toBe('image/webp')
    expect([...new Uint8Array(await photo.arrayBuffer())]).toEqual(PHOTO)
  })

  it('is written with its format first, the cipher’s settings readable, and nothing else in the clear', async () => {
    const file = await sealed('{"format":"the-butterfly-garden"}', PASSPHRASE)
    expect(file.startsWith(`{\n  "format": "${SEALED_BACKUP_FORMAT}",`)).toBe(true)
    expect(sealedKind(file)).toBe('backup')
    // ASCII throughout, so its length is its size.
    expect(/^[\x20-\x7e\n]*$/.test(file)).toBe(true)
    const value = JSON.parse(file) as Record<string, unknown>
    expect(Object.keys(value)).toEqual([
      'format',
      'formatVersion',
      'createdAt',
      'appVersion',
      'kdf',
      'cipher',
      'ciphertext',
    ])
    expect(value).toMatchObject({
      format: 'the-butterfly-garden-sealed',
      formatVersion: 1,
      appVersion: __APP_VERSION__,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: FAST },
      cipher: { name: 'AES-GCM' },
    })
    const { kdf, cipher } = value as { kdf: { salt: string }; cipher: { iv: string } }
    expect(fromBase64(kdf.salt)).toHaveLength(16)
    expect(fromBase64(cipher.iv)).toHaveLength(12)
  })

  it('takes a fresh salt and nonce for every file, so one passphrase never makes the same file twice', async () => {
    const one = envelope(await sealed('{}'))
    const two = envelope(await sealed('{}'))
    expect(one.kdf.salt).not.toBe(two.kdf.salt)
    expect(one.cipher.iv).not.toBe(two.cipher.iv)
    expect(one.ciphertext).not.toBe(two.ciphertext)
  })

  it('is only ever written at 600,000 iterations outside the tests, whatever is asked', async () => {
    vi.stubEnv('MODE', 'production')
    const outcome = await sealBackup('{}', PASSPHRASE, { iterations: 1 })
    expect(outcome.ok).toBe(true)
    const value = JSON.parse((outcome as { text: string }).text) as { kdf: { iterations: number } }
    expect(value.kdf.iterations).toBe(600_000)
  })

  it('says what it is doing at each slow step', async () => {
    const steps: SealingStep[] = []
    const outcome = await sealBackup('{}', PASSPHRASE, { iterations: FAST, onStep: (step) => steps.push(step) })
    expect(steps).toEqual(['deriving', 'locking'])
    steps.length = 0
    await openSealedBackup(checked((outcome as { text: string }).text), PASSPHRASE, (step) => steps.push(step))
    expect(steps).toEqual(['deriving', 'opening'])
  })

  it('opens with the same words typed another way', async () => {
    const file = await sealed('{"kept":true}', 'Ｑｕｉｅｔ meadow café')
    expect(await openSealedBackup(checked(file), 'Quiet meadow café')).toBe('{"kept":true}')
  })

  it('refuses to write a file larger than a backup this app would read back', async () => {
    const outcome = await sealBackup('x'.repeat(2_000), PASSPHRASE, { iterations: FAST, maxBytes: 2_000 })
    expect(outcome).toEqual({ ok: false, problem: 'too-large' })
  })
})

describe('opening it wrongly fails safely, saying nothing of how close', () => {
  it('does not open with a wrong passphrase, however near', async () => {
    const file = await sealed('{"kept":true}')
    expect(await openSealedBackup(checked(file), 'quiet meadow lanterN')).toBeUndefined()
    expect(await openSealedBackup(checked(file), `${PASSPHRASE} `)).toBeUndefined()
    expect(await openSealedBackup(checked(file), '')).toBeUndefined()
  })

  it('does not open once its ciphertext, nonce, salt or count has been changed', async () => {
    const file = await sealed('{"kept":true}')
    const backup = checked(file)
    const flip = (bytes: Uint8Array, at = 0) => {
      const copy = bytes.slice()
      copy[at] ^= 1
      return copy
    }
    for (const changed of [
      { ...backup, ciphertext: flip(backup.ciphertext) },
      { ...backup, ciphertext: flip(backup.ciphertext, backup.ciphertext.length - 1) },
      { ...backup, iv: flip(backup.iv) },
      { ...backup, salt: flip(backup.salt) },
      { ...backup, iterations: backup.iterations + 1 },
    ]) {
      expect(await openSealedBackup(changed, PASSPHRASE)).toBeUndefined()
    }
  })

  it('does not open a file relabelled from another format or version', async () => {
    // Locked as a version 2 file would be, then labelled version 1: the
    // additional data no longer matches, so a downgrade cannot slip through.
    const salt = new Uint8Array(16).fill(7)
    const key = await deriveKey(PASSPHRASE, salt, FAST)
    for (const boundTo of [
      [SEALED_BACKUP_FORMAT, 2],
      ['the-butterfly-garden', SEALED_FORMAT_VERSION],
    ]) {
      const locked = await seal(key, new TextEncoder().encode('{}'), new TextEncoder().encode(JSON.stringify(boundTo)))
      const relabelled = JSON.stringify({
        format: SEALED_BACKUP_FORMAT,
        formatVersion: 1,
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: FAST, salt: toBase64(salt) },
        cipher: { name: 'AES-GCM', iv: toBase64(locked.iv) },
        ciphertext: toBase64(locked.ciphertext),
      })
      expect(await openSealedBackup(checked(relabelled), PASSPHRASE)).toBeUndefined()
    }
  })

  it('does not hand back something that is not text, even when it authenticates', async () => {
    const salt = new Uint8Array(16).fill(3)
    const key = await deriveKey(PASSPHRASE, salt, FAST)
    const locked = await seal(key, new Uint8Array([0xff, 0xfe, 0x00]), new TextEncoder().encode(JSON.stringify([SEALED_BACKUP_FORMAT, 1])))
    const odd = JSON.stringify({
      format: SEALED_BACKUP_FORMAT,
      formatVersion: 1,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: FAST, salt: toBase64(salt) },
      cipher: { name: 'AES-GCM', iv: toBase64(locked.iv) },
      ciphertext: toBase64(locked.ciphertext),
    })
    expect(await openSealedBackup(checked(odd), PASSPHRASE)).toBeUndefined()
  })
})

describe('checking the envelope before any passphrase is asked for', () => {
  type Envelope = { [field: string]: unknown; kdf: Record<string, unknown>; cipher: Record<string, unknown> }

  async function changed(change: (value: Envelope) => void) {
    const value = JSON.parse(await sealed('{}')) as Envelope
    change(value)
    return readSealedBackup(JSON.stringify(value))
  }

  it('reads a whole file it wrote', async () => {
    const read = readSealedBackup(await sealed('{}'))
    expect(read.ok).toBe(true)
  })

  it('calls a later version or another algorithm a newer version’s file', async () => {
    const newer = { ok: false, problem: 'newer' }
    const changes: Array<(value: Envelope) => void> = [
      (value) => (value.formatVersion = 2),
      (value) => (value.kdf.name = 'Argon2id'),
      (value) => (value.kdf.hash = 'SHA-512'),
      (value) => (value.cipher.name = 'XChaCha20-Poly1305'),
      // More than this build will spend minutes on.
      (value) => (value.kdf.iterations = 50_000_000),
    ]
    for (const change of changes) expect(await changed(change)).toEqual(newer)
  })

  it('calls anything malformed damage', async () => {
    const damaged = { ok: false, problem: 'damaged' }
    const file = await sealed('{}')
    expect(readSealedBackup(file.slice(0, file.length / 2))).toEqual(damaged)
    expect(readSealedBackup('not json')).toEqual(damaged)
    expect(readSealedBackup('[]')).toEqual(damaged)
    expect(readSealedBackup('{"format":"the-butterfly-garden"}')).toEqual(damaged)
    const changes: Array<(value: Envelope) => void> = [
      (value) => (value.formatVersion = 0),
      (value) => (value.formatVersion = '1'),
      (value) => (value.formatVersion = 1.5),
      (value) => Reflect.deleteProperty(value, 'formatVersion'),
      (value) => ((value as Record<string, unknown>).kdf = 'PBKDF2'),
      (value) => Reflect.deleteProperty(value, 'cipher'),
      (value) => (value.kdf.iterations = 0),
      (value) => (value.kdf.iterations = 1.5),
      (value) => (value.kdf.iterations = '600000'),
      (value) => (value.kdf.salt = 'AAAA'),
      (value) => (value.kdf.salt = 'not base64!'),
      (value) => (value.cipher.iv = toBase64(new Uint8Array(16))),
      (value) => (value.cipher.iv = 12),
      (value) => (value.ciphertext = toBase64(new Uint8Array(15))),
      (value) => (value.ciphertext = 'with spaces ='),
    ]
    for (const change of changes) expect(await changed(change)).toEqual(damaged)
  })
})

describe('what an older build makes of a protected backup', () => {
  // Builds 3.0 to 3.3 know nothing of this format. They read whatever a file
  // holds as a garden: `garden` if the file has one, else the file itself.
  // The functions below are the ones 3.1 to 3.3 run; 3.0's import asked
  // migrateState the same question and said only "may be from a newer
  // version" when it answered nothing.
  it('is refused as not a garden that version can read: not damaged, not empty', async () => {
    const file = await sealed(await plainBackup())
    const value: unknown = JSON.parse(file)

    expect(readImportedState(value)).toBeUndefined()
    const inspection = inspectImportedState(value)
    expect(inspection.state).toBeUndefined()
    expect(inspection.refused).toBe('It is not a garden this version can read.')
    expect(inspection.refused).not.toMatch(/missing|damaged/i)

    // 3.0's import: the payload, then the migration, which answers nothing.
    const payload = value && typeof value === 'object' && 'garden' in value ? value.garden : value
    expect(migrateState(payload)).toBeUndefined()

    expect(previewBackup(file)).toEqual({
      ok: false,
      problem: 'It is not a garden this version can read.',
      repaired: 0,
    })
  })

  it('would read as a damaged garden with a numeric `version`, which is why it has none', async () => {
    // The plan's first sketch named the envelope's version `version`. Every
    // older build would then take it for a garden at state version 1 with
    // its collections missing.
    const value = { ...(JSON.parse(await sealed('{}')) as Record<string, unknown>), version: 1 }
    expect(inspectImportedState(value).refused).toBe('Part of the garden is missing.')
    expect('version' in (JSON.parse(await sealed('{}')) as object)).toBe(false)
  })
})
