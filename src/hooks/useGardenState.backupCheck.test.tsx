import { act, renderHook, waitFor } from '@testing-library/react'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gardenDigest, integrityOf } from '../lib/backupIntegrity'
import { DATABASE_NAME, gardenRepository } from '../repository/gardenRepository'
import { useGardenState } from './useGardenState'

/*
 * The backup Settings saves, shares and keeps up to date (and seals into a
 * protected backup or a move file) carries the revision of the garden it
 * was made from, and a SHA-256 of its garden (lib/backupIntegrity).
 */

beforeEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})
afterEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

async function storedRevision(): Promise<unknown> {
  const db = await openDB(DATABASE_NAME)
  try {
    return ((await db.get('meta', 'current')) as { revision?: unknown } | undefined)?.revision
  } finally {
    db.close()
  }
}

describe('4.3 a backup made from the garden', () => {
  it('carries the revision it was made at and a check of its garden', async () => {
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.onboard('Tester', 'Checked Garden'))
    act(() => result.current.plant('aster'))
    await waitFor(async () => expect(await storedRevision()).toBe(2))

    const file = JSON.parse((await result.current.exportGarden())!.text) as {
      revision: number
      sha256: string
      garden: unknown
    }
    expect(file.revision).toBe(2)
    expect(file.sha256).toBe(await gardenDigest(file.garden))
    expect(await integrityOf(file)).toBe('ok')
  })
})
