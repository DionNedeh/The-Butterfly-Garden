import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LockGate } from './components/LockGate'
import { toLocalDate } from './lib/date'
import { resetDrafts } from './lib/drafts'
import { lockGarden, turnLockOn } from './lib/gardenLockActions'
import { createInitialState } from './lib/progression'
import { newRecoveryCode } from './lib/recoveryCode'
import { createGardenRepository, gardenRepository, isSealed } from './repository/gardenRepository'
import { createLock } from './lib/gardenLock'
import { FakeBroadcastChannel } from './test/fakeBroadcastChannel'
import { openDB } from 'idb'
import type { AppState } from './types'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

vi.mock('./lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

/** How long a page loaded for the first time may take on a busy machine. */
const LAZY_PAGE_MS = 8000
const PASSCODE = 'thrush in the holly'

function journal(): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
    profile: { ...seed.profile!, lastVisitOn: toLocalDate() },
    reflections: [
      {
        id: 'reflection-1',
        localDate: toLocalDate(),
        promptId: 'notice',
        body: 'The kettle and the rain.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  }
}

/** What a reload of a locked garden finds: the lock on, and no key in this tab. */
async function lockedGarden() {
  await gardenRepository.save(journal())
  await turnLockOn(PASSCODE, newRecoveryCode())
  await lockGarden(false)
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(async () => {
  cleanup()
  resetDrafts()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
  await gardenRepository.clear().catch(() => undefined)
})

/** The app, unlocked here, on its garden. */
async function openUnlocked() {
  await lockedGarden()
  const user = userEvent.setup()
  render(
    <LockGate>
      <App />
    </LockGate>,
  )
  await user.type(await screen.findByLabelText('Passcode', {}, { timeout: LAZY_PAGE_MS }), PASSCODE)
  await user.click(screen.getByRole('button', { name: 'Open my garden' }))
  await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
  return user
}

describe('another tab and the lock', { timeout: 30_000 }, () => {
  it('locks this tab too when another tab chooses Lock now', async () => {
    await openUnlocked()
    const otherTab = new FakeBroadcastChannel('butterfly-garden-sync')
    act(() => otherTab.postMessage({ type: 'garden-lock', now: true }))
    expect(
      await screen.findByRole('heading', { name: 'Your garden is resting' }, { timeout: LAZY_PAGE_MS }),
    ).toBeInTheDocument()
    expect(gardenRepository.lockState()).toBe('locked')
    expect(screen.queryByRole('heading', { level: 1, name: 'Quiet Corner' })).toBeNull()
    otherTab.close()
  })

  it('follows another tab turning the lock on, and off again', async () => {
    await gardenRepository.save(journal())
    render(
      <LockGate>
        <App />
      </LockGate>,
    )
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })

    // The other tab: a repository of its own on the same database.
    const other = createGardenRepository()
    await other.load()
    const { record, key } = await createLock(PASSCODE, newRecoveryCode(), 1_000)
    await other.relock({ record, key })
    const channel = new FakeBroadcastChannel('butterfly-garden-sync')
    act(() => channel.postMessage({ type: 'garden-lock' }))
    expect(
      await screen.findByRole('heading', { name: 'Your garden is resting' }, { timeout: LAZY_PAGE_MS }),
    ).toBeInTheDocument()

    await other.relock(undefined)
    act(() => channel.postMessage({ type: 'garden-lock' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS }),
    ).toBeInTheDocument()
    expect(gardenRepository.lockState()).toBe('none')
    channel.close()
  })
})

describe('a locked garden in the app', { timeout: 30_000 }, () => {
  it('opens to the lock screen, never to onboarding or recovery, and to the garden once unlocked', async () => {
    await lockedGarden()
    const user = userEvent.setup()
    render(
      <LockGate>
        <App />
      </LockGate>,
    )
    const field = await screen.findByLabelText('Passcode', {}, { timeout: LAZY_PAGE_MS })
    expect(screen.queryByRole('heading', { name: /could not be opened/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /enter the garden/i })).toBeNull()

    await user.type(field, PASSCODE)
    await user.click(screen.getByRole('button', { name: 'Open my garden' }))
    const title = await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    await waitFor(() => expect(title).toHaveFocus(), { timeout: LAZY_PAGE_MS })
  })

  it('keeps every change sealed while open, and locks from Settings', async () => {
    await lockedGarden()
    const user = userEvent.setup()
    render(
      <LockGate>
        <App />
      </LockGate>,
    )
    await user.type(await screen.findByLabelText('Passcode', {}, { timeout: LAZY_PAGE_MS }), PASSCODE)
    await user.click(screen.getByRole('button', { name: 'Open my garden' }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })

    const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
    await user.click(nav.getByRole('button', { name: 'Settings' }))
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, { timeout: LAZY_PAGE_MS })
    expect(
      screen.getByText('This copy is not locked; keep it somewhere private, or use a protected backup.'),
    ).toBeInTheDocument()

    // A change made while open is written, and written sealed.
    await user.clear(screen.getByLabelText(/^Your name/))
    await user.type(screen.getByLabelText(/^Your name/), 'Wren')
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => {
      const db = await openDB('butterfly-garden')
      try {
        const meta = await db.get('meta', 'current')
        expect(isSealed(meta)).toBe(true)
        expect(JSON.stringify(meta)).not.toContain('Wren')
      } finally {
        db.close()
      }
      expect((await gardenRepository.load()).state.profile?.name).toBe('Wren')
    })

    await user.click(await screen.findByRole('button', { name: 'Lock now' }, { timeout: LAZY_PAGE_MS }))
    expect(await screen.findByRole('heading', { name: 'Your garden is resting' }, { timeout: LAZY_PAGE_MS })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull()
    await act(() => Promise.resolve())
    expect(gardenRepository.lockState()).toBe('locked')
  })
})
