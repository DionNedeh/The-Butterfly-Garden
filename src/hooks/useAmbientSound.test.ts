import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FADE_OUT_SECONDS, useAmbientSound } from './useAmbientSound'

/**
 * A stand-in for the Web Audio API.
 *
 * The hook is the only place in the app that takes hold of an operating-system
 * resource, and a context it forgets to close stays open until the tab does.
 * Browsers cap how many a page may hold at once, so a leak here ends with the
 * garden silently losing its sound — which is exactly the kind of failure
 * nobody notices until a device has been open for a while.
 */
function audioParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
}

function audioNode() {
  return {
    gain: audioParam(),
    frequency: audioParam(),
    Q: audioParam(),
    delayTime: audioParam(),
    detune: audioParam(),
    type: 'sine',
    buffer: null as unknown,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

interface FakeContext {
  close: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  state: string
}

let contexts: FakeContext[] = []

function installAudio(onConstruct?: () => void) {
  class FakeAudioContext {
    sampleRate = 44_100
    currentTime = 0
    state = 'running'
    destination = {}
    close = vi.fn(() => Promise.resolve())
    resume = vi.fn(() => Promise.resolve())
    createGain = vi.fn(audioNode)
    createOscillator = vi.fn(audioNode)
    createDelay = vi.fn(audioNode)
    createBiquadFilter = vi.fn(audioNode)
    createBufferSource = vi.fn(audioNode)
    createBuffer = vi.fn(() => ({
      getChannelData: () => new Float32Array(1024),
    }))
    constructor() {
      onConstruct?.()
      contexts.push(this)
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
}

/** Run the delayed close that stopEngine schedules, without faking the clock. */
function runScheduled(spy: ReturnType<typeof vi.spyOn>, delay: number) {
  for (const call of spy.mock.calls) {
    if (call[1] === delay) (call[0] as () => void)()
  }
}

beforeEach(() => {
  contexts = []
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useAmbientSound', () => {
  it('opens no audio context while sound is off', () => {
    installAudio()
    renderHook(() => useAmbientSound(false, 'garden-chimes'))
    expect(contexts).toHaveLength(0)
  })

  it('opens one context when sound is switched on', () => {
    installAudio()
    renderHook(() => useAmbientSound(true, 'garden-chimes'))
    expect(contexts).toHaveLength(1)
  })

  it('closes the context and cancels its pending work when sound stops', () => {
    installAudio()
    const schedule = vi.spyOn(window, 'setTimeout')
    const cancel = vi.spyOn(window, 'clearTimeout')

    const { unmount } = renderHook(() => useAmbientSound(true, 'piano-music'))
    const scheduledDuringPlayback = schedule.mock.calls.length
    unmount()

    // Every timer the engine queued is cleared, so a closed engine cannot wake
    // up later and schedule notes into a context that is going away.
    expect(cancel).toHaveBeenCalled()
    expect(scheduledDuringPlayback).toBeGreaterThan(0)

    runScheduled(schedule, 900)
    expect(contexts[0].close).toHaveBeenCalled()
  })

  it('closes the previous context when the soundscape changes', () => {
    installAudio()
    const schedule = vi.spyOn(window, 'setTimeout')

    type Props = { track: 'garden-chimes' | 'piano-music' }
    const { rerender } = renderHook(
      ({ track }: Props) => useAmbientSound(true, track),
      { initialProps: { track: 'garden-chimes' } },
    )
    rerender({ track: 'piano-music' })

    expect(contexts).toHaveLength(2)
    runScheduled(schedule, 900)
    // The first is released rather than left open alongside the second.
    expect(contexts[0].close).toHaveBeenCalled()
  })

  it('falls silent instead of throwing when no context can be opened', () => {
    // Browsers cap concurrent contexts, and closing one is deferred, so
    // toggling quickly can hit that ceiling. This runs inside an effect, where
    // an uncaught throw would take the whole app down with it.
    installAudio(() => {
      throw new Error('too many audio contexts')
    })

    expect(() =>
      renderHook(() => useAmbientSound(true, 'garden-chimes')),
    ).not.toThrow()
  })

  it('falls silent when the platform has no Web Audio at all', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() =>
      renderHook(() => useAmbientSound(true, 'garden-chimes')),
    ).not.toThrow()
  })
})

describe('the fade-out timer', () => {
  it('lowers the sound over its last minute, and brings it back if the timer is taken away', () => {
    vi.useFakeTimers()
    try {
      installAudio()
      const endsAt = Date.now() + FADE_OUT_SECONDS * 1000 + 5_000
      const initialProps: { fade?: number } = { fade: endsAt }
      const { rerender } = renderHook(
        ({ fade }: { fade?: number }) => useAmbientSound(true, 'garden', fade),
        { initialProps },
      )
      const context = contexts[0] as unknown as { createGain: ReturnType<typeof vi.fn> }
      const master = (context.createGain.mock.results[0].value as ReturnType<typeof audioNode>).gain
      master.linearRampToValueAtTime.mockClear()

      vi.advanceTimersByTime(4_000)
      expect(master.linearRampToValueAtTime).not.toHaveBeenCalledWith(0, expect.anything())
      vi.advanceTimersByTime(1_000)
      expect(master.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))

      rerender({ fade: undefined })
      expect(master.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.5, expect.any(Number))
    } finally {
      vi.useRealTimers()
    }
  })
})
