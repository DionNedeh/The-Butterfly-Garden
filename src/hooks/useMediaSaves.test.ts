import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { CustomBackdrop } from '../types'
import { useMediaSaves } from './useMediaSaves'

const record = (id: string) => ({ id }) as CustomBackdrop
const gardenWith = (...images: CustomBackdrop[]) => ({
  ...createInitialState('Tester', 'Garden'),
  customBackdrops: images,
})

describe('image saves waiting on a write', () => {
  it('answers only the saves whose images were in the write', async () => {
    const { result } = renderHook(() => useMediaSaves())
    const mine = record('mine')
    const other = record('other')
    const saved = result.current.waitFor(mine, () => undefined)
    const pending = result.current.waitFor(other, () => undefined)

    result.current.settleWritten(gardenWith(mine))
    expect(await saved).toEqual({ ok: true })
    expect(result.current.waiting()).toBe(true)

    // A failure elsewhere does not touch it either.
    expect(result.current.failWritten(gardenWith(), 'full')).toEqual([])
    expect(result.current.failWritten(gardenWith(other), 'Storage is full')).toEqual([other])
    expect(await pending).toEqual({ ok: false, message: 'Storage is full' })
    expect(result.current.waiting()).toBe(false)
  })

  it('settles each save once, whatever answers it first', async () => {
    const { result } = renderHook(() => useMediaSaves())
    const image = record('scene')
    let notCarried!: () => void
    const saved = result.current.waitFor(image, (report) => {
      notCarried = report
    })
    result.current.settleWritten(gardenWith(image))
    notCarried()
    await Promise.resolve()
    expect(await saved).toEqual({ ok: true })
  })

  it('waits for a sighting’s photo as for an image, by the very Blob a sighting carries', async () => {
    const { result } = renderHook(() => useMediaSaves())
    const photo = new Blob([new Uint8Array([1])], { type: 'image/webp' })
    const garden = createInitialState('Tester', 'Garden')
    const withPhoto = {
      ...garden,
      sightings: [{ id: 's', date: '2026-10-20', kind: 'butterfly' as const, speciesId: 'monarch', photo, createdAt: '' }],
    }
    const failing = result.current.waitFor(photo, () => undefined)
    result.current.settleWritten(garden)
    expect(result.current.waiting()).toBe(true)
    expect(result.current.failWritten(withPhoto, 'Storage is full')).toEqual([photo])
    expect(await failing).toEqual({ ok: false, message: 'Storage is full' })

    const saved = result.current.waitFor(photo, () => undefined)
    result.current.settleWritten(withPhoto)
    expect(await saved).toEqual({ ok: true })
  })

  it('answers whatever is still waiting when it goes away', async () => {
    const { result, unmount } = renderHook(() => useMediaSaves())
    const saved = result.current.waitFor(record('left'), () => undefined)
    unmount()
    expect(await saved).toEqual({ ok: false, message: 'Image saving was interrupted.' })
  })
})
