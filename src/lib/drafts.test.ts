import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gardenRepository } from '../repository/gardenRepository'
import {
  clearDraft,
  flushDrafts,
  getDraft,
  loadDrafts,
  resetDrafts,
  useDraft,
} from './drafts'

afterEach(() => {
  resetDrafts()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('drafts', () => {
  it('keeps unsaved words and writes them once typing pauses', () => {
    const write = vi
      .spyOn(gardenRepository, 'writeDrafts')
      .mockResolvedValue()
    const { result } = renderHook(() => useDraft('reflection:2026-10-26', ''))

    act(() => result.current[1]('Half a thought'))
    expect(result.current[0]).toBe('Half a thought')
    expect(getDraft('reflection:2026-10-26')).toBe('Half a thought')

    void flushDrafts()
    expect(write).toHaveBeenCalledWith({ 'reflection:2026-10-26': 'Half a thought' })
  })

  it('lets a reload wait until the pending draft is written', async () => {
    let written: () => void = () => undefined
    const write = vi.spyOn(gardenRepository, 'writeDrafts').mockReturnValue(
      new Promise<void>((resolve) => {
        written = resolve
      }),
    )
    const { result } = renderHook(() => useDraft('reflection:2026-10-26', ''))
    act(() => result.current[1]('Nearly there'))
    let settled = false
    const flushed = flushDrafts().then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    written()
    await flushed
    expect(settled).toBe(true)
    // Nothing waiting: settles at once, writing nothing.
    await expect(flushDrafts()).resolves.toBeUndefined()
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('follows the saved entry while nothing has been typed', () => {
    const { result, rerender } = renderHook(
      ({ saved }) => useDraft('mood-note:2026-10-26', saved),
      { initialProps: { saved: 'First' } },
    )
    expect(result.current[0]).toBe('First')
    rerender({ saved: 'Edited in the journal' })
    expect(result.current[0]).toBe('Edited in the journal')
  })

  it('keeps what is being typed when the saved entry changes underneath', () => {
    const { result, rerender } = renderHook(
      ({ saved }) => useDraft('mood-note:2026-10-26', saved),
      { initialProps: { saved: 'First' } },
    )
    act(() => result.current[1]('Typing…'))
    rerender({ saved: 'Edited elsewhere' })
    expect(result.current[0]).toBe('Typing…')
  })

  it('lets go of a draft once its entry is saved', () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue()
    const { result } = renderHook(() => useDraft('reflection:2026-10-26', ''))
    act(() => result.current[1]('Done'))
    act(() => clearDraft('reflection:2026-10-26'))
    expect(getDraft('reflection:2026-10-26')).toBeUndefined()
    expect(result.current[0]).toBe('')
  })

  it('forgets, on loading, what a day long past left behind, and keeps the rest', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: new Date(2026, 9, 27, 10) })
    vi.spyOn(gardenRepository, 'readDrafts').mockResolvedValue({
      'next-step:2026-10-01': 'seen',
      'recap:2026-10-19:wentWell': 'Old words',
      'recap:2026-10-20:wentWell': 'A week ago',
      'reflection:2026-10-27': 'Today',
      'earlier-entry:date': '2026-09-02',
      'night-until': '1793152800000',
    })
    const write = vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue()
    await loadDrafts()
    expect(getDraft('next-step:2026-10-01')).toBeUndefined()
    expect(getDraft('recap:2026-10-19:wentWell')).toBeUndefined()
    expect(getDraft('recap:2026-10-20:wentWell')).toBe('A week ago')
    expect(getDraft('reflection:2026-10-27')).toBe('Today')
    // Only a key that names its day ages; a day held as a value does not.
    expect(getDraft('earlier-entry:date')).toBe('2026-09-02')
    expect(getDraft('night-until')).toBe('1793152800000')
    // The smaller record is written back once.
    vi.runAllTimers()
    expect(write).toHaveBeenCalledTimes(1)
    expect(Object.keys(write.mock.calls[0][0])).toHaveLength(4)
  })

  it('writes nothing back when nothing has aged', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], now: new Date(2026, 9, 27, 10) })
    vi.spyOn(gardenRepository, 'readDrafts').mockResolvedValue({ 'reflection:2026-10-27': 'Today' })
    const write = vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue()
    await loadDrafts()
    vi.runAllTimers()
    expect(write).not.toHaveBeenCalled()
  })
})
