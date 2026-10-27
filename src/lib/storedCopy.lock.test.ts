import { afterEach, describe, expect, it, vi } from 'vitest'
import { gardenRepository } from '../repository/gardenRepository'
import { createInitialState } from './progression'
import { newRecoveryCode } from './recoveryCode'
import { turnLockOn } from './gardenLockActions'
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
})
