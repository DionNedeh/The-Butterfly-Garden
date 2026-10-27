import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shopItems } from '../data/shopItems'
import { setPassStatus } from '../lib/passEntitlement'
import { createInitialState } from '../lib/progression'
import { ShopView } from './ShopView'

vi.mock('../lib/playBilling', () => ({
  // Play never answers on its own here: each test says what it reports.
  getPassStatus: vi.fn(() => new Promise(() => undefined)),
  getPassOffers: vi.fn(() => new Promise(() => undefined)),
  subscribeToPass: vi.fn(),
  managePassSubscription: vi.fn(() => Promise.resolve(true)),
  dismissPassLapseNotice: vi.fn(() => Promise.resolve()),
  onPassStatusChange: vi.fn(() => () => undefined),
}))

const handlers = {
  onPurchasePattern: vi.fn(() => ({ kind: 'owned' as const })),
  onPurchaseJar: vi.fn(() => ({ kind: 'owned' as const })),
  onPurchaseItem: vi.fn(() => ({ kind: 'owned' as const })),
  onRecycleJar: vi.fn(() => ({ kind: 'missing' as const })),
  onRestoreJar: vi.fn(() => ({ kind: 'back' as const })),
  onSelectBackdrop: vi.fn(),
  onSaveCustomBackdrop: vi.fn(() => Promise.resolve({ ok: true as const })),
  onSelectCustomBackdrop: vi.fn(),
  onDeleteCustomBackdrop: vi.fn(),
}

const passPieces = shopItems.filter((item) => item.premium).length
const count = () => screen.getAllByText(/to explore/).at(-1)?.textContent

describe('the Owned filter on the Pass tab in the Android app', () => {
  afterEach(() => {
    act(() => setPassStatus({ state: 'checking', fromCache: false, lapsed: false }))
    vi.unstubAllEnvs()
  })

  it('holds the Pass pieces while Google Play says the Pass is active, and lets them go when it lapses', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    act(() => setPassStatus({ state: 'active', fromCache: false, lapsed: false }))
    const state = createInitialState('Tester', 'Shop')
    // A fresh element each time, as the App's own re-render makes one.
    const view = () => <ShopView state={state} initialTab="pass" {...handlers} />
    const { rerender } = render(view())
    const user = userEvent.setup()

    await user.selectOptions(screen.getByRole('combobox', { name: /^Collection/ }), 'owned')
    expect(count()).toBe(`${passPieces} pieces to explore`)

    act(() => setPassStatus({ state: 'inactive', fromCache: false, lapsed: true }))
    rerender(view())
    expect(count()).toBe('0 pieces to explore')
    await user.selectOptions(screen.getByRole('combobox', { name: /^Collection/ }), 'new')
    expect(count()).toBe(`${passPieces} pieces to explore`)
  })
})
