import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyState } from './progression'
import type { AppState } from '../types'

vi.mock('./playBilling', () => ({
  getPassStatus: vi.fn(),
  onPassStatusChange: vi.fn(() => () => undefined),
}))

/** Fresh modules, so each test starts from "checking". */
async function load() {
  vi.resetModules()
  const pass = await import('./gardenPass')
  const entitlement = await import('./passEntitlement')
  return { ...pass, ...entitlement }
}

const status = (state: 'active' | 'pending' | 'suspended' | 'inactive' | 'unavailable' | 'unconfigured') =>
  ({ state, fromCache: false, lapsed: false }) as const

describe('the Garden Pass in the Android app', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('answers to Google Play, never to the preview', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { releasePassProvider, playProvider } = await load()
    expect(releasePassProvider()).toBe(playProvider)
    vi.stubEnv('VITE_GARDEN_PASS_PREVIEW', 'on')
    expect(releasePassProvider()).toBe(playProvider)
  })

  it('stays in the preview in the PWA', async () => {
    const { releasePassProvider, previewProvider } = await load()
    expect(releasePassProvider()).toBe(previewProvider)
  })

  it('opens only while Play says the Pass is active', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { gardenPassAccess, setPassStatus } = await load()
    expect(gardenPassAccess('pass-cosmetics').allowed).toBe(false)
    for (const closed of ['pending', 'suspended', 'inactive', 'unavailable', 'unconfigured'] as const) {
      setPassStatus(status(closed))
      expect(gardenPassAccess('pass-cosmetics').allowed).toBe(false)
      expect(gardenPassAccess('custom-backdrops').allowed).toBe(false)
    }
    setPassStatus(status('active'))
    for (const feature of ['pass-cosmetics', 'pass-backdrops', 'custom-backdrops'] as const) {
      const access = gardenPassAccess(feature)
      expect(access.allowed).toBe(true)
      expect(access.source).toBe('verified-provider')
    }
    setPassStatus(status('inactive'))
    expect(gardenPassAccess('pass-backdrops').allowed).toBe(false)
  })

  it('cannot be opened by anything written into a garden', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { gardenPassAccess, canWearItem } = await load()
    const forged = {
      ...createEmptyState(),
      ownedItemIds: ['royal-monarch-crown'],
      subscription: { active: true },
      gardenPass: { allowed: true, source: 'verified-provider' },
    } as unknown as AppState
    expect(gardenPassAccess('pass-cosmetics').allowed).toBe(false)
    // Even "owning" a Pass item does not make it wearable without the Pass.
    expect(
      canWearItem(forged.ownedItemIds, { id: 'royal-monarch-crown', premium: true }),
    ).toBe(false)
  })

  it('tells subscribers when Play changes its answer', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { subscribeToPassStatus, setPassStatus, passStatus } = await load()
    const listener = vi.fn()
    const stop = subscribeToPassStatus(listener)
    setPassStatus(status('active'))
    setPassStatus(status('active'))
    expect(listener).toHaveBeenCalledOnce()
    expect(passStatus().state).toBe('active')
    stop()
    setPassStatus(status('inactive'))
    expect(listener).toHaveBeenCalledOnce()
  })

  it('asks Play once on start and follows its changes after', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const { trackPassStatus, passStatus } = await load()
    const playBilling = await import('./playBilling')
    vi.mocked(playBilling.getPassStatus).mockResolvedValueOnce(status('active'))
    let push: ((next: ReturnType<typeof status>) => void) | undefined
    vi.mocked(playBilling.onPassStatusChange).mockImplementationOnce((handler) => {
      push = handler
      return () => undefined
    })
    trackPassStatus()
    await vi.waitFor(() => expect(passStatus().state).toBe('active'))
    push?.(status('suspended'))
    expect(passStatus().state).toBe('suspended')
  })
})
