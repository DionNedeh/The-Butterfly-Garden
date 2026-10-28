import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { Profile } from '../types'
import { useEffectiveTheme } from './useEffectiveTheme'

const base = createInitialState('Tester', 'Theme Garden').profile!

/** A device whose dark setting the test can change, as matchMedia reports it. */
function stubDevice(dark: boolean) {
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(prefers-color-scheme: dark)' && dark
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  return {
    set(next: boolean) {
      dark = next
      act(() => listeners.forEach((listener) => listener()))
    },
    listening: () => listeners.size,
  }
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('the theme the shell draws', () => {
  it('is the hand-chosen theme, and sets no timer for it', () => {
    vi.setSystemTime(new Date(2026, 9, 27, 21))
    const { result, rerender } = renderHook(
      ({ profile }: { profile: Profile | undefined }) => useEffectiveTheme(profile),
      { initialProps: { profile: { ...base, theme: 'night' } } },
    )
    expect(result.current).toBe('night')
    expect(vi.getTimerCount()).toBe(0)
    rerender({ profile: undefined })
    expect(result.current).toBe('sunlight')
  })

  it('turns at the next evening and morning hours with one timer each time', () => {
    vi.setSystemTime(new Date(2026, 9, 27, 17, 58))
    const profile: Profile = { ...base, themeFollows: 'evening' }
    const { result } = renderHook(() => useEffectiveTheme(profile))
    expect(result.current).toBe('sunlight')
    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe('sunlight')
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe('night')
    // The next turn is waited for with one timer, not a tick.
    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(12 * 60 * 60_000)
    })
    expect(new Date().getHours()).toBe(6)
    expect(result.current).toBe('sunlight')
  })

  it('reads the clock again when the page is seen after the phone slept', () => {
    vi.setSystemTime(new Date(2026, 9, 27, 17, 0))
    const profile: Profile = { ...base, themeFollows: 'evening' }
    const { result } = renderHook(() => useEffectiveTheme(profile))
    expect(result.current).toBe('sunlight')

    // Asleep: the clock moves on, but the timer has not had its turn.
    setVisibility('hidden')
    vi.setSystemTime(new Date(2026, 9, 27, 20, 0))
    expect(result.current).toBe('sunlight')
    setVisibility('visible')
    expect(result.current).toBe('night')
  })

  it('follows the device as its dark setting changes', () => {
    const device = stubDevice(false)
    const profile: Profile = { ...base, theme: 'night', themeFollows: 'device' }
    const { result, unmount } = renderHook(() => useEffectiveTheme(profile))
    expect(result.current).toBe('sunlight')
    device.set(true)
    expect(result.current).toBe('night')
    device.set(false)
    expect(result.current).toBe('sunlight')
    expect(vi.getTimerCount()).toBe(0)
    unmount()
    expect(device.listening()).toBe(0)
  })

  it('stops its timer once the evening is no longer followed', () => {
    vi.setSystemTime(new Date(2026, 9, 27, 12))
    const { result, rerender } = renderHook(
      ({ profile }: { profile: Profile }) => useEffectiveTheme(profile),
      { initialProps: { profile: { ...base, themeFollows: 'evening' } } },
    )
    expect(vi.getTimerCount()).toBe(1)
    rerender({ profile: { ...base, theme: 'night' } })
    expect(vi.getTimerCount()).toBe(0)
    expect(result.current).toBe('night')
  })
})
