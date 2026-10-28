import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shopItems } from '../data/shopItems'
import { setPassStatus } from '../lib/passEntitlement'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { CareView } from './CareView'

vi.mock('../lib/playBilling', () => ({
  getPassStatus: vi.fn(),
  onPassStatusChange: vi.fn(() => () => undefined),
}))

const passHeadwear = shopItems.find(
  (item) => item.premium && item.kind === 'cosmetic' && item.slot === 'headwear',
)

function gardenWearingPassItem(): AppState {
  if (!passHeadwear) throw new Error('Expected a pass headwear item')
  const base = createInitialState('Tester', 'Test Garden')
  const creature = base.creatures[0]
  return {
    ...base,
    creatures: [
      {
        ...creature,
        stage: passHeadwear.stages?.[0] ?? 'butterfly',
        outfit: { headwear: passHeadwear.id },
      },
    ],
    profile: { ...base.profile!, activeCompanionId: creature.id },
  }
}

const handlers = {
  onCare: vi.fn(),
  onEquip: vi.fn(),
  onUnequip: vi.fn(),
  onRenameCreature: vi.fn(),
  onGoToShop: vi.fn(),
  onSavePreset: vi.fn(),
  onWearPreset: vi.fn(() => ({ worn: [], skipped: [] })),
  onRenamePreset: vi.fn(),
  onDeletePreset: vi.fn(),
  onRestorePreset: vi.fn(),
}

describe('Pass outfits in the Android app', () => {
  afterEach(() => {
    act(() => setPassStatus({ state: 'checking', fromCache: false, lapsed: false }))
    vi.unstubAllEnvs()
  })

  it('appear and rest as Google Play opens and closes the Pass', () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    // The same garden throughout: nothing about the creatures changes, only
    // Play's answer, as when the app starts before Play has replied.
    const state = gardenWearingPassItem()
    // A fresh element each time, as the App's own re-render makes one.
    const view = () => <CareView state={state} today="2026-09-05" {...handlers} />
    const { container, rerender } = render(view())
    const worn = () => container.querySelectorAll('.outfit-overlay > g').length

    expect(worn()).toBe(0)
    act(() => setPassStatus({ state: 'active', fromCache: false, lapsed: false }))
    rerender(view())
    expect(worn()).toBeGreaterThan(0)
    act(() => setPassStatus({ state: 'inactive', fromCache: false, lapsed: true }))
    rerender(view())
    expect(worn()).toBe(0)
  })
})
