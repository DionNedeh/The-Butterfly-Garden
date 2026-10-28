import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import App from './App'
import { toLocalDate } from './lib/date'
import { resetDrafts } from './lib/drafts'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import type { AppState, ComfortPlan } from './types'

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

/** How long a page loaded for the first time may take on a busy machine. */
const LAZY_PAGE_MS = 8000

function stored(profile: Partial<NonNullable<AppState['profile']>> = {}): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  // Visited today, so loading notes no visit.
  return { ...seed, profile: { ...seed.profile!, lastVisitOn: toLocalDate(), ...profile } }
}

let save: MockInstance<typeof gardenRepository.save>

/** The app over a stored garden, once past the splash screen and on its first page. */
async function openGarden(garden: AppState = stored(), firstPage = 'Quiet Corner') {
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: garden })
  save = vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: firstPage }, { timeout: LAZY_PAGE_MS })
  return user
}

function primaryNav() {
  return within(screen.getByRole('navigation', { name: 'Primary navigation' }))
}

async function onPage(name: string) {
  return screen.findByRole('heading', { level: 1, name }, { timeout: LAZY_PAGE_MS })
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
  resetDrafts()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('my comfort plan in the app', { timeout: 20_000 }, () => {
  it('is written from Settings, kept in the profile, and goes back there', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByRole('link', { name: 'Write a comfort plan' }, { timeout: LAZY_PAGE_MS }))
    const heading = await onPage('My comfort plan')
    expect(window.location.hash).toBe('#/comfort')
    await waitFor(() => expect(heading).toHaveFocus())

    const people = within(screen.getByRole('region', { name: 'People I can reach' }))
    await user.type(people.getByRole('textbox', { name: 'Name' }), 'Sam')
    await user.type(people.getByRole('textbox', { name: 'Phone number (optional)' }), '0161 496 0000')
    await user.click(people.getByRole('button', { name: 'Add to People I can reach' }))
    expect(people.getByRole('link', { name: 'Call Sam' })).toHaveAttribute('href', 'tel:01614960000')
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({
            comfortPlan: { people: [{ id: expect.any(String), text: 'Sam', phone: '0161 496 0000' }] },
          }),
        }),
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Back to Settings' }))
    await onPage('Settings')
    expect(screen.getByRole('link', { name: 'Your comfort plan' })).toBeInTheDocument()
  })

  it('opens the support page from its top, which comes back to the plan as it was', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    await user.click(await screen.findByRole('link', { name: 'Write a comfort plan' }, { timeout: LAZY_PAGE_MS }))
    await onPage('My comfort plan')
    await user.click(screen.getByRole('link', { name: 'If you need support now' }))
    await onPage('If you need support now')
    expect(window.location.hash).toBe('#/support')
    // The plan's back button is the way there, so the page offers no second one.
    expect(screen.queryByRole('link', { name: /comfort plan/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back to your comfort plan' }))
    await onPage('My comfort plan')
    // Still knowing the page that opened it.
    await user.click(screen.getByRole('button', { name: 'Back to Settings' }))
    await onPage('Settings')
  })

  it('is offered on the support page, and never sends the gardener round in a loop', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Guide' }))
    await user.click(
      await screen.findByRole('button', { name: 'If you need support now' }, { timeout: LAZY_PAGE_MS }),
    )
    await onPage('If you need support now')
    await user.click(await screen.findByRole('link', { name: 'Write a comfort plan' }, { timeout: LAZY_PAGE_MS }))
    await onPage('My comfort plan')
    expect(screen.getByRole('button', { name: 'Back to support' })).toBeInTheDocument()

    // Support from the plan the support page opened is that support page.
    await user.click(screen.getByRole('link', { name: 'If you need support now' }))
    await onPage('If you need support now')
    expect(screen.getByRole('button', { name: 'Back to the Guide' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write a comfort plan' })).toBeInTheDocument()
  })

  it('is offered on Today only while the day is gentle, and Android’s back returns there', async () => {
    const user = await openGarden(stored({ gentleDay: toLocalDate() }))
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    await user.click(await screen.findByRole('link', { name: 'Your comfort plan' }, { timeout: LAZY_PAGE_MS }))
    await onPage('My comfort plan')
    expect(screen.getByRole('button', { name: 'Back to Today' })).toBeInTheDocument()
    act(() => back.press?.())
    await onPage('Today')
    expect(window.location.hash).toBe('#/today')

    // An ordinary day has no link to it.
    await user.click(screen.getByRole('checkbox', { name: /gentle day/i }))
    await waitFor(() => expect(screen.queryByRole('link', { name: /comfort plan/i })).toBeNull())
  })

  it('opens from its address with the garden to go back to, and Android’s back goes there', async () => {
    const plan: ComfortPlan = { kindWords: [{ id: 'kind', text: 'Go gently.' }] }
    window.history.replaceState(null, '', '/#/comfort')
    await openGarden(stored({ comfortPlan: plan }), 'My comfort plan')
    expect(screen.getByText('Go gently.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to the garden' })).toBeInTheDocument()
    act(() => back.press?.())
    await onPage('Quiet Corner')
  })
})
