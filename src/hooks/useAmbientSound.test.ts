import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { gainForVolume } from '../lib/sound'
import { contexts, installAudio, isSource, type FakeAudioContext } from '../test/fakeAudio'
import {
  FADE_OUT_SECONDS,
  useAmbientSound,
  type AmbientSoundOptions,
} from './useAmbientSound'

const ON: AmbientSoundOptions = { enabled: true, trackId: 'garden-chimes', volume: 50 }

function sound(options: Partial<AmbientSoundOptions> = {}) {
  return renderHook((props: AmbientSoundOptions) => useAmbientSound(props), {
    initialProps: { ...ON, ...options },
  })
}

/** Wait for the soundscapes' module to arrive and a soundscape to start. */
async function playing(context: FakeAudioContext) {
  await vi.waitFor(() => expect(context.nodes.length).toBeGreaterThan(1))
}

/** The gains a soundscape plays through: those connected to the master. */
function soundscapeBuses(context: FakeAudioContext) {
  return context.nodes.filter((node) =>
    node.connect.mock.calls.some(([target]) => target === context.master),
  )
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

beforeAll(async () => {
  // Loaded once here, as the app would have it after the first time.
  await import('../lib/soundscapes')
})

beforeEach(() => {
  vi.useFakeTimers()
  installAudio()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('useAmbientSound', () => {
  it('opens no audio context while sound is off', () => {
    sound({ enabled: false })
    expect(contexts).toHaveLength(0)
  })

  it('opens one context when sound is switched on, and plays the soundscape into it', async () => {
    sound()
    expect(contexts).toHaveLength(1)
    await playing(contexts[0])
    expect(soundscapeBuses(contexts[0])).toHaveLength(1)
  })

  it('closes the context and lets every node go when sound stops', async () => {
    const { rerender } = sound({ trackId: 'piano-music' })
    const [context] = contexts
    await playing(context)
    vi.advanceTimersByTime(10_000)
    rerender({ ...ON, trackId: 'piano-music', enabled: false })

    vi.advanceTimersByTime(900)
    expect(context.close).toHaveBeenCalled()
    for (const node of context.nodes) {
      expect(node.disconnect).toHaveBeenCalled()
      if (isSource(node)) expect(node.stop).toHaveBeenCalled()
    }
    // Nothing wakes up later to queue notes into a context that has gone.
    const made = context.nodes.length
    vi.advanceTimersByTime(30_000)
    expect(context.nodes).toHaveLength(made)
  })

  it('changes soundscape within the same context, letting the old one go', async () => {
    const { rerender } = sound({ trackId: 'soft-rain' })
    const [context] = contexts
    await playing(context)
    const rain = context.nodes.slice(1)
    rerender({ ...ON, trackId: 'piano-music' })
    await vi.waitFor(() => expect(context.createDelay).toHaveBeenCalled())

    // No second context: a change of soundscape can come at nightfall, with
    // no tap to let a new one start.
    expect(contexts).toHaveLength(1)
    vi.advanceTimersByTime(1_600)
    for (const node of rain) expect(node.disconnect).toHaveBeenCalled()
    expect(context.master.disconnect).not.toHaveBeenCalled()
    expect(context.close).not.toHaveBeenCalled()
  })

  it('plays a soundscape asked for and taken back before it arrived only once', async () => {
    const { rerender } = sound({ trackId: 'garden' })
    rerender({ ...ON, trackId: 'dawn-birdsong' })
    rerender({ ...ON, trackId: 'garden' })
    const [context] = contexts
    await playing(context)
    vi.advanceTimersByTime(100)
    expect(soundscapeBuses(context)).toHaveLength(1)
  })

  it('falls silent instead of throwing when no context can be opened', () => {
    // Browsers cap concurrent contexts, and closing one is deferred, so
    // toggling quickly can hit that ceiling. This runs inside an effect, where
    // an uncaught throw would take the whole app down with it.
    installAudio({
      onConstruct: () => {
        throw new Error('too many audio contexts')
      },
    })
    expect(() => sound()).not.toThrow()
  })

  it('falls silent when the platform has no Web Audio at all', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() => sound()).not.toThrow()
  })

  it('waits for a first tap when the browser holds the sound back', () => {
    installAudio({ state: 'suspended' })
    const listen = vi.spyOn(window, 'addEventListener')
    const forget = vi.spyOn(window, 'removeEventListener')
    const { unmount } = sound()
    expect(listen).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.anything())
    unmount()
    expect(forget).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })
})

