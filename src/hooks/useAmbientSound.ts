import { useEffect, useRef } from 'react'

/**
 * A generative garden soundscape, synthesized on-device with the Web Audio
 * API so it works offline and adds nothing to the bundle: a soft filtered
 * breeze, pentatonic wind chimes, and the occasional distant bird.
 */

interface AmbientEngine {
  context: AudioContext
  master: GainNode
  timers: number[]
  stopped: boolean
}

const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]

function startEngine(): AmbientEngine | undefined {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioContextClass) return undefined
  const context = new AudioContextClass()
  const master = context.createGain()
  master.gain.value = 0
  master.connect(context.destination)
  // gentle fade in
  master.gain.linearRampToValueAtTime(0.5, context.currentTime + 3)

  const engine: AmbientEngine = { context, master, timers: [], stopped: false }

  // --- Breeze: looped brown noise through a slowly wandering lowpass ----
  const seconds = 4
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
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

  // --- Wind chimes: occasional soft pentatonic strikes ------------------
  const chime = () => {
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
    engine.timers.push(
      window.setTimeout(chime, 3500 + Math.random() * 8000),
    )
  }
  engine.timers.push(window.setTimeout(chime, 1500))

  // --- Birds: rare, quiet chirps from far away ---------------------------
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
    engine.timers.push(
      window.setTimeout(bird, 6000 + Math.random() * 14000),
    )
  }
  engine.timers.push(window.setTimeout(bird, 4000))

  return engine
}

function stopEngine(engine: AmbientEngine) {
  engine.stopped = true
  engine.timers.forEach((timer) => window.clearTimeout(timer))
  const { context, master } = engine
  try {
    master.gain.cancelScheduledValues(context.currentTime)
    master.gain.setValueAtTime(master.gain.value, context.currentTime)
    master.gain.linearRampToValueAtTime(0, context.currentTime + 0.8)
  } catch {
    // context may already be closed
  }
  window.setTimeout(() => {
    void context.close().catch(() => undefined)
  }, 900)
}

export function useAmbientSound(enabled: boolean) {
  const engineRef = useRef<AmbientEngine>(undefined)

  useEffect(() => {
    if (enabled && !engineRef.current) {
      engineRef.current = startEngine()
    } else if (!enabled && engineRef.current) {
      stopEngine(engineRef.current)
      engineRef.current = undefined
    }
    return () => {
      if (engineRef.current) {
        stopEngine(engineRef.current)
        engineRef.current = undefined
      }
    }
  }, [enabled])
}
