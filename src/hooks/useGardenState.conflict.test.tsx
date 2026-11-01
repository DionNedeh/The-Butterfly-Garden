import { Blob as NodeBlob } from 'node:buffer'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import { GardenConflictError, gardenRepository } from '../repository/gardenRepository'
import { FakeBroadcastChannel } from '../test/fakeBroadcastChannel'
import { ArrayBufferFileReader } from '../test/fileReader'
import type { Sighting } from '../types'
import { SYNC_CHANNEL } from './usePersistence'
import { useGardenState } from './useGardenState'

vi.mock('../lib/imageImport', () => ({ verifyGardenImages: vi.fn() }))

// A Blob fake-indexeddb can store, as a browser's can (see
// gardenRepository.sightings.test.ts).
beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('FileReader', ArrayBufferFileReader)
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
  await gardenRepository.clear().catch(() => undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const photo = () => new Blob([new Uint8Array([82, 73, 70, 70, 9])], { type: 'image/webp' })

function sighting(extra: Partial<Sighting> = {}): Sighting {
  return {
    id: 'sighting-1',
    date: '2026-10-20',
    kind: 'butterfly',
    speciesId: 'monarch',
    createdAt: '2026-10-20T09:00:00.000Z',
    ...extra,
  } as Sighting
}

async function renderReady() {
  await gardenRepository.save(createInitialState('Tester', 'Wild Garden'))
  const hook = renderHook(() => useGardenState())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

/** Log a sighting with `added` as its photo, and the wait for it. */
function logWith(result: Awaited<ReturnType<typeof renderReady>>['result'], added: Blob) {
  let kept: Promise<{ ok: boolean; reason?: string }> | undefined
  act(() => {
    result.current.changeSightings((sightings) => [...sightings, sighting({ photo: added })])
    kept = result.current.changeSightings.photoSaved!(added)
  })
  return kept!
}

describe('6.10 why a new photo was not kept', () => {
  it('is the garden changing in another tab, when a conflict throws the whole change away', async () => {
    const { result } = await renderReady()
    const save = gardenRepository.save.bind(gardenRepository)
    vi.spyOn(gardenRepository, 'save').mockImplementation((garden) =>
      garden.sightings.length ? Promise.reject(new GardenConflictError()) : save(garden),
    )
    const added = photo()
    const kept = logWith(result, added)
    await act(async () => {
      await expect(kept).resolves.toMatchObject({ ok: false, reason: 'conflict' })
    })
    // The garden read back has no such sighting: it went, not only its photo.
    await waitFor(() => expect(result.current.state!.sightings).toEqual([]))
  })

  it('is the garden changing in another tab, when that tab’s change arrives first', async () => {
    const { result } = await renderReady()
    // This tab's write never lands before the other tab's news.
    vi.spyOn(gardenRepository, 'save').mockImplementation(() => new Promise(() => undefined))
    const added = photo()
    const kept = logWith(result, added)
    const otherTab = new FakeBroadcastChannel(SYNC_CHANNEL)
    act(() => otherTab.postMessage({ type: 'garden-saved' }))
    await act(async () => {
      await expect(kept).resolves.toMatchObject({ ok: false, reason: 'conflict' })
    })
    otherTab.close()
  })

  it('is no conflict, when the photo would not go in', async () => {
    const { result } = await renderReady()
    const save = gardenRepository.save.bind(gardenRepository)
    vi.spyOn(gardenRepository, 'save').mockImplementation((garden) =>
      garden.sightings.some((item) => item.photo)
        ? Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'))
        : save(garden),
    )
    const kept = logWith(result, photo())
    await act(async () => {
      const answer = await kept
      expect(answer.ok).toBe(false)
      expect(answer.reason).toBeUndefined()
    })
    // The sighting is written again without its photo before the test ends.
    await waitFor(async () => expect((await gardenRepository.load()).state.sightings).toEqual([sighting()]))
    await waitFor(() => expect(result.current.persistence.writeError).toBeUndefined())
  })
})
