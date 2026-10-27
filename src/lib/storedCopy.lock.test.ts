import { openDB } from 'idb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGardenRepository, gardenRepository } from '../repository/gardenRepository'
import type { AppState } from '../types'
import { sealedKind } from './backupFile'
import { createLock } from './gardenLock'
import { createInitialState } from './progression'
import { newRecoveryCode } from './recoveryCode'
import { turnLockOn } from './gardenLockActions'
import { setAsideCopy } from './sightingPhotos'
import { storedCopy } from './storedCopy'

vi.mock('./sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

afterEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

describe('a copy of everything stored', () => {
  it('holds a garden as it is stored', async () => {
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    const copy = JSON.parse((await storedCopy()).text) as { stores: { meta: { current: { profile: { gardenName: string } } } } }
    expect(copy.stores.meta.current.profile.gardenName).toBe('Quiet Corner')
  })

  it('holds a locked garden sealed, its bytes as base64 rather than lists of numbers', async () => {
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    await turnLockOn('a long quiet passphrase', newRecoveryCode())
    const { text } = await storedCopy()
    expect(text).not.toContain('Quiet Corner')
    const copy = JSON.parse(text) as {
      stores: { meta: { current: { sealed: number; iv: { base64: string }; data: { base64: string } } } }
    }
    const meta = copy.stores.meta.current
    expect(meta.sealed).toBe(1)
    expect(atob(meta.iv.base64)).toHaveLength(12)
    expect(meta.data.base64.length).toBeGreaterThan(20)
    expect(text).not.toMatch(/"0": \d+/)
  })

  it('is known as a locked garden’s copy by the lock’s record in it, and only then', async () => {
    await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
    expect(sealedKind((await storedCopy()).text)).toBeUndefined()
    await turnLockOn('a long quiet passphrase', newRecoveryCode())
    expect(sealedKind((await storedCopy()).text)).toBe('copy')
  })
})

describe('the set-aside copy of a locked garden that would not open', () => {
  it('holds the sealed parts as safe mode’s copy does, bytes as base64, not lists of numbers', async () => {
    const name = `set-aside-${Math.random()}`
    const repository = createGardenRepository(name)
    const garden: AppState = {
      ...createInitialState('Robin', 'Quiet Corner'),
      moods: [
        {
          id: 'mood-1',
          localDate: '2026-10-20',
          level: 2,
          note: 'Words only the lock should keep. '.repeat(40),
          createdAt: '2026-10-20T09:00:00.000Z',
          updatedAt: '2026-10-20T09:00:00.000Z',
        },
      ],
    }
    await repository.save(garden)
    const { record, key } = await createLock('kingfisher at dawn', newRecoveryCode(), 1_000)
    await repository.relock({ record, key })

    // One byte of the sealed check-ins changed: that part no longer opens.
    const db = await openDB(name)
    const moods = (await db.get('moods', 'current')) as { data: Uint8Array }
    const data = new Uint8Array(moods.data)
    data[5] ^= 1
    await db.put('moods', { ...moods, data }, 'current')
    db.close()

    const tab = createGardenRepository(name)
    tab.unlock(key, record.id)
    expect(await tab.load()).toMatchObject({ status: 'withheld', reason: 'malformed' })
    const [newest] = await tab.quarantined()
    const { text } = await setAsideCopy(newest)
    expect(text).not.toMatch(/"0": \d+/)
    expect(text).not.toContain('Words only the lock should keep.')
    const copy = JSON.parse(text) as {
      garden: { moods: { sealed: number; iv: { base64: string }; data: { base64: string } } }
    }
    expect(copy.garden.moods.sealed).toBe(1)
    expect(atob(copy.garden.moods.iv.base64)).toHaveLength(12)
    // The damaged bytes, exactly as they were stored.
    expect([...Uint8Array.from(atob(copy.garden.moods.data.base64), (char) => char.charCodeAt(0))]).toEqual([
      ...data,
    ])
    await tab.clear()
  })
})
