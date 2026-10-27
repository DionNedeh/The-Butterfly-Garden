import type { AmbientTrackId } from '../types'

/**
 * The soundscapes, made on this device with the Web Audio API: no audio
 * files, nothing downloaded. hooks/useAmbientSound loads this module when the
 * sound first starts, so the app's first load does not carry it.
 *
 * Every soundscape is built the same way, to stay light on a phone left
 * playing all evening:
 * - Sounds are queued a few seconds ahead on the audio clock, by one timer a
 *   second, and never further. A soundscape holds a few dozen nodes at a
 *   time, not a whole piece's worth.
 * - The audio clock stands still while the context is suspended, so a paused
 *   soundscape queues nothing and carries on where it was.
 * - Noise is made once per context and shared by every sound that needs it.
 * - A sound disconnects itself when it ends, and stopping a soundscape stops
 *   and disconnects everything it still holds.
 */

/** A soundscape playing into the engine's master gain. */
export interface Soundscape {
  readonly trackId: AmbientTrackId
  /** Queue nothing more, fade away, then stop and disconnect every node. */
  stop(): void
  /** Stop and disconnect every node at once, as the context closes. */
  dispose(): void
}

/** How far ahead of the audio clock sounds are queued, in seconds. */
export const LOOKAHEAD_SECONDS = 4

/** How often the queue is topped up. */
const TICK_MS = 1000

/** How long a soundscape takes to come in, or to give way to another. */
export const CROSSFADE_SECONDS = 1.5

interface Scape {
  context: AudioContext
  /** Everything the soundscape plays goes through this, for its fades. */
  bus: GainNode
  /** Every node still connected, the lasting ones and those still ringing. */
  nodes: Set<AudioNode>
  /** Every source not yet known to have ended. */
  sources: Set<AudioScheduledSourceNode>
  timer?: number
  stopped: boolean
}

/** Queues what falls before `until`; `now` is the audio clock. */
type Look = (until: number, now: number) => void

/** Nodes that play for as long as the soundscape does. */
function keep(scape: Scape, sources: AudioScheduledSourceNode[], nodes: AudioNode[]) {
  for (const node of [...sources, ...nodes]) scape.nodes.add(node)
  for (const source of sources) scape.sources.add(source)
}

/** One sound: released, every node of it, once its last source has ended. */
function sound(scape: Scape, sources: AudioScheduledSourceNode[], nodes: AudioNode[]) {
  keep(scape, sources, nodes)
  let ringing = sources.length
  const ended = () => {
    ringing -= 1
    if (ringing > 0) return
    for (const node of [...sources, ...nodes]) {
      node.disconnect()
      scape.nodes.delete(node)
    }
    for (const source of sources) scape.sources.delete(source)
  }
  for (const source of sources) source.onended = ended
}

function dispose(scape: Scape) {
  scape.stopped = true
  window.clearTimeout(scape.timer)
  for (const source of scape.sources) {
    try {
      source.stop()
    } catch {
      // Already stopped, or its context is closed.
    }
  }
  for (const node of [...scape.nodes, scape.bus]) {
    try {
      node.disconnect()
    } catch {
      // Its context is closed.
    }
  }
  scape.sources.clear()
  scape.nodes.clear()
}

/** Look ahead now, and again every second, until the soundscape stops. */
function run(scape: Scape, looks: Look[]) {
  const tick = () => {
    if (scape.stopped) return
    const now = scape.context.currentTime
    for (const look of looks) look(now + LOOKAHEAD_SECONDS, now)
    scape.timer = window.setTimeout(tick, TICK_MS)
  }
  tick()
}

/**
 * Sounds that come at irregular gaps, the first `firstIn` seconds after the
 * start. A page too busy to look ahead in time carries on from now, rather
 * than playing everything it missed at once.
 */
function every(firstIn: number, gap: () => number, play: (when: number) => void): Look {
  let next: number | undefined
  // A gap is never so short that the queue could fill without end.
  const wait = () => Math.max(0.05, gap())
  return (until, now) => {
    next ??= now + firstIn
    if (next < now) next = now + wait()
    while (next < until) {
      play(next)
      next += wait()
    }
  }
}

