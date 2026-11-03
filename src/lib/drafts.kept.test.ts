import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { gardenRepository } from '../repository/gardenRepository'
import { useDraftKept } from './draftKept'
import { clearDraft, flushDrafts, loadDrafts, resetDrafts, setDraft } from './drafts'

/*
 * 6.2: whether a draft has reached storage, for the "Draft kept" hint. True
 * only once a write of exactly what is on screen has resolved as written, or
 * the draft was read from storage; never for a write that failed or that the
 * garden lock kept out.
 */
const KEY = 'reflection:2026-10-26'

/** A write the test settles: true once written, as the repository says it. */
function heldWrites() {
  const writes: Array<(written: true | void) => void> = []
  const spy = vi.spyOn(gardenRepository, 'writeDrafts').mockImplementation(
    () =>
      new Promise<true | void>((resolve) => {
        writes.push(resolve)
      }),
  )
  /** Settle a write, and let what follows from it happen. */
  const settle = (index: number, written: true | void) =>
    act(async () => {
      writes[index](written)
      await Promise.resolve()
    })
  return { spy, settle, resolve: (index: number, written: true | void) => writes[index](written) }
}

beforeEach(() => {
  vi.useFakeTimers()
  // The keys name 26 October, and drafts more than a week old are dropped,
  // so the clock is held on a day those keys are still kept.
  vi.setSystemTime(new Date(2026, 9, 27, 12))
})

afterEach(() => {
  resetDrafts()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('6.2 a draft kept', () => {
  it('is kept only once the write that holds it has resolved', async () => {
    const { spy, settle } = heldWrites()
    const { result } = renderHook(() => useDraftKept(KEY))
    act(() => setDraft(KEY, 'Half a thought'))
    expect(result.current).toBe(false)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(spy).toHaveBeenCalledWith({ [KEY]: 'Half a thought' })
    // Written, but not yet said to be.
    expect(result.current).toBe(false)
    await settle(0, true)
    expect(result.current).toBe(true)
  })

  it('is not kept when the write did not reach storage, as under a lock or on a failure', async () => {
    const { settle } = heldWrites()
    const { result } = renderHook(() => useDraftKept(KEY))
    act(() => setDraft(KEY, 'Kept out'))
    act(() => {
      vi.advanceTimersByTime(600)
    })
    await settle(0, undefined)
    expect(result.current).toBe(false)
  })

  it('is no longer kept once more is typed, until that is written too', async () => {
    const { settle } = heldWrites()
    const { result } = renderHook(() => useDraftKept(KEY))
    act(() => setDraft(KEY, 'First'))
    act(() => {
      vi.advanceTimersByTime(600)
    })
    await settle(0, true)
    expect(result.current).toBe(true)
    act(() => setDraft(KEY, 'First words'))
    expect(result.current).toBe(false)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    await settle(1, true)
    expect(result.current).toBe(true)
  })

  it('is kept by a write made now, as the page is hidden', async () => {
    const { resolve } = heldWrites()
    const { result } = renderHook(() => useDraftKept(KEY))
    act(() => setDraft(KEY, 'Quickly'))
    let flushed: Promise<void> = Promise.resolve()
    act(() => {
      flushed = flushDrafts()
    })
    await act(async () => {
      resolve(0, true)
      await flushed
    })
    expect(result.current).toBe(true)
  })

  it('goes with the draft, cleared once saved, and with every draft forgotten', async () => {
    const { settle } = heldWrites()
    const { result } = renderHook(() => useDraftKept(KEY))
    act(() => setDraft(KEY, 'Saved soon'))
    act(() => {
      vi.advanceTimersByTime(600)
    })
    await settle(0, true)
    expect(result.current).toBe(true)
    act(() => clearDraft(KEY))
    expect(result.current).toBe(false)

    // The clearing's own write is folded into this one, typing having resumed.
    act(() => setDraft(KEY, 'Again'))
    act(() => {
      vi.advanceTimersByTime(600)
    })
    await settle(1, true)
    expect(result.current).toBe(true)
    act(() => resetDrafts())
    expect(result.current).toBe(false)
  })

  it('is kept for a draft read back from storage, but not for words typed while it was read', async () => {
    vi.spyOn(gardenRepository, 'writeDrafts').mockResolvedValue(true)
    let read: (drafts: Record<string, string>) => void = () => undefined
    vi.spyOn(gardenRepository, 'readDrafts').mockReturnValue(
      new Promise((resolve) => {
        read = resolve
      }),
    )
    const stored = renderHook(() => useDraftKept(KEY))
    const typed = renderHook(() => useDraftKept('mood-note:2026-10-26'))
    let loading: Promise<void> = Promise.resolve()
    act(() => {
      loading = loadDrafts()
    })
    act(() => setDraft('mood-note:2026-10-26', 'Typed meanwhile'))
    await act(async () => {
      read({ [KEY]: 'From before the reload', 'mood-note:2026-10-26': 'Older' })
      await loading
    })
    expect(stored.result.current).toBe(true)
    expect(typed.result.current).toBe(false)
  })
})
