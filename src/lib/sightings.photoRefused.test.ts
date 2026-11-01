import { describe, expect, it, vi } from 'vitest'
import type { AppState, Sighting } from '../types'
import { createInitialState } from './progression'
import { fieldBookActions, type ChangeSightings, type SightingInput } from './sightings'

const refused = vi.hoisted(() => new WeakSet<Blob>())
vi.mock('./photoCheck', () => ({ isRefusedPhoto: (photo: Blob) => refused.has(photo) }))

const NOW = new Date('2026-10-27T12:00:00')
const photo = () => new Blob([new Uint8Array([1])], { type: 'image/webp' })
const monarch: SightingInput = { kind: 'butterfly', speciesId: 'monarch', date: '2026-10-26', note: 'By the gate.' }

/** The garden's own way of changing sightings, as useGardenState applies it. */
function gardenWith(sightings: Sighting[] = []) {
  let garden: AppState = { ...createInitialState('Tester', 'Wild Garden', NOW), sightings }
  const change: ChangeSightings = (recipe) => {
    const next = recipe(garden.sightings, NOW)
    if (next === garden.sightings) return false
    garden = { ...garden, sightings: next }
    return true
  }
  change.photoSaved = vi.fn(() => Promise.resolve({ ok: true }))
  return { change, actions: fieldBookActions(change), current: () => garden }
}

describe('5.2 a photo this browser refused never reaches the garden', () => {
  it('keeps the sighting without it, and says it was not kept', async () => {
    const { change, actions, current } = gardenWith()
    const taken = photo()
    refused.add(taken)
    const id = actions.log({ ...monarch, photo: taken })
    expect(id).toBeTruthy()
    expect(current().sightings).toEqual([expect.objectContaining({ id, speciesId: 'monarch', note: 'By the gate.' })])
    expect(current().sightings[0]).not.toHaveProperty('photo', expect.anything())
    await expect(actions.photoSaved(taken)).resolves.toBe(false)
    expect(change.photoSaved).not.toHaveBeenCalled()
  })

  it('keeps the photo a sighting had, and answers for a new one refused', async () => {
    const had = photo()
    const { actions, current } = gardenWith([
      { id: 'a', kind: 'butterfly', speciesId: 'monarch', date: '2026-10-26', photo: had, createdAt: NOW.toISOString() },
    ])
    const taken = photo()
    refused.add(taken)
    // The new photo the only change: still an answer to give, that it was not kept.
    expect(actions.edit('a', { ...monarch, note: '', photo: taken })).toBe(true)
    expect(current().sightings[0].photo).toBe(had)
    expect(actions.edit('a', { ...monarch, note: 'Two of them.', photo: taken })).toBe(true)
    expect(current().sightings[0]).toEqual(expect.objectContaining({ note: 'Two of them.', photo: had }))
    await expect(actions.photoSaved(taken)).resolves.toBe(false)
    // A sighting no longer there is no change, photo or not.
    expect(actions.edit('gone', { ...monarch, photo: taken })).toBe(false)
  })

  it('lets every other photo go in as before', async () => {
    const { change, actions, current } = gardenWith()
    const fine = photo()
    actions.log({ ...monarch, photo: fine })
    expect(current().sightings[0].photo).toBe(fine)
    await expect(actions.photoSaved(fine)).resolves.toBe(true)
    expect(change.photoSaved).toHaveBeenCalledWith(fine)
  })
})
