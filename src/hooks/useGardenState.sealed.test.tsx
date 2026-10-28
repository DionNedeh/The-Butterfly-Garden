import { Blob as NodeBlob } from 'node:buffer'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyGardenImages } from '../lib/imageImport'
import { createInitialState } from '../lib/progression'
import { openSealedBackup, readSealedBackup, sealBackup } from '../lib/sealedBackup'
import { gardenRepository } from '../repository/gardenRepository'
import { ArrayBufferFileReader } from '../test/fileReader'
import type { Sighting } from '../types'
import { useGardenState } from './useGardenState'

vi.mock('../lib/imageImport', () => ({ verifyGardenImages: vi.fn() }))

// A Blob fake-indexeddb can store, as a browser's can, read by a FileReader
// that reads it.
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

const PASSPHRASE = 'quiet meadow lantern'
const BYTES = [82, 73, 70, 70, 9, 8, 7]

async function renderReady() {
  const sighting = {
    id: 'sighting-1',
    date: '2026-10-20',
    kind: 'butterfly',
    speciesId: 'monarch',
    note: 'Over the allotments',
    createdAt: '2026-10-20T09:00:00.000Z',
    photo: new Blob([new Uint8Array(BYTES)], { type: 'image/webp' }),
  } as Sighting
  await gardenRepository.save({ ...createInitialState('Tester', 'Wild Garden'), sightings: [sighting] })
  const hook = renderHook(() => useGardenState())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

async function lock(text: string): Promise<string> {
  const outcome = await sealBackup(text, PASSPHRASE, { iterations: 1_000 })
  if (!outcome.ok) throw new Error('Not sealed')
  return outcome.text
}

describe('a protected backup through the garden', () => {
  it('locks the garden’s own backup, photos and all, and restores it once opened', async () => {
    const { result } = await renderReady()
    const plain = (await result.current.exportGarden())!
    const file = await lock(plain.text)
    expect(file).not.toContain('Over the allotments')

    act(() => {
      result.current.changeSightings(() => [])
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    const read = readSealedBackup(file)
    const opened = read.ok ? await openSealedBackup(read.backup, PASSPHRASE) : undefined
    expect(opened).toBe(plain.text)
    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(opened!)
    })
    expect(outcome).toEqual({ ok: true, message: 'Your garden was restored from the backup.' })
    expect(verifyGardenImages).toHaveBeenCalledOnce()
    const [restored] = result.current.state!.sightings
    expect(restored.note).toBe('Over the allotments')
    expect([...new Uint8Array(await restored.photo!.arrayBuffer())]).toEqual(BYTES)
    // A restore can be undone, as from any backup.
    expect(result.current.persistence.lastRestoreSnapshotId).toBeDefined()
  })

  it('is refused unopened, as a build that does not know it would, replacing nothing', async () => {
    // Every screen opens a protected backup before restoring it. Handed one
    // unopened, the import says what every older build says, and keeps
    // the garden exactly as it is.
    const { result } = await renderReady()
    const before = result.current.state
    const file = await lock((await result.current.exportGarden())!.text)
    const replace = vi.spyOn(gardenRepository, 'replace')
    let outcome: { ok: boolean; message: string } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(file)
    })
    expect(outcome).toEqual({
      ok: false,
      message: 'That backup could not be restored. It is not a garden this version can read.',
    })
    expect(replace).not.toHaveBeenCalled()
    expect(result.current.state).toBe(before)
    expect((await gardenRepository.load()).state.sightings).toHaveLength(1)
  })
})
