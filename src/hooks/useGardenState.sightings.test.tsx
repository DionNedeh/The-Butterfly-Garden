import { Blob as NodeBlob } from 'node:buffer'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyGardenImages } from '../lib/imageImport'
import { createInitialState } from '../lib/progression'
import { gardenRepository } from '../repository/gardenRepository'
import type { Sighting } from '../types'
import { useGardenState } from './useGardenState'

vi.mock('../lib/imageImport', () => ({ verifyGardenImages: vi.fn() }))

// A Blob fake-indexeddb can store, as a browser's can (see
// gardenRepository.sightings.test.ts).
beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob)
  await gardenRepository.clear().catch(() => undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(verifyGardenImages).mockReset()
})

const BYTES = [82, 73, 70, 70, 9, 8, 7]

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

async function renderReady(sightings: Sighting[] = []) {
  await gardenRepository.save({ ...createInitialState('Tester', 'Wild Garden'), sightings })
  const hook = renderHook(() => useGardenState())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('the field book through the garden', () => {
  it('changes only the sightings, says whether it did, and keeps them', async () => {
    const { result } = await renderReady()
    const before = result.current.state!
    let changed = false
    act(() => {
      changed = result.current.changeSightings((sightings) => [...sightings, sighting()])
    })
    expect(changed).toBe(true)
    const after = result.current.state!
    expect(after.sightings).toHaveLength(1)
    expect(after.sunlight).toBe(before.sunlight)
    expect(after.nectar).toBe(before.nectar)
    expect(after.plants).toBe(before.plants)

    let unchanged = true
    act(() => {
      unchanged = result.current.changeSightings((sightings) => sightings)
    })
    expect(unchanged).toBe(false)
    expect(result.current.state).toBe(after)

    await waitFor(async () => expect((await gardenRepository.load()).state.sightings).toHaveLength(1))
  })

  it('writes a photo into a backup as text, and a restore checks it and brings it back', async () => {
    const photo = new Blob([new Uint8Array(BYTES)], { type: 'image/webp' })
    const { result } = await renderReady([sighting({ photo })])
    const file = (await result.current.exportGarden())!
    const { garden } = JSON.parse(file) as { garden: { version: number; sightings: Array<{ photo: unknown }> } }
    expect(garden.version).toBe(8)
    expect(garden.sightings[0].photo).toEqual({
      mimeType: 'image/webp',
      imageData: btoa(String.fromCharCode(...BYTES)),
    })

    act(() => {
      result.current.changeSightings(() => [])
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(file)
    })
    expect(outcome?.ok).toBe(true)
    expect(verifyGardenImages).toHaveBeenCalledOnce()
    const restored = result.current.state!.sightings[0].photo
    expect([...new Uint8Array(await restored!.arrayBuffer())]).toEqual(BYTES)
  })

  it('restores nothing when a photo in the backup cannot be read', async () => {
    const photo = new Blob([new Uint8Array(BYTES)], { type: 'image/webp' })
    const { result } = await renderReady([sighting({ photo })])
    const file = (await result.current.exportGarden())!
    vi.mocked(verifyGardenImages).mockRejectedValueOnce(
      new Error('A photo in that backup could not be read, so nothing was replaced.'),
    )
    const replace = vi.spyOn(gardenRepository, 'replace')
    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(file)
    })
    expect(outcome).toEqual({ ok: false, message: 'A photo in that backup could not be read, so nothing was replaced.' })
    expect(replace).not.toHaveBeenCalled()
  })

  it('exports a garden without photos without loading anything more', async () => {
    const { result } = await renderReady([sighting({ note: 'No photo' })])
    const { garden } = JSON.parse((await result.current.exportGarden())!) as { garden: { sightings: Sighting[] } }
    expect(garden.sightings).toEqual([sighting({ note: 'No photo' })])
  })
})
