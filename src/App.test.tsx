import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { toLocalDate } from './lib/date'
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

// Each test renders the whole app; the first walks into every lazily loaded
// page. That outgrows Vitest's five seconds on a busy CI runner with coverage
// on, without anything being wrong.
const WHOLE_APP_TIMEOUT_MS = 20_000

describe('the app shell', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
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

  it("reaches the pages behind the dock's More, and More stands for them", async () => {
    const user = await openGarden()
    const dock = within(screen.getByRole('navigation', { name: 'Mobile navigation' }))
    const more = dock.getByRole('button', { name: 'More' })
    await user.click(more)
    await user.click(within(screen.getByRole('dialog', { name: 'More' })).getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' }, { timeout: 3000 })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/settings')
    expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull()
    expect(more).toHaveAttribute('aria-current', 'page')
    expect(more).toHaveFocus()

    await user.click(dock.getByRole('button', { name: 'Today' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' }, { timeout: 3000 })).toBeInTheDocument()
    expect(more).not.toHaveAttribute('aria-current')
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

  it('shows the sunlight earned today against the daily cap, each currency named alike', async () => {
    await openGarden()
    expect(screen.getByTitle('Sunlight earned today')).toHaveTextContent('0 / 5 Sunlight today')
    expect(screen.getByTitle('Nectar balance')).toHaveTextContent(/Nectar$/)
    expect(screen.getByTitle('Stardust balance')).toHaveTextContent(/Stardust$/)
  })

  it('opens support from the Guide and returns there', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Guide' }))
    await user.click(await screen.findByRole('button', { name: 'If you need support now' }, { timeout: 3000 }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'If you need support now' }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe('#/support')
    await user.click(screen.getByRole('button', { name: 'Back to the Guide' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'How the garden works' })).toBeInTheDocument()
  })

  it('opens the Guide where a "What does this do?" link points, and goes back', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    await user.click(
      await screen.findByRole('link', { name: /^What does this do\? Sunlight/ }, { timeout: 3000 }),
    )
    const heading = await screen.findByRole(
      'heading',
      { level: 2, name: 'Sunlight — care for yourself first' },
      { timeout: 3000 },
    )
    expect(window.location.hash).toBe('#/guide/sunlight')
    await waitFor(() => expect(heading).toHaveFocus())
    await user.click(screen.getByRole('button', { name: 'Back to Today' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/today')
  })

  it('opens the Guide at a section a link names, with no way back to offer', async () => {
    window.history.replaceState(null, '', '/#/guide/bond')
    await openGardenAt('How the garden works')
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Bond levels' })).toHaveFocus(),
    )
    expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull()
  })

  it('starts the fade-out when the sound is turned on, and turns the sound off at the end', async () => {
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    await user.selectOptions(await screen.findByLabelText('Fade out after', {}, { timeout: 3000 }), '15')
    expect(screen.getByText('The timer starts when the sound is turned on.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Turn on / }))
    expect(screen.getByText(/The sound fades away at/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Turn off / }))
    expect(screen.getByText('The timer starts when the sound is turned on.')).toBeInTheDocument()
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

describe('arriving at an address', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
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

  it('opens the "Check in" shortcut on Today, at the weather question', async () => {
    window.history.replaceState(null, '', '/#/today/check-in')
    await openGardenAt('Today')
    expect(screen.getByRole('heading', { name: 'What is your inner weather?' })).toHaveFocus()
    expect(window.location.hash).toBe('#/today/check-in')
  })
})

describe('the backup reminder in the navigation', () => {
  it('marks Settings, quietly, once a fresh copy is due, and not before', async () => {
    const seed = stored()
    const longAgo = new Date(Date.now() - 40 * 86_400_000).toISOString()
    await openGarden({ ...seed, profile: { ...seed.profile!, createdAt: longAgo } })
    expect(
      primaryNav().getByRole('button', { name: 'Settings, time for a fresh copy' }),
    ).toBeInTheDocument()
  }, WHOLE_APP_TIMEOUT_MS)

  it('says nothing while the last copy is recent', async () => {
    const seed = stored()
    const longAgo = new Date(Date.now() - 40 * 86_400_000).toISOString()
    const recently = new Date(Date.now() - 2 * 86_400_000).toISOString()
    await openGarden({
      ...seed,
      profile: { ...seed.profile!, createdAt: longAgo, lastBackupAt: recently },
    })
    expect(primaryNav().getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  }, WHOLE_APP_TIMEOUT_MS)
})

/** A device whose dark setting a test can change, as matchMedia reports it. */
function stubDevice(dark: boolean) {
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(prefers-color-scheme: dark)' && dark
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }))
  return (next: boolean) => {
    dark = next
    act(() => listeners.forEach((listener) => listener()))
  }
}

/** A stored garden with these profile choices. */
function storedWith(profile: Partial<NonNullable<AppState['profile']>>): AppState {
  const seed = stored()
  return { ...seed, profile: { ...seed.profile!, ...profile } }
}

const shell = () => document.querySelector('.app-shell')!

describe('a theme that follows', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove())
  })

  it('turns to night when the evening starts, and the switch then stops following', async () => {
    // The clock runs, so the splash and the page's own waits pass as ever;
    // the test moves it on to six o'clock.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 27, 17, 59, 30))
    const user = await openGarden(storedWith({ themeFollows: 'evening' }))
    expect(shell()).toHaveClass('theme-sunlight')
    expect(
      screen.getByRole('button', { name: 'Switch to night mode and stop following your evening' }),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(31_000)
    })
    expect(shell()).toHaveClass('theme-night')

    await user.click(
      screen.getByRole('button', { name: 'Switch to sunlight mode and stop following your evening' }),
    )
    expect(shell()).toHaveClass('theme-sunlight')
    // Chosen by hand now: the switch says only what it does.
    expect(screen.getByRole('button', { name: 'Switch to night mode' })).toBeInTheDocument()
  })

  it('follows the device, and colours the browser’s bars to match', async () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="#f7f3e8" media="(prefers-color-scheme: light)">' +
        '<meta name="theme-color" content="#07131f" media="(prefers-color-scheme: dark)">',
    )
    const bars = () =>
      [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
        (meta) => meta.content,
      )
    const setDark = stubDevice(false)
    await openGarden(storedWith({ theme: 'night', themeFollows: 'device' }))
    expect(shell()).toHaveClass('theme-sunlight')
    expect(bars()).toEqual(['#f7f3e8', '#f7f3e8'])

    setDark(true)
    expect(shell()).toHaveClass('theme-night')
    expect(bars()).toEqual(['#07131f', '#07131f'])
    expect(
      screen.getByRole('button', { name: 'Switch to sunlight mode and stop following your device' }),
    ).toBeInTheDocument()
    setDark(false)
    expect(shell()).toHaveClass('theme-sunlight')
  })

  it('is chosen in Settings, and a hand-chosen night stays night whatever the device', async () => {
    const setDark = stubDevice(true)
    const user = await openGarden()
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    const themes = await screen.findByRole('group', { name: 'Theme' }, { timeout: 3000 })
    await user.click(within(themes).getByRole('radio', { name: /^Follow device/ }))
    expect(shell()).toHaveClass('theme-night')
    await user.click(within(themes).getByRole('radio', { name: /^Sunlight/ }))
    expect(shell()).toHaveClass('theme-sunlight')
    await user.click(within(themes).getByRole('radio', { name: /^Night/ }))
    setDark(false)
    expect(shell()).toHaveClass('theme-night')
  })
})

