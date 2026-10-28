import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  gardenRepository,
  inspectImportedState,
  readImportedState,
} from '../repository/gardenRepository'
import { ArrayBufferFileReader } from '../test/fileReader'
import type { AppState } from '../types'
import { sealedKind } from './backupFile'
import { turnLockOn } from './gardenLockActions'
import { openLockedCopy, readLockedCopy, type LockedCopy } from './lockedCopy'
import { createInitialState } from './progression'
import { newRecoveryCode } from './recoveryCode'
import { bytesAsBase64 } from './storedBytes'
import { storedCopy } from './storedCopy'

/*
 * Safe mode's copy of a garden with the lock on is sealed as the garden is
 * stored. It must open again with the lock's own passcode or recovery code,
 * after the garden it came from is gone, and restore to exactly that garden:
 * otherwise the copy safe mode tells the gardener to keep is worth nothing.
 */

// The real lock, quick: the count is the tests' only change.
vi.mock('./sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

beforeEach(() => {
  // A photo is a Blob fake-indexeddb can store, read as a browser reads one.
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('FileReader', ArrayBufferFileReader)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await gardenRepository.clear().catch(() => undefined)
})

const PASSCODE = 'kingfisher at dawn'
const PHRASE = 'I told nobody about the letter from my sister'
const PHOTO = [82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 7, 250, 0, 128]

function journal(): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-20',
        level: 2,
        note: PHRASE,
        createdAt: '2026-10-20T09:00:00.000Z',
        updatedAt: '2026-10-20T09:00:00.000Z',
      },
    ],
    sightings: [
      {
        id: 'sighting-1',
        date: '2026-10-19',
        kind: 'butterfly',
        speciesId: 'monarch',
        note: 'Over the allotments',
        createdAt: '2026-10-19T09:00:00.000Z',
        photo: new Blob([new Uint8Array(PHOTO)], { type: 'image/webp' }),
      },
    ],
  }
}

/** A garden with the lock on, and safe mode's copy of it. */
async function lockedGardenCopy() {
  const words = newRecoveryCode()
  await gardenRepository.save(journal())
  await turnLockOn(PASSCODE, words)
  const { text } = await storedCopy()
  return { text, words }
}

function checked(text: string): LockedCopy {
  const read = readLockedCopy(text)
  if (!read.ok) throw new Error(read.problem)
  return read.copy
}

async function bytesOf(photo: Blob | undefined): Promise<number[]> {
  return [...new Uint8Array(await photo!.arrayBuffer())]
}

/** The copy's text, changed as `edit` changes its parsed form. */
function edited(text: string, edit: (copy: { stores: Record<string, { current: Record<string, unknown> }> }) => void) {
  const copy = JSON.parse(text) as { stores: Record<string, { current: Record<string, unknown> }> }
  edit(copy)
  return JSON.stringify(copy, null, 2)
}

