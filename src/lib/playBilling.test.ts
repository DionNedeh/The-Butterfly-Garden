import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPassOffers,
  getPassStatus,
  managePassSubscription,
  parseOffers,
  parseStatus,
  subscribeToPass,
} from './playBilling'

const registerPlugin = vi.hoisted(() => vi.fn())
vi.mock('@capacitor/core', () => ({ registerPlugin }))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('parseStatus', () => {
  it('accepts what the native side sends', () => {
    expect(parseStatus({ state: 'active', fromCache: true, lapsed: false })).toEqual({
      state: 'active',
      fromCache: true,
      lapsed: false,
    })
  })

  it('reads anything unexpected as unavailable, never as access', () => {
    for (const odd of [
      undefined,
      null,
      'active',
      {},
      { state: 'ACTIVE' },
      { state: 'checking' },
      { state: 'lifetime' },
    ])
      expect(parseStatus(odd).state).toBe('unavailable')
    expect(parseStatus({ state: 'active', fromCache: 'yes', lapsed: 1 })).toEqual({
      state: 'active',
      fromCache: false,
      lapsed: false,
    })
  })
})

describe('parseOffers', () => {
  const phase = {
    formattedPrice: '£2.49',
    priceMicros: 2_490_000,
    currency: 'GBP',
    billingPeriod: 'P1M',
    cycles: 0,
    recurrence: 'infinite',
  }

  it('keeps well-formed offers and drops the rest', () => {
    const offers = parseOffers({
      offers: [
        { basePlanId: 'monthly', offerId: null, offerToken: 't1', phases: [phase] },
        { basePlanId: 'yearly', offerToken: 't2', phases: [{ ...phase, priceMicros: '19.99' }] },
        { basePlanId: 'weekly', offerToken: 't3', phases: [] },
        { offerToken: 't4', phases: [phase] },
        'nonsense',
      ],
    })
    expect(offers).toEqual([
      { basePlanId: 'monthly', offerId: null, offerToken: 't1', phases: [phase] },
    ])
  })

  it('treats a missing or malformed list as no offers', () => {
    expect(parseOffers(undefined)).toEqual([])
    expect(parseOffers({ offers: 'none' })).toEqual([])
  })
})

describe('in the PWA', () => {
  it('reports the Pass as unavailable without touching Capacitor', async () => {
    await expect(getPassStatus()).resolves.toEqual({
      state: 'unavailable',
      fromCache: false,
      lapsed: false,
    })
    await expect(getPassOffers()).resolves.toEqual({ offers: [], reachable: false })
    await expect(subscribeToPass('token')).resolves.toEqual({ outcome: 'unavailable' })
    await expect(managePassSubscription()).resolves.toBe(false)
    expect(registerPlugin).not.toHaveBeenCalled()
  })
})

describe('in the Android app', () => {
  it('reports unavailable when the plugin itself fails', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    vi.resetModules()
    registerPlugin.mockReturnValue({
      getStatus: () => Promise.reject(new Error('not implemented')),
      subscribe: () => Promise.reject(new Error('not implemented')),
    })
    const billing = await import('./playBilling')
    await expect(billing.getPassStatus()).resolves.toMatchObject({ state: 'unavailable' })
    await expect(billing.subscribeToPass('token')).resolves.toEqual({ outcome: 'failed' })
  })

  it('passes through a purchase outcome and the status that came with it', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    vi.resetModules()
    registerPlugin.mockReturnValue({
      subscribe: () =>
        Promise.resolve({
          outcome: 'purchased',
          status: { state: 'active', fromCache: false, lapsed: false },
        }),
    })
    const billing = await import('./playBilling')
    await expect(billing.subscribeToPass('token')).resolves.toEqual({
      outcome: 'purchased',
      status: { state: 'active', fromCache: false, lapsed: false },
    })
  })
})
