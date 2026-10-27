import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { species } from '../data/content'
import { backAction, requestDialogClose } from '../lib/backNavigation'
import { toLocalDate } from '../lib/date'
import { REBLOOM_CARE_DAYS } from '../lib/gardenPace'
import { CALM_AIRBORNE } from '../lib/motion'
import { createInitialState } from '../lib/progression'
import type { AppState, CreatureInstance } from '../types'
import { GardenView } from './GardenView'

function butterfly(speciesId: string, index: number): CreatureInstance {
  return {
    id: `emerged-${index}`,
    speciesId,
    name: `Flyer ${index}`,
    stage: 'butterfly',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-01-01T00:00:00.000Z',
  }
}

function renderGarden(overrides: Partial<AppState> = {}) {
  const handlers = {
    onPlant: vi.fn(),
    onRemovePlant: vi.fn(),
    onPlaceJar: vi.fn(),
    onRemoveJarPlacement: vi.fn(),
    onSelectCompanion: vi.fn(),
    onRenameCreature: vi.fn(),
    onOpenCare: vi.fn(),
    onCareFor: vi.fn(),
    onPutAwayWelcomeBack: vi.fn(),
  }
  const state: AppState = {
    ...createInitialState('Tester', 'Test Garden'),
    ...overrides,
  }
  render(<GardenView state={state} {...handlers} />)
  // The rendered state, so tests refer to the same generated ids it drew.
  return { handlers, state }
}

describe('GardenView flight scene', () => {
  it('keeps the scene to twelve flyers however many butterflies are welcomed', () => {
    // Twenty emerged butterflies, each a distinct species.
    const emerged = species
      .slice(0, 20)
      .map((definition, index) => butterfly(definition.id, index))
    const seed = createInitialState('Tester', 'Test Garden')
    renderGarden({
      creatures: emerged,
      profile: { ...seed.profile!, activeCompanionId: 'emerged-19' },
    })

    // Every flyer can be met, and only flyers.
    const flyers = screen.getAllByRole('button', { name: /^Meet / })
    expect(flyers).toHaveLength(12)
  })

  it('always flies the guide and the chosen companion, whoever else rotates', () => {
    const emerged = species
      .slice(0, 20)
      .map((definition, index) => butterfly(definition.id, index))
    const seed = createInitialState('Tester', 'Test Garden')
    renderGarden({
      creatures: emerged,
      profile: { ...seed.profile!, activeCompanionId: 'emerged-19' },
    })

    expect(
      screen.getByRole('button', { name: /Meet Marigold/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Meet Flyer 19/ }),
    ).toBeInTheDocument()
  })

  it('flies everyone when the garden is still small', () => {
    const emerged = species
      .slice(0, 3)
      .map((definition, index) => butterfly(definition.id, index))
    renderGarden({ creatures: emerged })

    // Three companions plus Marigold, with no rotation needed.
    expect(screen.getAllByRole('button', { name: /^Meet / })).toHaveLength(4)
  })

  it('in calm motion keeps everyone in the scene but only a few in the air', () => {
    const emerged = species
      .slice(0, 20)
      .map((definition, index) => butterfly(definition.id, index))
    const seed = createInitialState('Tester', 'Test Garden')
    renderGarden({
      creatures: emerged,
      profile: {
        ...seed.profile!,
        activeCompanionId: 'emerged-19',
        calmMotion: true,
      },
    })

    const flyers = screen.getAllByRole('button', { name: /^Meet / })
    expect(flyers).toHaveLength(12)
    const flapping = flyers.filter((flyer) =>
      flyer.querySelector('.butterfly-sprite.flapping'),
    )
    expect(flapping).toHaveLength(CALM_AIRBORNE)
    // The guide and the chosen companion are among those still flying.
    const flyingNames = flapping.map((flyer) => flyer.getAttribute('aria-label') ?? '')
    expect(flyingNames.some((name) => name.startsWith('Meet Marigold'))).toBe(true)
    expect(flyingNames.some((name) => name.startsWith('Meet Flyer 19'))).toBe(true)
  })

  it('flies each companion its own pattern while it is owned, and the garden\'s otherwise', () => {
    renderGarden({
      ownedFlightPatternIds: ['gentle-drift', 'petal-hop', 'ribbon-loop'],
      selectedFlightPatternId: 'ribbon-loop',
      creatures: [
        { ...butterfly('monarch', 0), flightPatternId: 'petal-hop' },
        butterfly('monarch', 1),
        // A pattern the garden does not own is kept, and not flown.
        { ...butterfly('monarch', 2), flightPatternId: 'canopy-dance' },
      ],
    })
    const flown = Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>('[data-flyer]')).map((flyer) => [
        flyer.dataset.flyer,
        flyer.dataset.pattern,
      ]),
    )
    expect(flown).toEqual({
      'marigold-guide': 'ribbon-loop',
      'emerged-0': 'petal-hop',
      'emerged-1': 'ribbon-loop',
      'emerged-2': 'ribbon-loop',
    })
  })
})

