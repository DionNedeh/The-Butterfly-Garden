import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeBroadcastChannel } from '../test/fakeBroadcastChannel'
import { LAZY_PAGE_MS } from '../test/lazyPage'
import { getDraft, loadDrafts, resetDrafts, setDraft } from '../lib/drafts'
import {
  autoLockMinutes,
  chooseAutoLock,
  lockGarden,
  turnLockOn,
  turnLockOff,
  unlockGarden,
} from '../lib/gardenLockActions'
import { withAutoLock, type AutoLockMinutes } from '../lib/gardenLock'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import { createGardenRepository, gardenRepository } from '../repository/gardenRepository'
import { GoalEditor } from './GoalEditor'
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

/** Another tab choosing when the garden locks itself, and saying so on the tabs' channel. */
async function chosenInAnotherTab(minutes: AutoLockMinutes | undefined) {
  const other = createGardenRepository()
  const record = (await other.readLock())!
  await other.writeLock(withAutoLock(record, minutes), record)
  const channel = new FakeBroadcastChannel('butterfly-garden-sync')
  channel.postMessage({ type: 'garden-auto-lock' })
  channel.close()
}

describe('a time chosen in another tab', { timeout: 30_000 }, () => {
  // Timers and the clock are the test's; storage still answers (fake-indexeddb
  // runs on setImmediate), and vi.waitFor moves the clock as it waits.
  const fakeClock = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })

  it('is taken at once, locking a garden already out of sight for longer', async () => {
    await lockedAndOpen()
    fakeClock()
    render(<LockWatch />)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(3 * 60_000))
    expect(gardenRepository.lockState()).toBe('unlocked')
    await act(() => chosenInAnotherTab(1))
    await vi.waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('is taken at once, counting from when the garden went out of sight', async () => {
    await lockedAndOpen()
    fakeClock()
    render(<LockWatch />)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(3 * 60_000))
    await act(() => chosenInAnotherTab(5))
    await vi.waitFor(() => expect(autoLockMinutes()).toBe(5))
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(gardenRepository.lockState()).toBe('unlocked')
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    await vi.waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('is taken at once when it is never: a clock already running stops', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    fakeClock()
    render(<LockWatch />)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    await act(() => chosenInAnotherTab(undefined))
    await vi.waitFor(() => expect(autoLockMinutes()).toBeUndefined())
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000))
    setVisibility('visible')
    expect(gardenRepository.lockState()).toBe('unlocked')
  })
})

describe('waiting on what the gardener is in the middle of', { timeout: 30_000 }, () => {
  /** A photo field, as the sighting form has, with the watch beside it. */
  function photoField() {
    render(
      <>
        <label>
          Add a photo
          <input type="file" accept="image/webp" />
        </label>
        <LockWatch />
      </>,
    )
    return screen.getByLabelText('Add a photo')
  }

  it('does not start the clock while a photo is chosen, as Android’s picker sends the app to the background', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const photo = photoField()
    fireEvent.click(photo)
    act(() => app.active?.(false))
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000))
    act(() => app.active?.(true))
    fireEvent.change(photo)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(gardenRepository.lockState()).toBe('unlocked')

    // Once it is chosen, the next time out of sight counts as ever.
    act(() => app.active?.(false))
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('does not lock on the way back from the camera, whichever comes first, the photo or the app', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const photo = photoField()
    fireEvent.click(photo)
    act(() => app.active?.(false))
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000))
    // The photo arrives a moment before the app is back in front.
    fireEvent.change(photo)
    await act(() => vi.advanceTimersByTimeAsync(1_000))
    act(() => app.active?.(true))
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000))
    expect(gardenRepository.lockState()).toBe('unlocked')
  })

  it('starts the clock once a chooser is put away while the garden is still out of sight', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const photo = photoField()
    fireEvent.click(photo)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
    expect(gardenRepository.lockState()).toBe('unlocked')
    fireEvent(photo, new Event('cancel', { bubbles: true }))
    await act(() => vi.advanceTimersByTimeAsync(59_000))
    expect(gardenRepository.lockState()).toBe('unlocked')
    await act(() => vi.advanceTimersByTimeAsync(1_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('takes focus coming back as the chooser put away, where a browser says nothing else', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    fireEvent.click(photoField())
    fireEvent.focus(window)
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('pays no heed to a click on anything but a file field', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    render(
      <>
        <button type="button">Somewhere else</button>
        <LockWatch />
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Somewhere else' }))
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('waits while a goal is open to edit, its words not being a draft, and locks once it is put away', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const editor = (
      <GoalEditor
        goal={{
          id: 'water',
          title: 'Drink some water',
          schedule: 'daily',
          weekdays: [],
          createdDate: '2026-09-01',
          archived: false,
        }}
        today="2026-09-05"
        completedBefore={false}
        completedToday={false}
        onSave={() => undefined}
        onArchive={() => undefined}
        onDelete={() => undefined}
        onCancel={() => undefined}
      />
    )
    const page = (open: boolean) => (
      <>
        {open && editor}
        <LockWatch />
      </>
    )
    const { rerender } = render(page(true))
    fireEvent.change(screen.getByRole('textbox', { name: /^Edit goal/ }), {
      target: { value: 'Drink a glass of water by the window' },
    })
    act(() => app.active?.(false))
    await act(() => vi.advanceTimersByTimeAsync(30 * 60_000))
    act(() => app.active?.(true))
    expect(gardenRepository.lockState()).toBe('unlocked')
    expect(screen.getByRole('textbox', { name: /^Edit goal/ })).toHaveValue(
      'Drink a glass of water by the window',
    )

    rerender(page(false))
    act(() => app.active?.(false))
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })

  it('looks again while out of sight, starting the clock once what it waited on has gone', async () => {
    await lockedAndOpen()
    await chooseAutoLock(1)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const page = (open: boolean) => (
      <>
        {open && <form data-auto-lock-waits="" aria-label="An image being framed" />}
        <LockWatch />
      </>
    )
    const { rerender } = render(page(true))
    setVisibility('hidden')
    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
    // Its save finished, and it closed, after the garden went out of sight.
    rerender(page(false))
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(gardenRepository.lockState()).toBe('unlocked')
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    vi.useRealTimers()
    await waitFor(() => expect(gardenRepository.lockState()).toBe('locked'))
  })
})
