import { useEffect, useRef } from 'react'
import type { AmbientTrackId } from '../types'

/**
 * Three on-device soundscapes built with the Web Audio API. The original
 * garden blend is preserved, the garden-only option omits its wind chimes,
 * and the piano option plays an original classical-style loop.
 */

interface AmbientEngine {
  context: AudioContext
  master: GainNode
  /** Pending timeouts only — entries are removed as they fire, so a long
   *  listening session does not accumulate thousands of stale handles. */
  timers: Set<number>
  stopped: boolean
  /** Detaches the "resume on first gesture" listeners, if any are attached. */
  releaseGesture?: () => void
}

/** Schedule work on the engine, keeping the pending-timer set accurate. */
function schedule(engine: AmbientEngine, run: () => void, delay: number) {
  const id = window.setTimeout(() => {
    engine.timers.delete(id)
    run()
  }, delay)
  engine.timers.add(id)
}

interface PianoNote {
  beat: number
  midi: number
  duration: number
  velocity?: number
}

const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]
const PIANO_BEAT_SECONDS = 60 / 72
const PIANO_LOOP_BEATS = 24

// An original eight-measure garden waltz in C major.
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

function createEngine(): AmbientEngine | undefined {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioContextClass) return undefined

  const context = new AudioContextClass()
  const master = context.createGain()
  master.gain.value = 0
  master.connect(context.destination)
  master.gain.linearRampToValueAtTime(0.5, context.currentTime + 3)

  const engine: AmbientEngine = {
    context,
    master,
    timers: new Set(),
    stopped: false,
  }

  void context.resume().catch(() => undefined)

  // A page reloaded with sound already switched on has had no user gesture
  // yet, so the browser keeps the context suspended and the garden is silent
  // while the button reads "on". Resume at the first interaction instead.
  if (context.state === 'suspended') {
    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
    ]
    const resume = () => {
      if (engine.stopped) return
      void context.resume().catch(() => undefined)
      engine.releaseGesture?.()
    }
    engine.releaseGesture = () => {
      events.forEach((event) => window.removeEventListener(event, resume))
      engine.releaseGesture = undefined
    }
    events.forEach((event) =>
      window.addEventListener(event, resume, { once: false, passive: true }),
    )
  }

  return engine
}

function startGardenSound(engine: AmbientEngine, includeNotes: boolean) {
  const { context, master } = engine

  // Breeze: looped brown noise through a slowly wandering lowpass.
  const seconds = 4
  const buffer = context.createBuffer(
    1,
    context.sampleRate * seconds,
    context.sampleRate,
  )
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.2
  }
  const noise = context.createBufferSource()
  noise.buffer = buffer
  noise.loop = true
  const breezeFilter = context.createBiquadFilter()
  breezeFilter.type = 'lowpass'
  breezeFilter.frequency.value = 320
  const breezeGain = context.createGain()
  breezeGain.gain.value = 0.06
  const breezeLfo = context.createOscillator()
  breezeLfo.frequency.value = 0.07
  const breezeLfoGain = context.createGain()
  breezeLfoGain.gain.value = 0.035
  breezeLfo.connect(breezeLfoGain)
  breezeLfoGain.connect(breezeGain.gain)
  noise.connect(breezeFilter)
  breezeFilter.connect(breezeGain)
  breezeGain.connect(master)
  noise.start()
  breezeLfo.start()

  if (includeNotes) {
    const notes = () => {
      if (engine.stopped) return
      const strikes = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < strikes; i += 1) {
        const when = context.currentTime + i * (0.18 + Math.random() * 0.3)
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
        gain.connect(master)
        shimmerGain.connect(master)
        osc.start(when)
        shimmer.start(when)
        osc.stop(when + 3)
        shimmer.stop(when + 2)
      }
      schedule(engine, notes, 3500 + Math.random() * 8000)
    }
    schedule(engine, notes, 1500)
  }

  // Rare, quiet birds from far away.
  const bird = () => {
    if (engine.stopped) return
    const chirps = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < chirps; i += 1) {
      const when = context.currentTime + i * (0.14 + Math.random() * 0.1)
      const osc = context.createOscillator()
      osc.type = 'sine'
      const start = 2100 + Math.random() * 900
      osc.frequency.setValueAtTime(start, when)
      osc.frequency.exponentialRampToValueAtTime(start * 1.7, when + 0.06)
      osc.frequency.exponentialRampToValueAtTime(start * 0.9, when + 0.11)
      const gain = context.createGain()
      gain.gain.setValueAtTime(0, when)
      gain.gain.linearRampToValueAtTime(0.02, when + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.13)
      osc.connect(gain)
      gain.connect(master)
      osc.start(when)
      osc.stop(when + 0.2)
    }
    schedule(engine, bird, 6000 + Math.random() * 14000)
  }
  schedule(engine, bird, 4000)
}

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12)
}

