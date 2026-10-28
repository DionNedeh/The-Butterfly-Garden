import { describe, expect, it } from 'vitest'
import { createInitialState } from './progression'
import {
  clampVolume,
  DEFAULT_SOUND_VOLUME,
  gainForVolume,
  heardTrack,
  setSoundFollowsTheme,
  setSoundInBackground,
  setSoundVolume,
  soundVolumeOf,
} from './sound'
import type { AppState, Profile } from '../types'

function gardenWith(fields: Partial<Profile> = {}): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return { ...seed, profile: { ...seed.profile!, ...fields } }
}

describe('the volume', () => {
  it('plays a garden with no volume chosen at exactly the level it always had', () => {
    expect(soundVolumeOf(gardenWith().profile)).toBe(DEFAULT_SOUND_VOLUME)
    expect(soundVolumeOf(undefined)).toBe(DEFAULT_SOUND_VOLUME)
    expect(gainForVolume(DEFAULT_SOUND_VOLUME)).toBe(0.5)
  })

  it('rises evenly to the ear, from silence to 12 dB above the usual level', () => {
    expect(gainForVolume(0)).toBe(0)
    expect(gainForVolume(100)).toBe(2)
    // A quarter of the way down is a quarter of the usual strength, not three
    // quarters of it as a straight line would make it.
    expect(gainForVolume(25)).toBeCloseTo(0.125)
    for (let volume = 1; volume <= 100; volume += 1) {
      expect(gainForVolume(volume)).toBeGreaterThan(gainForVolume(volume - 1))
    }
  })

  it('is a whole number from 0 to 100', () => {
    expect(clampVolume(42.4)).toBe(42)
    expect(clampVolume(-3)).toBe(0)
    expect(clampVolume(180)).toBe(100)
    expect(gainForVolume(180)).toBe(2)
  })

  it('is stored when changed, and the garden is left alone when it is not', () => {
    const garden = gardenWith()
    expect(setSoundVolume(garden, DEFAULT_SOUND_VOLUME)).toBe(garden)
    expect(setSoundVolume(garden, Number.NaN)).toBe(garden)

    const quieter = setSoundVolume(garden, 30.2)
    expect(quieter.profile?.ambientVolume).toBe(30)
    expect(garden.profile).not.toHaveProperty('ambientVolume')
    expect(setSoundVolume(quieter, 30)).toBe(quieter)
    expect(setSoundVolume(quieter, 50).profile?.ambientVolume).toBe(50)

    const unmade = { ...garden, profile: undefined }
    expect(setSoundVolume(unmade, 20)).toBe(unmade)
  })
})

describe('night brings the piano', () => {
  it('plays the chosen soundscape until it is asked for', () => {
    const profile = gardenWith({ ambientTrack: 'soft-rain' }).profile
    expect(heardTrack(profile, 'night')).toBe('soft-rain')
    expect(heardTrack(profile, 'sunlight')).toBe('soft-rain')
    expect(heardTrack(undefined, 'night')).toBe('garden-chimes')
  })

  it('plays the piano while the theme on screen is night, and the chosen one in sunlight', () => {
    const profile = gardenWith({ ambientTrack: 'dawn-birdsong', soundFollowsTheme: true }).profile
    expect(heardTrack(profile, 'night')).toBe('piano-music')
    expect(heardTrack(profile, 'sunlight')).toBe('dawn-birdsong')
  })

  it('is switched on and off, leaving the garden alone when nothing changes', () => {
    const garden = gardenWith()
    expect(setSoundFollowsTheme(garden, false)).toBe(garden)
    const on = setSoundFollowsTheme(garden, true)
    expect(on.profile?.soundFollowsTheme).toBe(true)
    expect(garden.profile).not.toHaveProperty('soundFollowsTheme')
    expect(setSoundFollowsTheme(on, true)).toBe(on)
    expect(setSoundFollowsTheme(on, false).profile?.soundFollowsTheme).toBeUndefined()
    const unmade = { ...garden, profile: undefined }
    expect(setSoundFollowsTheme(unmade, true)).toBe(unmade)
  })
})

describe('playing in the background', () => {
  it('keeps playing unless asked not to, storing only the exception', () => {
    const garden = gardenWith()
    expect(setSoundInBackground(garden, true)).toBe(garden)
    const paused = setSoundInBackground(garden, false)
    expect(paused.profile?.soundInBackground).toBe(false)
    expect(garden.profile).not.toHaveProperty('soundInBackground')
    expect(setSoundInBackground(paused, false)).toBe(paused)
    expect(setSoundInBackground(paused, true).profile?.soundInBackground).toBeUndefined()
    const unmade = { ...garden, profile: undefined }
    expect(setSoundInBackground(unmade, false)).toBe(unmade)
  })
})
