import { describe, expect, it, vi } from 'vitest'
import type { AppState, Sighting } from '../types'
import { MAX_SIGHTING_PHOTOS, MAX_SIGHTINGS, photosIn } from './customBackdrops'
import { createInitialState } from './progression'
import {
  deleteSighting,
  editSighting,
  fieldBookActions,
  logSighting,
  newestFirst,
  restoreSighting,
  seenInTheWild,
  SIGHTING_NOTE_LENGTH,
  sightingProblem,
  subjectKey,
  subjectName,
  type ChangeSightings,
  type SightingInput,
} from './sightings'

const NOW = new Date('2026-10-27T12:00:00')
const TODAY = '2026-10-27'

const photo = (bytes = 10, type = 'image/webp') => new Blob([new Uint8Array(bytes)], { type })

const monarch: SightingInput = {
  kind: 'butterfly',
  speciesId: 'monarch',
  date: '2026-10-26',
  note: '  On the milkweed by the gate.  ',
}
const milkweed: SightingInput = { kind: 'plant', plantId: 'milkweed', date: TODAY, note: '' }

function sighting(id: string, extra: Partial<Sighting> = {}): Sighting {
  return {
    id,
    date: '2026-10-01',
    kind: 'butterfly',
    speciesId: 'monarch',
    createdAt: '2026-10-01T09:00:00.000Z',
    ...extra,
  } as Sighting
}

describe('writing a sighting down', () => {
  it('keeps what was seen, the day, a trimmed note and a photo, as of now', () => {
    const picture = photo()
    const logged = logSighting([], { ...monarch, photo: picture }, NOW, 's-1')
    expect(logged).toEqual([
      {
        id: 's-1',
        date: '2026-10-26',
        kind: 'butterfly',
        speciesId: 'monarch',
        note: 'On the milkweed by the gate.',
        photo: picture,
        createdAt: NOW.toISOString(),
      },
    ])
    // A plant, with no note and no photo, stores neither.
    const plant = logSighting(logged, milkweed, NOW, 's-2')
    expect(plant[1]).toEqual({
      id: 's-2',
      date: TODAY,
      kind: 'plant',
      plantId: 'milkweed',
      createdAt: NOW.toISOString(),
    })
    expect(plant[0]).toBe(logged[0])
  })

  it('cuts a long note to a few words’ length', () => {
    const [kept] = logSighting([], { ...monarch, note: 'x'.repeat(SIGHTING_NOTE_LENGTH + 20) }, NOW)
    expect(kept.note).toHaveLength(SIGHTING_NOTE_LENGTH)
  })

  it('refuses a butterfly or plant the field guide does not know, changing nothing', () => {
    const before: Sighting[] = []
    expect(logSighting(before, { ...monarch, speciesId: 'dragon' }, NOW)).toBe(before)
    expect(logSighting(before, { ...milkweed, plantId: 'beanstalk' }, NOW)).toBe(before)
    expect(sightingProblem(before, { ...monarch, speciesId: 'dragon' }, TODAY)).toMatch(/Choose a butterfly/)
  })

  it('refuses a day still to come, or one that is not a day', () => {
    const before: Sighting[] = []
    expect(logSighting(before, { ...monarch, date: '2026-10-28' }, NOW)).toBe(before)
    expect(logSighting(before, { ...monarch, date: '27/10/2026' }, NOW)).toBe(before)
    expect(sightingProblem(before, { ...monarch, date: '2026-10-28' }, TODAY)).toMatch(/today or an earlier day/)
    expect(sightingProblem(before, { ...monarch, date: '' }, TODAY)).toMatch(/the day you saw it/)
    // Today itself is fine.
    expect(logSighting(before, { ...monarch, date: TODAY }, NOW)).toHaveLength(1)
  })

  it('refuses a photo that is not one it can keep', () => {
    const before: Sighting[] = []
    for (const bad of [photo(10, 'image/gif'), photo(0), photo(400 * 1024 + 1)]) {
      expect(logSighting(before, { ...monarch, photo: bad }, NOW)).toBe(before)
      expect(sightingProblem(before, { ...monarch, photo: bad }, TODAY)).toMatch(/photo could not be kept/)
    }
  })

  it('stops at a full field book, and says so', () => {
    const full = Array.from({ length: MAX_SIGHTINGS }, (_, index) => sighting(`s-${index}`))
    expect(logSighting(full, monarch, NOW)).toBe(full)
    expect(sightingProblem(full, monarch, TODAY)).toMatch(/full: it keeps 2,000 sightings/)
  })

  it('keeps at most 50 photos, though a sighting without one still fits', () => {
    const photos = Array.from({ length: MAX_SIGHTING_PHOTOS }, (_, index) =>
      sighting(`p-${index}`, { photo: photo() }),
    )
    expect(logSighting(photos, { ...monarch, photo: photo() }, NOW)).toBe(photos)
    expect(sightingProblem(photos, { ...monarch, photo: photo() }, TODAY)).toMatch(/already keeps 50 photos/)
    expect(logSighting(photos, monarch, NOW)).toHaveLength(MAX_SIGHTING_PHOTOS + 1)
  })

  it('never uses an id twice', () => {
    const before = [sighting('s-1')]
    expect(logSighting(before, monarch, NOW, 's-1')).toBe(before)
  })
})