describe('the text size', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
  it('scales the root while a garden is open, and the usual size sets nothing', async () => {
    const root = document.documentElement
    const user = await openGarden(storedWith({ textSize: 'largest' }))
    expect(root.style.fontSize).toBe('125%')
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    const sizes = await screen.findByRole('group', { name: 'Text size' }, { timeout: 3000 })
    await user.click(within(sizes).getByRole('radio', { name: /^Larger/ }))
    expect(root.style.fontSize).toBe('112.5%')
    await user.click(within(sizes).getByRole('radio', { name: /^Comfortable/ }))
    expect(root.style.fontSize).toBe('')
    await user.click(within(sizes).getByRole('radio', { name: /^Largest/ }))
    expect(root.style.fontSize).toBe('125%')
  })

  it('goes with the garden', async () => {
    await openGarden(storedWith({ textSize: 'larger' }))
    expect(document.documentElement.style.fontSize).toBe('112.5%')
    cleanup()
    expect(document.documentElement.style.fontSize).toBe('')
  })
})

describe('ending the recap by fading the garden to night', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    resetDrafts()
  })

  /** Open tonight's recap from Today and walk to its last screen. */
  async function walkToTheEnd(user: ReturnType<typeof userEvent.setup>) {
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    await user.click(await screen.findByRole('button', { name: 'Begin' }, { timeout: 3000 }))
    await screen.findByRole('heading', { name: 'Here is your day.' }, { timeout: 3000 })
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole('button', { name: 'Skip this one' }))
    }
  }

  it('collects the night, turns to night, fades the sound and goes back to the garden', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 27, 21, 0))
    const user = await openGarden(storedWith({ ambientSound: true }))
    await walkToTheEnd(user)
    await user.click(screen.getByRole('button', { name: 'Fade the garden to night and close' }))

    const title = await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })
    expect(title).toHaveFocus()
    expect(window.location.hash).toBe('')
    expect(shell()).toHaveClass('theme-night')
    expect(screen.getByTitle('Stardust balance')).toHaveTextContent('1 Stardust')

    // The fade-out runs, as if it had been chosen in Settings.
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    expect(await screen.findByText(/The sound fades away at/, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByLabelText('Fade out after')).toHaveValue('15')
    // Night is held for tonight only: the theme chosen is still Sunlight,
    // and it is back in the morning.
    expect(within(screen.getByRole('group', { name: 'Theme' })).getByRole('radio', { name: /^Sunlight/ })).toBeChecked()
    expect(shell()).toHaveClass('theme-night')
    vi.setSystemTime(new Date(2026, 9, 28, 6, 1))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(shell()).toHaveClass('theme-sunlight')
  })

  it('keeps following the device, and the switch simply ends the night it holds', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 27, 21, 0))
    stubDevice(false)
    const user = await openGarden(storedWith({ themeFollows: 'device' }))
    expect(shell()).toHaveClass('theme-sunlight')
    await walkToTheEnd(user)
    await user.click(screen.getByRole('button', { name: 'Fade the garden to night and close' }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })
    expect(shell()).toHaveClass('theme-night')

    // Pressing the switch lets the held night go, and following goes on.
    await user.click(screen.getByRole('button', { name: 'Switch to sunlight mode' }))
    expect(shell()).toHaveClass('theme-sunlight')
    expect(
      screen.getByRole('button', { name: 'Switch to night mode and stop following your device' }),
    ).toBeInTheDocument()
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    const themes = await screen.findByRole('group', { name: 'Theme' }, { timeout: 3000 })
    expect(within(themes).getByRole('radio', { name: /^Follow device/ })).toBeChecked()
  })

  it('leaves a followed night and a silent garden as they are', async () => {
    vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 9, 27, 21, 0))
    const user = await openGarden(storedWith({ themeFollows: 'evening' }))
    expect(shell()).toHaveClass('theme-night')
    await walkToTheEnd(user)
    await user.click(screen.getByRole('button', { name: 'Fade the garden to night and close' }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })
    expect(shell()).toHaveClass('theme-night')

    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    const themes = await screen.findByRole('group', { name: 'Theme' }, { timeout: 3000 })
    expect(within(themes).getByRole('radio', { name: /^Follow evening/ })).toBeChecked()
    // No sound was playing, so no fade was started.
    expect(screen.getByLabelText('Fade out after')).toHaveValue('')
  })
})

