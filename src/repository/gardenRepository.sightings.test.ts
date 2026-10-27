import { Blob as NodeBlob } from 'node:buffer'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import { withPhotosAsText } from '../lib/sightingPhotos'
import type { AppState, Sighting } from '../types'
import { gardenRepository, readImportedState, RAW_EXPORT_FORMAT } from './gardenRepository'

/*
 * A sighting's photo is a Blob, kept in the sightings store and carried in a
 * backup as text. jsdom's own Blob is not one that Node's structuredClone,
 * which fake-indexeddb stores with, can copy; Node's Blob is, as every
 * browser's is, so these tests make it the Blob the app sees.
 */
beforeEach(() => {
  vi.stubGlobal('Blob', NodeBlob)
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await gardenRepository.clear().catch(() => undefined)
})

/** A few bytes that start the way a WebP file does. */
const BYTES = [82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 7, 250, 0, 128]

function withSightings(): AppState {
  const photo = new Blob([new Uint8Array(BYTES)], { type: 'image/webp' })
  const sightings: Sighting[] = [
    {
      id: 'sighting-1',
      date: '2026-10-20',
      kind: 'butterfly',
      speciesId: 'monarch',
      note: 'Two of them, over the allotments.',
      photo,
      createdAt: '2026-10-20T15:00:00.000Z',
    },
    {
      id: 'sighting-2',
      date: '2026-10-21',
      kind: 'plant',
      plantId: 'aster',
      createdAt: '2026-10-21T09:00:00.000Z',
    },
  ]
  return { ...createInitialState('Tester', 'Wild Garden'), sightings }
}

async function bytesOf(blob: Blob | undefined): Promise<number[]> {
  return blob ? [...new Uint8Array(await blob.arrayBuffer())] : []
}

describe('sightings in storage', () => {
  it('keep their photo as a Blob in a store of their own, through a save and a load', async () => {
    await gardenRepository.save(withSightings())
    const db = await openDB('butterfly-garden')
    try {
      const stored = (await db.get('sightings', 'current')) as Sighting[]
      expect(stored).toHaveLength(2)
      expect(stored[0].photo).toBeInstanceOf(Blob)
      // Not in the small record beside the profile, which an older build
      // writes field by field.
      expect(await db.get('meta', 'current')).not.toHaveProperty('sightings')
    } finally {
      db.close()
    }
    const loaded = await gardenRepository.load()
    expect(loaded.status).toBe('loaded')
    expect(loaded.state.version).toBe(8)
    const [first, second] = loaded.state.sightings
    expect(first).toMatchObject({ id: 'sighting-1', note: 'Two of them, over the allotments.' })
    expect(await bytesOf(first.photo)).toEqual(BYTES)
    expect(first.photo?.type).toBe('image/webp')
    expect(second).toMatchObject({ kind: 'plant', plantId: 'aster' })
  })

  it('writes only the sightings when a sighting is logged', async () => {
    const before = withSightings()
    await gardenRepository.save(before)
    const after: AppState = {
      ...before,
      sightings: [
        ...before.sightings,
        { id: 'sighting-3', date: '2026-10-22', kind: 'plant', plantId: 'violet', createdAt: '2026-10-22T10:00:00.000Z' },
      ],
    }
    await expect(gardenRepository.save(after)).resolves.toEqual(['meta', 'sightings'])
  })
})

describe('sightings in a backup', () => {
  it('round-trip a photo byte for byte, written as text in the file', async () => {
    const garden = withSightings()
    const file = JSON.stringify({
      format: 'the-butterfly-garden',
      exportedAt: '2026-10-27T09:00:00.000Z',
      garden: await withPhotosAsText(garden),
    })
    // In the file, a photo is its type and its base64, as a personal image is.
    const written = (JSON.parse(file) as { garden: { sightings: Array<Record<string, unknown>> } })
      .garden.sightings[0].photo
    expect(written).toEqual({
      mimeType: 'image/webp',
      imageData: btoa(String.fromCharCode(...BYTES)),
    })

    const restored = readImportedState(JSON.parse(file))
    expect(restored?.sightings).toHaveLength(2)
    expect(await bytesOf(restored?.sightings[0].photo)).toEqual(BYTES)

    await gardenRepository.replace(restored!)
    const reopened = await gardenRepository.load()
    expect(reopened.status).toBe('loaded')
    expect(await bytesOf(reopened.state.sightings[0].photo)).toEqual(BYTES)
    expect(reopened.state.sightings[1]).toEqual(garden.sightings[1])
  })

  it('carries photos in safe mode’s copy of everything stored, which restores too', async () => {
    await gardenRepository.save(withSightings())
    const raw = await gardenRepository.readRaw()
    const text = JSON.stringify(await withPhotosAsText(raw))
    const parsed = JSON.parse(text) as { format: string }
    expect(parsed.format).toBe(RAW_EXPORT_FORMAT)
    const restored = readImportedState(parsed)
    expect(await bytesOf(restored?.sightings[0].photo)).toEqual(BYTES)
  })

  it('restores a backup from 3.1, before the field book, with an empty one', () => {
    const older: Record<string, unknown> = { ...createInitialState('Tester', 'Older'), version: 6 }
    delete older.sightings
    const restored = readImportedState({ format: 'the-butterfly-garden', appVersion: '3.1.0', garden: older })
    expect(restored?.sightings).toEqual([])
    expect(restored?.version).toBe(8)
  })
})
