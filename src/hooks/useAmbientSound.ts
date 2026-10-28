import { useCallback, useEffect, useRef } from 'react'
import { gainForVolume } from '../lib/sound'
import type { Soundscape } from '../lib/soundscapes'
import type { AmbientTrackId } from '../types'

/**
 * The garden's sound: one audio context while the sound is on, its master
 * gain (the gardener's volume and the fade-out timer), and the soundscape
 * playing into it.
 *
 * The soundscapes themselves (lib/soundscapes) are loaded when the sound
 * first starts, so the app's first load does not carry them. The context is
 * made here, at once, inside the tap that turned the sound on: browsers let a
 * page start sound only from a gesture, and one made later, once the module
 * has arrived, could be held silent.
 */

interface AmbientEngine {
  context: AudioContext
  master: GainNode
  stopped: boolean
  /** The volume the master is at or on its way to; unset until first set. */
  volume?: number
  /** When the fade-out timer runs out, while one is running. */
  fadeEndsAt?: number
  /** The soundscape asked for, and the one playing once it has loaded. */
  trackId?: AmbientTrackId
  soundscape?: Soundscape
  /** Suspended because the page was hidden, not held back by the browser. */
  pausedWhileHidden: boolean
  /** Detaches the "resume on first gesture" listeners, if any are attached. */
  releaseGesture?: () => void
}

/** How long the fade-out timer takes to bring the sound down to nothing. */
export const FADE_OUT_SECONDS = 60

/** How long the sound takes to come in when it is switched on. */
const FADE_IN_SECONDS = 3

/** How long a change of volume takes: quick to follow, too slow to click. */
const VOLUME_STEP_SECONDS = 0.12

/** Taking the fade-out timer away brings the sound back over this long. */
const RETURN_SECONDS = 2

let soundscapes: Promise<typeof import('../lib/soundscapes')> | undefined

/** The soundscapes' module, fetched once; a failed fetch is tried again next time. */
function loadSoundscapes() {
  soundscapes ??= import('../lib/soundscapes').catch((error: unknown) => {
    soundscapes = undefined
    throw error
  })
  return soundscapes
}