describe('meeting a butterfly in the garden', () => {
  function gardenWithSol() {
    return renderGarden({
      creatures: [{ ...butterfly('monarch', 0), name: 'Sol', bond: 17 }],
    })
  }

  it('opens a card saying who it is, rather than petting it', async () => {
    const user = userEvent.setup()
    gardenWithSol()
    const flyer = screen.getByRole('button', { name: 'Meet Sol, Monarch' })
    expect(flyer).toHaveAttribute('aria-haspopup', 'dialog')
    await user.click(flyer)

    const card = await screen.findByRole('dialog', { name: 'Sol' })
    expect(within(card).getByText('Monarch · Butterfly')).toBeInTheDocument()
    expect(within(card).getByText('Bond level 2')).toBeInTheDocument()
    // Focus moves into the card, onto its first action.
    expect(within(card).getByRole('button', { name: 'Care for Sol' })).toHaveFocus()
    // The tap that opened it did not also pet.
    expect(document.querySelector('.heart-burst')).toBeNull()
  })

  it('pets from the card, with hearts and a hello read out, and stays open', async () => {
    const user = userEvent.setup()
    gardenWithSol()
    await user.click(screen.getByRole('button', { name: 'Meet Sol, Monarch' }))
    const card = await screen.findByRole('dialog', { name: 'Sol' })

    await user.click(within(card).getByRole('button', { name: 'Pet Sol' }))
    expect(card.querySelector('.heart-burst')).not.toBeNull()
    expect(within(card).getByText('Sol enjoyed that gentle hello.')).toBeInTheDocument()
    expect(card).toHaveAttribute('open')
  })

  it('closes with Close and hands focus back to the butterfly', async () => {
    const user = userEvent.setup()
    gardenWithSol()
    const flyer = screen.getByRole('button', { name: 'Meet Sol, Monarch' })
    await user.click(flyer)
    const card = await screen.findByRole('dialog', { name: 'Sol' })

    await user.click(within(card).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(flyer).toHaveFocus()
  })

  it('opens from the keyboard, and Escape or Android\'s back gesture closes it to the butterfly', async () => {
    const user = userEvent.setup()
    gardenWithSol()
    const flyer = screen.getByRole('button', { name: 'Meet Sol, Monarch' })
    for (const key of ['{Enter}', ' ']) {
      flyer.focus()
      await user.keyboard(key)
      const card = await screen.findByRole('dialog', { name: 'Sol' })
      // Back finds the open card before anything else on the page.
      const action = backAction('garden')
      expect(action).toEqual({ kind: 'close-dialog', dialog: card })
      // Escape and the back gesture both arrive as the dialog's cancel.
      requestDialogClose(card as HTMLDialogElement)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(flyer).toHaveFocus()
    }
  })

  it('stays open when opened again before the last close has been told', async () => {
    const user = userEvent.setup()
    gardenWithSol()
    const flyer = screen.getByRole('button', { name: 'Meet Sol, Monarch' })
    await user.click(flyer)
    await screen.findByRole('dialog', { name: 'Sol' })
    const first = document.querySelector('dialog')!
    // As a browser does: the dialog closes at once and hands focus back, but
    // its close event comes a moment later.
    first.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
      setTimeout(() => this.dispatchEvent(new Event('close')), 0)
    }
    first.close()
    // Pressed in that moment, before the event has come.
    act(() => {
      fireEvent.click(flyer)
    })
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(screen.getByRole('dialog', { name: 'Sol' })).toHaveAttribute('open')
  })

  it('closes on a tap outside the card, and not on one inside it', async () => {
    const user = userEvent.setup()
    gardenWithSol()
    await user.click(screen.getByRole('button', { name: 'Meet Sol, Monarch' }))
    const card = await screen.findByRole('dialog', { name: 'Sol' })

    fireEvent.click(within(card).getByText('Bond level 2'))
    expect(card).toHaveAttribute('open')
    // Only the backdrop lands on the dialog element itself.
    fireEvent.click(card)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens Care for that companion', async () => {
    const user = userEvent.setup()
    const { handlers } = gardenWithSol()
    await user.click(screen.getByRole('button', { name: 'Meet Sol, Monarch' }))
    const card = await screen.findByRole('dialog', { name: 'Sol' })

    await user.click(within(card).getByRole('button', { name: 'Care for Sol' }))
    expect(handlers.onCareFor).toHaveBeenCalledWith('emerged-0')
  })

  it('introduces Marigold as the garden\'s guide, with nothing to care for', async () => {
    const user = userEvent.setup()
    gardenWithSol()
    await user.click(
      screen.getByRole('button', { name: 'Meet Marigold, your monarch garden guide' }),
    )
    const card = await screen.findByRole('dialog', { name: 'Marigold' })
    expect(within(card).getByText(/Your garden guide/)).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /^Care for/ })).toBeNull()
    expect(within(card).getByRole('button', { name: 'Pet Marigold' })).toHaveFocus()
  })
})