const between = (low: number, high: number) => low + Math.random() * (high - low)

type NoiseColour = 'brown' | 'white'

const noises = new WeakMap<BaseAudioContext, Partial<Record<NoiseColour, AudioBuffer>>>()

/**
 * A few seconds of noise, made once per context: brown (soft and low, the
 * breeze) or white (bright, for rain). Looped, and shared by every sound that
 * needs it, so changing soundscapes makes no new buffers.
 */
function noiseBuffer(context: AudioContext, colour: NoiseColour): AudioBuffer {
  const made = noises.get(context) ?? {}
  noises.set(context, made)
  const existing = made[colour]
  if (existing) return existing
  const seconds = colour === 'brown' ? 4 : 5
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1
    if (colour === 'white') {
      data[i] = white
    } else {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.2
    }
  }
  made[colour] = buffer
  return buffer
}

interface BedShape {
  type: BiquadFilterType
  frequency: number
  /** The filter's Q, where the browser's own default will not do. */
  q?: number
  level: number
  /** Playback speed: below 1 lowers the noise and lengthens its loop. */
  rate?: number
}

/** Noise looped through one filter at a steady level, for a soundscape's bed. */
function bed(scape: Scape, buffer: AudioBuffer, shape: BedShape) {
  const { context, bus } = scape
  const { type, frequency, q, level, rate = 1 } = shape
  const source = context.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.playbackRate.value = rate
  const filter = context.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  if (q !== undefined) filter.Q.value = q
  const gain = context.createGain()
  gain.gain.value = level
  source.connect(filter)
  filter.connect(gain)
  gain.connect(bus)
  // Started part-way in, so two beds from the same noise never line up.
  source.start(context.currentTime, Math.random() * buffer.duration)
  keep(scape, [source], [filter, gain])
  return { filter, gain }
}

/**
 * A slow swell on a setting, `depth` either way of where it stands, `hertz`
 * times a second. An oscillator does it, rather than a ramp queued every few
 * seconds, so a whole evening's listening leaves no trail of automation on the
 * setting for the browser to step through.
 */
function sway(scape: Scape, param: AudioParam, hertz: number, depth: number) {
  const { context } = scape
  const lfo = context.createOscillator()
  lfo.frequency.value = hertz
  const amount = context.createGain()
  amount.gain.value = depth
  lfo.connect(amount)
  amount.connect(param)
  lfo.start()
  keep(scape, [lfo], [amount])
}

// ---------------------------------------------------------------------------
// Garden Sounds, with or without wind chimes: the original blend.

const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]

function chimes(scape: Scape, start: number) {
  const { context, bus } = scape
  const strikes = 1 + Math.floor(Math.random() * 3)
  let when = start
  for (let i = 0; i < strikes; i += 1) {
    const note = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)]
    const osc = context.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = note
    const shimmer = context.createOscillator()
    shimmer.type = 'sine'
    shimmer.frequency.value = note * 2.01
    const gain = context.createGain()
    const shimmerGain = context.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(0.055, when + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 2.8)
    shimmerGain.gain.setValueAtTime(0, when)
    shimmerGain.gain.linearRampToValueAtTime(0.018, when + 0.012)
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, when + 1.6)
    osc.connect(gain)
    shimmer.connect(shimmerGain)
    gain.connect(bus)
    shimmerGain.connect(bus)
    osc.start(when)
    shimmer.start(when)
    osc.stop(when + 3)
    shimmer.stop(when + 2)
    sound(scape, [osc, shimmer], [gain, shimmerGain])
    when += 0.18 + Math.random() * 0.3
  }
}

