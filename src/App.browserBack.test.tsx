import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import App from './App'
import { toLocalDate } from './lib/date'
import { resetDrafts } from './lib/drafts'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import type { AppState, CreatureStage } from './types'
import { LAZY_PAGE_MS } from './test/lazyPage'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

/** Three companions, which Care sorts egg, caterpillar, butterfly. */
function gardenOfThree(): AppState {
  const base = createInitialState('Robin', 'Quiet Corner')
  const companion = (id: string, name: string, stage: CreatureStage) => ({
    ...base.creatures[0],
    id,
    name,
    stage,
    awaitingName: undefined,
  })
  return {
    ...base,
    creatures: [
      companion('zed', 'Zed', 'butterfly'),
      companion('elm', 'Elm', 'egg'),
      companion('fern', 'Fern', 'caterpillar'),
    ],
  }
}

/** A garden visited today, on a gentle day, so Today offers the comfort plan. */
function gentleGarden(): AppState {
  const base = createInitialState('Robin', 'Quiet Corner')
  return {
    ...base,
    profile: { ...base.profile!, lastVisitOn: toLocalDate(), gentleDay: toLocalDate() },
  }
}

async function openGarden(garden: AppState = gardenOfThree()) {
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: garden })
  vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
  return user
}

function primaryNav() {
  return within(screen.getByRole('navigation', { name: 'Primary navigation' }))
}

