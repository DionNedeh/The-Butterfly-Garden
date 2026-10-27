import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from './progression'
import { gardenRepository, readImportedState } from '../repository/gardenRepository'
import { ArrayBufferFileReader, unreadablePhoto } from '../test/fileReader'
import type { Sighting } from '../types'

/*
 * Safe mode's copy of everything stored, which exists for a garden in
 * trouble: one photo whose bytes are gone must not cost the whole copy, and
 * the copy must still be one the app can put back.
 */

// A Blob fake-indexeddb can store, as a browser's can (see
// gardenRepository.sightings.test.ts), read by a FileReader that reads it.
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('FileReader', ArrayBufferFileReader)
})
afterEach(async () => {
  vi.doUnmock('./sightingPhotos')
  vi.resetModules()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await gardenRepository.clear().catch(() => undefined)
})

const BYTES = [82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80]

function sighting(id: string, photo?: Blob): Sighting {
  return {
    id,
    date: '2026-10-20',
    kind: 'butterfly',
    speciesId: 'monarch',
    ...(photo ? { photo } : {}),
    createdAt: '2026-10-20T15:00:00.000Z',
  }
}

/** A stored garden: a check-in, and two photos, the first of them unreadable. */
async function storeGarden() {
  const garden = createInitialState('Tester', 'Wild Garden')
  await gardenRepository.save({
    ...garden,
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-20',
        level: 4,
        note: 'A quiet walk.',
        createdAt: '2026-10-20T08:00:00.000Z',
        updatedAt: '2026-10-20T08:00:00.000Z',
      },
    ],
    sightings: [
      sighting('lost', new Blob([new Uint8Array(BYTES)], { type: 'image/webp' })),
      sighting('kept', new Blob([new Uint8Array(BYTES)], { type: 'image/webp' })),
    ],
  })
  // What storage hands back for the first photo once its file has gone.
  const readRaw = gardenRepository.readRaw.bind(gardenRepository)
  vi.spyOn(gardenRepository, 'readRaw').mockImplementation(async () => {
    const raw = await readRaw()
    const stores = raw.stores as { sightings: { current: Sighting[] } }
    stores.sightings.current[0] = { ...stores.sightings.current[0], photo: unreadablePhoto() }
    return raw
  })
}

describe('a copy of everything stored', () => {
  it('is written whole when a photo cannot be read, leaving out only that photo, and says so', async () => {
    await storeGarden()
    const { storedCopy } = await import('./storedCopy')
    const copy = await storedCopy()
    expect(copy.leftOut).toBe(
      'One photo in the field book could not be read on this device, so the file keeps its sighting without it.',
    )
    const restored = readImportedState(JSON.parse(copy.text))
    expect(restored?.moods.map((mood) => mood.note)).toEqual(['A quiet walk.'])
    const [lost, kept] = restored!.sightings
    expect(lost.id).toBe('lost')
    expect(lost).not.toHaveProperty('photo')
    expect([...new Uint8Array(await kept.photo!.arrayBuffer())]).toEqual(BYTES)
  })

  it('marks its photos as left out, not as `{}`, when they cannot be written as text, and still restores and counts them', async () => {
    await storeGarden()
    vi.doMock('./sightingPhotos', () => {
      throw new Error('A part of the app could not be loaded.')
    })
    vi.resetModules()
    const { storedCopy } = await import('./storedCopy')
    const copy = await storedCopy()
    expect(copy.text).not.toContain('"photo": {}')
    const { inspectImportedState } = await import('../repository/gardenRepository')
    const restored = inspectImportedState(JSON.parse(copy.text))
    expect(restored.refused).toBeUndefined()
    expect(restored.state?.moods).toHaveLength(1)
    expect(restored.state?.sightings.map((item) => [item.id, item.photo])).toEqual([
      ['lost', undefined],
      ['kept', undefined],
    ])
    expect(restored.repaired).toBe(2)
  })
})