describe('changing a sighting', () => {
  const before = [sighting('a'), sighting('b', { note: 'Two of them.' }), sighting('c')]

  it('keeps its place and when it was first written', () => {
    const after = editSighting(before, 'b', { ...milkweed, date: '2026-10-20', note: 'A patch' }, NOW)
    expect(after[1]).toEqual({
      id: 'b',
      date: '2026-10-20',
      kind: 'plant',
      plantId: 'milkweed',
      note: 'A patch',
      createdAt: '2026-10-01T09:00:00.000Z',
    })
    expect(after[0]).toBe(before[0])
    expect(after[2]).toBe(before[2])
  })

  it('hands back the same list when nothing changed, or nothing can', () => {
    const same: SightingInput = { kind: 'butterfly', speciesId: 'monarch', date: '2026-10-01', note: 'Two of them.' }
    expect(editSighting(before, 'b', same, NOW)).toBe(before)
    expect(editSighting(before, 'gone', same, NOW)).toBe(before)
    expect(editSighting(before, 'b', { ...same, date: '2027-01-01' }, NOW)).toBe(before)
    expect(sightingProblem(before, same, TODAY, 'gone')).toMatch(/no longer in your field book/)
  })

  it('lets a photo be replaced at the photo limit, but not added', () => {
    const full = Array.from({ length: MAX_SIGHTING_PHOTOS }, (_, index) =>
      sighting(`p-${index}`, { photo: photo() }),
    )
    const withOneMore = [...full, sighting('bare')]
    const replacement = photo(20)
    const input: SightingInput = { kind: 'butterfly', speciesId: 'monarch', date: '2026-10-01', note: '', photo: replacement }
    expect(editSighting(withOneMore, 'p-0', input, NOW)[0].photo).toBe(replacement)
    expect(editSighting(withOneMore, 'bare', input, NOW)).toBe(withOneMore)
  })

  it('takes a photo away', () => {
    const withPhoto = [sighting('a', { photo: photo() })]
    const after = editSighting(withPhoto, 'a', { kind: 'butterfly', speciesId: 'monarch', date: '2026-10-01', note: '' }, NOW)
    expect(after[0]).not.toHaveProperty('photo')
    expect(photosIn(after).count).toBe(0)
  })
})

