import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { currentRelease } from './data/currentRelease'
import { createEmptyState, createInitialState } from './lib/progression'
import { reloadApp } from './lib/reload'
import { gardenRepository } from './repository/gardenRepository'
import { FakeBroadcastChannel } from './test/fakeBroadcastChannel'
import type { AppState } from './types'
import { LAZY_PAGE_MS } from './test/lazyPage'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    offlineReady: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

vi.mock('./lib/reload', () => ({ reloadApp: vi.fn() }))

/** A garden last opened on the build before this one. */
function gardenFromBefore(): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return { ...seed, profile: { ...seed.profile!, lastSeenReleaseId: 'release-3-0' } }
}

function storedGarden(garden: AppState | undefined) {
  vi.spyOn(gardenRepository, 'load').mockResolvedValue(
    garden ? { status: 'loaded', state: garden } : { status: 'empty', state: createEmptyState() },
  )
  return vi.spyOn(gardenRepository, 'save').mockResolvedValue([])
}

const WHATS_NEW = { level: 1, name: "What's new in the garden" } as const

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  FakeBroadcastChannel.open.clear()
  window.history.replaceState(null, '', '/')
})

describe("after an update, What's new", { timeout: 20_000 }, () => {
  it('opens by itself once, over the garden, and is remembered as read', async () => {
    // The window is in front, as a browser's is when nothing inside has focus.
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const save = storedGarden(gardenFromBefore())
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('heading', WHATS_NEW, { timeout: LAZY_PAGE_MS })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/whats-new')
    await waitFor(() =>
      expect(save.mock.lastCall?.[0].profile?.lastSeenReleaseId).toBe(currentRelease.id),
    )
    // The garden it opened over is a step back, and has no notice left.
    await user.click(screen.getByRole('button', { name: /go to the garden/i }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' })
    expect(screen.queryByText('Your garden has grown.')).toBeNull()
  })

  it('stays shut for a garden that has read this release', async () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    const seed = createInitialState('Robin', 'Quiet Corner')
    storedGarden(seed)
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(screen.queryByRole('heading', WHATS_NEW)).toBeNull()
    expect(window.location.hash).toBe('')
  })
})

describe('an update applied in another tab', { timeout: 20_000 }, () => {
  it('reloads this tab too, whatever it shows', async () => {
    // A tab still on the welcome, with no garden yet.
    storedGarden(undefined)
    render(<App />)
    await screen.findByRole('heading', { name: /welcome to your butterfly garden/i }, { timeout: LAZY_PAGE_MS })
    new FakeBroadcastChannel('butterfly-garden-update').postMessage({
      type: 'reload-for-update',
      from: __BUILD_ID__,
    })
    await waitFor(() => expect(reloadApp).toHaveBeenCalledOnce())
  })

  it('stops listening once the app is closed', async () => {
    storedGarden(createInitialState('Robin', 'Quiet Corner'))
    const { unmount } = render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    unmount()
    expect(FakeBroadcastChannel.named('butterfly-garden-update')).toHaveLength(0)
  })
})
