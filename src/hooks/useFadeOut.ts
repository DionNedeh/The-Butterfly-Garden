import { useEffect, useRef, useState } from 'react'

/** The fade-out lengths offered in Settings, in minutes. */
export const FADE_OUT_CHOICES = [15, 30, 60] as const
export type FadeOutMinutes = (typeof FADE_OUT_CHOICES)[number]

/**
 * A fade-out timer for the soundscape, offered as calming ambience rather
 * than a sleep aid: the evidence does not support all-night background noise
 * for sleep, and the Breeze layer is brown noise.
 *
 * The choice lasts for this visit only. Each time the sound is turned on the
 * timer starts again; turning it off cancels the timer. When it runs out it
 * calls `onEnd`, which turns the sound off. `endsAt` says when, so the sound
 * can fade on its way there and Settings can say so.
 */
export function useFadeOut(onEnd: () => void) {
  const [minutes, setMinutes] = useState<FadeOutMinutes>()
  const [endsAt, setEndsAt] = useState<number>()
  const end = useRef(onEnd)
  useEffect(() => {
    end.current = onEnd
  }, [onEnd])

  useEffect(() => {
    if (endsAt === undefined) return
    const timer = window.setTimeout(() => {
      setEndsAt(undefined)
      end.current()
    }, Math.max(0, endsAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [endsAt])

  const from = (length: FadeOutMinutes | undefined) =>
    length === undefined ? undefined : Date.now() + length * 60_000

  return {
    minutes,
    endsAt,
    /** Choose a length (or none). Starts now if the sound is already on. */
    choose: (length: FadeOutMinutes | undefined, soundOn: boolean) => {
      setMinutes(length)
      setEndsAt(soundOn ? from(length) : undefined)
    },
    /** The gardener turned the sound on or off. */
    soundSwitched: (on: boolean) => setEndsAt(on ? from(minutes) : undefined),
  }
}
