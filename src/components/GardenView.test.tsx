import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { species } from '../data/content'
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

    // Every flyer is pettable, and only flyers are.
    const flyers = screen.getAllByRole('button', { name: /^Pet / })
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
      screen.getByRole('button', { name: /Pet Marigold/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Pet Flyer 19/ }),
    ).toBeInTheDocument()
  })

  it('flies everyone when the garden is still small', () => {
    const emerged = species
      .slice(0, 3)
      .map((definition, index) => butterfly(definition.id, index))
    renderGarden({ creatures: emerged })

    // Three companions plus Marigold, with no rotation needed.
    expect(screen.getAllByRole('button', { name: /^Pet / })).toHaveLength(4)
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
