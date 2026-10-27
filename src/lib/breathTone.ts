import { gainForVolume } from './sound'

/**
 * The soft tone that marks each turn of a breath (plan c.1), for eyes closed
 * or a butterfly kept still by the motion setting.
 *
 * It has an audio context of its own, made inside the tap that starts the
 * session: browsers let a page start sound only from a gesture. It is small
 * and short-lived, a sine with a soft swell and fade for each turn, queued a
 * moment ahead on the audio clock, and closed when the session ends. The
 * garden's soundscape (hooks/useAmbientSound) carries on beside it, at the
 * same volume setting.
 */
export interface BreathTone {
  /** A tone `inSeconds` from now, high for a breath in, low for a breath out. */
  play(inSeconds: number, kind: 'in' | 'out'): void
  /** Stop and let go of every node, and close the context. */
  close(): void
}

/** A breath in sounds a little higher than a breath out: G4 and D4. */
const PITCH = { in: 392, out: 293.66 } as const

/** How long a tone takes to swell, and to fade away again. */
const SWELL_SECONDS = 0.08
const TONE_SECONDS = 1.4

/** How long the tone takes to fall silent when the session ends. */
const CLOSE_SECONDS = 0.15

/**
 * The tone's peak at the garden's usual volume. A plain sine sounds louder
 * than a soundscape of the same level, so it sits well below the master's.
 */
const TONE_LEVEL = 0.16

/** Opens the tone at the gardener's volume (0 to 100), or undefined where there is no Web Audio. */
export function openBreathTone(volume: number): BreathTone | undefined {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return undefined
  // A page may hold only so many contexts; at that limit the constructor
  // throws, and a session without its tone is the right way to fail.
  let context: AudioContext
  try {
    context = new AudioContextClass()
  } catch {
    return undefined
  }
  void context.resume().catch(() => undefined)
  const master = context.createGain()
  master.gain.value = TONE_LEVEL * gainForVolume(volume)
  master.connect(context.destination)
  const ringing = new Set<{ source: OscillatorNode; envelope: GainNode }>()
  let closed = false

  return {
    play(inSeconds, kind) {
      if (closed) return
      const at = context.currentTime + Math.max(0, inSeconds)
      const source = context.createOscillator()
      const envelope = context.createGain()
      source.type = 'sine'
      source.frequency.value = PITCH[kind]
      envelope.gain.setValueAtTime(0.0001, at)
      envelope.gain.exponentialRampToValueAtTime(1, at + SWELL_SECONDS)
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + TONE_SECONDS)
      source.connect(envelope)
      envelope.connect(master)
      const tone = { source, envelope }
      ringing.add(tone)
      source.onended = () => {
        source.disconnect()
        envelope.disconnect()
        ringing.delete(tone)
      }
      source.start(at)
      source.stop(at + TONE_SECONDS + 0.05)
    },
    close() {
      if (closed) return
      closed = true
      // A quick fade rather than a cut, which would click mid-tone.
      const now = context.currentTime
      try {
        master.gain.cancelScheduledValues(now)
        master.gain.setValueAtTime(master.gain.value, now)
        master.gain.linearRampToValueAtTime(0, now + CLOSE_SECONDS)
      } catch {
        // The context may already be closed.
      }
      window.setTimeout(() => {
        for (const { source, envelope } of ringing) {
          try {
            source.stop()
          } catch {
            // Already stopped, or its context is closed.
          }
          source.disconnect()
          envelope.disconnect()
        }
        ringing.clear()
        master.disconnect()
        void context.close().catch(() => undefined)
      }, CLOSE_SECONDS * 1000 + 50)
    },
  }
}
