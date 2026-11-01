import type { ComponentType } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import { LAZY_PAGE_MS } from './test/lazyPage'

/*
 * Every page draws inside the app's own error boundary (App.tsx), so one
 * page that throws shows "This page could not be shown" in its place: the
 * navigation stays, and moving to another page draws that one afresh. Each
 * page below is made to throw in turn.
 */

const broken = vi.hoisted(() => {
  const state = { page: '' }
  return {
    state,
    /** The module, its page swapped for one that throws while it is the broken one. */
    async page(module: Record<string, unknown>, name: string): Promise<Record<string, unknown>> {
      const { createElement } = await import('react')
      const Page = module[name] as ComponentType<object>
      function Breakable(props: object) {
        if (state.page === name) throw new Error(`${name} could not be drawn, on purpose`)
        return createElement(Page, props)
      }
      return { ...module, [name]: Breakable }
    },
  }
})

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))
vi.mock('./components/GardenView', async (original) => broken.page(await original(), 'GardenView'))
vi.mock('./components/CareView', async (original) => broken.page(await original(), 'CareView'))
vi.mock('./components/TodayView', async (original) => broken.page(await original(), 'TodayView'))
vi.mock('./components/JournalView', async (original) => broken.page(await original(), 'JournalView'))
vi.mock('./components/ShopView', async (original) => broken.page(await original(), 'ShopView'))
vi.mock('./components/FlightPatternsView', async (original) =>
  broken.page(await original(), 'FlightPatternsView'),
)
vi.mock('./components/GuideView', async (original) => broken.page(await original(), 'GuideView'))
vi.mock('./components/SettingsView', async (original) => broken.page(await original(), 'SettingsView'))
vi.mock('./components/WhatsNewView', async (original) => broken.page(await original(), 'WhatsNewView'))
vi.mock('./components/PrivacyPolicyView', async (original) =>
  broken.page(await original(), 'PrivacyPolicyView'),
)
vi.mock('./components/NoticesView', async (original) => broken.page(await original(), 'NoticesView'))
vi.mock('./components/SupportView', async (original) => broken.page(await original(), 'SupportView'))
vi.mock('./components/BreathingView', async (original) => broken.page(await original(), 'BreathingView'))
vi.mock('./components/YearView', async (original) => broken.page(await original(), 'YearView'))
vi.mock('./components/ComfortPlanView', async (original) =>
  broken.page(await original(), 'ComfortPlanView'),
)
vi.mock('./components/MoonlightRecap', async (original) => broken.page(await original(), 'MoonlightRecap'))

const GARDEN = 'Quiet Corner'

/** The app over a stored garden, at `address`, once past the splash screen. */
function openAt(address: string) {
  window.history.replaceState(null, '', `/${address}`)
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({
    status: 'loaded',
    state: createInitialState('Robin', GARDEN),
  })
  vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
  const user = userEvent.setup()
  render(<App />)
  return user
}

function primaryNav() {
  return within(screen.getByRole('navigation', { name: 'Primary navigation' }))
}

async function problemShown() {
  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'This page could not be shown' },
      { timeout: LAZY_PAGE_MS },
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Back to the garden' })).toBeInTheDocument()
}

beforeEach(() => {
  // A page that throws is logged by React and by the boundary.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  broken.state.page = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('4.4 a page that cannot be drawn', { timeout: 20_000 }, () => {
  // Every page an address opens (lib/routes), each loaded as its own chunk.
  it.each([
    ['CareView', '#/care'],
    ['TodayView', '#/today'],
    ['JournalView', '#/journal'],
    ['ShopView', '#/shop'],
    ['FlightPatternsView', '#/flight'],
    ['GuideView', '#/guide'],
    ['SettingsView', '#/settings'],
    ['WhatsNewView', '#/whats-new'],
    ['PrivacyPolicyView', '#/privacy'],
    ['NoticesView', '#/notices'],
    ['SupportView', '#/support'],
    ['BreathingView', '#/breathe'],
    ['YearView', '#/year'],
    ['ComfortPlanView', '#/comfort'],
  ])('shows the problem in place of %s, keeps the navigation, and recovers on another page', async (page, address) => {
    broken.state.page = page
    const user = openAt(address)
    await problemShown()
    expect(window.location.hash).toBe(address)

    // The navigation still works, and the next page is drawn afresh.
    await user.click(primaryNav().getByRole('button', { name: 'Garden' }))
    expect(await screen.findByRole('heading', { level: 1, name: GARDEN })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'This page could not be shown' })).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('shows the problem in place of the garden itself, and recovers on another page', async () => {
    broken.state.page = 'GardenView'
    const user = openAt('')
    await problemShown()

    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Today' }, { timeout: LAZY_PAGE_MS }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'This page could not be shown' })).toBeNull()
  })

  it('shows the problem in place of the evening recap, and its way back to the garden works', async () => {
    // The recap is offered on Today in the evening.
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 27, 21, 0))
    broken.state.page = 'MoonlightRecap'
    const user = openAt('#/today')
    await user.click(await screen.findByRole('button', { name: 'Begin' }, { timeout: LAZY_PAGE_MS }))
    await problemShown()

    await user.click(screen.getByRole('button', { name: 'Back to the garden' }))
    expect(await screen.findByRole('heading', { level: 1, name: GARDEN })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'This page could not be shown' })).toBeNull()
  })
})