/** Rare, quiet birds from far away. */
function distantBird(scape: Scape, start: number) {
  const { context, bus } = scape
  const chirps = 2 + Math.floor(Math.random() * 3)
  let when = start
  for (let i = 0; i < chirps; i += 1) {
    const osc = context.createOscillator()
    osc.type = 'sine'
    const from = 2100 + Math.random() * 900
    osc.frequency.setValueAtTime(from, when)
    osc.frequency.exponentialRampToValueAtTime(from * 1.7, when + 0.06)
    osc.frequency.exponentialRampToValueAtTime(from * 0.9, when + 0.11)
    const gain = context.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(0.02, when + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.13)
    osc.connect(gain)
    gain.connect(bus)
    osc.start(when)
    osc.stop(when + 0.2)
    sound(scape, [osc], [gain])
    when += 0.14 + Math.random() * 0.1
  }
}

function garden(scape: Scape, withChimes: boolean): Look[] {
  const { context } = scape
  // Breeze: looped brown noise through a lowpass, its level wandering slowly.
  const breeze = bed(scape, noiseBuffer(context, 'brown'), {
    type: 'lowpass',
    frequency: 320,
    level: 0.06,
  })
  sway(scape, breeze.gain.gain, 0.07, 0.035)

  const looks = [every(4, () => between(6, 20), (when) => distantBird(scape, when))]
  if (withChimes) looks.push(every(1.5, () => between(3.5, 11.5), (when) => chimes(scape, when)))
  return looks
}

// ---------------------------------------------------------------------------
// Piano Music: an original eight-measure garden waltz in C major.

interface PianoNote {
  beat: number
  midi: number
  duration: number
  velocity?: number
}

const PIANO_BEAT_SECONDS = 60 / 72
const PIANO_LOOP_BEATS = 24

const PIANO_CHORDS = [
  [48, 55, 64],
  [47, 55, 62],
  [45, 52, 60],
  [43, 52, 59],
  [41, 48, 57],
  [40, 48, 55],
  [38, 45, 53],
  [43, 50, 59],
]

const PIANO_MELODY: PianoNote[] = [
  { beat: 0, midi: 64, duration: 1 },
  { beat: 1, midi: 67, duration: 1 },
  { beat: 2, midi: 72, duration: 1 },
  { beat: 3, midi: 71, duration: 1.5 },
  { beat: 4.5, midi: 67, duration: 0.5 },
  { beat: 5, midi: 62, duration: 1 },
  { beat: 6, midi: 64, duration: 1 },
  { beat: 7, midi: 69, duration: 1 },
  { beat: 8, midi: 72, duration: 1 },
  { beat: 9, midi: 71, duration: 1 },
  { beat: 10, midi: 67, duration: 1 },
  { beat: 11, midi: 64, duration: 1 },
  { beat: 12, midi: 65, duration: 1.5 },
  { beat: 13.5, midi: 69, duration: 0.5 },
  { beat: 14, midi: 72, duration: 1 },
  { beat: 15, midi: 67, duration: 1 },
  { beat: 16, midi: 64, duration: 1 },
  { beat: 17, midi: 60, duration: 1 },
  { beat: 18, midi: 62, duration: 1 },
  { beat: 19, midi: 65, duration: 1 },
  { beat: 20, midi: 69, duration: 1 },
  { beat: 21, midi: 67, duration: 1 },
  { beat: 22, midi: 62, duration: 1 },
  { beat: 23, midi: 59, duration: 1 },
]

/** Every note of one pass through the waltz, in the order they sound. */
const PIANO_LOOP: PianoNote[] = [
  ...PIANO_CHORDS.flatMap((chord, measure) => {
    const measureBeat = measure * 3
    // A low root under each measure, then the chord broken in quavers.
    const bass = { beat: measureBeat, midi: chord[0] - 12, duration: 2.7, velocity: 0.022 }
    const broken = [0, 1, 2, 1, 2, 1].map((chordIndex, step) => ({
      beat: measureBeat + step * 0.5,
      midi: chord[chordIndex],
      duration: 0.62,
      velocity: step === 0 ? 0.026 : 0.02,
    }))
    return [bass, ...broken]
  }),
  ...PIANO_MELODY,
].sort((a, b) => a.beat - b.beat)

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12)
}

