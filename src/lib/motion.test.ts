import { describe, expect, it } from 'vitest'
import { motionClass, motionPreference } from './motion'

describe('garden motion preference', () => {
  it('reads an older garden, which has no calm field, as full motion', () => {
    expect(motionPreference({ reducedMotion: false })).toBe('full')
    expect(motionPreference(undefined)).toBe('full')
  })

  it('lets reduced motion win over calm', () => {
    expect(motionPreference({ reducedMotion: true, calmMotion: true })).toBe('reduce')
    expect(motionPreference({ reducedMotion: false, calmMotion: true })).toBe('calm')
  })

  it('gives the app shell one class per preference', () => {
    expect(motionClass('full')).toBe('')
    expect(motionClass('calm')).toBe('calm-motion')
    expect(motionClass('reduce')).toBe('reduce-motion')
  })
})
