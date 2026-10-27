import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { shopItems } from '../data/shopItems'
import { BOND_LEVEL_NECTAR, BOND_LEVEL_STARDUST, BOND_PER_LEVEL } from '../lib/lifecycle'
import { renameCreature } from '../lib/gardenActions'
import { createInitialState } from '../lib/progression'
import type { AppState, CreatureInstance } from '../types'
import { CareView } from './CareView'

const TODAY = '2026-09-05'

function gardenWithCaterpillar(overrides: Partial<AppState> = {}): AppState {
  const base = createInitialState('Tester', 'Test Garden')
  return { ...base, ...overrides }
}

/** The saved looks' handlers, doing nothing: most tests are about something else. */
function lookHandlers() {
  return {
    onSavePreset: vi.fn(),
    onWearPreset: vi.fn(() => ({ worn: [], skipped: [] })),
    onRenamePreset: vi.fn(),
    onDeletePreset: vi.fn(),
    onRestorePreset: vi.fn(),
  }
}

function renderCare(state: AppState, overrides: Record<string, unknown> = {}) {
  const handlers = {
    onCare: vi.fn(),
    onEquip: vi.fn(),
    onUnequip: vi.fn(),
    onRenameCreature: vi.fn(),
    onGoToShop: vi.fn(),
    ...lookHandlers(),
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
        {...lookHandlers()}
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

describe('opened for one companion, and a flight of its own', () => {
  function gardenOfButterflies(overrides: Partial<AppState> = {}): AppState {
    const base = createInitialState('Tester', 'Test Garden')
    const flyer = (id: string, name: string, more: Partial<CreatureInstance> = {}) => ({
      ...base.creatures[0],
      id,
      name,
      stage: 'butterfly' as const,
      ...more,
    })
    return {
      ...base,
      ownedFlightPatternIds: ['gentle-drift', 'petal-hop', 'ribbon-loop'],
      selectedFlightPatternId: 'gentle-drift',
      creatures: [flyer('a', 'Aster'), flyer('b', 'Briar'), flyer('c', 'Clove')],
      ...overrides,
    }
  }

  it('opens on the companion it was asked for, with focus on its tab', () => {
    renderCare(gardenOfButterflies(), { openOn: 'b' })
    const tab = screen.getByRole('tab', { name: /Briar/ })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(tab).toHaveFocus()
    expect(screen.getByLabelText('Name for Briar')).toBeInTheDocument()
  })

  it('names the companion shown when its bond meter’s link is pressed', async () => {
    const user = userEvent.setup()
    const onOpenGuide = vi.fn()
    renderCare(gardenOfButterflies(), { onOpenGuide })
    await user.click(screen.getByRole('tab', { name: /Clove/ }))
    await user.click(screen.getByRole('link', { name: /^What does this do\? Bond levels/ }))
    expect(onOpenGuide).toHaveBeenCalledExactlyOnceWith('bond', 'c')
  })

  it('opens as usual, and leaves focus alone, when asked for nobody in particular', () => {
    renderCare(gardenOfButterflies())
    expect(screen.getByRole('tab', { name: /Aster/ })).toHaveAttribute('aria-selected', 'true')
    expect(document.body).toHaveFocus()
  })

  it('offers the garden default and every owned pattern, and says which is flown', async () => {
    const user = userEvent.setup()
    const onChooseFlight = vi.fn()
    renderCare(gardenOfButterflies(), { onChooseFlight })
    const flight = screen.getByRole('combobox', { name: 'Flight' })
    expect(Array.from((flight as HTMLSelectElement).options).map((option) => option.text)).toEqual([
      'Garden default (Gentle Drift)',
      'Gentle Drift',
      'Petal Hop',
      'Ribbon Loop',
    ])
    expect(flight).toHaveValue('')

    await user.selectOptions(flight, 'Petal Hop')
    expect(onChooseFlight).toHaveBeenCalledWith('a', 'petal-hop')
  })

  it('shows a companion its own pattern, and hands back none for the garden default', async () => {
    const user = userEvent.setup()
    const onChooseFlight = vi.fn()
    const state = gardenOfButterflies()
    renderCare(
      { ...state, creatures: [{ ...state.creatures[0], flightPatternId: 'ribbon-loop' }] },
      { onChooseFlight },
    )
    const flight = screen.getByRole('combobox', { name: 'Flight' })
    expect(flight).toHaveValue('ribbon-loop')

    await user.selectOptions(flight, 'Garden default (Gentle Drift)')
    expect(onChooseFlight).toHaveBeenCalledWith('a', undefined)
  })

  it('shows the garden default while its own pattern is not owned', () => {
    const state = gardenOfButterflies()
    renderCare(
      { ...state, creatures: [{ ...state.creatures[0], flightPatternId: 'canopy-dance' }] },
      { onChooseFlight: vi.fn() },
    )
    expect(screen.getByRole('combobox', { name: 'Flight' })).toHaveValue('')
  })

  it('asks nothing about flight before a companion has wings', () => {
    renderCare(gardenWithCaterpillar(), { onChooseFlight: vi.fn() })
    expect(screen.queryByRole('combobox', { name: 'Flight' })).toBeNull()
  })
})

describe('the bond and the companion’s story', () => {
  function butterfly(bond: number): AppState {
    const base = createInitialState('Tester', 'Test Garden')
    return {
      ...base,
      creatures: [{ ...base.creatures[0], stage: 'butterfly', bond }],
    }
  }

  it('says what the next bond level asks and brings, from the rules', () => {
    renderCare(butterfly(BOND_PER_LEVEL + 7))
    const next = document.querySelector('.bond-next')!
    const seen = next.cloneNode(true) as HTMLElement
    seen.querySelector('.sr-only')?.remove()
    expect(seen).toHaveTextContent(
      `Next bond level: ${BOND_PER_LEVEL - 7} more bond points → ${BOND_LEVEL_STARDUST} Stardust, ${BOND_LEVEL_NECTAR} Nectar`,
    )
    // The arrow is drawn for the eye; a screen reader hears a word instead.
    const heard = next.cloneNode(true) as HTMLElement
    heard.querySelector('[aria-hidden="true"]')?.remove()
    expect(heard).toHaveTextContent(
      `Next bond level: ${BOND_PER_LEVEL - 7} more bond points for ${BOND_LEVEL_STARDUST} Stardust, ${BOND_LEVEL_NECTAR} Nectar`,
    )
  })

  it('agrees with one bond point to go', () => {
    renderCare(butterfly(BOND_PER_LEVEL - 1))
    expect(document.querySelector('.bond-next')).toHaveTextContent('Next bond level: 1 more bond point')
  })

  it('shows the bond’s numbers even when the journal keeps its day counts hidden', () => {
    const state = butterfly(3)
    renderCare({ ...state, profile: { ...state.profile!, hideDayCounts: true } })
    expect(document.querySelector('.bond-next')).toHaveTextContent(
      `${BOND_PER_LEVEL - 3} more bond points`,
    )
  })

  it('folds the selected companion’s story under the wardrobe’s saved looks', async () => {
    const user = userEvent.setup()
    renderCare(gardenWithCaterpillar())
    expect(screen.getByRole('heading', { name: 'Saved looks' })).toBeInTheDocument()
    await user.click(screen.getByText('Sol’s story'))
    expect(screen.getByText('Welcomed')).toBeInTheDocument()
    expect(screen.getByText('Days cared for')).toBeInTheDocument()
  })

  it('hands a look to the garden’s own actions, for the companion chosen', async () => {
    const user = userEvent.setup()
    const state = gardenWithCaterpillar({ ownedItemIds: ['sprout-cap'] })
    const sol = { ...state.creatures[0], outfit: { headwear: 'sprout-cap' } }
    const handlers = renderCare({
      ...state,
      // Where the garden keeps its looks: in the profile.
      profile: {
        ...state.profile!,
        outfitPresets: [{ id: 'bow', name: 'Bow', outfit: { accessory: 'silk-bow' } }],
      },
      creatures: [sol],
    })
    await user.click(screen.getByRole('button', { name: 'Save this look' }))
    await user.click(screen.getByRole('button', { name: 'Save look' }))
    expect(handlers.onSavePreset).toHaveBeenCalledWith(sol.id, 'Sol’s look')
    await user.click(screen.getByRole('button', { name: 'Wear Bow' }))
    expect(handlers.onWearPreset).toHaveBeenCalledWith(sol.id, 'bow')

    // Deleting offers Undo from the page itself, not from inside the card,
    // whose entrance animation would pin a fixed toast to it.
    await user.click(screen.getByRole('button', { name: 'Delete Bow' }))
    expect(handlers.onDeletePreset).toHaveBeenCalledWith('bow')
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo.closest('.card')).toBeNull()
    expect(undo.closest('.care-view')).not.toBeNull()
  })
})

describe('CareView field guide', () => {
  function withBond(bond: number): AppState {
    const base = createInitialState('Tester', 'Test Garden')
    return { ...base, creatures: base.creatures.map((creature) => ({ ...creature, bond })) }
  }

  function factCard() {
    return within(screen.getByRole('heading', { level: 2, name: 'Monarch' }).closest('section')!)
  }

  it('shares the first fact, and says which bond level shares the next', () => {
    renderCare(withBond(0))
    expect(factCard().getAllByText(/./, { selector: '.field-fact' })).toHaveLength(1)
    expect(factCard().getByText('Monarch caterpillars rely on milkweed, the only plants they can eat.')).toBeInTheDocument()
    expect(factCard().getByText('Bond level 3 shares another.')).toBeInTheDocument()
  })

  it('shares a second fact at bond level 3 and the third at level 5', () => {
    renderCare(withBond(BOND_PER_LEVEL * 2))
    expect(factCard().getAllByText(/./, { selector: '.field-fact' })).toHaveLength(2)
    expect(factCard().getByText('Bond level 5 shares another.')).toBeInTheDocument()
  })

  it('says nothing more to come once all three are shared', () => {
    renderCare(withBond(BOND_PER_LEVEL * 4))
    expect(factCard().getAllByText(/./, { selector: '.field-fact' })).toHaveLength(3)
    expect(factCard().queryByText(/shares another/)).toBeNull()
  })

  it('links the bond meter to what bond levels do', async () => {
    const user = userEvent.setup()
    const onOpenGuide = vi.fn()
    const state = withBond(0)
    renderCare(state, { onOpenGuide })
    await user.click(screen.getByRole('link', { name: 'What does this do? Bond levels, in the Guide' }))
    expect(onOpenGuide).toHaveBeenCalledWith('bond', state.creatures[0].id)
  })
})

