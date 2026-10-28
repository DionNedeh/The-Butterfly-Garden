import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFadeOut } from './useFadeOut'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('the soundscape fade-out timer', () => {
  it('runs from the moment it is chosen while the sound plays, then turns the sound off', () => {
    const onEnd = vi.fn()
    const { result } = renderHook(() => useFadeOut(onEnd))
    expect(result.current.endsAt).toBeUndefined()

    act(() => result.current.choose(15, true))
    expect(result.current.minutes).toBe(15)
    expect(result.current.endsAt).toBe(Date.now() + 15 * 60_000)

    act(() => {
      vi.advanceTimersByTime(15 * 60_000)
    })
    expect(onEnd).toHaveBeenCalledOnce()
    expect(result.current.endsAt).toBeUndefined()
    // The choice is kept for the next time the sound starts.
    expect(result.current.minutes).toBe(15)
  })

  it('waits for the sound to start, and stops when the sound is turned off', () => {
    const onEnd = vi.fn()
    const { result } = renderHook(() => useFadeOut(onEnd))
    act(() => result.current.choose(30, false))
    expect(result.current.endsAt).toBeUndefined()

    act(() => result.current.soundSwitched(true))
    expect(result.current.endsAt).toBe(Date.now() + 30 * 60_000)
    act(() => result.current.soundSwitched(false))
    act(() => {
      vi.advanceTimersByTime(60 * 60_000)
    })
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('does nothing when no length is chosen', () => {
    const { result } = renderHook(() => useFadeOut(vi.fn()))
    act(() => result.current.soundSwitched(true))
    expect(result.current.endsAt).toBeUndefined()
    act(() => result.current.choose(undefined, true))
    expect(result.current.endsAt).toBeUndefined()
  })
})
