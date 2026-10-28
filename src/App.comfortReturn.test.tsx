import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import App from './App'
import { toLocalDate } from './lib/date'
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

/** Android's back gesture, as the app registers for it. */
const back = vi.hoisted(() => ({ press: undefined as (() => void) | undefined }))
vi.mock('./lib/native', async (original) => ({
  ...(await original<typeof import('./lib/native')>()),
  onBackButton: (handler: () => void) => {
    back.press = handler
    return () => {
      if (back.press === handler) back.press = undefined
    }
  },
}))

const PLAN = { level: 1, name: 'My comfort plan' } as const

/** A garden visited today, so loading notes no visit, on a gentle day if asked. */
function stored({ gentle = false } = {}): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
    profile: {
      ...seed.profile!,
      lastVisitOn: toLocalDate(),
      ...(gentle ? { gentleDay: toLocalDate() } : {}),
    },
  }
}

async function openGarden(garden: AppState = stored()) {
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

async function onPage(name: string) {
  return screen.findByRole('heading', { level: 1, name }, { timeout: LAZY_PAGE_MS })
}

/** Where the app asks the window to scroll to, jsdom having no scrolling. */
let scrollTo: MockInstance<typeof window.scrollTo>
/** How far down the page is, as the app reads it. */
let scrolled: MockInstance<() => number>

/** Press a way into the comfort plan at this depth, and wait for the plan. */
async function openPlanFrom(
  user: ReturnType<typeof userEvent.setup>,
  wayIn: HTMLElement,
  scrollY: number,
) {
  scrolled.mockReturnValue(scrollY)
  await user.click(wayIn)
  const heading = await screen.findByRole('heading', PLAN, { timeout: LAZY_PAGE_MS })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(window.location.hash).toBe('#/comfort')
  // The plan opens at its top.
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
  scrolled.mockReturnValue(0)
}

/** Settings' About card's way to the plan, pressed far down the page. */
async function planFromSettings() {
  const user = await openGarden()
  await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
  const link = await screen.findByRole(
    'link',
    { name: 'Write a comfort plan' },
    { timeout: LAZY_PAGE_MS },
  )
  await openPlanFrom(user, link, 2400)
  return user
}

/** Settings as it should be on the way back: scrolled as it was, focus on the link. */
async function expectBackInSettings() {
  await onPage('Settings')
  expect(window.location.hash).toBe('#/settings')
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Write a comfort plan' })).toHaveFocus(),
  )
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 2400, behavior: 'instant' })
}

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

describe('back from the comfort plan to the way in', { timeout: 20_000 }, () => {
  it('returns Settings to its About card’s link, scrolled where it was', async () => {
    const user = await planFromSettings()
    await user.click(screen.getByRole('button', { name: 'Back to Settings' }))
    await expectBackInSettings()
  })

  it('does the same for Android’s back gesture', async () => {
    await planFromSettings()
    act(() => back.press?.())
    await expectBackInSettings()
  })

  it('returns the support page to its own link, which still goes back to its opener', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    await user.click(
      await screen.findByRole('button', { name: 'If you need support now' }, { timeout: LAZY_PAGE_MS }),
    )
    const link = await screen.findByRole(
      'link',
      { name: 'Write a comfort plan' },
      { timeout: LAZY_PAGE_MS },
    )
    await openPlanFrom(user, link, 1080)
    await user.click(screen.getByRole('button', { name: 'Back to support' }))
    await onPage('If you need support now')
    expect(window.location.hash).toBe('#/support')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Write a comfort plan' })).toHaveFocus(),
    )
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1080, behavior: 'instant' })
    expect(screen.getByRole('button', { name: 'Back to Settings' })).toBeInTheDocument()
  })

  it('comes back through the support page the plan opened to Today’s gentle-day line', async () => {
    const user = await openGarden(stored({ gentle: true }))
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    const link = await screen.findByRole(
      'link',
      { name: 'Your comfort plan' },
      { timeout: LAZY_PAGE_MS },
    )
    await openPlanFrom(user, link, 640)

    // Support from partway down the plan opens at its top, as ever.
    scrolled.mockReturnValue(300)
    await user.click(screen.getByRole('link', { name: 'If you need support now' }))
    await onPage('If you need support now')
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    scrolled.mockReturnValue(0)

    // Its Back returns to the plan at the plan's way to support...
    await user.click(screen.getByRole('button', { name: 'Back to your comfort plan' }))
    await onPage('My comfort plan')
    expect(window.location.hash).toBe('#/comfort')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'If you need support now' })).toHaveFocus(),
    )
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 300, behavior: 'instant' })

    // ...and the plan, knowing still where it was opened, returns to Today's line.
    act(() => back.press?.())
    await onPage('Today')
    expect(window.location.hash).toBe('#/today')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Your comfort plan' })).toHaveFocus(),
    )
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'instant' })
  })

  it('opens a page at its top as ever when it is not a way back', async () => {
    const user = await planFromSettings()
    scrollTo.mockClear()
    // Leaving the plan by the navigation is not going back.
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    await onPage('Settings')
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' })
    expect(screen.getByRole('link', { name: 'Write a comfort plan' })).not.toHaveFocus()
  })
})
