import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { toLocalDate } from './lib/date'
import { resetDrafts } from './lib/drafts'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import { LAZY_PAGE_MS } from './test/lazyPage'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  // A Tuesday morning; the letter for the week of the 19th came on Sunday.
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 27, 10))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetDrafts()
  window.history.replaceState(null, '', '/')
})

describe('a letter from Marigold', { timeout: 20_000 }, () => {
  it('waits in the garden, opens in the Journal, and is gone from the garden once read', async () => {
    const seed = createInitialState('Robin', 'Quiet Corner', new Date(2026, 8, 1, 9))
    const garden = {
      ...seed,
      // Visited today, so loading notes no visit.
      profile: { ...seed.profile!, lastVisitOn: toLocalDate() },
      moods: [
        {
          id: 'mood-1',
          localDate: '2026-10-21',
          level: 4 as const,
          note: 'The light on the river after work',
          starred: true as const,
          createdAt: '2026-10-21T18:00:00.000Z',
          updatedAt: '2026-10-21T18:00:00.000Z',
        },
      ],
    }
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: garden })
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })

    const card = await screen.findByRole(
      'region',
      { name: 'A letter from Marigold is waiting' },
      { timeout: LAZY_PAGE_MS },
    )
    await user.click(within(card).getByRole('button', { name: 'Read the letter' }))

    const heading = await screen.findByRole(
      'heading',
      { name: /^The week of October 19/ },
      { timeout: LAZY_PAGE_MS },
    )
    await waitFor(() => expect(heading).toHaveFocus())
    expect(window.location.hash).toBe('#/journal')
    const letter = screen.getByRole('article', { name: /^The week of October 19/ })
    expect(within(letter).getByText('This week you checked in once.')).toBeInTheDocument()
    expect(within(letter).getByText('The light on the river after work')).toBeInTheDocument()
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({ lastLetterRead: '2026-10-25' }),
        }),
      ),
    )

    const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
    await user.click(nav.getByRole('button', { name: 'Garden' }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('region', { name: 'A letter from Marigold is waiting' })).toBeNull()
  })
})
