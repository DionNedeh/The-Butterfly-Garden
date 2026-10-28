import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { flightPatterns } from '../data/flightPatterns'
import { createInitialState } from '../lib/progression'
import type { AppState, CreatureInstance, FlightPatternId } from '../types'
import { FlightPatternsView } from './FlightPatternsView'

function renderPatterns(overrides: Partial<AppState> = {}) {
  const onSelect = vi.fn()
  render(
    <FlightPatternsView
      state={{ ...createInitialState('Tester', 'Test Garden'), ...overrides }}
      onSelect={onSelect}
    />,
  )
  return { onSelect }
}

/** Named from the catalog rather than hardcoded, so a repricing shows up here. */
const stardustPattern = flightPatterns.find(
  (pattern) => pattern.currency === 'stardust',
)
const nectarPattern = flightPatterns.find(
  (pattern) => pattern.currency === 'nectar' && pattern.cost > 0,
)

describe('FlightPatternsView', () => {
  it('names the currency a locked pattern is actually priced in', () => {
    if (!stardustPattern || !nectarPattern) {
      throw new Error('Expected the catalog to price patterns in both currencies')
    }
    renderPatterns()

    // The bug this guards: every locked pattern used to be labelled "Nectar",
    // sending gardeners to the shop with a balance they could not spend on it.
    expect(
      screen.getByText(
        `Locked - ${stardustPattern.cost} Stardust in Shop`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`Locked - ${nectarPattern.cost} Nectar in Shop`),
    ).toBeInTheDocument()
  })

  it('never labels a Stardust pattern in Nectar', () => {
    renderPatterns()

    for (const pattern of flightPatterns) {
      if (pattern.cost <= 0) continue
      const wrong = pattern.currency === 'stardust' ? 'Nectar' : 'Stardust'
      // Scoped to this pattern's own card. Two patterns may share a price
      // across currencies -- 12 Nectar and 12 Stardust both exist -- so a
      // document-wide search would find the other card's correct label and
      // report it as this card's wrong one.
      const card = screen.getByRole('button', {
        name: new RegExp(pattern.name),
      })
      expect(
        within(card).queryByText(`Locked - ${pattern.cost} ${wrong} in Shop`),
      ).not.toBeInTheDocument()
      expect(
        within(card).getByText(
          new RegExp(`(Selected|Owned|Locked - ${pattern.cost} ${
            pattern.currency === 'stardust' ? 'Stardust' : 'Nectar'
          } in Shop)`),
        ),
      ).toBeInTheDocument()
    }
  })

  it('offers an owned pattern for selection and marks the current one', async () => {
    if (!stardustPattern) throw new Error('Expected a Stardust pattern')
    const user = userEvent.setup()
    const { onSelect } = renderPatterns({
      ownedFlightPatternIds: [
        'gentle-drift',
        stardustPattern.id,
      ] as FlightPatternId[],
      selectedFlightPatternId: 'gentle-drift',
    })

    expect(screen.getByText('Selected')).toBeInTheDocument()
    const owned = screen.getByText('Owned - select pattern')
    expect(owned).toBeInTheDocument()

    await user.click(owned)
    expect(onSelect).toHaveBeenCalledWith(stardustPattern.id)
  })

  it('does not offer a pattern that has not been bought', async () => {
    if (!stardustPattern) throw new Error('Expected a Stardust pattern')
    const user = userEvent.setup()
    const { onSelect } = renderPatterns()

    await user.click(
      screen.getByText(`Locked - ${stardustPattern.cost} Stardust in Shop`),
    )
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('says which companions fly a pattern of their own', () => {
    const seed = createInitialState('Tester', 'Test Garden')
    const flyer = (name: string, more: Partial<CreatureInstance> = {}): CreatureInstance => ({
      ...seed.creatures[0],
      id: name,
      name,
      stage: 'butterfly',
      ...more,
    })
    renderPatterns({
      ownedFlightPatternIds: ['gentle-drift', 'petal-hop', 'ribbon-loop'],
      selectedFlightPatternId: 'gentle-drift',
      creatures: [
        flyer('Aster', { flightPatternId: 'petal-hop' }),
        flyer('Briar', { flightPatternId: 'petal-hop' }),
        flyer('Clove', { flightPatternId: 'ribbon-loop' }),
        flyer('Dill', { flightPatternId: 'ribbon-loop' }),
        flyer('Elm', { flightPatternId: 'ribbon-loop' }),
        flyer('Fern', { flightPatternId: 'ribbon-loop' }),
        // Flying the garden's, so not listed anywhere.
        flyer('Gale'),
        // Not owned, so it flies the garden's for now.
        flyer('Hazel', { flightPatternId: 'canopy-dance' }),
        // Still a caterpillar: nothing to fly yet.
        { ...flyer('Iris', { flightPatternId: 'petal-hop' }), stage: 'caterpillar' },
      ],
    })
    const card = (name: string) => screen.getByRole('button', { name: new RegExp(name) })
    expect(within(card('Petal Hop')).getByText('Flown by Aster and Briar')).toBeInTheDocument()
    expect(
      within(card('Ribbon Loop')).getByText('Flown by Clove, Dill and 2 others'),
    ).toBeInTheDocument()
    expect(within(card('Gentle Drift')).queryByText(/^Flown by/)).toBeNull()
    expect(within(card('Canopy Dance')).queryByText(/^Flown by/)).toBeNull()
    expect(screen.queryByText(/Gale|Hazel|Iris/)).toBeNull()
  })
})
