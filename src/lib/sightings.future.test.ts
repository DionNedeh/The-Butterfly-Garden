import { describe, expect, it, vi } from 'vitest'
import type { Sighting } from '../types'
import {
  editSighting,
  fieldBookActions,
  logSighting,
  PHOTO_NOT_KEPT,
  photoNotSaved,
  SIGHTING_NOT_SAVED,
  sightingProblem,
  type ChangeSightings,
} from './sightings'

const TODAY = '2026-10-27'
/** A sighting written down while the device's clock ran a few days ahead. */
const ahead: Sighting = {
  id: 'ahead',
  date: '2026-11-02',
  kind: 'butterfly',
  speciesId: 'monarch',
  note: 'By the gate',
  createdAt: '2026-11-02T09:00:00.000Z',
}
const monarch = { kind: 'butterfly' as const, speciesId: 'monarch' }

describe('6.10 a sighting dated ahead of the clock', () => {
  it('can have its note changed, keeping its own day', () => {
    const input = { ...monarch, date: ahead.date, note: 'By the gate, two of them' }
    expect(sightingProblem([ahead], input, TODAY, ahead.id)).toBeUndefined()
    const [changed] = editSighting([ahead], ahead.id, input, new Date(`${TODAY}T12:00:00`))
    expect(changed).toEqual({ ...ahead, note: 'By the gate, two of them' })
  })

  it('still cannot be moved to another day after today', () => {
    const input = { ...monarch, date: '2026-11-03', note: 'By the gate' }
    expect(sightingProblem([ahead], input, TODAY, ahead.id)).toMatch(/^Choose today or an earlier day/)
    expect(editSighting([ahead], ahead.id, input, new Date(`${TODAY}T12:00:00`))).toEqual([ahead])
  })

  it('is not a day a new sighting can take, nor another sighting’s', () => {
    const input = { ...monarch, date: ahead.date, note: '' }
    expect(sightingProblem([ahead], input, TODAY)).toMatch(/^Choose today or an earlier day/)
    expect(logSighting([ahead], input, new Date(`${TODAY}T12:00:00`))).toEqual([ahead])
    const other: Sighting = { ...ahead, id: 'other', date: '2026-10-20' }
    expect(sightingProblem([ahead, other], input, TODAY, other.id)).toMatch(/^Choose today or an earlier day/)
  })
})

describe('6.10 a sighting lost to another tab’s change', () => {
  const photo = () => new Blob([new Uint8Array([1])], { type: 'image/webp' })

  it('is told apart from a photo that would not go in', async () => {
    const change: ChangeSightings = () => true
    change.photoSaved = vi.fn(() =>
      Promise.resolve({ ok: false, reason: 'conflict' as const, message: 'Changed elsewhere.' }),
    )
    await expect(fieldBookActions(change).photoSaved(photo())).resolves.toBe('conflict')
    change.photoSaved = vi.fn(() => Promise.resolve({ ok: false, message: 'Full.' }))
    await expect(fieldBookActions(change).photoSaved(photo())).resolves.toBe(false)
  })

  it('says the whole sighting was not saved, rather than only its photo', () => {
    expect(SIGHTING_NOT_SAVED).toBe('The garden changed in another tab, so this sighting was not saved.')
    expect(photoNotSaved('conflict')).toBe(SIGHTING_NOT_SAVED)
    expect(photoNotSaved(false)).toBe(PHOTO_NOT_KEPT)
  })
})
