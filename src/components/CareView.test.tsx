import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { shopItems } from '../data/shopItems'
import { renameCreature } from '../lib/gardenActions'
import { createInitialState } from '../lib/progression'
import type { AppState, CreatureInstance } from '../types'
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


describe('naming a new arrival', () => {
  /** The starter caterpillar, joined by a queen egg the garden just found. */
  function gardenWithEgg(egg: Partial<CreatureInstance> = {}): AppState {
    const base = createInitialState('Tester', 'Test Garden')
    const arrival: CreatureInstance = {
      ...base.creatures[0],
      id: 'egg',
      speciesId: 'queen',
      name: 'Clover',
      stage: 'egg',
      awaitingName: true,
      ...egg,
    }
    return { ...base, creatures: [base.creatures[0], arrival] }
  }

  /** Care over a garden that really changes, as the app shell's would. */
  function CareWithGarden({ initial }: { initial: AppState }) {
    const [state, setState] = useState(initial)
    return (
      <CareView
        state={state}
        today={TODAY}
        onCare={vi.fn()}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
        onRenameCreature={(id, name) => setState((current) => renameCreature(current, id, name))}
        onGoToShop={vi.fn()}
      />
    )
  }

  const offer = () => screen.queryByRole('region', { name: /name your queen egg/i })

  it('offers to name an egg the garden just found, and opens on it', () => {
    renderCare(gardenWithEgg())
    expect(offer()).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Clover')
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Clover')
  })

  it('asks nothing about an egg without an open offer, or one that hatched', () => {
    const { unmount } = render(<CareWithGarden initial={gardenWithEgg({ awaitingName: undefined })} />)
    expect(offer()).not.toBeInTheDocument()
    unmount()
    // The flag outlived the egg; the offer lapsed when it hatched.
    render(<CareWithGarden initial={gardenWithEgg({ stage: 'caterpillar' })} />)
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument()
  })

  it('names the egg, then hands focus to its chip as the offer goes', async () => {
    const user = userEvent.setup()
    render(<CareWithGarden initial={gardenWithEgg()} />)
    const field = screen.getByRole('textbox', { name: 'Name' })
    await user.clear(field)
    await user.type(field, 'Pip{Enter}')

    expect(offer()).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Pip/ })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'Name for Pip' })).toHaveValue('Pip')
  })

  it('keeps the name it came with, and does not ask again', async () => {
    const user = userEvent.setup()
    render(<CareWithGarden initial={gardenWithEgg()} />)
    await user.click(screen.getByRole('button', { name: 'Keep Clover' }))

    expect(offer()).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Clover/ })).toHaveFocus()
  })

  it('takes a name from the usual name field as the answer too', async () => {
    const user = userEvent.setup()
    render(<CareWithGarden initial={gardenWithEgg()} />)
    const field = screen.getByRole('textbox', { name: 'Name for Clover' })
    await user.clear(field)
    await user.type(field, 'Wren')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(offer()).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name for Wren' })).toBeInTheDocument()
  })

  it('moves on to the next egg waiting for a name', async () => {
    const user = userEvent.setup()
    const garden = gardenWithEgg()
    const second: CreatureInstance = { ...garden.creatures[1], id: 'egg-2', name: 'Fern', speciesId: 'monarch' }
    render(<CareWithGarden initial={{ ...garden, creatures: [...garden.creatures, second] }} />)

    await user.click(screen.getByRole('button', { name: 'Keep Clover' }))
    expect(
      screen.getByRole('region', { name: /name your monarch egg/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Fern')
  })
})
