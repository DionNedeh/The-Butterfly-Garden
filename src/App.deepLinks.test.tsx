import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resetDrafts } from './lib/drafts'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import type { AppState } from './types'
import { LAZY_PAGE_MS } from './test/lazyPage'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

/** A garden written in on two October days. */
function garden(): AppState {
  const base = createInitialState('Robin', 'Quiet Corner', new Date(2026, 8, 1, 9))
  const mood = (localDate: string, note: string) => ({
    id: `mood-${localDate}`,
    localDate,
    level: 4 as const,
    note,
    createdAt: `${localDate}T16:00:00.000Z`,
    updatedAt: `${localDate}T16:00:00.000Z`,
  })
  return {
    ...base,
    profile: { ...base.profile!, lastVisitOn: '2026-10-27' },
    moods: [mood('2026-10-20', 'Rain on the window'), mood('2026-10-24', 'A walk by the river')],
  }
}

/** The app opened at whatever address the test set, once the named page is drawn. */
async function openAt(hash: string, heading: string) {
  window.history.replaceState(null, '', `/${hash}`)
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: garden() })
  vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: heading }, { timeout: LAZY_PAGE_MS })
  return user
}

/** The date of a day in the Journal's timeline. */
const dateOf = (day: string) => document.querySelector<HTMLElement>(`#day-${day} time`)
const shopTabs = () => within(screen.getByRole('navigation', { name: 'Shop sections' }))

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 27, 10))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetDrafts()
  window.history.replaceState(null, '', '/')
})

describe('6.7 deeper addresses: a journal day and a shop tab', { timeout: 20_000 }, () => {
  it('opens the Journal at a day the address names, with focus on its date', async () => {
    await openAt('#/journal/2026-10-20', 'Journal')
    await waitFor(() => expect(dateOf('2026-10-20')).toHaveFocus())
    expect(window.location.hash).toBe('#/journal/2026-10-20')
  })

  it('opens the Journal at its top for a day with nothing written, and tidies the address', async () => {
    await openAt('#/journal/2026-10-21', 'Journal')
    await waitFor(() => expect(window.location.hash).toBe('#/journal'))
    expect(document.activeElement?.closest('.timeline-entry')).toBeNull()
  })

  it('opens the garden for a day that is not on the calendar, as for any unknown address', async () => {
    await openAt('#/journal/2026-02-30', 'Quiet Corner')
    await waitFor(() => expect(window.location.hash).toBe(''))
  })

  it('opens the shop on the tab the address names', async () => {
    await openAt('#/shop/boutique', 'Stock up & dress up')
    expect(shopTabs().getByRole('button', { name: 'Boutique' })).toHaveAttribute('aria-current', 'page')
    expect(window.location.hash).toBe('#/shop/boutique')
  })

  it('opens the garden for a tab the shop does not have', async () => {
    await openAt('#/shop/hats', 'Quiet Corner')
    await waitFor(() => expect(window.location.hash).toBe(''))
  })

  it('follows a tab chosen in the address without adding to the history, so Back still walks pages', async () => {
    const user = await openAt('', 'Quiet Corner')
    await user.click(
      within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('button', { name: 'Shop' }),
    )
    await screen.findByRole('heading', { level: 1, name: 'Stock up & dress up' }, { timeout: LAZY_PAGE_MS })
    const pushState = vi.spyOn(window.history, 'pushState')
    await user.click(shopTabs().getByRole('button', { name: 'Jars' }))
    expect(window.location.hash).toBe('#/shop/jars')
    await user.click(shopTabs().getByRole('button', { name: 'Flight' }))
    expect(window.location.hash).toBe('#/shop/flight')
    expect(pushState).not.toHaveBeenCalled()
    await act(async () => {
      window.history.back()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
  })

  it('follows a day opened from the calendar, without adding to the history', async () => {
    const user = await openAt('#/journal', 'Journal')
    const pushState = vi.spyOn(window.history, 'pushState')
    const calendar = document.querySelector<HTMLElement>('.weather-calendar')!
    const [first] = within(calendar).getAllByRole('button').filter((button) => button.classList.contains('cal-day'))
    await user.click(first)
    await waitFor(() => expect(dateOf('2026-10-20')).toHaveFocus())
    expect(window.location.hash).toBe('#/journal/2026-10-20')
    expect(pushState).not.toHaveBeenCalled()
  })

  it('opens another day named while the Journal is open, as the shop does a tab, and the first again on Back', async () => {
    await openAt('#/journal/2026-10-24', 'Journal')
    await waitFor(() => expect(dateOf('2026-10-24')).toHaveFocus())
    // An address typed, or a link to a day followed, while the Journal is open.
    await act(async () => {
      window.history.pushState(null, '', '/#/journal/2026-10-20')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
      await Promise.resolve()
    })
    await waitFor(() => expect(dateOf('2026-10-20')).toHaveFocus())
    await act(async () => {
      window.history.back()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(window.location.hash).toBe('#/journal/2026-10-24')
    await waitFor(() => expect(dateOf('2026-10-24')).toHaveFocus())
  })

  it('opens a named day once, and leaves focus where the gardener moves it when the garden redraws', async () => {
    const user = await openAt('#/journal/2026-10-24', 'Journal')
    await waitFor(() => expect(dateOf('2026-10-24')).toHaveFocus())
    const themeSwitch = screen.getByRole('button', { name: /^Switch to (night|sunlight) mode/ })
    await user.click(themeSwitch)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(themeSwitch).toHaveFocus()
  })
})