describe('the volume', () => {
  it('brings the sound in to the usual level, as it always has', () => {
    sound()
    expect(contexts[0].master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.5, 3)
  })

  it('brings the sound in to the chosen volume', () => {
    sound({ volume: 25 })
    expect(contexts[0].master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      gainForVolume(25),
      3,
    )
  })

  it('glides to a new volume while playing, from where it is, with no jump', () => {
    const { rerender } = sound()
    const gain = contexts[0].master.gain
    gain.value = 0.42
    vi.clearAllMocks()
    rerender({ ...ON, volume: 80 })
    expect(gain.cancelScheduledValues).toHaveBeenCalled()
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0.42, 0)
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(gainForVolume(80), 0.12)
    // Held at its present value first, then ramped: a click needs a jump.
    expect(gain.setValueAtTime.mock.invocationCallOrder[0]).toBeLessThan(
      gain.linearRampToValueAtTime.mock.invocationCallOrder[0],
    )
  })

  it('hears a volume being chosen at once, and does not ramp again when it is stored', () => {
    const { result, rerender } = sound()
    const gain = contexts[0].master.gain
    act(() => result.current.hearVolume(20))
    expect(gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(gainForVolume(20), 0.12)
    gain.linearRampToValueAtTime.mockClear()
    rerender({ ...ON, volume: 20 })
    expect(gain.linearRampToValueAtTime).not.toHaveBeenCalled()
  })

  it('hears nothing while the sound is off', () => {
    const { result } = sound({ enabled: false })
    expect(() => result.current.hearVolume(20)).not.toThrow()
    expect(contexts).toHaveLength(0)
  })
})

describe('the fade-out timer', () => {
  it('lowers the sound over its last minute, and brings it back if the timer is taken away', () => {
    const endsAt = Date.now() + FADE_OUT_SECONDS * 1000 + 5_000
    const { rerender } = sound({ trackId: 'garden', fadeEndsAt: endsAt })
    const master = contexts[0].master.gain
    master.linearRampToValueAtTime.mockClear()

    vi.advanceTimersByTime(4_000)
    expect(master.linearRampToValueAtTime).not.toHaveBeenCalledWith(0, expect.anything())
    vi.advanceTimersByTime(1_000)
    expect(master.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))

    rerender({ ...ON, trackId: 'garden', fadeEndsAt: undefined })
    expect(master.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.5, expect.any(Number))
  })

  it("brings it back to the gardener's own volume", () => {
    const endsAt = Date.now() + 30_000
    const { rerender } = sound({ volume: 30, fadeEndsAt: endsAt })
    vi.advanceTimersByTime(1_000)
    rerender({ ...ON, volume: 30 })
    expect(contexts[0].master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      gainForVolume(30),
      2,
    )
  })

  it('keeps to its time across a pause, though the audio clock stood still', () => {
    const endsAt = Date.now() + 90_000
    sound({ fadeEndsAt: endsAt, pauseWhenHidden: true })
    const [context] = contexts
    setVisibility('hidden')
    expect(context.suspend).toHaveBeenCalled()

    // Fifty seconds hidden: the fade began twenty seconds ago by the clock,
    // while the audio clock, suspended, stayed where it was.
    vi.advanceTimersByTime(50_000)
    const gain = context.master.gain
    gain.linearRampToValueAtTime.mockClear()
    setVisibility('visible')
    expect(context.resume).toHaveBeenCalled()
    // Where the fade has reached by now, then down to nothing in the forty
    // seconds the timer has left.
    const [toNow, toEnd] = gain.linearRampToValueAtTime.mock.calls
    expect(toNow[0]).toBeCloseTo((0.5 * (40 - 0.12)) / 60)
    expect(toEnd[0]).toBe(0)
    expect(toEnd[1]).toBeCloseTo(40)
  })
})

describe('playing in the background', () => {
  it('keeps playing while hidden unless asked not to, as it always has', () => {
    sound()
    setVisibility('hidden')
    expect(contexts[0].suspend).not.toHaveBeenCalled()
  })

  it('pauses while hidden, and carries on where it was when seen again', () => {
    sound({ pauseWhenHidden: true, volume: 70 })
    const [context] = contexts
    const resumed = context.resume.mock.calls.length
    setVisibility('hidden')
    expect(context.suspend).toHaveBeenCalledOnce()
    setVisibility('hidden')
    expect(context.suspend).toHaveBeenCalledOnce()

    setVisibility('visible')
    expect(context.resume.mock.calls.length).toBe(resumed + 1)
    expect(context.master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      gainForVolume(70),
      expect.any(Number),
    )
    // Still the same context: nothing had to start again.
    expect(contexts).toHaveLength(1)
  })

  it('leaves a sound the browser is holding back to the first tap', () => {
    sound({ pauseWhenHidden: true })
    const [context] = contexts
    context.state = 'suspended'
    const resumed = context.resume.mock.calls.length
    setVisibility('hidden')
    setVisibility('visible')
    expect(context.suspend).not.toHaveBeenCalled()
    expect(context.resume.mock.calls.length).toBe(resumed)
  })

  it('starts paused when the sound comes on while the page is hidden', () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    sound({ pauseWhenHidden: true })
    expect(contexts[0].suspend).toHaveBeenCalled()
  })

  it('carries on at once when the switch is turned back on while paused', () => {
    const { rerender } = sound({ pauseWhenHidden: true })
    const [context] = contexts
    setVisibility('hidden')
    const resumed = context.resume.mock.calls.length
    rerender({ ...ON, pauseWhenHidden: false })
    expect(context.resume.mock.calls.length).toBe(resumed + 1)
  })

  it('does not wake a sound that was turned off while hidden', () => {
    const { rerender } = sound({ pauseWhenHidden: true })
    const [context] = contexts
    setVisibility('hidden')
    const resumed = context.resume.mock.calls.length
    rerender({ ...ON, pauseWhenHidden: true, enabled: false })
    setVisibility('visible')
    expect(context.resume.mock.calls.length).toBe(resumed)
  })
})