describe('the sound you can shape', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lets night bring the piano as the theme turns, and the chosen soundscape return with the sunlight', async () => {
    const setDark = stubDevice(false)
    await openGarden(
      storedWith({ ambientTrack: 'soft-rain', soundFollowsTheme: true, themeFollows: 'device' }),
    )
    expect(screen.getByRole('button', { name: 'Turn on Soft Rain' })).toBeInTheDocument()
    setDark(true)
    expect(screen.getByRole('button', { name: 'Turn on Piano Music' })).toBeInTheDocument()
    setDark(false)
    expect(screen.getByRole('button', { name: 'Turn on Soft Rain' })).toBeInTheDocument()
  })

  it('stores the volume and both switches from Settings', async () => {
    const user = await openGarden()
    const save = vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
    const lastProfile = () => save.mock.calls.at(-1)?.[0].profile
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    const slider = await screen.findByRole('slider', { name: 'Volume' }, { timeout: 3000 })

    fireEvent.input(slider, { target: { value: '30' } })
    fireEvent.change(slider)
    await waitFor(() => expect(lastProfile()?.ambientVolume).toBe(30))
    expect(slider).toHaveValue('30')

    await user.click(screen.getByRole('checkbox', { name: /^Night brings the piano/ }))
    await waitFor(() => expect(lastProfile()?.soundFollowsTheme).toBe(true))
    await user.click(
      screen.getByRole('checkbox', { name: /^Keep playing when the app is in the background/ }),
    )
    await waitFor(() => expect(lastProfile()?.soundInBackground).toBe(false))
  })
})

