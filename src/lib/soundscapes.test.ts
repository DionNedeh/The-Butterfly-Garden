import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ambientTracks } from '../data/ambientTracks'
import {
  FakeAudioContext,
  isSource,
  seededRandom,
  startTime,
  type FakeNode,
} from '../test/fakeAudio'
import type { AmbientTrackId } from '../types'
import { CROSSFADE_SECONDS, LOOKAHEAD_SECONDS, startSoundscape } from './soundscapes'

const TRACK_IDS = ambientTracks.map((track) => track.id)

/** A soundscape on a fresh fake context, with its output node. */
function play(trackId: AmbientTrackId, context = new FakeAudioContext()) {
  const output = { connect: vi.fn() }
  const soundscape = startSoundscape(
    context as unknown as AudioContext,
    output as unknown as AudioNode,
    trackId,
  )
  return { context, soundscape }
}

/** Let `seconds` pass on both clocks, a second at a time, ending what ends. */
function listen(context: FakeAudioContext, seconds: number) {
  for (let i = 0; i < seconds; i += 1) {
    context.currentTime += 1
    vi.advanceTimersByTime(1000)
    context.endUpTo(context.currentTime)
  }
}

const sources = (context: FakeAudioContext) => context.nodes.filter(isSource)

/** Every node let go: each source stopped or ended, every node disconnected. */
function expectAllReleased(nodes: FakeNode[]) {
  for (const node of nodes) {
    expect(node.disconnect, node.kind).toHaveBeenCalled()
    if (isSource(node)) expect(node.ended || node.stop.mock.calls.length > 0, node.kind).toBe(true)
  }
}

// Replaced rather than spied on: a spy would keep every one of the many
// thousand calls that making noise takes.
const realRandom = Math.random

beforeEach(() => {
  vi.useFakeTimers()
  Math.random = seededRandom(7)
})
afterEach(() => {
  vi.useRealTimers()
  Math.random = realRandom
})

describe.each(TRACK_IDS)('the %s soundscape', (trackId) => {
  it('queues sounds only a few seconds ahead of the audio clock', () => {
    const { context } = play(trackId)
    for (let second = 0; second < 90; second += 1) {
      listen(context, 1)
      // A phrase that starts inside the look-ahead may run a little past it.
      for (const source of sources(context)) {
        expect(startTime(source)).toBeLessThan(context.currentTime + LOOKAHEAD_SECONDS + 6)
      }
    }
    expect(sources(context).length).toBeGreaterThan(1)
  })

  it('lets each sound go when it ends, so a long listen holds only a few nodes', () => {
    const { context } = play(trackId)
    let most = 0
    for (let second = 0; second < 180; second += 1) {
      listen(context, 1)
      most = Math.max(most, context.live().length)
    }
    // Three minutes of sound, and never more held at once than a few seconds'
    // worth; the piano's notes are eight nodes each, and ring for a while.
    expect(most).toBeLessThan(trackId === 'piano-music' ? 300 : 60)
    expect(context.nodes.length).toBeGreaterThan(most)
  })

  it('stops and disconnects every node it made when it is stopped', () => {
    const { context, soundscape } = play(trackId)
    listen(context, 20)
    soundscape.stop()
    const made = context.nodes.length
    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000 + 100)
    expectAllReleased(context.nodes)
    // Nothing more is queued once it has stopped.
    listen(context, 30)
    expect(context.nodes).toHaveLength(made)
  })

  it('fades in, and fades out before it lets go', () => {
    const { context, soundscape } = play(trackId)
    const bus = context.nodes[0]
    expect(bus.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, CROSSFADE_SECONDS)
    listen(context, 5)
    soundscape.stop()
    expect(bus.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 5 + CROSSFADE_SECONDS)
    expect(bus.disconnect).not.toHaveBeenCalled()
    vi.advanceTimersByTime(CROSSFADE_SECONDS * 1000 + 100)
    expect(bus.disconnect).toHaveBeenCalled()
  })

  it('queues nothing more while the audio clock stands still', () => {
    const { context } = play(trackId)
    listen(context, 10)
    const made = context.nodes.length
    // Suspended: the timers run on, but the audio clock does not.
    vi.advanceTimersByTime(60_000)
    expect(context.nodes).toHaveLength(made)
  })

  it('carries on from now after falling behind, rather than playing all it missed', () => {
    const { context } = play(trackId)
    listen(context, 5)
    const before = context.nodes.length
    // Ten minutes in which the page never got to look ahead.
    context.currentTime += 600
    vi.advanceTimersByTime(1000)
    expect(context.nodes.length - before).toBeLessThan(400)
    for (const source of sources(context).slice(before)) {
      expect(startTime(source)).toBeGreaterThanOrEqual(context.currentTime)
    }
  })

  it('can be let go at once, as the context closes', () => {
    const { context, soundscape } = play(trackId)
    listen(context, 12)
    soundscape.dispose()
    expectAllReleased(context.nodes)
  })
})

