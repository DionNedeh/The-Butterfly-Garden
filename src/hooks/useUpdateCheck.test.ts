import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateCheck } from './useUpdateCheck'

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

function registration(update = vi.fn(() => Promise.resolve())) {
  return {
    registration: { installing: null, update } as unknown as ServiceWorkerRegistration,
    update,
  }
}

/** Show or hide the page, telling whoever listens, as a browser does. */
function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  Reflect.deleteProperty(document, 'visibilityState')
  Reflect.deleteProperty(navigator, 'onLine')
})

describe('looking for an update while the garden is open', () => {
  it('asks every hour while the garden is seen', () => {
    const { registration: found, update } = registration()
    renderHook(() => useUpdateCheck(found))
    vi.advanceTimersByTime(HOUR - MINUTE)
    expect(update).not.toHaveBeenCalled()
    vi.advanceTimersByTime(MINUTE)
    expect(update).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(HOUR)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('asks nothing while hidden, and asks at once when seen again after an hour', () => {
    const { registration: found, update } = registration()
    renderHook(() => useUpdateCheck(found))
    setVisibility('hidden')
    vi.advanceTimersByTime(3 * HOUR)
    expect(update).not.toHaveBeenCalled()
    setVisibility('visible')
    expect(update).toHaveBeenCalledOnce()
    // Seen again soon after: the last look is still fresh.
    setVisibility('hidden')
    vi.advanceTimersByTime(10 * MINUTE)
    setVisibility('visible')
    expect(update).toHaveBeenCalledOnce()
  })

  it('asks nothing when seen again within the hour', () => {
    const { registration: found, update } = registration()
    renderHook(() => useUpdateCheck(found))
    setVisibility('hidden')
    vi.advanceTimersByTime(30 * MINUTE)
    setVisibility('visible')
    expect(update).not.toHaveBeenCalled()
  })

  it('waits while offline, or while an update is already arriving', () => {
    const { registration: found, update } = registration()
    renderHook(() => useUpdateCheck(found))
    setOnline(false)
    vi.advanceTimersByTime(HOUR)
    expect(update).not.toHaveBeenCalled()
    setOnline(true)
    Object.assign(found, { installing: {} })
    vi.advanceTimersByTime(HOUR)
    expect(update).not.toHaveBeenCalled()
    Object.assign(found, { installing: null })
    vi.advanceTimersByTime(HOUR)
    expect(update).toHaveBeenCalledOnce()
  })

  it('lets a failed look pass quietly and tries again the next hour', async () => {
    const update = vi.fn(() => Promise.reject(new Error('Failed to fetch')))
    const { registration: found } = registration(update)
    renderHook(() => useUpdateCheck(found))
    await vi.advanceTimersByTimeAsync(HOUR)
    await vi.advanceTimersByTimeAsync(HOUR)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('does nothing before the service worker is registered, or once closed', () => {
    const { registration: found, update } = registration()
    const { rerender, unmount } = renderHook(
      ({ current }: { current?: ServiceWorkerRegistration }) => useUpdateCheck(current),
      { initialProps: {} },
    )
    vi.advanceTimersByTime(2 * HOUR)
    rerender({ current: found })
    vi.advanceTimersByTime(HOUR)
    expect(update).toHaveBeenCalledOnce()
    unmount()
    vi.advanceTimersByTime(2 * HOUR)
    setVisibility('visible')
    expect(update).toHaveBeenCalledOnce()
  })

  it('never looks in the Android app, which Google Play updates', () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { registration: found, update } = registration()
    renderHook(() => useUpdateCheck(found))
    vi.advanceTimersByTime(3 * HOUR)
    setVisibility('visible')
    expect(update).not.toHaveBeenCalled()
  })
})
