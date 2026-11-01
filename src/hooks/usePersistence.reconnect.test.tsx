import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGardenRepository, gardenRepository } from '../repository/gardenRepository'
import { useGardenState } from './useGardenState'

/*
 * A change made after the browser closed the garden's connection under it
 * (the repository retries the write once on a fresh one) is kept, and the
 * gardener is never told it could not be saved.
 */

beforeEach(async () => {
  await gardenRepository.clear().catch(() => undefined)
})

afterEach(async () => {
  vi.restoreAllMocks()
  await gardenRepository.clear().catch(() => undefined)
})

describe('4.1 saving after the connection closed', () => {
  it('keeps the change, and shows no write error', async () => {
    const opened: IDBDatabase[] = []
    const open = indexedDB.open.bind(indexedDB)
    vi.spyOn(indexedDB, 'open').mockImplementation((name: string, version?: number) => {
      const request = open(name, version)
      request.addEventListener('success', () => opened.push(request.result))
      return request
    })
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.onboard('Tester', 'Kept Garden'))
    await waitFor(async () =>
      expect((await createGardenRepository().load()).state.profile?.gardenName).toBe('Kept Garden'),
    )
    const before = result.current.state!.plants.length

    // The browser closes the garden's connection, and says nothing.
    for (const db of opened) db.close()
    act(() => result.current.plant('aster'))

    await waitFor(async () =>
      expect((await createGardenRepository().load()).state.plants).toHaveLength(before + 1),
    )
    expect(result.current.persistence.writeError).toBeUndefined()
  })
})
