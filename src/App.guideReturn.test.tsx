import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import App from './App'
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

/** On Care, Zed chosen, and the Guide opened from Zed's bond meter. */
async function openGuideFromZed() {
  const user = await openGarden(gardenOfThree())
  await user.click(primaryNav().getByRole('button', { name: 'Care' }))
  await user.click(await screen.findByRole('tab', { name: /Zed/ }, { timeout: LAZY_PAGE_MS }))
  await user.click(screen.getByRole('link', { name: /^What does this do\? Bond levels/ }))
  const heading = await screen.findByRole(
    'heading',
    { level: 2, name: 'Bond levels' },
    { timeout: LAZY_PAGE_MS },
  )
  await waitFor(() => expect(heading).toHaveFocus())
  expect(window.location.hash).toBe('#/guide/bond')
  return user
}

/** Care as it should be on the way back: Zed shown, focus on the link pressed. */
async function expectBackWithZed() {
  await screen.findByRole('heading', { level: 1, name: 'Care & nurture' }, { timeout: LAZY_PAGE_MS })
  expect(window.location.hash).toBe('#/care')
  expect(screen.getByRole('tab', { name: /Zed/ })).toHaveAttribute('aria-selected', 'true')
  await waitFor(() =>
    expect(screen.getByRole('link', { name: /^What does this do\? Bond levels/ })).toHaveFocus(),
  )
}

/** Where the app asks the window to scroll to, jsdom having no scrolling. */
let scrollTo: MockInstance<typeof window.scrollTo>

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('back from the Guide a "What does this do?" link opened', { timeout: 20_000 }, () => {
  it('returns Care to the companion whose link it was, with focus on that link', async () => {
    const user = await openGuideFromZed()
    await user.click(screen.getByRole('button', { name: 'Back to Care' }))
    await expectBackWithZed()
  })

  it('does the same for Android’s back gesture', async () => {
    await openGuideFromZed()
    act(() => back.press?.())
    await expectBackWithZed()
  })

  it('scrolls Settings back to where it was, rather than to the top', async () => {
    const user = await openGarden(gardenOfThree())
    await user.click(primaryNav().getByRole('button', { name: 'Settings' }))
    const link = await screen.findByRole(
      'link',
      { name: /^What does this do\? Seeds/ },
      { timeout: LAZY_PAGE_MS },
    )
    // Far down the page, where Garden pace is.
    const scrolled = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1500)
    await user.click(link)
    await screen.findByRole('heading', { level: 1, name: 'How the garden works' }, { timeout: LAZY_PAGE_MS })
    // The Guide opens at its top.
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
    scrolled.mockReturnValue(0)
    await user.click(screen.getByRole('button', { name: 'Back to Settings' }))
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, { timeout: LAZY_PAGE_MS })
    expect(window.location.hash).toBe('#/settings')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /^What does this do\? Seeds/ })).toHaveFocus(),
    )
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1500, behavior: 'instant' })
  })

  it('opens a page at its top as ever when it is not a way back', async () => {
    const user = await openGuideFromZed()
    scrollTo.mockClear()
    // Leaving the Guide by the navigation is not going back.
    await user.click(primaryNav().getByRole('button', { name: 'Care' }))
    await screen.findByRole('heading', { level: 1, name: 'Care & nurture' }, { timeout: LAZY_PAGE_MS })
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior: 'instant' })
    expect(screen.getByRole('tab', { name: /Elm/ })).toHaveAttribute('aria-selected', 'true')
  })
})
