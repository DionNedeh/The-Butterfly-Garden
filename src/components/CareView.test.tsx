import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { shopItems } from '../data/shopItems'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { CareView } from './CareView'

const TODAY = '2026-09-05'

function gardenWithCaterpillar(overrides: Partial<AppState> = {}): AppState {
  const base = createInitialState('Tester', 'Test Garden')
  return { ...base, ...overrides }
}

function renderCare(state: AppState, overrides: Record<string, unknown> = {}) {
  const handlers = {
    onCare: vi.fn(),
    onEquip: vi.fn(),
    onUnequip: vi.fn(),
    onRenameCreature: vi.fn(),
    onGoToShop: vi.fn(),
    ...overrides,
  }
  render(<CareView state={state} today={TODAY} {...handlers} />)
  return handlers
}

describe('CareView', () => {
  it('offers the current stage’s activities and performs one', async () => {
    const user = userEvent.setup()
    const { onCare } = renderCare(gardenWithCaterpillar())

    const playtime = screen.getByRole('button', { name: /playtime/i })
    expect(playtime).toBeEnabled()
    await user.click(playtime)

    expect(onCare).toHaveBeenCalledWith(expect.any(String), 'cat-play')
  })

  it('disables an activity whose supply has run out', () => {
    const state = gardenWithCaterpillar({ inventory: {} })
    renderCare(state)

    // Fresh leaves need a leaf bundle; playtime costs nothing.
    expect(screen.getByRole('button', { name: /fresh leaves/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /playtime/i })).toBeEnabled()
  })

  it('disables an activity already done today, using the date it is given', () => {
    const base = createInitialState('Tester', 'Test Garden')
    const creature = base.creatures[0]
    const state: AppState = {
      ...base,
      // Performing care records both the activity and the day it counted for.
      creatures: [
        {
          ...creature,
          actionLog: { 'cat-play': TODAY },
          careDates: { caterpillar: [TODAY] },
        },
      ],
    }
    renderCare(state)

    expect(screen.getByRole('button', { name: /playtime/i })).toBeDisabled()
    expect(document.querySelector('.cared-today-badge')).toBeInTheDocument()
  })

  it('treats a different day as a fresh start', () => {
    const base = createInitialState('Tester', 'Test Garden')
    const creature = base.creatures[0]
    const state: AppState = {
      ...base,
      creatures: [
        {
          ...creature,
          actionLog: { 'cat-play': '2026-09-04' },
          careDates: { caterpillar: ['2026-09-04'] },
        },
      ],
    }
    renderCare(state)

    expect(screen.getByRole('button', { name: /playtime/i })).toBeEnabled()
    expect(document.querySelector('.cared-today-badge')).not.toBeInTheDocument()
  })

  it('invites the gardener to the nursery when there is nobody to care for', () => {
    renderCare(gardenWithCaterpillar({ creatures: [] }))
    expect(
      screen.getByRole('heading', { name: /the nursery is quiet/i }),
    ).toBeInTheDocument()
  })
})

describe('Garden Pass outfits in the wardrobe', () => {
  const passItem = shopItems.find(
    (item) => item.premium && item.kind === 'cosmetic' && item.slot === 'headwear',
  )

  it('offers a pass outfit that was never bought', () => {
    // Pass cosmetics are deliberately never written into ownedItemIds, so a
    // wardrobe filtered on ownership alone made them permanently unreachable
    // while the preview notice said they were included.
    if (!passItem) throw new Error('Expected a pass headwear item')
    const base = createInitialState('Tester', 'Test Garden')
    const stage = passItem.stages?.[0] ?? 'butterfly'
    const state: AppState = {
      ...base,
      ownedItemIds: [],
      creatures: [{ ...base.creatures[0], stage }],
      profile: { ...base.profile!, activeCompanionId: base.creatures[0].id },
    }

    renderCare(state)
    expect(
      screen.getByRole('button', { name: new RegExp(passItem.name, 'i') }),
    ).toBeInTheDocument()
  })

  it('still hides an ordinary cosmetic nobody owns', () => {
    const ordinary = shopItems.find(
      (item) => !item.premium && item.kind === 'cosmetic' && item.slot === 'headwear',
    )
    if (!ordinary) throw new Error('Expected an ordinary headwear item')
    const base = createInitialState('Tester', 'Test Garden')
    const stage = ordinary.stages?.[0] ?? 'butterfly'
    const state: AppState = {
      ...base,
      ownedItemIds: [],
      creatures: [{ ...base.creatures[0], stage }],
      profile: { ...base.profile!, activeCompanionId: base.creatures[0].id },
    }

    renderCare(state)
    expect(
      screen.queryByRole('button', { name: new RegExp(ordinary.name, 'i') }),
    ).not.toBeInTheDocument()
  })
})

