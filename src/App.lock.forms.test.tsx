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
import { gardenRepository } from './repository/gardenRepository'
import { FakeBroadcastChannel } from './test/fakeBroadcastChannel'
import { LAZY_PAGE_MS } from './test/lazyPage'
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

const LAZY = { timeout: LAZY_PAGE_MS }
const PASSCODE = 'thrush in the holly'

function garden(): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
    profile: { ...seed.profile!, lastVisitOn: toLocalDate() },
    goals: [
      { id: 'water', title: 'Drink some water', schedule: 'daily', weekdays: [], createdDate: toLocalDate(), archived: false },
    ],
  }
}

beforeEach(() => {
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

/** The app, unlocked here, on the page `hash` names. */
async function openUnlocked(hash: string, heading: string) {
  await gardenRepository.save(garden())
  await turnLockOn(PASSCODE, newRecoveryCode())
  await lockGarden(false)
  window.history.replaceState(null, '', `/${hash}`)
  const user = userEvent.setup()
  render(
    <LockGate>
      <App />
    </LockGate>,
  )
  await openWithPasscode(user)
  await screen.findByRole('heading', { level: 1, name: heading }, LAZY)
  return user
}

async function openWithPasscode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Passcode', { exact: true }, LAZY), PASSCODE)
  await user.click(screen.getByRole('button', { name: 'Open my garden' }))
}

/** "Lock now" chosen in another tab. */
async function lockNowElsewhere() {
  const otherTab = new FakeBroadcastChannel('butterfly-garden-sync')
  act(() => otherTab.postMessage({ type: 'garden-lock', now: true }))
  otherTab.close()
  return screen.findByRole('heading', { name: 'Your garden is resting' }, LAZY)
}

describe('3.2 Lock now in another tab, part-way through a form', { timeout: 40_000 }, () => {
  it('keeps a new goal being typed on Today, and puts it back in its form', async () => {
    const user = await openUnlocked('#/today', 'Today')
    await user.type(screen.getByRole('combobox', { name: 'Add a goal' }), 'Water the fern')
    await user.type(screen.getByRole('textbox', { name: 'A two-minute version (optional)' }), 'One glass')
    await lockNowElsewhere()
    expect(screen.queryByText(/not saved when the garden locked/)).toBeNull()
    await openWithPasscode(user)
    expect(await screen.findByRole('combobox', { name: 'Add a goal' }, LAZY)).toHaveValue('Water the fern')
    expect(screen.getByRole('textbox', { name: 'A two-minute version (optional)' })).toHaveValue('One glass')
  })

  it('keeps a goal being edited, open, with what was typed in it', async () => {
    const user = await openUnlocked('#/today', 'Today')
    await user.click(screen.getByRole('button', { name: 'More for Drink some water' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByRole('textbox', { name: /^Edit goal/ }), ' by the window')
    await lockNowElsewhere()
    await openWithPasscode(user)
    expect(await screen.findByRole('textbox', { name: /^Edit goal/ }, LAZY)).toHaveValue(
      'Drink some water by the window',
    )
  })

  it('says a sighting being written was not kept', async () => {
    const user = await openUnlocked('#/guide', 'How the garden works')
    const card = screen.getByRole('heading', { level: 3, name: 'Monarch' }).closest('article')!
    await user.click(within(card).getByRole('button', { name: 'Log a Monarch sighting' }))
    const dialog = await screen.findByRole('dialog', { name: 'Log a sighting' }, LAZY)
    await user.type(within(dialog).getByLabelText('A few words, if you like'), 'Over the allotments')
    await lockNowElsewhere()
    expect(
      screen.getByText('The sighting you were writing was not saved when the garden locked.'),
    ).toBeInTheDocument()
  })
})

describe('3.2 a goal editor put back after an unlock', { timeout: 40_000 }, () => {
  it('leaves focus on the page’s heading, where the unlock puts it, not in the editor', async () => {
    const user = await openUnlocked('#/today', 'Today')
    await user.click(screen.getByRole('button', { name: 'More for Drink some water' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.type(screen.getByRole('textbox', { name: /^Edit goal/ }), ' by the window')
    await lockNowElsewhere()
    await openWithPasscode(user)
    const editor = await screen.findByRole('textbox', { name: /^Edit goal/ }, LAZY)
    expect(editor).toHaveValue('Drink some water by the window')
    const heading = screen.getByRole('heading', { level: 1, name: 'Today' })
    await waitFor(() => expect(heading).toHaveFocus())
    // Settled: nothing takes it after the page is drawn.
    await act(() => new Promise((done) => setTimeout(done, 200)))
    expect(heading).toHaveFocus()
    expect(editor).not.toHaveFocus()
  })
})
