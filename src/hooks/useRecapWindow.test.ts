import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RECAP_HOURS, type RecapHours } from '../lib/date'
import { useRecapWindow } from './useRecapWindow'

// The suite runs in America/New_York (see vite.config.ts), so these are local
// wall-clock times there. 2026-10-27 is a Tuesday well clear of a clock change.
const at = (hour: number, minute = 0, second = 0) =>
  new Date(2026, 9, 27, hour, minute, second)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function renderWindow(hours: RecapHours = DEFAULT_RECAP_HOURS) {
  return renderHook(({ hours }) => useRecapWindow(hours), {
    initialProps: { hours },
  })
}

describe('the Moonlight window', () => {
  it('waits before the evening, and opens on the minute tick once it arrives', () => {
    vi.setSystemTime(at(17, 59, 30))
    const { result } = renderHook(() => useRecapWindow())
    expect(result.current).toEqual({ open: false, state: 'waiting' })

    // Six o'clock has passed, but nothing has looked at the clock since.
    act(() => {
      vi.advanceTimersByTime(31_000)
    })
    expect(result.current.open).toBe(false)

    act(() => {
      vi.advanceTimersByTime(29_000)
    })
    expect(result.current).toEqual({
      open: true,
      targetDate: '2026-10-27',
      state: 'evening',
    })
  })

  it('reads new hours at once instead of a minute later', () => {
    vi.setSystemTime(at(19, 30))
    const { result, rerender } = renderWindow({ opensHour: 21, graceEndsHour: 4 })
    expect(result.current.state).toBe('waiting')

    rerender({ hours: { opensHour: 19, graceEndsHour: 4 } })
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current).toEqual({
      open: true,
      targetDate: '2026-10-27',
      state: 'evening',
    })

    rerender({ hours: { opensHour: 22, graceEndsHour: 4 } })
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current).toEqual({ open: false, state: 'waiting' })
  })

  it('keeps offering the day before through a longer late night', () => {
    vi.setSystemTime(at(5))
    const { result, rerender } = renderWindow()
    expect(result.current.state).toBe('waiting')

    rerender({ hours: { opensHour: 18, graceEndsHour: 6 } })
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current).toEqual({
      open: true,
      targetDate: '2026-10-26',
      state: 'grace',
    })
  })

  it('looks again when the window regains focus', () => {
    vi.setSystemTime(at(17, 59, 50))
    const { result } = renderWindow()
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.open).toBe(false)

    // The clock moves on without a tick, as it does while a tab sleeps.
    vi.setSystemTime(at(18, 0, 5))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(result.current.state).toBe('evening')
  })

  it('looks again when the page is shown, but not when it is hidden', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get')
    vi.setSystemTime(at(17, 59, 50))
    const { result } = renderWindow()
    act(() => {
      vi.advanceTimersByTime(0)
    })
    vi.setSystemTime(at(18, 0, 5))

    visibility.mockReturnValue('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.open).toBe(false)

    visibility.mockReturnValue('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.state).toBe('evening')
    visibility.mockRestore()
  })

  it('keeps the same window from tick to tick until it actually moves', () => {
    vi.setSystemTime(at(23, 55))
    const { result } = renderWindow()
    const evening = result.current

    act(() => {
      vi.advanceTimersByTime(3 * 60_000)
    })
    // Equal is not enough: a fresh object every minute re-renders Today.
    expect(result.current).toBe(evening)

    act(() => {
      vi.advanceTimersByTime(2 * 60_000)
    })
    expect(result.current).not.toBe(evening)
    expect(result.current).toEqual({
      open: true,
      targetDate: '2026-10-27',
      state: 'grace',
    })
  })

  it('stops looking once it is unmounted', () => {
    vi.setSystemTime(at(17, 59))
    const { unmount } = renderWindow()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