function createEngine(): AmbientEngine | undefined {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioContextClass) return undefined

  // Browsers cap how many audio contexts a page may hold open at once, and
  // stopEngine closes the previous one on a short delay, so toggling sound
  // quickly can hit that ceiling. The constructor throws there, and this runs
  // inside an effect, where an uncaught throw takes the whole app down.
  // Falling silent is the right failure.
  let context: AudioContext
  try {
    context = new AudioContextClass()
  } catch {
    return undefined
  }
  const master = context.createGain()
  master.gain.value = 0
  master.connect(context.destination)

  const engine: AmbientEngine = {
    context,
    master,
    stopped: false,
    pausedWhileHidden: false,
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

function stopEngine(engine: AmbientEngine) {
  engine.stopped = true
  engine.releaseGesture?.()
  engine.soundscape?.stop()
  const { context, master } = engine
  try {
    master.gain.cancelScheduledValues(context.currentTime)
    master.gain.setValueAtTime(master.gain.value, context.currentTime)
    master.gain.linearRampToValueAtTime(0, context.currentTime + 0.8)
  } catch {
    // The context may already be closed.
  }
  window.setTimeout(() => {
    engine.soundscape?.dispose()
    master.disconnect()
    void context.close().catch(() => undefined)
  }, 900)
}

/**
 * Play `trackId`, crossfading from whatever plays now, in the same context: a
 * change of soundscape (night bringing the piano, say) may come with no tap
 * to start a new one.
 */
function playTrack(engine: AmbientEngine, trackId: AmbientTrackId) {
  engine.trackId = trackId
  void loadSoundscapes()
    .then(({ startSoundscape }) => {
      if (engine.stopped || engine.trackId !== trackId) return
      if (engine.soundscape?.trackId === trackId) return
      engine.soundscape?.stop()
      engine.soundscape = startSoundscape(engine.context, engine.master, trackId)
    })
    // The soundscapes could not be loaded: the garden stays quiet.
    .catch(() => undefined)
}

/**
 * Bring the master to the level it should have now, over `seconds`: the
 * gardener's volume, or, within the fade-out timer's last minute, where the
 * fade has reached by the clock, then on down to nothing as the timer runs
 * out. Worked out from the wall clock each time, so it is right after a
 * pause, when the audio clock stood still and the timer did not.
 */
function applyLevel(engine: AmbientEngine, seconds: number) {
  if (engine.stopped || engine.volume === undefined) return
  const { context, master } = engine
  const full = gainForVolume(engine.volume)
  const left =
    engine.fadeEndsAt === undefined
      ? Infinity
      : (engine.fadeEndsAt - Date.now()) / 1000
  const now = context.currentTime
  try {
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    if (left > FADE_OUT_SECONDS) {
      master.gain.linearRampToValueAtTime(full, now + seconds)
    } else {
      const fading = (full * Math.max(0, left - seconds)) / FADE_OUT_SECONDS
      master.gain.linearRampToValueAtTime(fading, now + seconds)
      master.gain.linearRampToValueAtTime(0, now + Math.max(seconds, left))
    }
  } catch {
    // The context may already be closed.
  }
}

/** Carry on after a pause while the page was hidden. */
function resumeAfterHiding(engine: AmbientEngine) {
  engine.pausedWhileHidden = false
  if (engine.stopped) return
  void engine.context.resume().catch(() => undefined)
  applyLevel(engine, VOLUME_STEP_SECONDS)
}

export interface AmbientSoundOptions {
  /** Whether the sound plays. */
  enabled: boolean
  /** The soundscape that plays (lib/sound's heardTrack). */
  trackId: AmbientTrackId
  /** How loud, 0 to 100 (lib/sound). */
  volume: number
  /**
   * When the fade-out timer runs out (ms since the epoch): the sound is
   * lowered over the last FADE_OUT_SECONDS before then, and the caller turns
   * it off at that time (hooks/useFadeOut). Taking it away brings the volume
   * back.
   */
  fadeEndsAt?: number
  /** Pause while the page is hidden, and pick up again when it is seen. */
  pauseWhenHidden?: boolean
}

/**
 * Play the garden's soundscape while `enabled`. Returns `hearVolume`, for a
 * volume being chosen: heard at once, before it is stored.
 */
export function useAmbientSound({
  enabled,
  trackId,
  volume,
  fadeEndsAt,
  pauseWhenHidden = false,
}: AmbientSoundOptions) {
  const engineRef = useRef<AmbientEngine>(undefined)

  // One context for as long as the sound is on.
  useEffect(() => {
    if (!enabled) return
    const engine = createEngine()
    engineRef.current = engine
    return () => {
      if (engine) stopEngine(engine)
      engineRef.current = undefined
    }
  }, [enabled])

  useEffect(() => {
    const engine = engineRef.current
    if (enabled && engine) playTrack(engine, trackId)
  }, [enabled, trackId])

  // The first volume brings the sound in; each change after that glides.
  useEffect(() => {
    const engine = engineRef.current
    if (!enabled || !engine || engine.volume === volume) return
    const first = engine.volume === undefined
    engine.volume = volume
    applyLevel(engine, first ? FADE_IN_SECONDS : VOLUME_STEP_SECONDS)
  }, [enabled, volume])

  useEffect(() => {
    const engine = engineRef.current
    if (!enabled || !engine || fadeEndsAt === undefined) return
    engine.fadeEndsAt = fadeEndsAt
    const timer = window.setTimeout(
      () => applyLevel(engine, VOLUME_STEP_SECONDS),
      Math.max(0, fadeEndsAt - FADE_OUT_SECONDS * 1000 - Date.now()),
    )
    return () => {
      window.clearTimeout(timer)
      engine.fadeEndsAt = undefined
      applyLevel(engine, RETURN_SECONDS)
    }
  }, [enabled, fadeEndsAt])

  // Hidden, the context is suspended rather than closed, so the soundscape
  // carries on where it was, with no new context to start without a tap.
  // Only a sound that is playing is paused: one the browser is still holding
  // back until a first tap is left to that tap.
  useEffect(() => {
    const engine = engineRef.current
    if (!enabled || !engine || !pauseWhenHidden) return
    const follow = () => {
      if (engine.stopped) return
      if (document.visibilityState === 'hidden') {
        if (engine.pausedWhileHidden || engine.context.state !== 'running') return
        engine.pausedWhileHidden = true
        void engine.context.suspend().catch(() => undefined)
      } else if (engine.pausedWhileHidden) {
        resumeAfterHiding(engine)
      }
    }
    follow()
    document.addEventListener('visibilitychange', follow)
    return () => {
      document.removeEventListener('visibilitychange', follow)
      if (engine.pausedWhileHidden) resumeAfterHiding(engine)
    }
  }, [enabled, pauseWhenHidden])

  const hearVolume = useCallback((chosen: number) => {
    const engine = engineRef.current
    if (!engine || engine.volume === chosen) return
    engine.volume = chosen
    applyLevel(engine, VOLUME_STEP_SECONDS)
  }, [])

  return { hearVolume }
}
