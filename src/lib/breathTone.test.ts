import { afterEach, describe, expect, it, vi } from 'vitest'
import { contexts, installAudio, startTime } from '../test/fakeAudio'
import { openBreathTone } from './breathTone'
import { gainForVolume } from './sound'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the tone that marks each turn', () => {
  it('has a small context of its own, at the gardener’s volume', () => {
    installAudio()
    const tone = openBreathTone(50)
    expect(tone).toBeDefined()
    expect(contexts).toHaveLength(1)
    const [context] = contexts
    expect(context.resume).toHaveBeenCalled()
    expect(context.master.gain.value).toBeCloseTo(0.16 * gainForVolume(50))
    // Louder with the volume, and silent at nothing.
    expect(openBreathTone(100) && contexts[1].master.gain.value).toBeGreaterThan(
      context.master.gain.value,
    )
    expect(openBreathTone(0) && contexts[2].master.gain.value).toBe(0)
  })

  it('sounds a soft sine at each turn, higher for in than out, queued on the audio clock', () => {
    installAudio()
    const tone = openBreathTone(50)!
    const [context] = contexts
    context.currentTime = 10
    tone.play(0.5, 'in')
    tone.play(4, 'out')
    const oscillators = context.nodes.filter((node) => node.kind === 'oscillator')
    expect(oscillators).toHaveLength(2)
    expect(oscillators.map(startTime)).toEqual([10.5, 14])
    expect(oscillators[0].frequency.value).toBeGreaterThan(oscillators[1].frequency.value)
    expect(oscillators.every((node) => node.type === 'sine')).toBe(true)
    // A turn already passed sounds now, never in the past.
    tone.play(-1, 'in')
    expect(startTime(context.nodes.filter((node) => node.kind === 'oscillator')[2])).toBe(10)
  })

  it('lets go of each tone once it has rung', () => {
    installAudio()
    const tone = openBreathTone(50)!
    const [context] = contexts
    tone.play(0, 'in')
    context.endUpTo(2)
    const made = context.nodes.slice(1)
    expect(made.every((node) => node.disconnect.mock.calls.length > 0)).toBe(true)
  })

  it('falls quiet and closes everything when the session ends', () => {
    vi.useFakeTimers()
    installAudio()
    const tone = openBreathTone(50)!
    const [context] = contexts
    tone.play(0, 'in')
    tone.play(1.5, 'out')
    tone.close()
    expect(context.master.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, expect.any(Number))
    vi.runAllTimers()
    expect(context.close).toHaveBeenCalledOnce()
    expect(context.live()).toEqual([])
    // Nothing more is made once closed, and closing twice is harmless.
    tone.play(0, 'in')
    tone.close()
    expect(context.nodes.filter((node) => node.kind === 'oscillator')).toHaveLength(2)
    vi.runAllTimers()
    expect(context.close).toHaveBeenCalledOnce()
  })

  it('is simply absent where there is no Web Audio, or no context to be had', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(openBreathTone(50)).toBeUndefined()
    installAudio({
      onConstruct: () => {
        throw new Error('Too many audio contexts')
      },
    })
    expect(openBreathTone(50)).toBeUndefined()
  })
})