describe('the soundscapes', () => {
  it('plays the whole waltz, every note of it, once round each loop', () => {
    const { context } = play('piano-music')
    const loopSeconds = 24 * (60 / 72)
    listen(context, Math.ceil(loopSeconds) + LOOKAHEAD_SECONDS + 1)
    const firstLoop = sources(context).filter(
      (source) => startTime(source) >= 0.12 && startTime(source) < 0.12 + loopSeconds - 0.001,
    )
    // Eight measures of a bass note and six broken-chord notes, a 24-note
    // tune, three partials each.
    expect(firstLoop).toHaveLength((8 * 7 + 24) * 3)
  })

  it('makes its noise once per context and shares it', () => {
    const context = new FakeAudioContext()
    play('soft-rain', context).soundscape.dispose()
    play('soft-rain', context).soundscape.dispose()
    play('garden', context).soundscape.dispose()
    play('dawn-birdsong', context).soundscape.dispose()
    // One white noise for rain, one brown for the breeze and the morning air.
    expect(context.createBuffer).toHaveBeenCalledTimes(2)
  })

  it('has no thunder in its rain: every sound in it is a small drop, high and short', () => {
    const { context } = play('soft-rain')
    listen(context, 120)
    // What plays for the whole soundscape: two looped beds of noise, and the
    // slow swells on them, far too slow to hear as a sound of their own.
    const lasting = sources(context).filter(
      (source) => source.stop.mock.calls.length === 0 && source.start.mock.calls[0]?.[2] === undefined,
    )
    expect(lasting.filter((source) => source.kind === 'bufferSource' && source.loop)).toHaveLength(2)
    for (const swell of lasting.filter((source) => source.kind === 'oscillator')) {
      expect(swell.frequency.value).toBeLessThan(0.1)
    }
    // Everything else is a drop.
    const drops = sources(context).filter((source) => !lasting.includes(source))
    expect(drops.length).toBeGreaterThan(30)
    for (const drop of drops) {
      const length = drop.kind === 'oscillator'
        ? (drop.stop.mock.calls[0][0] as number) - startTime(drop)
        : (drop.start.mock.calls[0][2] as number)
      expect(length).toBeLessThanOrEqual(0.2)
      if (drop.kind === 'oscillator')
        expect(drop.frequency.setValueAtTime.mock.calls[0][0]).toBeGreaterThanOrEqual(600)
    }
  })

  it('swells its rain and air with oscillators, never a growing queue of ramps', () => {
    // The beds' gains come straight after the soundscape's own: two for the
    // rain, one for the morning air.
    for (const [trackId, beds] of [['soft-rain', 2], ['dawn-birdsong', 1]] as const) {
      const { context } = play(trackId)
      listen(context, 120)
      const gains = context.nodes.filter((node) => node.kind === 'gain').slice(1, 1 + beds)
      for (const gain of gains) {
        expect(gain.gain.value).toBeGreaterThan(0)
        expect(gain.gain.linearRampToValueAtTime).not.toHaveBeenCalled()
        expect(gain.gain.setValueAtTime).not.toHaveBeenCalled()
      }
    }
  })

  it('sings from the middle where the browser cannot place a bird', () => {
    const context = new FakeAudioContext()
    context.createStereoPanner = undefined
    play('dawn-birdsong', context)
    listen(context, 40)
    expect(context.nodes.some((node) => node.kind === 'panner')).toBe(false)
    expect(context.nodes.filter((node) => node.kind === 'oscillator').length).toBeGreaterThan(0)
  })

  it('places its birds to either side where it can', () => {
    const { context } = play('dawn-birdsong')
    listen(context, 60)
    const panners = context.nodes.filter((node) => node.kind === 'panner')
    expect(panners.length).toBeGreaterThan(0)
    for (const panner of panners) expect(Math.abs(panner.pan.value)).toBeLessThanOrEqual(0.7)
  })

  it('leaves long pauses between the birds', () => {
    const { context } = play('dawn-birdsong')
    listen(context, 600)
    const phrases = context.nodes
      .filter((node) => node.kind === 'oscillator')
      .map(startTime)
      .sort((a, b) => a - b)
    // Ten minutes hold a few dozen phrases at most, answers included.
    expect(phrases.length).toBeGreaterThan(10)
    expect(phrases.length).toBeLessThan(150)
  })
})