describe('meeting a butterfly, and a flight of its own', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
  function twoCompanions(): AppState {
    const seed = stored()
    const flyer = (id: string, name: string) => ({
      ...seed.creatures[0],
      id,
      name,
      speciesId: 'monarch',
      stage: 'butterfly' as const,
    })
    return {
      ...seed,
      ownedFlightPatternIds: ['gentle-drift', 'petal-hop'],
      // Ash comes first on the Care page; the card asks for Sol.
      creatures: [flyer('ash', 'Ash'), flyer('sol', 'Sol')],
    }
  }

  it('opens Care on the companion from its card, and flies the pattern chosen there', async () => {
    const user = await openGarden(twoCompanions())
    await user.click(screen.getByRole('button', { name: 'Meet Sol, Monarch' }))
    const card = await screen.findByRole('dialog', { name: 'Sol' }, { timeout: 3000 })
    await user.click(within(card).getByRole('button', { name: 'Care for Sol' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Care & nurture' }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(window.location.hash).toBe('#/care')
    const tab = screen.getByRole('tab', { name: /Sol/ })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    expect(tab).toHaveFocus()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Flight' }), 'Petal Hop')
    await user.click(primaryNav().getByRole('button', { name: 'Garden' }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })
    const pattern = (id: string) =>
      document.querySelector<HTMLElement>(`[data-flyer="${id}"]`)?.dataset.pattern
    expect(pattern('sol')).toBe('petal-hop')
    expect(pattern('ash')).toBe('gentle-drift')
    expect(pattern('marigold-guide')).toBe('gentle-drift')

    // Care from the navigation opens as usual, on the first companion.
    await user.click(primaryNav().getByRole('button', { name: 'Care' }))
    expect(await screen.findByRole('tab', { name: /Ash/ }, { timeout: 3000 })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})

describe('coming back after a few days away', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
  const daysAgo = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date
  }

  it('shows one small welcome in the garden, remembered as shown once put away', async () => {
    const lastVisitOn = toLocalDate(daysAgo(5))
    const user = await openGarden(storedWith({ lastVisitOn }))
    // The spy openGarden set up, which spying again hands back.
    const save = vi.spyOn(gardenRepository, 'save')
    const card = await screen.findByRole('group', { name: 'Welcome back' }, { timeout: 3000 })
    // It never says how long, and the visit was written down once.
    expect(card).not.toHaveTextContent(/\b(\d+|days?|weeks?|missed|lost)\b/i)
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({ lastVisitOn: toLocalDate(), welcomeBackOn: toLocalDate() }),
        }),
      ),
    )
    const nectar = screen.getByTitle(/Nectar balance/).textContent

    await user.click(within(card).getByRole('button', { name: 'Put away' }))
    expect(screen.queryByRole('group', { name: 'Welcome back' })).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Quiet Corner' })).toHaveFocus()
    await waitFor(() =>
      expect(save.mock.lastCall?.[0].profile).not.toHaveProperty('welcomeBackOn'),
    )
    // It granted nothing.
    expect(screen.getByTitle(/Nectar balance/).textContent).toBe(nectar)

    // Elsewhere and back again, it stays away.
    await user.click(primaryNav().getByRole('button', { name: 'Today' }))
    await user.click(primaryNav().getByRole('button', { name: 'Garden' }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })
    expect(screen.queryByRole('group', { name: 'Welcome back' })).toBeNull()
  })

  it('has nothing to show after a day or two', async () => {
    await openGarden(storedWith({ lastVisitOn: toLocalDate(daysAgo(2)) }))
    await waitFor(() =>
      expect(vi.spyOn(gardenRepository, 'save')).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({ lastVisitOn: toLocalDate() }),
        }),
      ),
    )
    expect(screen.queryByRole('group', { name: 'Welcome back' })).toBeNull()
  })
})

describe('the garden pace', { timeout: WHOLE_APP_TIMEOUT_MS }, () => {
  it('is chosen in Settings, and the plant panel then says when the next bloom comes', async () => {
    const seed = stored()
    const bloomed = { ...seed, plants: seed.plants.map((plant) => ({ ...plant, growth: 3 })) }
    const user = await openGarden(bloomed)
    await user.click(await screen.findByRole('button', { name: /^Milkweed 1/ }))
    // Classic: a plant blooms once, so there is no next bloom to speak of.
    expect(screen.queryByText('Next bloom')).toBeNull()

    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    const pace = await screen.findByRole('group', { name: 'Garden pace' }, { timeout: 3000 })
    await user.click(within(pace).getByRole('radio', { name: /^Keep giving/ }))
    expect(within(pace).getByRole('radio', { name: /^Keep giving/ })).toBeChecked()

    await user.click(primaryNav().getByRole('button', { name: 'Garden' }))
    await user.click(await screen.findByRole('button', { name: /^Milkweed 1/ }))
    expect(screen.getByText('Next bloom').nextElementSibling).toHaveTextContent(
      'Blooms again in 7 more days of care.',
    )
  })
})
