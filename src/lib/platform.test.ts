import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentPlatform, isAndroidApp } from './platform'

describe('platform', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is the web build unless the Android mode says otherwise', () => {
    expect(currentPlatform()).toBe('web')
    expect(isAndroidApp()).toBe(false)
  })

  it('is the Android app when the Android mode set it', () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    expect(currentPlatform()).toBe('android')
    expect(isAndroidApp()).toBe(true)
  })

  it('treats anything else as the web build', () => {
    vi.stubEnv('VITE_PLATFORM', 'Android')
    expect(isAndroidApp()).toBe(false)
    vi.stubEnv('VITE_PLATFORM', '')
    expect(isAndroidApp()).toBe(false)
  })
})
