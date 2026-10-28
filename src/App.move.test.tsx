import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { openDB } from 'idb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { LockGate } from './components/LockGate'
import { toLocalDate } from './lib/date'
import { saveTextFile } from './lib/download'
import { resetDrafts } from './lib/drafts'
import { lockGarden, turnLockOn } from './lib/gardenLockActions'
import { createInitialState } from './lib/progression'
import { newRecoveryCode } from './lib/recoveryCode'
import { DATABASE_NAME, gardenRepository, isSealed } from './repository/gardenRepository'
import { FakeBroadcastChannel } from './test/fakeBroadcastChannel'
import { LAZY_PAGE_MS } from './test/lazyPage'
import type { AppState } from './types'

/** Text entered all at once, as a paste: twelve words key by key are slow on a busy machine. */
async function enter(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.click(field)
  await user.paste(text)
}

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

// Every derivation at a quick count: the file records the full one, and
// opening it asks for the same quick one here, so the two still meet.
vi.mock('./lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})
vi.mock('./lib/download', async (original) => ({
  ...(await original<typeof import('./lib/download')>()),
  saveTextFile: vi.fn(() => Promise.resolve('started')),
}))

const PASSCODE = 'thrush in the holly'
const REFLECTION = 'The kettle and the rain.'

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
        body: REFLECTION,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  }
}

/** Everything this device has stored, as text: every store's every record, and local storage. */
async function everythingStored(): Promise<string> {
  const db = await openDB(DATABASE_NAME)
  try {
    const stores: Record<string, unknown[]> = {}
    for (const name of db.objectStoreNames) stores[name] = await db.getAll(name)
    return JSON.stringify({ stores, local: { ...window.localStorage }, session: { ...window.sessionStorage } })
  } finally {
    db.close()
  }
}

/** Settings, Move my garden, the file downloaded: its text and the code shown. */
async function makeMoveFile(user: ReturnType<typeof userEvent.setup>) {
  const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }))
  await user.click(nav.getByRole('button', { name: 'Settings' }))
  await screen.findByRole('heading', { level: 1, name: 'Settings' }, { timeout: LAZY_PAGE_MS })
  await user.click(screen.getByRole('button', { name: 'Move my garden to another device…' }))
  await user.click(await screen.findByRole('button', { name: 'Make the move file' }, { timeout: LAZY_PAGE_MS }))
  await user.click(await screen.findByRole('button', { name: 'Download the move file' }, { timeout: LAZY_PAGE_MS }))
  await screen.findByRole('heading', { name: 'Your one-time code' })
  const words = within(screen.getByRole('list', { name: 'The one-time code, 12 words' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
  const text = vi.mocked(saveTextFile).mock.calls.at(-1)![2]
  return { text, words }
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
})

afterEach(async () => {
  cleanup()
  resetDrafts()
  vi.mocked(saveTextFile).mockClear()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
  await gardenRepository.clear().catch(() => undefined)
})

describe('moving a garden to another device', { timeout: 60_000 }, () => {
  it('makes a move file that stores nothing here, and brings the garden into a fresh one with its words', async () => {
    await gardenRepository.save(journal())
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    const before = await everythingStored()

    const { text, words } = await makeMoveFile(user)
    expect(text).not.toContain(REFLECTION)
    expect(text).not.toContain('Quiet Corner')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Nothing of the code, and nothing new at all, was kept on this device.
    const after = await everythingStored()
    expect(after).not.toContain(words.join(' '))
    expect(after).toBe(before)

    // Another device: nothing stored at all, opened at the garden's address.
    cleanup()
    await gardenRepository.clear()
    window.history.replaceState(null, '', '/')
    render(<App />)
    await user.click(
      await screen.findByRole('button', { name: 'Arrive from another device' }, { timeout: LAZY_PAGE_MS }),
    )
    await user.upload(
      await screen.findByLabelText('Choose the move file', {}, { timeout: LAZY_PAGE_MS }),
      new File([text], 'butterfly-garden-move.json', { type: 'application/json' }),
    )
    await enter(user, await screen.findByLabelText('The 12 words'), words.join('  ').toUpperCase())
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    const arrived = await gardenRepository.load()
    expect(arrived.state.reflections.map((entry) => entry.body)).toEqual([REFLECTION])
  })

  it('is allowed with the lock on, writes nothing in the clear, and says the lock stays behind', async () => {
    await gardenRepository.save(journal())
    await turnLockOn(PASSCODE, newRecoveryCode())
    await lockGarden(false)
    const user = userEvent.setup()
    render(
      <LockGate>
        <App />
      </LockGate>,
    )
    await enter(user, await screen.findByLabelText('Passcode', {}, { timeout: LAZY_PAGE_MS }), PASSCODE)
    await user.click(screen.getByRole('button', { name: 'Open my garden' }))
    await screen.findByRole('heading', { level: 1, name: 'Quiet Corner' }, { timeout: LAZY_PAGE_MS })
    const before = await everythingStored()

    const { text, words } = await makeMoveFile(user)
    expect(
      screen.getAllByText(
        'Your garden lock stays on this device. The garden on your new device will not be locked until you turn the lock on there, in Settings.',
      ).length,
    ).toBeGreaterThan(0)
    expect(text).not.toContain(REFLECTION)
    await user.click(screen.getByRole('button', { name: 'Done' }))

    const after = await everythingStored()
    expect(after).toBe(before)
    expect(after).not.toContain(REFLECTION)
    expect(after).not.toContain(words.join(' '))
    const db = await openDB(DATABASE_NAME)
    try {
      expect(isSealed(await db.get('meta', 'current'))).toBe(true)
    } finally {
      db.close()
    }
  })
})