/** The browser's own Back or Forward, as a gardener presses it. */
async function browser(step: 'back' | 'forward') {
  await act(async () => {
    window.history[step]()
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

const bondLink = () => screen.getByRole('link', { name: /^What does this do\? Bond levels/ })

/** Where the app asks the window to scroll to, jsdom having no scrolling. */
let scrollTo: MockInstance<typeof window.scrollTo>
/** How far down the page is, as the app reads it. */
let scrolled: MockInstance<() => number>

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  scrolled = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetDrafts()
  window.history.replaceState(null, '', '/')
})

/** On Care, Zed chosen, scrolled down, and the Guide opened from Zed's bond meter. */
async function openGuideFromZed() {
  const user = await openGarden()
  await user.click(primaryNav().getByRole('button', { name: 'Care' }))
  await user.click(await screen.findByRole('tab', { name: /Zed/ }, { timeout: LAZY_PAGE_MS }))
  scrolled.mockReturnValue(480)
  await user.click(bondLink())
  scrolled.mockReturnValue(0)
  const heading = await screen.findByRole('heading', { level: 2, name: 'Bond levels' }, { timeout: LAZY_PAGE_MS })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(window.location.hash).toBe('#/guide/bond')
  return user
}

describe('6.6 the browser’s own Back returns to the same place', { timeout: 20_000 }, () => {
  it('returns Care to the companion whose link it was, scrolled where it was, with focus on that link', async () => {
    await openGuideFromZed()
    scrollTo.mockClear()
    await browser('back')
    await screen.findByRole('heading', { level: 1, name: 'Care & nurture' }, { timeout: LAZY_PAGE_MS })
    expect(window.location.hash).toBe('#/care')
    expect(screen.getByRole('tab', { name: /Zed/ })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(bondLink()).toHaveFocus())
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 480, behavior: 'instant' })
    expect(scrollTo).not.toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
  })

  it('and Forward opens the Guide again, with its way back', async () => {
    await openGuideFromZed()
    await browser('back')
    await waitFor(() => expect(bondLink()).toHaveFocus())
    await browser('forward')
    const heading = await screen.findByRole('heading', { level: 2, name: 'Bond levels' }, { timeout: LAZY_PAGE_MS })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Back to Care' })).toBeInTheDocument()
  })

  it('returns Settings to where it was scrolled, with focus on the link', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    const link = await screen.findByRole('link', { name: /^What does this do\? Seeds/ }, { timeout: LAZY_PAGE_MS })
    scrolled.mockReturnValue(1500)
    await user.click(link)
    scrolled.mockReturnValue(0)
    await screen.findByRole('heading', { level: 1, name: 'How the garden works' }, { timeout: LAZY_PAGE_MS })
    await browser('back')
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, { timeout: LAZY_PAGE_MS })
    expect(window.location.hash).toBe('#/settings')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /^What does this do\? Seeds/ })).toHaveFocus(),
    )
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1500, behavior: 'instant' })
  })

  it('keeps a second Guide section its own step: Back returns to the first, and then to Care', async () => {
    const user = await openGuideFromZed()
    const contents = within(screen.getByRole('navigation', { name: 'In this guide' }))
    await user.click(contents.getByRole('link', { name: 'Seeds and plants' }))
    expect(window.location.hash).toBe('#/guide/seeds')
    await browser('back')
    expect(window.location.hash).toBe('#/guide/bond')
    const heading = await screen.findByRole('heading', { level: 2, name: 'Bond levels' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Back to Care' })).toBeInTheDocument()
    await browser('back')
    await screen.findByRole('heading', { level: 1, name: 'Care & nurture' }, { timeout: LAZY_PAGE_MS })
    expect(screen.getByRole('tab', { name: /Zed/ })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(bondLink()).toHaveFocus())
  })

  it('returns the plan the support page’s Back reopened to that support page, and on back to Today', async () => {
    const user = await openGarden(gentleGarden())
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    await user.click(await screen.findByRole('link', { name: 'Your comfort plan' }, { timeout: LAZY_PAGE_MS }))
    await screen.findByRole('heading', { level: 1, name: 'My comfort plan' }, { timeout: LAZY_PAGE_MS })
    await user.click(screen.getByRole('link', { name: 'If you need support now' }))
    await screen.findByRole('heading', { level: 1, name: 'If you need support now' }, { timeout: LAZY_PAGE_MS })
    await user.click(screen.getByRole('button', { name: 'Back to your comfort plan' }))
    await screen.findByRole('heading', { level: 1, name: 'My comfort plan' }, { timeout: LAZY_PAGE_MS })
    await browser('back')
    expect(window.location.hash).toBe('#/support')
    await screen.findByRole('heading', { level: 1, name: 'If you need support now' }, { timeout: LAZY_PAGE_MS })
    await browser('back')
    expect(window.location.hash).toBe('#/comfort')
    await screen.findByRole('heading', { level: 1, name: 'My comfort plan' }, { timeout: LAZY_PAGE_MS })
    await browser('back')
    expect(window.location.hash).toBe('#/today')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Your comfort plan' })).toHaveFocus(),
    )
  })

  it('returns to the recap for the same evening, even once the app has been reopened on the Guide', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 27, 21, 0))
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    await user.click(await screen.findByRole('button', { name: 'Begin' }, { timeout: LAZY_PAGE_MS }))
    await screen.findByRole('heading', { name: 'Here is your day.' }, { timeout: LAZY_PAGE_MS })
    expect(window.location.hash).toBe('#/recap')
    await user.click(screen.getByRole('link', { name: /^What does this do\? Moonlight/ }))
    await screen.findByRole('heading', { level: 2, name: 'Moonlight — round out the evening' }, { timeout: LAZY_PAGE_MS })
    // Reopened on the Guide, as a reload would: what the app held in memory
    // is gone, and only the browser's history remembers the evening.
    cleanup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'How the garden works' }, { timeout: LAZY_PAGE_MS })
    await browser('back')
    await screen.findByRole('heading', { name: 'Here is your day.' }, { timeout: LAZY_PAGE_MS })
    expect(window.location.hash).toBe('#/recap')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /^What does this do\? Moonlight/ })).toHaveFocus(),
    )
  })

  it('leaves a reload as it was: the address alone, at the top of the page', async () => {
    // An entry this app wrote, with a place to go back to, reloaded.
    window.history.replaceState(
      { view: 'care', companionId: 'zed', restore: { section: 'bond', scrollY: 480, companionId: 'zed' } },
      '',
      '/#/care',
    )
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: gardenOfThree() })
    vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Care & nurture' }, { timeout: LAZY_PAGE_MS })
    // Care's first companion, as a link to #/care opens it.
    expect(screen.getByRole('tab', { name: /Elm/ })).toHaveAttribute('aria-selected', 'true')
    expect(scrollTo).not.toHaveBeenCalledWith({ top: 480, behavior: 'instant' })
  })

  it('reads an entry it did not write, a hash typed by hand, from the address, at the top', async () => {
    await openGuideFromZed()
    scrollTo.mockClear()
    await act(async () => {
      window.history.pushState(null, '', '/#/journal')
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
      await Promise.resolve()
    })
    await screen.findByRole('heading', { level: 1, name: 'Journal' }, { timeout: LAZY_PAGE_MS })
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' })
  })
})
