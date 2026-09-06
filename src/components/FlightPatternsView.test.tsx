import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { flightPatterns } from '../data/flightPatterns'
import { createInitialState } from '../lib/progression'
import type { AppState, FlightPatternId } from '../types'
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
      expect(
        screen.queryByText(`Locked - ${pattern.cost} ${wrong} in Shop`),
      ).not.toBeInTheDocument()
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
})
