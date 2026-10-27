import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeBroadcastChannel } from '../test/fakeBroadcastChannel'
import { LAZY_PAGE_MS } from '../test/lazyPage'
import { getDraft, loadDrafts, resetDrafts, setDraft } from '../lib/drafts'
import {
  chooseAutoLock,
  lockGarden,
  turnLockOn,
  turnLockOff,
  unlockGarden,
} from '../lib/gardenLockActions'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import { gardenRepository } from '../repository/gardenRepository'
import { LockGate } from './LockGate'
import { LockWatch } from './lock/LockWatch'

vi.mock('../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

/** The Android app's foreground and background, as LockWatch follows them. */
const app = vi.hoisted(() => ({ active: undefined as ((active: boolean) => void) | undefined }))
vi.mock('../lib/native', async (original) => ({
  ...(await original<typeof import('../lib/native')>()),
  onAppActiveChange: (handler: (active: boolean) => void) => {
    app.active = handler
    return () => {
      app.active = undefined
    }
  },
}))

const PASSCODE = 'swallows in the eaves'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function lockedAndOpen() {
  await gardenRepository.save(createInitialState('Robin', 'Quiet Corner'))
  await turnLockOn(PASSCODE, newRecoveryCode())
  expect(gardenRepository.lockState()).toBe('unlocked')
}

beforeEach(() => {
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(async () => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setVisibility('visible')
  resetDrafts()
  await gardenRepository.clear().catch(() => undefined)
})

describe('the lock gate', { timeout: 30_000 }, () => {
  it('passes the app through when the garden has no lock', () => {
    render(
      <LockGate>
        <p>The garden</p>
      </LockGate>,
    )
    expect(screen.getByText('The garden')).toBeInTheDocument()
  })

  it('takes the app down for the lock screen when the garden locks, and brings it back once opened', async () => {
    await lockedAndOpen()
    render(
      <LockGate>
        <main id="main-content">
          <h1>The garden</h1>
        </main>
      </LockGate>,
    )
    expect(screen.getByText('The garden')).toBeInTheDocument()
    await act(() => lockGarden(false))
    expect(
      await screen.findByRole('heading', { name: 'Your garden is resting' }, { timeout: LAZY_PAGE_MS }),
    ).toBeInTheDocument()
    expect(screen.queryByText('The garden')).toBeNull()

    await act(() => unlockGarden({ slot: 'passcode', passcode: PASSCODE }))
    const heading = screen.getByRole('heading', { name: 'The garden' })
    // Focus lands on the page, not on nothing, once the lock screen is gone.
    await waitFor(() => expect(heading).toHaveFocus(), { timeout: LAZY_PAGE_MS })
  })
})

describe('locking by itself', { timeout: 30_000 }, () => {
  it('locks after the minutes chosen out of sight, keeping unsaved words sealed', async () => {
    await lockedAndOpen()
    await chooseAutoLock(5)
    setDraft('reflection:2026-10-27', 'Half a thought')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(<LockWatch />)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(4 * 60_000))
    expect(gardenRepository.lockState()).toBe('unlocked')
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
    // Let go of in memory, and kept on disk, sealed, for the next unlock.
    expect(getDraft('reflection:2026-10-27')).toBeUndefined()
    await unlockGarden({ slot: 'passcode', passcode: PASSCODE })
    await loadDrafts()
    expect(getDraft('reflection:2026-10-27')).toBe('Half a thought')
  })

  it('does not lock when the garden is back in sight in time', async () => {
    await lockedAndOpen()
    await chooseAutoLock(5)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(<LockWatch />)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000))
    setVisibility('visible')
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000))
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('locks the moment it is seen, if the browser held its timer back while hidden', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(<LockWatch />)
    setVisibility('hidden')
    // Time passes, but no timer runs, as in a frozen background tab.
    vi.setSystemTime(Date.now() + 3 * 60_000)
    setVisibility('visible')
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('follows the Android app going to the background', async () => {
    await lockedAndOpen()
    await chooseAutoLock(15)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(<LockWatch />)
    act(() => app.active?.(false))
    await act(() => vi.advanceTimersByTimeAsync(15 * 60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('never locks by itself unless chosen', async () => {
    await lockedAndOpen()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(<LockWatch />)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(24 * 60 * 60_000))
    setVisibility('visible')
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('stops watching once the lock is off', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    await turnLockOff(PASSCODE)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(<LockWatch />)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
    expect(gardenRepository.lockState()).toBe('none')
  })
})