describe('GardenView plant protection', () => {
  it('refuses to remove a plant that is sheltering a developing creature', async () => {
    const user = userEvent.setup()
    const seed = createInitialState('Tester', 'Test Garden')
    const { handlers } = renderGarden({
      plants: seed.plants,
      creatures: [
        {
          ...seed.creatures[0],
          stage: 'caterpillar',
          sourcePlantId: seed.plants[0].id,
          name: 'Sol',
        },
      ],
    })

    await user.click(screen.getByRole('button', { name: /^View .*growth 2 of 3/ }))

    expect(
      screen.getByText(/Sol is still growing on this host plant/),
    ).toBeInTheDocument()
    const remove = screen.getByRole('button', { name: /remove this plant/i })
    expect(remove).toBeDisabled()

    await user.click(remove)
    expect(handlers.onRemovePlant).not.toHaveBeenCalled()
  })

  it('removes a plant nothing depends on, once the gardener confirms', async () => {
    const user = userEvent.setup()
    const { handlers, state } = renderGarden({ creatures: [] })
    const spare = state.plants[1]

    await user.click(screen.getByRole('button', { name: /^View .*growth 1 of 3/ }))
    await user.click(screen.getByRole('button', { name: /remove this plant/i }))

    // Removal is permanent and unrefunded, so it asks first.
    expect(
      screen.getByText(/Remove this plant without a seed refund\?/),
    ).toBeInTheDocument()
    expect(handlers.onRemovePlant).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /yes, remove plant/i }))
    expect(handlers.onRemovePlant).toHaveBeenCalledWith(spare.id)
  })
})

describe('a plant’s jars', () => {
  it('opens the jar panel with the plant, alike jars stacked, and places one of them', async () => {
    const user = userEvent.setup()
    const jar = (id: string) => ({
      id,
      character: 'É',
      colorId: 'pink' as const,
      purchasedAt: '2026-10-27T12:00:00.000Z',
    })
    const { handlers, state } = renderGarden({ jars: [jar('e1'), jar('e2')] })

    await user.click(screen.getByRole('button', { name: /^View Milkweed/ }))
    // Loaded with the panel, not with the garden.
    const place = await screen.findByRole('button', {
      name: 'Place Pink É jar on Milkweed, 2 on the shelf',
    })
    await user.click(place)
    expect(handlers.onPlaceJar).toHaveBeenCalledWith('e1', state.plants[0].id)
  })

  it('names a plant’s jar in the scene', () => {
    const seed = createInitialState('Tester', 'Test Garden')
    renderGarden({
      jars: [{ id: 'a1', character: 'A', colorId: 'blue', purchasedAt: '' }],
      jarPlacements: [{ jarId: 'a1', plantId: seed.plants[0].id }],
      plants: seed.plants,
    })
    expect(screen.getByRole('button', { name: /^View Milkweed.*with Blue A jar$/ })).toBeInTheDocument()
  })
})

