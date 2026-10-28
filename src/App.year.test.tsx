import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { resetDrafts } from './lib/drafts'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import type { AppState } from './types'

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

/** Every page arrives as a lazy chunk, which a busy machine can take a while over. */
const LAZY_PAGE_MS = 8000

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  // A Tuesday in late October: the year is a quiet link away.
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 9, 27, 10))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  resetDrafts()
  window.history.replaceState(null, '', '/')
})

/** A garden begun in 2025, written in that year and this one. */
function garden(): AppState {
  const base = createInitialState('Robin', 'Quiet Corner', new Date(2025, 2, 1, 9))
  const mood = (localDate: string, note: string) => ({
    id: `mood-${localDate}`,
    localDate,
    level: 4 as const,
    note,
    starred: true as const,
    createdAt: `${localDate}T16:00:00.000Z`,
    updatedAt: `${localDate}T16:00:00.000Z`,
  })
  return {
    ...base,
    profile: { ...base.profile!, lastVisitOn: '2026-10-27' },
    moods: [mood('2025-06-01', 'A June evening'), mood('2026-04-05', 'The light on the river')],
  }
}

async function openJournal() {
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: garden() })
  vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
  const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
  await user.click(nav.getByRole('button', { name: 'Journal' }))
  const link = await screen.findByRole('link', { name: 'Your garden’s year' }, { timeout: LAZY_PAGE_MS })
  return { user, link }
}

async function openYear() {
  const { user, link } = await openJournal()
  await user.click(link)
  const heading = await screen.findByRole(
    'heading',
    { level: 1, name: 'Your garden’s 2026' },
    { timeout: LAZY_PAGE_MS },
  )
  await waitFor(() => expect(heading).toHaveFocus())
  expect(window.location.hash).toBe('#/year')
  return user
}

/** The Journal, back from the year, with focus on the link that opened it. */
async function expectBackInJournal() {
  await screen.findByRole('heading', { level: 1, name: 'Journal' }, { timeout: LAZY_PAGE_MS })
  expect(window.location.hash).toBe('#/journal')
  await waitFor(() =>
    expect(screen.getByRole('link', { name: 'Your garden’s year' })).toHaveFocus(),
  )
}

describe('your garden’s year, from the Journal', { timeout: 30_000 }, () => {
  it('opens from the Journal’s link and goes back there by its button', async () => {
    const user = await openYear()
    expect(screen.getByRole('region', { name: 'Lines you starred' })).toHaveTextContent(
      'The light on the river',
    )
    await user.click(screen.getByRole('button', { name: 'Back to the Journal' }))
    await expectBackInJournal()
  })

  it('goes back to the Journal with Android’s back gesture too', async () => {
    await openYear()
    act(() => back.press?.())
    await expectBackInJournal()
  })

  it('keeps an earlier year in the address, so a reload stays on it', async () => {
    const user = await openYear()
    await user.click(
      within(screen.getByRole('group', { name: 'Years' })).getByRole('button', { name: '2025' }),
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your garden’s 2025' }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe('#/year/2025')
    expect(screen.getByRole('region', { name: 'Lines you starred' })).toHaveTextContent(
      'A June evening',
    )
  })

  it('opens from its address, with the Journal to go back to', async () => {
    window.history.replaceState(null, '', '/#/year/2025')
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: garden() })
    vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    render(<App />)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your garden’s 2025' }, { timeout: LAZY_PAGE_MS }),
    ).toBeInTheDocument()
    act(() => back.press?.())
    await expectBackInJournal()
  })
})
