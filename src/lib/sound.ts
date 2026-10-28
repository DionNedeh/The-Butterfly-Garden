import { DEFAULT_AMBIENT_TRACK_ID, NIGHT_AMBIENT_TRACK_ID } from '../data/ambientTracks'
import type { AmbientTrackId, AppState, AppearanceTheme, Profile } from '../types'

/**
 * The gardener's say over the soundscape: how loud, whether night brings the
 * piano, and whether it keeps playing in the background. The sound itself is
 * made in hooks/useAmbientSound and lib/soundscapes.
 */

/** The volume a garden starts at, the middle of the slider. */
export const DEFAULT_SOUND_VOLUME = 50

/** The master gain at the usual volume: the level the garden always played at. */
const USUAL_GAIN = 0.5

/** A volume as stored: a whole number from 0 to 100. */
export function clampVolume(volume: number): number {
  return Math.min(100, Math.max(0, Math.round(volume)))
}

/** The gardener's volume, or the usual one. */
export function soundVolumeOf(profile: Pick<Profile, 'ambientVolume'> | undefined): number {
  return profile?.ambientVolume ?? DEFAULT_SOUND_VOLUME
}

/**
 * The master gain for a volume from 0 to 100.
 *
 * It follows the square of the slider rather than a straight line: the ear
 * hears loudness in ratios, so a straight line would crowd every quiet level
 * into the slider's first few steps. The middle is exactly the level the
 * garden always played at; the top is 12 dB above it, for a phone's small
 * speaker, and every soundscape is quiet enough to stay clear of clipping
 * there.
 */
export function gainForVolume(volume: number): number {
  return USUAL_GAIN * (clampVolume(volume) / DEFAULT_SOUND_VOLUME) ** 2
}

/**
 * The soundscape that plays: the one chosen, unless night brings the piano
 * and the theme on screen is night. The theme is the effective one, so a
 * garden that follows the device or the evening turns with it.
 */
export function heardTrack(
  profile: Pick<Profile, 'ambientTrack' | 'soundFollowsTheme'> | undefined,
  theme: AppearanceTheme,
): AmbientTrackId {
  if (profile?.soundFollowsTheme && theme === 'night') return NIGHT_AMBIENT_TRACK_ID
  return profile?.ambientTrack ?? DEFAULT_AMBIENT_TRACK_ID
}

/** Set the volume. The usual volume needs nothing stored, but is kept if set. */
export function setSoundVolume(state: AppState, volume: number): AppState {
  if (!state.profile || !Number.isFinite(volume)) return state
  const ambientVolume = clampVolume(volume)
  if (soundVolumeOf(state.profile) === ambientVolume) return state
  return { ...state, profile: { ...state.profile, ambientVolume } }
}

/** Night brings the piano, or the chosen soundscape plays at every hour. */
export function setSoundFollowsTheme(state: AppState, on: boolean): AppState {
  if (!state.profile || Boolean(state.profile.soundFollowsTheme) === on) return state
  return { ...state, profile: { ...state.profile, soundFollowsTheme: on ? true : undefined } }
}

/** Keep playing in the background (the default), or pause while hidden. */
export function setSoundInBackground(state: AppState, on: boolean): AppState {
  if (!state.profile || (state.profile.soundInBackground !== false) === on) return state
  return { ...state, profile: { ...state.profile, soundInBackground: on ? undefined : false } }
}
