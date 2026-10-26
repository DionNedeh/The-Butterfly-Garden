import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gardenRepository } from '../repository/gardenRepository'
import { clearDraft, flushDrafts, getDraft, resetDrafts, useDraft } from './drafts'

afterEach(() => {
  resetDrafts()
  vi.restoreAllMocks()
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

    flushDrafts()
    expect(write).toHaveBeenCalledWith({ 'reflection:2026-10-26': 'Half a thought' })
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
})
