import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import App from './App'
import { toLocalDate } from './lib/date'
import { resetDrafts } from './lib/drafts'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import type { AppState, Goal } from './types'
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

const BREATHE = { level: 1, name: 'Breathe with Marigold' } as const

function daily(id: string, title: string): Goal {
  return { id, title, schedule: 'daily', weekdays: [], createdDate: '2020-01-01', archived: false }
}

/** Two daily goals on Today, the second a breathing goal with its own link. */
function gardenWithBreaths(overrides: Partial<AppState> = {}): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
    goals: [daily('water', 'Drink a glass of water'), daily('breaths', 'Take three slow breaths')],
    ...overrides,
  }
}

async function openGarden(garden: AppState) {
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

/** Where the app asks the window to scroll to, jsdom having no scrolling. */
let scrollTo: MockInstance<typeof window.scrollTo>
/** How far down the page is, as the app reads it. */
let scrolled: MockInstance<() => number>

/** Press a way into breathing at this depth, and wait for the page. */
async function breatheFrom(
  user: ReturnType<typeof userEvent.setup>,
  wayIn: HTMLElement,
  scrollY: number,
) {
  scrolled.mockReturnValue(scrollY)
  await user.click(wayIn)
  const heading = await screen.findByRole('heading', BREATHE, { timeout: LAZY_PAGE_MS })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(window.location.hash).toBe('#/breathe')
  // Breathing opens at its top.
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
  scrolled.mockReturnValue(0)
}

/** On Today, a breathing goal's "Breathe now" pressed far down the page. */
async function breatheFromGoal() {
  const user = await openGarden(gardenWithBreaths())
  await user.click(primaryNav().getByRole('button', { name: 'Today' }))
  const link = await screen.findByRole('link', { name: 'Breathe now' }, { timeout: LAZY_PAGE_MS })
  await breatheFrom(user, link, 2315)
  return user
}

/** Today as it should be on the way back: scrolled as it was, focus on the link. */
async function expectBackAtGoal() {
  await screen.findByRole('heading', { level: 1, name: 'Today' }, { timeout: LAZY_PAGE_MS })
  expect(window.location.hash).toBe('#/today')
  const link = screen.getByRole('link', { name: 'Breathe now' })
  await waitFor(() => expect(link).toHaveFocus())
  expect(link.closest('.goal-row')).toHaveAttribute('data-goal-id', 'breaths')
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 2315, behavior: 'instant' })
}

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

describe('back from breathing to the way in', { timeout: 20_000 }, () => {
  it('returns Today to the goal’s "Breathe now", scrolled where it was', async () => {
    const user = await breatheFromGoal()
    await user.click(screen.getByRole('button', { name: 'Back to Today' }))
    await expectBackAtGoal()
  })

  it('does the same for Escape', async () => {
    const user = await breatheFromGoal()
    await user.keyboard('{Escape}')
    await expectBackAtGoal()
  })

  it('does the same for Android’s back gesture', async () => {
    await breatheFromGoal()
    act(() => back.press?.())
    await expectBackAtGoal()
  })

  it('returns the support page to its own link', async () => {
    const user = await openGarden(gardenWithBreaths())
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    await user.click(
      await screen.findByRole('button', { name: 'If you need support now' }, { timeout: LAZY_PAGE_MS }),
    )
    const link = await screen.findByRole(
      'link',
      { name: 'breathe with Marigold' },
      { timeout: LAZY_PAGE_MS },
    )
    await breatheFrom(user, link, 1400)
    await user.click(screen.getByRole('button', { name: 'Back to support' }))
    await screen.findByRole('heading', { level: 1, name: 'If you need support now' })
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'breathe with Marigold' })).toHaveFocus(),
    )
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1400, behavior: 'instant' })
    // Support still goes back to the page that opened it.
    expect(screen.getByRole('button', { name: 'Back to Settings' })).toBeInTheDocument()
  })

  it('returns to the check-in the next step followed, the offer being taken', async () => {
    const stormy = {
      id: 'm',
      localDate: toLocalDate(),
      level: 1 as const,
      note: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const user = await openGarden(gardenWithBreaths({ moods: [stormy] }))
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    const offer = await screen.findByRole(
      'group',
      { name: /One small thing/ },
      { timeout: LAZY_PAGE_MS },
    )
    await breatheFrom(user, within(offer).getByRole('button', { name: 'Breathe with Marigold' }), 700)
    await user.click(screen.getByRole('button', { name: 'Back to Today' }))
    await screen.findByRole('heading', { level: 1, name: 'Today' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Update check-in' })).toHaveFocus(),
    )
    expect(screen.queryByRole('group', { name: /One small thing/ })).toBeNull()
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 700, behavior: 'instant' })
  })

  it('returns from the recap, collected on the way, to the top of Today', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 27, 21, 0))
    const user = await openGarden(gardenWithBreaths())
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    await user.click(await screen.findByRole('button', { name: 'Begin' }, { timeout: LAZY_PAGE_MS }))
    await screen.findByRole('heading', { name: 'Here is your day.' }, { timeout: LAZY_PAGE_MS })
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole('button', { name: 'Skip this one' }))
    }
    // Wherever the recap was scrolled, it is not Today's place.
    await breatheFrom(
      user,
      screen.getByRole('button', { name: 'Collect Moonlight and breathe with Marigold' }),
      900,
    )
    await user.click(screen.getByRole('button', { name: 'Back to Today' }))
    const today = await screen.findByRole('heading', { level: 1, name: 'Today' })
    expect(window.location.hash).toBe('#/today')
    await waitFor(() => expect(today).toHaveFocus())
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    // The recap was kept, so Today offers it no more.
    expect(screen.getByRole('heading', { name: 'The day is rounded out.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull()
  })

  it('opens a page at its top as ever when it is not a way back', async () => {
    const user = await breatheFromGoal()
    scrollTo.mockClear()
    // Leaving breathing by the navigation is not going back.
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    await screen.findByRole('heading', { level: 1, name: 'Today' }, { timeout: LAZY_PAGE_MS })
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' })
    expect(screen.getByRole('link', { name: 'Breathe now' })).not.toHaveFocus()
  })
})