describe('crossing a sighting out, and Undo', () => {
  const before = [sighting('a'), sighting('b'), sighting('c')]

  it('removes it, and puts it back where it was', () => {
    const after = deleteSighting(before, 'b')
    expect(after.map((item) => item.id)).toEqual(['a', 'c'])
    expect(deleteSighting(after, 'b')).toBe(after)
    const back = restoreSighting(after, { sighting: before[1], index: 1 })
    expect(back.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(back[1]).toBe(before[1])
    // Already back: nothing to do. An index past the end puts it last.
    expect(restoreSighting(back, { sighting: before[1], index: 1 })).toBe(back)
    expect(restoreSighting(after, { sighting: before[1], index: 99 }).at(-1)).toBe(before[1])
  })

  it('does not put one back into a field book that filled up meanwhile', () => {
    const full = Array.from({ length: MAX_SIGHTINGS }, (_, index) => sighting(`s-${index}`))
    expect(restoreSighting(full, { sighting: sighting('x'), index: 0 })).toBe(full)
    const photos = Array.from({ length: MAX_SIGHTING_PHOTOS }, (_, index) =>
      sighting(`p-${index}`, { photo: photo() }),
    )
    expect(restoreSighting(photos, { sighting: sighting('x', { photo: photo() }), index: 0 })).toBe(photos)
  })
})

describe('the field book’s actions on a garden', () => {
  /** The garden's own way of changing sightings, as useGardenState applies it. */
  function gardenWith(sightings: Sighting[] = []) {
    let garden: AppState = { ...createInitialState('Tester', 'Wild Garden', NOW), sightings }
    const change: ChangeSightings = (recipe) => {
      const next = recipe(garden.sightings, NOW)
      if (next === garden.sightings) return false
      garden = { ...garden, sightings: next }
      return true
    }
    return { actions: fieldBookActions(change), current: () => garden }
  }

  it('logs, edits, crosses out and puts back, earning nothing', () => {
    const { actions, current } = gardenWith()
    const before = current()
    const id = actions.log(monarch)
    expect(id).toBeTruthy()
    expect(current().sightings).toHaveLength(1)
    expect(actions.edit(id!, { ...monarch, note: 'Three of them.' })).toBe(true)
    expect(current().sightings[0].note).toBe('Three of them.')
    const removed = actions.remove(id!)
    expect(removed?.index).toBe(0)
    expect(current().sightings).toEqual([])
    expect(actions.remove(id!)).toBeUndefined()
    expect(actions.restore(removed!)).toBe(true)
    expect(current().sightings).toHaveLength(1)
    // Noticing is its own reward: nothing earned, nothing grown.
    const after = current()
    expect(after.sunlight).toBe(before.sunlight)
    expect(after.nectar).toBe(before.nectar)
    expect(after.stardust).toBe(before.stardust)
    expect(after.plants).toBe(before.plants)
    expect(after.creatures).toBe(before.creatures)
  })

  it('says when the garden refused', () => {
    const { actions } = gardenWith()
    expect(actions.log({ ...monarch, date: '2030-01-01' })).toBeUndefined()
    expect(actions.edit('none', monarch)).toBe(false)
  })

  it('asks the garden whether a new photo was stored, and takes it as kept where the garden cannot say', async () => {
    const { actions } = gardenWith()
    await expect(actions.photoSaved(photo())).resolves.toBe(true)
    const change: ChangeSightings = () => true
    change.photoSaved = vi.fn(() => Promise.resolve({ ok: false, message: 'Full.' }))
    const kept = photo()
    await expect(fieldBookActions(change).photoSaved(kept)).resolves.toBe(false)
    expect(change.photoSaved).toHaveBeenCalledWith(kept)
  })
})

describe('what has been seen', () => {
  it('names each butterfly and plant as the field guide does', () => {
    expect(subjectName({ kind: 'butterfly', speciesId: 'painted-lady' })).toBe('Painted Lady')
    expect(subjectName({ kind: 'plant', plantId: 'milkweed' })).toBe('Milkweed')
    expect(subjectName({ kind: 'plant', plantId: 'nothing' })).toBeUndefined()
    expect(subjectKey({ kind: 'plant', plantId: 'milkweed' })).toBe('plant:milkweed')
    expect(subjectKey({ kind: 'butterfly', speciesId: 'monarch' })).toBe('butterfly:monarch')
  })

  it('gives each the latest day it was seen, and how often', () => {
    const seen = seenInTheWild([
      sighting('a', { date: '2026-09-01' }),
      sighting('b', { date: '2026-10-03' }),
      sighting('c', { date: '2026-08-15' }),
      { id: 'd', kind: 'plant', plantId: 'violet', date: '2026-04-02', createdAt: '' },
    ])
    expect(seen.get('butterfly:monarch')).toEqual({ latest: '2026-10-03', count: 3 })
    expect(seen.get('plant:violet')).toEqual({ latest: '2026-04-02', count: 1 })
    expect(seen.has('butterfly:queen')).toBe(false)
  })

  it('lists the book newest first, by day and then by when written', () => {
    const order = newestFirst([
      sighting('old', { date: '2026-09-01' }),
      sighting('later-same-day', { date: '2026-10-03', createdAt: '2026-10-03T18:00:00.000Z' }),
      sighting('earlier-same-day', { date: '2026-10-03', createdAt: '2026-10-03T08:00:00.000Z' }),
    ])
    expect(order.map((item) => item.id)).toEqual(['later-same-day', 'earlier-same-day', 'old'])
  })
})