function pianoNote(scape: Scape, output: AudioNode, note: PianoNote, when: number) {
  const { context } = scape
  const duration = note.duration * PIANO_BEAT_SECONDS
  const frequency = midiToFrequency(note.midi)
  const envelope = context.createGain()
  const filter = context.createBiquadFilter()
  const peak = note.velocity ?? 0.035

  filter.type = 'lowpass'
  filter.frequency.value = Math.min(5200, 1800 + frequency * 5)
  filter.Q.value = 0.7
  envelope.gain.setValueAtTime(0.0001, when)
  envelope.gain.exponentialRampToValueAtTime(peak, when + 0.012)
  envelope.gain.exponentialRampToValueAtTime(peak * 0.48, when + 0.12)
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration + 1.15)
  filter.connect(envelope)
  envelope.connect(output)

  const partials: Array<[number, OscillatorType, number]> = [
    [1, 'triangle', 0.82],
    [2.01, 'sine', 0.22],
    [3.98, 'sine', 0.06],
  ]
  const oscillators: OscillatorNode[] = []
  const gains: GainNode[] = []
  for (const [multiple, type, level] of partials) {
    const oscillator = context.createOscillator()
    const partialGain = context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency * multiple
    partialGain.gain.value = level
    oscillator.connect(partialGain)
    partialGain.connect(filter)
    oscillator.start(when)
    oscillator.stop(when + duration + 1.25)
    oscillators.push(oscillator)
    gains.push(partialGain)
  }
  sound(scape, oscillators, [...gains, filter, envelope])
}

/**
 * The waltz, note by note, a few seconds ahead. A note the page was too busy
 * to queue in time is left out rather than played late.
 */
function piano(scape: Scape): Look[] {
  const { context, bus } = scape
  const pianoBus = context.createGain()
  const delay = context.createDelay(1)
  const echoGain = context.createGain()
  pianoBus.gain.value = 0.82
  delay.delayTime.value = 0.24
  echoGain.gain.value = 0.12
  pianoBus.connect(bus)
  pianoBus.connect(delay)
  delay.connect(echoGain)
  echoGain.connect(bus)
  keep(scape, [], [pianoBus, delay, echoGain])

  const loopSeconds = PIANO_LOOP_BEATS * PIANO_BEAT_SECONDS
  let loopStart: number | undefined
  let index = 0
  return [
    (until, now) => {
      loopStart ??= now + 0.12
      for (;;) {
        const note = PIANO_LOOP[index]
        const when = loopStart + note.beat * PIANO_BEAT_SECONDS
        // Written so that a clock that is not a number stops it too.
        if (!(when < until)) return
        if (when >= now) pianoNote(scape, pianoBus, note, when)
        index += 1
        if (index === PIANO_LOOP.length) {
          index = 0
          loopStart += loopSeconds
        }
      }
    },
  ]
}

// ---------------------------------------------------------------------------
// Soft Rain: steady rain, a drop close by now and then, and no thunder.