function playPianoNote(
  context: AudioContext,
  output: AudioNode,
  note: PianoNote,
  loopStart: number,
) {
  const when = loopStart + note.beat * PIANO_BEAT_SECONDS
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
  partials.forEach(([multiple, type, level]) => {
    const oscillator = context.createOscillator()
    const partialGain = context.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency * multiple
    partialGain.gain.value = level
    oscillator.connect(partialGain)
    partialGain.connect(filter)
    oscillator.start(when)
    oscillator.stop(when + duration + 1.25)
  })
}

function schedulePianoLoop(
  engine: AmbientEngine,
  pianoBus: AudioNode,
  loopStart: number,
) {
  PIANO_CHORDS.forEach((chord, measure) => {
    const measureBeat = measure * 3
    playPianoNote(
      engine.context,
      pianoBus,
      {
        beat: measureBeat,
        midi: chord[0] - 12,
        duration: 2.7,
        velocity: 0.022,
      },
      loopStart,
    )
    const pattern = [0, 1, 2, 1, 2, 1]
    pattern.forEach((chordIndex, step) => {
      playPianoNote(
        engine.context,
        pianoBus,
        {
          beat: measureBeat + step * 0.5,
          midi: chord[chordIndex],
          duration: 0.62,
          velocity: step === 0 ? 0.026 : 0.02,
        },
        loopStart,
      )
    })
  })

  PIANO_MELODY.forEach((note) => {
    playPianoNote(engine.context, pianoBus, note, loopStart)
  })
}

function startPiano(engine: AmbientEngine) {
  const { context, master } = engine
  const pianoBus = context.createGain()
  const delay = context.createDelay(1)
  const echoGain = context.createGain()
  pianoBus.gain.value = 0.82
  delay.delayTime.value = 0.24
  echoGain.gain.value = 0.12
  pianoBus.connect(master)
  pianoBus.connect(delay)
  delay.connect(echoGain)
  echoGain.connect(master)

  const loopSeconds = PIANO_LOOP_BEATS * PIANO_BEAT_SECONDS
  let nextLoopStart = context.currentTime + 0.12
  const refill = () => {
    if (engine.stopped) return
    // Keep one loop queued ahead; refill halfway through to avoid a seam
    // without holding two full arrangements in memory on mobile devices.
    const horizon = context.currentTime + loopSeconds * 0.75
    while (nextLoopStart < horizon) {
      schedulePianoLoop(engine, pianoBus, nextLoopStart)
      nextLoopStart += loopSeconds
    }
    schedule(engine, refill, (loopSeconds * 1000) / 2)
  }
  refill()
}

function startEngine(trackId: AmbientTrackId): AmbientEngine | undefined {
  const engine = createEngine()
  if (!engine) return undefined

  if (trackId === 'piano-music') {
    startPiano(engine)
  } else {
    startGardenSound(engine, trackId === 'garden-chimes')
  }
  return engine
}

function stopEngine(engine: AmbientEngine) {
  engine.stopped = true
  engine.releaseGesture?.()
  engine.timers.forEach((timer) => window.clearTimeout(timer))
  engine.timers.clear()
  const { context, master } = engine
  try {
    master.gain.cancelScheduledValues(context.currentTime)
    master.gain.setValueAtTime(master.gain.value, context.currentTime)
    master.gain.linearRampToValueAtTime(0, context.currentTime + 0.8)
  } catch {
    // The context may already be closed.
  }
  window.setTimeout(() => {
    void context.close().catch(() => undefined)
  }, 900)
}

export function useAmbientSound(enabled: boolean, trackId: AmbientTrackId) {
  const engineRef = useRef<AmbientEngine>(undefined)

  useEffect(() => {
    if (enabled) {
      engineRef.current = startEngine(trackId)
    }
    return () => {
      if (engineRef.current) {
        stopEngine(engineRef.current)
        engineRef.current = undefined
      }
    }
  }, [enabled, trackId])
}