describe('the species welcomed figure', () => {
  it('counts distinct species, not butterflies', () => {
    // Three butterflies, two species. Counting creatures reported three, which
    // is not what "species welcomed" says.
    renderGarden({
      creatures: [
        butterfly('monarch', 0),
        butterfly('monarch', 1),
        butterfly('queen', 2),
      ],
    })

    expect(screen.getByText(`2 / ${species.length}`)).toBeInTheDocument()
  })

  it('leaves out species still growing', () => {
    const growing = {
      ...butterfly('queen', 1),
      stage: 'chrysalis' as const,
    }
    renderGarden({ creatures: [butterfly('monarch', 0), growing] })

    expect(screen.getByText(`1 / ${species.length}`)).toBeInTheDocument()
  })
})


describe('the companions card', () => {
  it('speaks of the starter by the name the gardener gave it', () => {
    const seed = createInitialState('Tester', 'Test Garden')
    renderGarden({
      creatures: seed.creatures.map((creature) => ({ ...creature, name: 'Pip' })),
    })
    expect(screen.getByText(/^Pip is still changing\./)).toBeInTheDocument()
  })
})

describe('saying why', () => {
  it('says why a seed cannot be planted when the tray is empty', () => {
    renderGarden({ seeds: 0 })
    const button = screen.getByRole('button', { name: 'Plant a seed' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription(/No seeds in your tray yet/)
  })

  it('says what a host plant did about eggs', async () => {
    const seed = createInitialState('Tester', 'Test Garden')
    const plant = { id: 'host-1', plantId: 'milkweed', growth: 3, plantedAt: '2026-10-01T10:00:00.000Z' }
    renderGarden({
      plants: [plant],
      creatures: [
        seed.creatures[0],
        { ...butterfly('queen', 1), name: 'Pip', sourcePlantId: 'host-1' },
      ],
    })
    await userEvent.setup().click(screen.getByRole('button', { name: /Milkweed 1/ }))
    expect(screen.getByText("This bloom brought Pip's egg.")).toBeInTheDocument()
  })
})

describe('Keep giving, on the plant panel', () => {
  const mature = {
    id: 'host-1',
    plantId: 'milkweed',
    growth: 3,
    plantedAt: '2026-10-01T10:00:00.000Z',
    careDaysSinceBloom: REBLOOM_CARE_DAYS - 3,
  }

  it('says how close the next bloom is', async () => {
    const seed = createInitialState('Tester', 'Test Garden')
    renderGarden({
      plants: [mature],
      profile: { ...seed.profile!, gardenPace: 'keep-giving' },
    })
    await userEvent.setup().click(screen.getByRole('button', { name: /Milkweed 1/ }))
    const row = screen.getByText('Next bloom').closest('div')!
    expect(within(row).getByText('Blooms again in 3 more days of care.')).toBeInTheDocument()
  })

  it('says nothing of blooming again under Classic', async () => {
    renderGarden({ plants: [mature] })
    await userEvent.setup().click(screen.getByRole('button', { name: /Milkweed 1/ }))
    expect(screen.queryByText('Next bloom')).toBeNull()
    expect(screen.queryByText(/Blooms again/)).toBeNull()
  })
})

describe('the welcome back', () => {
  function returnedToday() {
    const seed = createInitialState('Tester', 'Test Garden')
    return { ...seed.profile!, welcomeBackOn: toLocalDate() }
  }

  it('shows one line in a polite region, and puts it away without losing focus', async () => {
    const user = userEvent.setup()
    const { handlers } = renderGarden({ profile: returnedToday() })
    const card = await screen.findByRole('group', { name: 'Welcome back' })
    // Inside a live region that was there before the card, so it is heard.
    expect(card.closest('[role="status"]')).toHaveClass('welcome-back-region')
    expect(within(card).getByText(/Sol|Marigold|milkweed|aster/)).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: 'Put away' }))
    expect(handlers.onPutAwayWelcomeBack).toHaveBeenCalledTimes(1)
    // The card goes with its button, so focus moves to the garden's name.
    expect(screen.getByRole('heading', { level: 1, name: 'Test Garden' })).toHaveFocus()
  })

  it('is not there on an ordinary day, or on a later one', () => {
    const seed = createInitialState('Tester', 'Test Garden')
    renderGarden()
    expect(screen.queryByRole('group', { name: 'Welcome back' })).toBeNull()
    renderGarden({ profile: { ...seed.profile!, welcomeBackOn: '2026-01-02' } })
    expect(screen.queryByRole('group', { name: 'Welcome back' })).toBeNull()
  })
})
