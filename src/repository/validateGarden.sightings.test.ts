import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_SIGHTING_PHOTOS, MAX_SIGHTINGS } from '../lib/customBackdrops'
import { createInitialState } from '../lib/progression'
import { CURRENT_STATE_VERSION, validateGarden } from './validateGarden'

/*
 * The field book's sightings as a stored garden or a backup holds them:
 * defaulted when a garden predates them, kept when sound, the same list when
 * nothing needed changing, and dropped or refused as the rules say.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-27T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

const photo = (bytes: number[] = [82, 73, 70, 70], type = 'image/webp') =>
  new Blob([new Uint8Array(bytes)], { type })

function sighting(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sighting-1',
    date: '2026-10-20',
    kind: 'butterfly',
    speciesId: 'monarch',
    note: 'Two of them, over the allotments.',
    createdAt: '2026-10-20T15:00:00.000Z',
    ...extra,
  }
}

function garden(sightings: unknown) {
  return { ...createInitialState('Tester', 'Wild Garden'), sightings }
}

describe('a garden’s field book', () => {
  it('is empty in a garden from before it, and the garden is stored at version 8', () => {
    const older: Record<string, unknown> = { ...createInitialState('Tester', 'Older'), version: 7 }
    delete older.sightings
    const result = validateGarden(older)
    expect(result.state?.sightings).toEqual([])
    expect(result.state?.version).toBe(8)
    expect(CURRENT_STATE_VERSION).toBe(8)
    expect(result.repaired).toBe(0)
  })

  it('keeps a sound field book as the very same list, and each sighting as it was', () => {
    const stored = [
      sighting(),
      sighting({ id: 'sighting-2', kind: 'plant', plantId: 'violet', speciesId: undefined, note: undefined }),
      sighting({ id: 'sighting-3', photo: photo() }),
    ].map((item) => JSON.parse(JSON.stringify(item)) as Record<string, unknown>)
    // The photo does not survive JSON; put the Blob back as storage holds it.
    stored[2].photo = photo()
    const result = validateGarden(garden(stored))
    expect(result.state?.sightings).toBe(stored)
    expect(result.repaired).toBe(0)
  })

  it('drops a sighting of a butterfly or plant the catalogue does not know', () => {
    const result = validateGarden(
      garden([
        sighting({ id: 'a', speciesId: 'dragon' }),
        sighting({ id: 'b', kind: 'plant', plantId: 'beanstalk' }),
        sighting({ id: 'c', kind: 'plant' }),
        sighting({ id: 'd', kind: 'moth' }),
        sighting({ id: 'e' }),
        'not a sighting',
      ]),
    )
    expect(result.state?.sightings.map((item) => item.id)).toEqual(['e'])
    expect(result.repaired).toBe(5)
  })

  it('keeps one dated ahead of this device’s clock, as a check-in is kept, and drops one on no real day', () => {
    // A clock set back (a phone flat for a while) must not lose what was
    // seen since: only a sighting being written down is held to today.
    const ahead = [
      sighting({ id: 'tomorrow', date: '2026-10-28' }),
      sighting({ id: 'later', date: '2026-10-29', photo: photo() }),
      sighting({ id: 'far', date: '3026-01-01' }),
    ]
    const result = validateGarden(
      garden([
        ...ahead,
        sighting({ id: 'nonsense', date: '2026-02-30' }),
        sighting({ id: 'missing', date: undefined }),
      ]),
    )
    expect(result.state?.sightings).toEqual(ahead)
    expect(result.state?.sightings[1].photo).toBe(ahead[1].photo)
    expect(result.repaired).toBe(2)
  })

  it('keeps a sighting whose photo a file left out as unreadable, without it, and counts it', () => {
    const result = validateGarden(
      garden([
        sighting({ id: 'a', photo: { mimeType: 'image/webp', unreadable: true } }),
        sighting({ id: 'b', photo: photo() }),
      ]),
    )
    const [a, b] = result.state!.sightings
    expect(a).toEqual(sighting({ id: 'a' }))
    expect(a).not.toHaveProperty('photo')
    expect(b.photo).toBeInstanceOf(Blob)
    expect(result.repaired).toBe(1)
    // Only that mark: a photo that says nothing of itself is still damage.
    expect(validateGarden(garden([sighting({ photo: { unreadable: 'yes' } })])).refused).toBe(
      'One of its photos is damaged.',
    )
  })

  it('repairs a missing or repeated id and a missing time, keeping the sighting', () => {
    const result = validateGarden(
      garden([
        sighting({ id: 'same' }),
        sighting({ id: 'same', speciesId: 'queen' }),
        sighting({ id: undefined, speciesId: 'viceroy', createdAt: 5 }),
      ]),
    )
    const kept = result.state!.sightings
    expect(kept).toHaveLength(3)
    expect(new Set(kept.map((item) => item.id)).size).toBe(3)
    expect(kept[0].id).toBe('same')
    expect(kept[2]).toMatchObject({ speciesId: 'viceroy', createdAt: new Date(0).toISOString() })
    expect(result.repaired).toBe(2)
  })

  it('keeps words as words, and leaves out a blank note', () => {
    const result = validateGarden(
      garden([sighting({ id: 'a', note: 42 }), sighting({ id: 'b', note: '   ' })]),
    )
    const [a, b] = result.state!.sightings
    expect(a.note).toBe('42')
    expect(b).not.toHaveProperty('note')
  })

  it('turns a backup’s photo, written as text, back into the same bytes', async () => {
    const bytes = [82, 73, 70, 70, 1, 2, 3, 250]
    const result = validateGarden(
      garden([
        sighting({ photo: { mimeType: 'image/webp', imageData: btoa(String.fromCharCode(...bytes)) } }),
      ]),
    )
    const kept = result.state!.sightings[0]
    expect(kept.photo).toBeInstanceOf(Blob)
    expect(kept.photo?.type).toBe('image/webp')
    expect([...new Uint8Array(await kept.photo!.arrayBuffer())]).toEqual(bytes)
    // Reading a file's photo is no repair.
    expect(result.repaired).toBe(0)
  })

  it('refuses the whole garden for a damaged photo, rather than drop it', () => {
    for (const broken of [
      { mimeType: 'image/gif', imageData: btoa('GIF89a') },
      { mimeType: 'image/png', imageData: 'not base64!' },
      { mimeType: 'image/png', imageData: btoa('x'.repeat(400 * 1024 + 1)) },
      photo([1], 'image/gif'),
      photo([]),
      {},
      'a photo',
    ]) {
      const result = validateGarden(garden([sighting({ photo: broken })]))
      expect(result.state).toBeUndefined()
      expect(result.refused).toBe('One of its photos is damaged.')
    }
  })

  it('refuses a field book that is not a list, or holds more than this build keeps', () => {
    expect(validateGarden(garden('not a list')).refused).toBe('Its field book is damaged.')
    const tooMany = Array.from({ length: MAX_SIGHTINGS + 1 }, (_, index) => sighting({ id: `s-${index}` }))
    expect(validateGarden(garden(tooMany)).refused).toMatch(/more than this version can keep/)
    const tooManyPhotos = Array.from({ length: MAX_SIGHTING_PHOTOS + 1 }, (_, index) =>
      sighting({ id: `p-${index}`, photo: photo() }),
    )
    expect(validateGarden(garden(tooManyPhotos)).refused).toMatch(/more than this version can keep/)
    // Exactly at the limits is fine.
    expect(validateGarden(garden(tooManyPhotos.slice(1))).state?.sightings).toHaveLength(MAX_SIGHTING_PHOTOS)
  })
})