/** A single drop on a leaf nearby: a moment of noise, ringing at one pitch. */
function raindrop(scape: Scape, noise: AudioBuffer, when: number) {
  const { context, bus } = scape
  const source = context.createBufferSource()
  source.buffer = noise
  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = between(1400, 4200)
  filter.Q.value = between(3, 7)
  const gain = context.createGain()
  const length = between(0.04, 0.1)
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(between(0.06, 0.2), when + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(bus)
  source.start(when, Math.random() * (noise.duration - 0.2), length + 0.02)
  sound(scape, [source], [filter, gain])
}

/** A drop into a puddle: a soft, quick, rising note. */
function plip(scape: Scape, when: number) {
  const { context, bus } = scape
  const osc = context.createOscillator()
  osc.type = 'sine'
  const from = between(650, 1150)
  osc.frequency.setValueAtTime(from, when)
  osc.frequency.exponentialRampToValueAtTime(from * 1.6, when + 0.05)
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(between(0.008, 0.016), when + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + between(0.08, 0.13))
  osc.connect(gain)
  gain.connect(bus)
  osc.start(when)
  osc.stop(when + 0.16)
  sound(scape, [osc], [gain])
}

function rain(scape: Scape): Look[] {
  const noise = noiseBuffer(scape.context, 'white')
  // The hiss of rain all around, and under it a softer, lower wash: one noise
  // at two speeds, so their patterns never fall into step.
  const hiss = bed(scape, noise, { type: 'bandpass', frequency: 2600, q: 0.45, level: 0.04 })
  const wash = bed(scape, noise, { type: 'lowpass', frequency: 900, level: 0.035, rate: 0.73 })
  // The rain grows a little heavier and lighter by turns, never by much: slow
  // swells at unrelated speeds, so their pattern never quite comes round.
  sway(scape, hiss.gain.gain, 0.023, 0.007)
  sway(scape, hiss.gain.gain, 0.061, 0.004)
  sway(scape, hiss.filter.frequency, 0.037, 450)
  sway(scape, wash.gain.gain, 0.029, 0.008)
  return [
    // Most drops come alone, a few in a quick little run.
    every(
      0.6,
      () => (Math.random() < 0.25 ? between(0.07, 0.25) : between(0.35, 2.3)),
      (when) => raindrop(scape, noise, when),
    ),
    every(5, () => between(4, 13), (when) => plip(scape, when)),
  ]
}

// ---------------------------------------------------------------------------
// Dawn Birdsong: a few birds with long, quiet pauses, over a hush of air.

/** One bird's whistle for one phrase: its pitch and loudness, set by the phrase. */
interface Whistle {
  pitch: AudioParam
  level: AudioParam
}

function whistle(scape: Scape, start: number, end: number, pan: number): Whistle {
  const { context, bus } = scape
  const osc = context.createOscillator()
  osc.type = 'sine'
  const gain = context.createGain()
  gain.gain.setValueAtTime(0, start)
  osc.connect(gain)
  const nodes: AudioNode[] = [gain]
  // Birds to either side, where the browser can place them; centred otherwise.
  if (typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner()
    panner.pan.value = pan
    gain.connect(panner)
    panner.connect(bus)
    nodes.push(panner)
  } else {
    gain.connect(bus)
  }
  osc.start(start)
  osc.stop(end + 0.05)
  sound(scape, [osc], nodes)
  return { pitch: osc.frequency, level: gain.gain }
}

/** One note of a phrase: a glide in pitch under a soft swell and fall. */
function note(
  voice: Whistle,
  when: number,
  length: number,
  from: number,
  to: number,
  peak: number,
  attack = 0.015,
) {
  voice.pitch.setValueAtTime(from, when)
  voice.pitch.exponentialRampToValueAtTime(to, when + length)
  voice.level.setValueAtTime(0, when)
  voice.level.linearRampToValueAtTime(peak, when + Math.min(attack, length / 3))
  voice.level.linearRampToValueAtTime(peak * 0.7, when + length * 0.7)
  voice.level.linearRampToValueAtTime(0, when + length)
}

/**
 * A phrase as a list of notes, in order: [start offset, length, pitch from,
 * pitch to, loudness, and optionally how long the note takes to swell].
 */
type Phrase = Array<[number, number, number, number, number, number?]>

/** A run of short notes that wander up and down, robin-like. */
function warble(): Phrase {
  const base = between(2300, 3200)
  const phrase: Phrase = []
  let at = 0
  const notes = 3 + Math.floor(Math.random() * 4)
  for (let i = 0; i < notes; i += 1) {
    const length = between(0.07, 0.15)
    const from = base * between(0.85, 1.2)
    phrase.push([at, length, from, from * between(0.8, 1.3), between(0.75, 1)])
    at += length + between(0.03, 0.09)
  }
  return phrase
}

/** Two clear, held notes, the second a little lower. */
function twoNotes(): Phrase {
  const high = between(3300, 4100)
  const first = between(0.28, 0.38)
  const gap = between(0.06, 0.12)
  // Whistled, so they swell more slowly than the other birds' notes.
  return [
    [0, first, high, high * 0.97, 1, 0.04],
    [first + gap, between(0.32, 0.45), high * 0.82, high * 0.8, 0.9, 0.04],
  ]
}

/** A quick trill that swells and fades. */
function trill(): Phrase {
  const chirps = 8 + Math.floor(Math.random() * 7)
  const spacing = between(0.055, 0.075)
  const high = between(3600, 4800)
  return Array.from({ length: chirps }, (_, i) => [
    i * spacing,
    spacing * 0.8,
    high,
    high * 0.75,
    0.4 + 0.6 * Math.sin((Math.PI * (i + 0.5)) / chirps),
  ])
}

/** A few rising calls, like the garden's distant birds, but nearer. */
function calls(): Phrase {
  const count = 2 + Math.floor(Math.random() * 3)
  const from = between(2100, 3000)
  const phrase: Phrase = []
  let at = 0
  for (let i = 0; i < count; i += 1) {
    phrase.push([at, 0.13, from, from * 1.5, 1])
    at += between(0.18, 0.28)
  }
  return phrase
}

const PHRASES = [warble, twoNotes, trill, calls]

/** Sing one phrase from somewhere in the garden; returns when it ends. */
function sing(scape: Scape, when: number, make: () => Phrase, pan: number, loudness: number) {
  const phrase = make()
  const [lastAt, lastLength] = phrase[phrase.length - 1]
  const end = when + lastAt + lastLength
  const voice = whistle(scape, when, end, pan)
  for (const [at, length, from, to, level, attack] of phrase) {
    note(voice, when + at, length, from, to, loudness * level, attack)
  }
  return end
}

function birdsong(scape: Scape): Look[] {
  // The faintest morning air under the birds.
  const air = bed(scape, noiseBuffer(scape.context, 'brown'), {
    type: 'lowpass',
    frequency: 480,
    level: 0.035,
  })
  sway(scape, air.gain.gain, 0.05, 0.01)
  return [
    // Long, uneven pauses: mostly some seconds, now and then much longer.
    every(
      between(2, 4),
      () => 4 + 18 * Math.random() ** 1.5,
      (when) => {
        const make = PHRASES[Math.floor(Math.random() * PHRASES.length)]
        // Near birds are a little louder than far ones, and none is loud.
        const loudness = () => (Math.random() < 0.5 ? between(0.016, 0.022) : between(0.006, 0.011))
        const end = sing(scape, when, make, between(-0.7, 0.7), loudness())
        // Sometimes another answers from elsewhere.
        if (Math.random() < 0.3)
          sing(scape, end + between(0.8, 2.5), make, between(-0.7, 0.7), loudness())
      },
    ),
  ]
}

// ---------------------------------------------------------------------------

/** What each soundscape is made of; every track has one, or this will not build. */
const SOUNDSCAPES: Record<AmbientTrackId, (scape: Scape) => Look[]> = {
  'garden-chimes': (scape) => garden(scape, true),
  garden: (scape) => garden(scape, false),
  'piano-music': piano,
  'soft-rain': rain,
  'dawn-birdsong': birdsong,
}

/** Start a soundscape into `output`, fading in over CROSSFADE_SECONDS. */
export function startSoundscape(
  context: AudioContext,
  output: AudioNode,
  trackId: AmbientTrackId,
): Soundscape {
  const bus = context.createGain()
  const now = context.currentTime
  bus.gain.setValueAtTime(0, now)
  bus.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS)
  bus.connect(output)
  const scape: Scape = {
    context,
    bus,
    nodes: new Set(),
    sources: new Set(),
    stopped: false,
  }
  run(scape, SOUNDSCAPES[trackId](scape))
  return {
    trackId,
    stop: () => {
      if (scape.stopped) return
      scape.stopped = true
      window.clearTimeout(scape.timer)
      try {
        const at = context.currentTime
        bus.gain.cancelScheduledValues(at)
        bus.gain.setValueAtTime(bus.gain.value, at)
        bus.gain.linearRampToValueAtTime(0, at + CROSSFADE_SECONDS)
      } catch {
        // The context is closed.
      }
      window.setTimeout(() => dispose(scape), CROSSFADE_SECONDS * 1000 + 100)
    },
    dispose: () => dispose(scape),
  }
}