describe('a copy of a locked garden', () => {
  it('is sealed, says so, and is known as a copy to be opened with the lock', async () => {
    const { text } = await lockedGardenCopy()
    expect(text).not.toContain(PHRASE)
    expect(text).not.toContain('Quiet Corner')
    expect(sealedKind(text)).toBe('copy')
    // A restore that is not given the lock's secret still refuses it, as it always has.
    expect(inspectImportedState(JSON.parse(text)).refused).toMatch(/still sealed/)
  })

  it('opens with the passcode to exactly the garden it was, photos and all, after that garden is gone', async () => {
    const { text } = await lockedGardenCopy()
    await gardenRepository.clear()

    const opened = await openLockedCopy(checked(text), { slot: 'passcode', passcode: PASSCODE })
    if (!opened.ok) throw new Error(opened.problem)
    const plain = JSON.parse(opened.text) as { format: string; exportedAt: string }
    expect(plain.format).toBe('the-butterfly-garden')
    expect(plain.exportedAt).toBe((JSON.parse(text) as { exportedAt: string }).exportedAt)

    const restored = readImportedState(plain)!
    expect(restored.profile?.gardenName).toBe('Quiet Corner')
    expect(restored.moods).toEqual(journal().moods)
    const [sighting] = restored.sightings
    expect(sighting.photo?.type).toBe('image/webp')
    expect(await bytesOf(sighting.photo)).toEqual(PHOTO)

    // And it restores as any backup does, into a garden that opens again.
    await gardenRepository.replace(restored, { snapshot: true })
    const loaded = await gardenRepository.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.moods[0].note).toBe(PHRASE)
    expect(await bytesOf(loaded.state.sightings[0].photo)).toEqual(PHOTO)
  })

  it('opens with the recovery code too', async () => {
    const { text, words } = await lockedGardenCopy()
    const opened = await openLockedCopy(checked(text), { slot: 'recovery', words })
    expect(opened.ok).toBe(true)
    if (opened.ok) expect(readImportedState(JSON.parse(opened.text))?.moods[0].note).toBe(PHRASE)
  })

  it('says only that a wrong passcode or recovery code is wrong, and hands back nothing', async () => {
    const { text } = await lockedGardenCopy()
    const copy = checked(text)
    expect(await openLockedCopy(copy, { slot: 'passcode', passcode: 'kingfisher at dusk' })).toEqual({
      ok: false,
      problem: 'wrong',
    })
    expect(await openLockedCopy(copy, { slot: 'recovery', words: newRecoveryCode() })).toEqual({
      ok: false,
      problem: 'wrong',
    })
  })

  it('opens with the passcode the garden had when it was copied, not one chosen since', async () => {
    const { text } = await lockedGardenCopy()
    const { changePasscode } = await import('./gardenLockActions')
    await changePasscode(PASSCODE, 'heron by the weir')
    const copy = checked(text)
    expect((await openLockedCopy(copy, { slot: 'passcode', passcode: 'heron by the weir' })).ok).toBe(false)
    expect((await openLockedCopy(copy, { slot: 'passcode', passcode: PASSCODE })).ok).toBe(true)
  })

  it('keeps a sighting whose sealed photo could not be read into the copy, without its photo', async () => {
    const { text } = await lockedGardenCopy()
    // As safe mode writes a sealed photo it could not read: marked as left out.
    const missing = edited(text, (copy) => {
      const sightings = copy.stores.sightings.current
      sightings.blobs = (sightings.blobs as unknown[]).map(() => ({ mimeType: '', unreadable: true }))
    })
    const opened = await openLockedCopy(checked(missing), { slot: 'passcode', passcode: PASSCODE })
    if (!opened.ok) throw new Error(opened.problem)
    const inspection = inspectImportedState(JSON.parse(opened.text))
    expect(inspection.state?.moods[0].note).toBe(PHRASE)
    expect(inspection.state?.sightings).toHaveLength(1)
    expect(inspection.state?.sightings[0].photo).toBeUndefined()
    expect(inspection.repaired).toBe(1)
  })

  it('opens as written when safe mode could not load what writes photos as text', async () => {
    await gardenRepository.save(journal())
    await turnLockOn(PASSCODE, newRecoveryCode())
    // storedCopy's own fallback: every Blob marked as left out, bytes as base64.
    const raw = await gardenRepository.readRaw()
    const text = JSON.stringify(
      raw,
      (key, value: unknown) => (value instanceof Blob ? { unreadable: true } : bytesAsBase64(key, value)),
      2,
    )
    expect(sealedKind(text)).toBe('copy')
    const opened = await openLockedCopy(checked(text), { slot: 'passcode', passcode: PASSCODE })
    if (!opened.ok) throw new Error(opened.problem)
    const restored = readImportedState(JSON.parse(opened.text))!
    expect(restored.moods[0].note).toBe(PHRASE)
    expect(restored.sightings[0].photo).toBeUndefined()
  })

  it('says a copy changed since it was made is damaged, once the secret is right', async () => {
    const { text } = await lockedGardenCopy()
    const changed = edited(text, (copy) => {
      const moods = copy.stores.moods.current
      const data = atob((moods.data as { base64: string }).base64)
      moods.data = { base64: btoa(`${data.slice(0, 5)}${String.fromCharCode(data.charCodeAt(5) ^ 1)}${data.slice(6)}`) }
    })
    expect(await openLockedCopy(checked(changed), { slot: 'passcode', passcode: PASSCODE })).toEqual({
      ok: false,
      problem: 'damaged',
    })
    // A part moved into another's place does not open either.
    const moved = edited(text, (copy) => {
      copy.stores.goals.current = copy.stores.moods.current
    })
    expect(await openLockedCopy(checked(moved), { slot: 'passcode', passcode: PASSCODE })).toEqual({
      ok: false,
      problem: 'damaged',
    })
  })

  it('throws, rather than calling a secret wrong, when the browser cannot do the work', async () => {
    const { text } = await lockedGardenCopy()
    const copy = checked(text)
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    await expect(openLockedCopy(copy, { slot: 'passcode', passcode: PASSCODE })).rejects.toThrow(
      'This browser cannot lock or open files here.',
    )
  })
})

