import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
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

/*
 * 6.9: support → the comfort plan → "If you need support now" goes back to
 * that support page where it was, with focus on its link to the plan, by the
 * same way back the plan's own Back button takes.
 */
let scrollTo: MockInstance<typeof window.scrollTo>
let scrolled: MockInstance<() => number>

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  scrolled = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
})

afterEach(() => {
  vi.restoreAllMocks()
  resetDrafts()
  window.history.replaceState(null, '', '/')
})

describe('6.9 from a plan the support page opened, back to support', { timeout: 20_000 }, () => {
  it('returns to the support page at its link to the plan, focused, scrolled where it was', async () => {
    const seed = createInitialState('Robin', 'Quiet Corner')
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'loaded',
      state: { ...seed, profile: { ...seed.profile!, lastVisitOn: toLocalDate() } },
    })
    vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
    await user.click(nav.getByRole('button', { name: 'Settings' }))
    await user.click(
      await screen.findByRole('button', { name: 'If you need support now' }, { timeout: LAZY_PAGE_MS }),
    )
    const toPlan = await screen.findByRole('link', { name: 'Write a comfort plan' }, { timeout: LAZY_PAGE_MS })
    scrolled.mockReturnValue(900)
    await user.click(toPlan)
    await screen.findByRole('heading', { level: 1, name: 'My comfort plan' }, { timeout: LAZY_PAGE_MS })
    scrolled.mockReturnValue(0)

    await user.click(screen.getByRole('link', { name: 'If you need support now' }))
    await screen.findByRole('heading', { level: 1, name: 'If you need support now' }, { timeout: LAZY_PAGE_MS })
    expect(window.location.hash).toBe('#/support')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Write a comfort plan' })).toHaveFocus(),
    )
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 900, behavior: 'instant' })
    // That support page still goes back to the page that opened it.
    expect(screen.getByRole('button', { name: 'Back to Settings' })).toBeInTheDocument()
  })
})
