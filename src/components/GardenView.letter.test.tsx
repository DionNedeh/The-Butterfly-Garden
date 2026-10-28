import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { GardenView } from './GardenView'

/** A Tuesday, two days after the letter for the week of the 19th arrived. */
const NOW = new Date(2026, 9, 27, 10)

function renderGarden(extra: Partial<AppState['profile']> = {}, withLetters = true) {
  const garden = createInitialState('Robin', 'Test Garden', new Date(2026, 8, 1, 9))
  const handlers = { onOpenLetter: vi.fn(), onReadLetter: vi.fn() }
  render(
    <GardenView
      state={{ ...garden, profile: { ...garden.profile!, ...extra } }}
      onPlant={vi.fn()}
      onRemovePlant={vi.fn()}
      onPlaceJar={vi.fn()}
      onRemoveJarPlacement={vi.fn()}
      onSelectCompanion={vi.fn()}
      onRenameCreature={vi.fn()}
      onOpenCare={vi.fn()}
      {...(withLetters ? handlers : {})}
    />,
  )
  return handlers
}

beforeEach(() => {
  // Only the clock: the card's own code still loads as it would.
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('a letter waiting in the garden', () => {
  it('opens the letter in the Journal', async () => {
    const user = userEvent.setup()
    const { onOpenLetter, onReadLetter } = renderGarden()
    const card = await screen.findByRole('region', { name: 'A letter from Marigold is waiting' })
    await user.click(screen.getByRole('button', { name: 'Read the letter' }))
    expect(onOpenLetter).toHaveBeenCalledTimes(1)
    // Reading is noted by the Journal, where the letter is shown.
    expect(onReadLetter).not.toHaveBeenCalled()
    expect(card).toBeInTheDocument()
  })

  it('is put away for this week without losing focus', async () => {
    const user = userEvent.setup()
    const { onReadLetter } = renderGarden()
    await screen.findByRole('region', { name: 'A letter from Marigold is waiting' })
    await user.click(screen.getByRole('button', { name: 'Put away' }))
    expect(onReadLetter).toHaveBeenCalledWith('2026-10-25')
    // The card goes with its button, so focus moves to the garden's name.
    expect(screen.getByRole('heading', { level: 1, name: 'Test Garden' })).toHaveFocus()
  })

  it('is not there once read, nor where the app offers no letters', async () => {
    renderGarden({ lastLetterRead: '2026-10-25' })
    renderGarden({}, false)
    // Long enough for the card's code to have loaded and said nothing.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('region', { name: 'A letter from Marigold is waiting' })).toBeNull()
  })
})