describe('a copy that can never open', () => {
  it('says so before any secret, damaged or newer', async () => {
    const { text } = await lockedGardenCopy()
    expect(readLockedCopy('{')).toEqual({ ok: false, problem: 'damaged' })
    expect(readLockedCopy('[]')).toEqual({ ok: false, problem: 'damaged' })
    expect(readLockedCopy(JSON.stringify({ format: 'the-butterfly-garden', garden: {} }))).toEqual({
      ok: false,
      problem: 'damaged',
    })
    const cases: Array<[string, (copy: { stores: Record<string, { current: Record<string, unknown> }> }) => void, string]> = [
      ['no lock', (copy) => delete copy.stores.lock, 'damaged'],
      ['another lock format', (copy) => (copy.stores.lock.current.format = 'something-else'), 'damaged'],
      ['no version', (copy) => delete copy.stores.lock.current.version, 'damaged'],
      ['a later lock', (copy) => (copy.stores.lock.current.version = 2), 'newer'],
      ['no id', (copy) => delete copy.stores.lock.current.id, 'damaged'],
      ['another derivation', (copy) => ((copy.stores.lock.current.passcode as Record<string, unknown>).kdf = 'Argon2id'), 'newer'],
      ['too many rounds', (copy) => ((copy.stores.lock.current.recovery as Record<string, unknown>).iterations = 20_000_000), 'newer'],
      ['no rounds', (copy) => ((copy.stores.lock.current.passcode as Record<string, unknown>).iterations = 0), 'damaged'],
      ['a salt not base64', (copy) => ((copy.stores.lock.current.passcode as Record<string, unknown>).salt = { base64: '***' }), 'damaged'],
      ['no wrapped key', (copy) => delete copy.stores.lock.current.recovery, 'damaged'],
      ['no meta', (copy) => delete copy.stores.meta, 'damaged'],
      ['a part in the clear', (copy) => (copy.stores.moods.current = { note: 'plain' } as never), 'damaged'],
      ['a part without its bytes', (copy) => delete copy.stores.goals.current.iv, 'damaged'],
      ['photos not a list', (copy) => (copy.stores.sightings.current.blobs = 'none'), 'damaged'],
    ]
    for (const [what, edit, problem] of cases) {
      expect(readLockedCopy(edited(text, edit)), what).toEqual({ ok: false, problem })
    }
  })

  it('reads a copy whose stores are missing a part, which the garden then goes without', async () => {
    const { text } = await lockedGardenCopy()
    const without = edited(text, (copy) => {
      delete copy.stores.sightings
    })
    const opened = await openLockedCopy(checked(without), { slot: 'passcode', passcode: PASSCODE })
    if (!opened.ok) throw new Error(opened.problem)
    expect(readImportedState(JSON.parse(opened.text))?.sightings).toEqual([])
  })
})
