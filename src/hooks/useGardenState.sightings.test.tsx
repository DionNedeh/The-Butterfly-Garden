import { Blob as NodeBlob } from 'node:buffer'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyGardenImages } from '../lib/imageImport'
import { createInitialState } from '../lib/progression'
import { gardenRepository } from '../repository/gardenRepository'
import { ArrayBufferFileReader, unreadablePhoto } from '../test/fileReader'
import type { Sighting } from '../types'
import { useGardenState } from './useGardenState'

vi.mock('../lib/imageImport', () => ({ verifyGardenImages: vi.fn() }))

// A Blob fake-indexeddb can store, as a browser's can (see
// gardenRepository.sightings.test.ts).
beforeEach(async () => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('FileReader', ArrayBufferFileReader)
  await gardenRepository.clear().catch(() => undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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
    const file = (await result.current.exportGarden())!.text
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
    const file = (await result.current.exportGarden())!.text
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

  it('makes a backup whole when a photo cannot be read, leaving out only that photo, and a restore keeps its sighting', async () => {
    const photo = new Blob([new Uint8Array(BYTES)], { type: 'image/webp' })
    const { result } = await renderReady([sighting({ photo }), sighting({ id: 'sighting-2', photo })])
    // Storage kept the record but lost the bytes of one photo.
    act(() => {
      result.current.changeSightings((sightings) => [{ ...sightings[0], photo: unreadablePhoto() }, sightings[1]])
    })
    const copy = (await result.current.exportGarden())!
    expect(copy.leftOut).toBe(
      'One photo in the field book could not be read on this device, so the file keeps its sighting without it.',
    )
    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(copy.text)
    })
    expect(outcome).toEqual({
      ok: true,
      message: 'Your garden was restored from the backup. 1 damaged entry was repaired along the way.',
    })
    const [first, second] = result.current.state!.sightings
    expect(first.id).toBe('sighting-1')
    expect(first).not.toHaveProperty('photo')
    expect([...new Uint8Array(await second.photo!.arrayBuffer())]).toEqual(BYTES)
  })

  it('takes a photo that will not go into storage back out, says so, and lets the rest of the garden save', async () => {
    const { result } = await renderReady([sighting({ note: 'Before' })])
    // A device too full for a photo: any write that carries one fails.
    const save = gardenRepository.save.bind(gardenRepository)
    const writes = vi.spyOn(gardenRepository, 'save').mockImplementation((garden) =>
      garden.sightings.some((item) => item.photo)
        ? Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'))
        : save(garden),
    )
    const photo = new Blob([new Uint8Array(BYTES)], { type: 'image/webp' })
    let kept: Promise<{ ok: boolean; message?: string }> | undefined
    act(() => {
      result.current.changeSightings((sightings) => [
        { ...sightings[0], note: 'After', photo },
        sighting({ id: 'sighting-2', photo }),
      ])
      kept = result.current.changeSightings.photoSaved!(photo)
    })
    await act(async () => {
      await expect(kept).resolves.toMatchObject({ ok: false })
    })
    // The words stay; the photo does not, so the next write can go in.
    await waitFor(() =>
      expect(result.current.state!.sightings).toEqual([
        sighting({ note: 'After' }),
        sighting({ id: 'sighting-2' }),
      ]),
    )
    act(() => result.current.setGentleDay(true))
    await waitFor(async () => {
      const stored = (await gardenRepository.load()).state
      expect(stored.profile?.gentleDay).toBeDefined()
      expect(stored.sightings.map((item) => [item.id, item.note, item.photo])).toEqual([
        ['sighting-1', 'After', undefined],
        ['sighting-2', undefined, undefined],
      ])
    })
    await waitFor(() => expect(result.current.persistence.writeError).toBeUndefined())
    expect(writes.mock.calls.filter(([garden]) => garden.sightings.some((item) => item.photo))).toHaveLength(1)
  })

  it('answers for a new photo once it is stored, and puts back the one stored before when a new one will not go in', async () => {
    const { result } = await renderReady([sighting({ photo: new Blob([new Uint8Array(BYTES)], { type: 'image/webp' }) })])
    // The photo as storage handed it back.
    const before = result.current.state!.sightings[0].photo
    const added = new Blob([new Uint8Array([1, ...BYTES])], { type: 'image/webp' })
    let kept: Promise<{ ok: boolean; message?: string }> | undefined
    act(() => {
      result.current.changeSightings((sightings) => [...sightings, sighting({ id: 'sighting-2', photo: added })])
      kept = result.current.changeSightings.photoSaved!(added)
    })
    await act(async () => {
      await expect(kept).resolves.toEqual({ ok: true })
    })

    const save = gardenRepository.save.bind(gardenRepository)
    const changed = new Blob([new Uint8Array([2, ...BYTES])], { type: 'image/webp' })
    vi.spyOn(gardenRepository, 'save').mockImplementation((garden) =>
      garden.sightings.some((item) => item.photo === changed)
        ? Promise.reject(new DOMException('The quota has been exceeded.', 'QuotaExceededError'))
        : save(garden),
    )
    act(() => {
      result.current.changeSightings((sightings) => [{ ...sightings[0], photo: changed }, sightings[1]])
      kept = result.current.changeSightings.photoSaved!(changed)
    })
    await act(async () => {
      await expect(kept).resolves.toMatchObject({ ok: false })
    })
    await waitFor(() => expect(result.current.state!.sightings[0].photo).toBe(before))
    expect(result.current.state!.sightings[1].photo).toBe(added)
    // And the garden, the photo put back, is written again.
    await waitFor(() => expect(result.current.persistence.writeError).toBeUndefined())

    // A photo the change did not bring is not waited for.
    await expect(result.current.changeSightings.photoSaved!(changed)).resolves.toMatchObject({ ok: false })
  })

  it('exports a garden without photos without loading anything more', async () => {
    const { result } = await renderReady([sighting({ note: 'No photo' })])
    const { garden } = JSON.parse((await result.current.exportGarden())!.text) as { garden: { sightings: Sighting[] } }
    expect(garden.sightings).toEqual([sighting({ note: 'No photo' })])
  })
})
