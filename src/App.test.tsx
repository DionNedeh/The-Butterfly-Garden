import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createInitialState } from './lib/progression'
import { gardenRepository } from './repository/gardenRepository'
import type { AppState } from './types'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

function stored(overrides: Partial<AppState> = {}): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return { ...seed, ...overrides }
}

/** The app over a stored garden, once past the splash screen. */
async function openGarden(garden: AppState = stored()) {
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: garden })
  vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { level: 1, name: garden.profile?.gardenName }, { timeout: 3000 })
  return user
}

function primaryNav() {
  return within(screen.getByRole('navigation', { name: 'Primary navigation' }))
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('the app shell', () => {
  it('opens every page from the navigation, and the address follows', async () => {
    const user = await openGarden()
    const pages: Array<[string, RegExp | string, string]> = [
      ['Care', /care & nurture|the nursery is quiet/i, '#/care'],
      ['Today', 'Today', '#/today'],
      ['Journal', 'Journal', '#/journal'],
      ['Shop', /stock up/i, '#/shop'],
      ['Flight', 'Flight Patterns', '#/flight'],
      ['Guide', 'How the garden works', '#/guide'],
      ['Settings', 'Settings', '#/settings'],
    ]
    for (const [label, heading, hash] of pages) {
      await user.click(primaryNav().getByRole('button', { name: label }))
      expect(
        await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 3000 }),
      ).toBeInTheDocument()
      expect(window.location.hash).toBe(hash)
      expect(primaryNav().getByRole('button', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      )
    }

    // The wordmark goes home, to the plain address.
    await user.click(screen.getByRole('button', { name: /go to the garden/i }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })).toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('follows Back to the page before', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Journal' }))
    await screen.findByRole('heading', { level: 1, name: 'Journal' }, { timeout: 3000 })
    act(() => {
      window.history.pushState(null, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })).toBeInTheDocument()
  })

  it('opens the page a link names', async () => {
    window.history.replaceState(null, '', '/#/journal')
    await openGardenAt('Journal')
    expect(window.location.hash).toBe('#/journal')
  })

  it('switches theme and sound from the header', async () => {
    const user = await openGarden()
    const shell = document.querySelector('.app-shell')!
    expect(shell).toHaveClass('theme-sunlight')
    await user.click(screen.getByRole('button', { name: 'Switch to night mode' }))
    expect(shell).toHaveClass('theme-night')
    await user.click(screen.getByRole('button', { name: 'Switch to sunlight mode' }))
    expect(shell).toHaveClass('theme-sunlight')

    const sound = screen.getByRole('button', { name: /^Turn on / })
    expect(sound).toHaveAttribute('aria-pressed', 'false')
    await user.click(sound)
    expect(screen.getByRole('button', { name: /^Turn off / })).toHaveAttribute('aria-pressed', 'true')
  })

  it('says so when the device goes offline, and when it is back', async () => {
    await openGarden()
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByText(/you are offline/i)).toBeNull()
  })

  it('offers the release notes once, and remembers they were read', async () => {
    // A garden from before this release; new ones start having seen it.
    const seed = stored()
    const user = await openGarden({
      ...seed,
      profile: { ...seed.profile!, lastSeenReleaseId: undefined },
    })
    const notice = screen.getByText('Your garden has grown.').closest('aside')!
    await user.click(within(notice).getByRole('button', { name: /what.s new/i }))
    expect(window.location.hash).toBe('#/whats-new')
    await user.click(screen.getByRole('button', { name: /go to the garden/i }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })
    expect(screen.queryByText('Your garden has grown.')).toBeNull()
  })

  it('shows the sunlight earned today against the daily cap', async () => {
    await openGarden()
    expect(screen.getByTitle('Sunlight earned today')).toHaveTextContent('0 / 5')
  })

  it('says when a change could not be saved, and what to do', async () => {
    const user = await openGarden()
    vi.spyOn(gardenRepository, 'save').mockRejectedValue(new Error('The disk is full.'))
    await user.click(screen.getByRole('button', { name: 'Switch to night mode' }))
    expect(await screen.findByText('Your last change could not be saved.')).toBeInTheDocument()
    expect(screen.getByText('The disk is full.')).toBeInTheDocument()
  })
})

/** Render at whatever address the test set, and wait for the named page. */
async function openGardenAt(heading: string) {
  vi.spyOn(gardenRepository, 'load').mockResolvedValue({ status: 'loaded', state: stored() })
  vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
  render(<App />)
  expect(
    await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 3000 }),
  ).toBeInTheDocument()
}

describe('arriving at an address', () => {
  it('opens an unknown page as the garden and cleans the address', async () => {
    window.history.replaceState(null, '', '/#/somewhere-old')
    await openGardenAt('Quiet Corner')
    await waitFor(() => expect(window.location.hash).toBe(''))
  })

  it('opens a shared Garden Pass link on the shop', async () => {
    window.history.replaceState(null, '', '/#/shop/pass')
    await openGardenAt('Stock up & dress up')
    expect(window.location.hash).toBe('#/shop/pass')
  })

  it('lands a reloaded recap on Today', async () => {
    window.history.replaceState(null, '', '/#/recap')
    await openGardenAt('Today')
    await waitFor(() => expect(window.location.hash).toBe('#/today'))
  })
})
