import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SOUND_VOLUME } from '../lib/sound'
import type { Profile } from '../types'

/**
 * The volume slider in Settings' sound card.
 *
 * A drag is heard as it moves (`onHear`) but stored only when it is let go
 * (`onSet`), on the input's own change event: storing every step would write
 * the garden dozens of times a second and wake every other open tab as often.
 * Each key press is a step of its own, so it is stored at once.
 */
export function SoundVolume({
  volume,
  onHear,
  onSet,
}: {
  volume: number
  onHear?: (volume: number) => void
  onSet: (volume: number) => void
}) {
  /** The value under the gardener's finger, until it is let go. */
  const [moving, setMoving] = useState<number>()
  const slider = useRef<HTMLInputElement>(null)
  const pending = useRef<number>(undefined)
  const store = useRef(onSet)
  useEffect(() => {
    store.current = onSet
  }, [onSet])

  useEffect(() => {
    const input = slider.current
    if (!input) return
    const letGo = () => {
      pending.current = undefined
      setMoving(undefined)
      store.current(Number(input.value))
    }
    input.addEventListener('change', letGo)
    return () => {
      input.removeEventListener('change', letGo)
      // Leaving Settings mid-drag still keeps what was being heard.
      if (pending.current !== undefined) store.current(pending.current)
    }
  }, [])

  const shown = moving ?? volume
  return (
    <div className="sound-volume">
      <label htmlFor="sound-volume">Volume</label>
      <div className="sound-volume-row">
        <input
          ref={slider}
          id="sound-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          value={shown}
          aria-valuetext={shown === DEFAULT_SOUND_VOLUME ? `${shown}, the usual level` : String(shown)}
          onChange={(event) => {
            const next = Number(event.target.value)
            pending.current = next
            setMoving(next)
            onHear?.(next)
          }}
        />
        {/* The slider announces its own value; this is the same, for the eye. */}
        <span className="sound-volume-value" aria-hidden="true">
          {shown}
        </span>
      </div>
      <small className="subtle-copy">{DEFAULT_SOUND_VOLUME} is the garden’s usual level.</small>
    </div>
  )
}

/**
 * When the sound plays: whether night brings the piano, and whether it keeps
 * playing in the background. The Android app always rests the sound in the
 * background (App.tsx), so there it says so instead of offering a switch.
 */
export function SoundSwitches({
  profile,
  android,
  onSetFollowsTheme,
  onSetInBackground,
}: {
  profile: Pick<Profile, 'soundFollowsTheme' | 'soundInBackground'> | undefined
  android: boolean
  onSetFollowsTheme?: (on: boolean) => void
  onSetInBackground?: (on: boolean) => void
}) {
  if (!onSetFollowsTheme && !onSetInBackground) return null
  return (
    <div className="sound-switches">
      {onSetFollowsTheme && (
        <label className="toggle-row">
          <span>
            <strong>Night brings the piano</strong>
            <small>
              While the garden is in its night theme, Piano Music plays. Your
              own choice returns with the sunlight.
            </small>
          </span>
          <input
            type="checkbox"
            checked={profile?.soundFollowsTheme === true}
            onChange={(event) => onSetFollowsTheme(event.target.checked)}
          />
        </label>
      )}
      {onSetInBackground &&
        (android ? (
          <p className="subtle-copy">
            The sound rests while the app is in the background, and starts
            again when you come back.
          </p>
        ) : (
          <label className="toggle-row">
            <span>
              <strong>Keep playing when the app is in the background</strong>
              <small>
                Turn this off to pause the sound while you are in another tab
                or app. It picks up again when you come back.
              </small>
            </span>
            <input
              type="checkbox"
              checked={profile?.soundInBackground !== false}
              onChange={(event) => onSetInBackground(event.target.checked)}
            />
          </label>
        ))}
    </div>
  )
}
