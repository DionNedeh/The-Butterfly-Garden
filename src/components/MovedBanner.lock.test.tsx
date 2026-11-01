import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sealedKind } from '../lib/backupFile'
import { turnLockOn } from '../lib/gardenLockActions'
import { movedTo } from '../lib/hosting'
import { openLockedCopy, readLockedCopy } from '../lib/lockedCopy'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import { storedCopy } from '../lib/storedCopy'
import { COLLECTION_STORES, gardenRepository } from '../repository/gardenRepository'
import type { AppState } from '../types'

/*
 * The old address's final build carries each garden over as a file. A garden
 * with the lock on is sealed where it is stored, and its carry-over must stay
 * sealed: a plain backup would put the whole journal in the clear in the
 * downloads folder of a gardener who chose the lock to keep it out of reach.
 * So with the lock on, the banner saves the garden sealed with the lock, in
 * the form safe mode's copy takes, which opens at the new address with the
 * passcode or the recovery code, and says that passkeys are added again there.
 */

const saveTextFile = vi.fn()
vi.mock('../lib/download', () => ({
  saveTextFile: (...args: unknown[]) => saveTextFile(...args) as unknown,
  datedFileName: (what: string) => `${what}.json`,
}))

// The real lock, quick: the count is the tests' only change.
vi.mock('../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})

const { MovedBanner } = await import('./MovedBanner')

const PASSCODE = 'kingfisher at dawn'
const PHRASE = 'I told nobody about the letter from my sister'

function journal(): AppState {
  const seed = createInitialState('Robin', 'Quiet Corner')
  return {
    ...seed,
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-20',
        level: 2,
        note: PHRASE,
        createdAt: '2026-10-20T09:00:00.000Z',
        updatedAt: '2026-10-20T09:00:00.000Z',
      },
    ],
  }
}

/** The old address's final build: dormant unless VITE_MOVED_TO is set. */
function newAddress(): URL {
  vi.stubEnv('VITE_MOVED_TO', 'https://garden.example.org/')
  const target = movedTo()
  if (!target) throw new Error('VITE_MOVED_TO did not wake the move')
  return target
}

/** The text handed to the save screen. */
function savedText(): string {
  expect(saveTextFile).toHaveBeenCalledTimes(1)
  const [, , text] = saveTextFile.mock.calls[0] as [string, string, string]
  return text
}

/** The stores a copy holds, by name. */
function storesOf(text: string): string[] {
  return Object.keys((JSON.parse(text) as { stores: Record<string, unknown> }).stores).sort()
}

/** The stores the new address opens a locked copy from (lib/lockedCopy). */
const GARDEN_STORES: string[] = ['lock', 'meta', ...Object.values(COLLECTION_STORES)]

/** A garden with the lock on; its recovery code. */
async function lockedJournal(): Promise<string[]> {
  const words = newRecoveryCode()
  await gardenRepository.save(journal())
  await turnLockOn(PASSCODE, words)
  return words
}

/** What the new address does with the file (onboarding's "I have a backup"). */
async function opensWithEither(text: string, words: string[]) {
  const read = readLockedCopy(text)
  if (!read.ok) throw new Error(read.problem)
  for (const secret of [
    { slot: 'passcode', passcode: PASSCODE },
    { slot: 'recovery', words },
  ] as const) {
    const opened = await openLockedCopy(read.copy, secret)
    if (!opened.ok) throw new Error(opened.problem)
    expect(opened.text).toContain(PHRASE)
  }
}

afterEach(async () => {
  saveTextFile.mockReset()
  vi.unstubAllEnvs()
  await gardenRepository.clear().catch(() => undefined)
})

describe('5.1 carrying a garden with the lock on to its new address', () => {
  it('saves the copy sealed with the lock, never a plain backup, and it opens with the passcode or the recovery code', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('started')
    const words = await lockedJournal()
    const exportGarden = vi.fn(() => ({ text: JSON.stringify({ format: 'the-butterfly-garden', note: PHRASE }) }))
    render(<MovedBanner target={newAddress()} onExportGarden={exportGarden} />)

    // Said before anything is saved, so the gardener knows what to bring.
    expect(await screen.findByText(/opens there with your passcode or recovery code/)).toBeInTheDocument()
    expect(screen.getByText(/add your passkey again/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(await screen.findByRole('link', { name: 'Open garden.example.org' })).toBeInTheDocument()

    expect(exportGarden).not.toHaveBeenCalled()
    const text = savedText()
    expect(text).not.toContain(PHRASE)
    expect(text).not.toContain('Quiet Corner')
    expect(sealedKind(text)).toBe('copy')
    // Safe mode's copy, in its form, of the garden's own stores as stored,
    // but for when it was made.
    const made = (copy: string) => {
      const { stores, ...rest } = JSON.parse(copy) as { stores: Record<string, unknown> }
      const garden = Object.entries(stores).filter(([name]) => GARDEN_STORES.includes(name))
      return { ...rest, exportedAt: undefined, stores: Object.fromEntries(garden) }
    }
    expect(JSON.parse(text)).toMatchObject({ stores: { lock: {}, meta: {} } })
    expect(made(text)).toEqual(made((await storedCopy()).text))

    await opensWithEither(text, words)
  })

  it('carries the garden alone, not the earlier copies or drafts safe mode keeps beside it', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('started')
    const words = await lockedJournal()
    // A restore's copy of the garden it replaced, and words half written.
    await gardenRepository.replace({ ...journal(), seeds: 9 }, { snapshot: true })
    await gardenRepository.writeDrafts({ 'reflection:2026-10-21': `Half written: ${PHRASE}` })
    const everything = (await storedCopy()).text
    expect(storesOf(everything)).toEqual(expect.arrayContaining(['drafts', 'snapshots']))
    render(<MovedBanner target={newAddress()} onExportGarden={() => undefined} />)
    await screen.findByText(/opens there with your passcode or recovery code/)

    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(await screen.findByRole('link', { name: 'Open garden.example.org' })).toBeInTheDocument()

    const text = savedText()
    // Only what the new address opens. Restore and daily copies, drafts and
    // a set-aside copy are never restored from it, and could make the file
    // larger than a restore takes (lib/backupFile's MAX_BACKUP_BYTES).
    expect(storesOf(text).filter((name) => !GARDEN_STORES.includes(name))).toEqual([])
    expect(storesOf(text)).toEqual(expect.arrayContaining(['lock', 'meta', 'moods']))
    expect(text.length).toBeLessThan(everything.length)
    await opensWithEither(text, words)
  })

  it('saves nothing while the latest change is not stored, as the sealed file is made from what is stored', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('started')
    await lockedJournal()
    const exportGarden = vi.fn(() => ({ text: '{}' }))
    render(
      <MovedBanner
        target={newAddress()}
        onExportGarden={exportGarden}
        persistence={{ readOnly: false, writeError: 'The device is full.' }}
      />,
    )
    await screen.findByText(/opens there with your passcode or recovery code/)

    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(
      await screen.findByText(/Your latest change is not stored on this device yet, so the sealed file would leave it out/),
    ).toBeInTheDocument()
    // The way that still works: a protected backup, made from this tab.
    expect(screen.getByText(/save a protected backup in Settings/)).toBeInTheDocument()
    expect(saveTextFile).not.toHaveBeenCalled()
    expect(exportGarden).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: 'Open garden.example.org' })).toBeNull()
  })

  it('saves nothing while saving is paused, as the plain backup is refused then too', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('started')
    await lockedJournal()
    render(
      <MovedBanner
        target={newAddress()}
        onExportGarden={() => ({ text: '{}' })}
        persistence={{ readOnly: true }}
      />,
    )
    await screen.findByText(/opens there with your passcode or recovery code/)

    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(await screen.findByText(/This garden cannot be saved just now/)).toBeInTheDocument()
    expect(saveTextFile).not.toHaveBeenCalled()
  })

  it('saves a garden with no lock as the plain backup, and says nothing of a passcode', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('started')
    await gardenRepository.save(journal())
    await gardenRepository.load()
    const plain = JSON.stringify({ format: 'the-butterfly-garden', note: PHRASE })
    const exportGarden = vi.fn(() => ({ text: plain }))
    render(<MovedBanner target={newAddress()} onExportGarden={exportGarden} />)

    expect(screen.queryByText(/passcode/)).toBeNull()
    expect(screen.queryByText(/passkey/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(await screen.findByRole('link', { name: 'Open garden.example.org' })).toBeInTheDocument()
    expect(exportGarden).toHaveBeenCalledTimes(1)
    expect(savedText()).toBe(plain)
  })

  it('saves a garden with no lock from this tab after a change could not be stored, as the tab still holds it', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('started')
    await gardenRepository.save(journal())
    await gardenRepository.load()
    const plain = JSON.stringify({ format: 'the-butterfly-garden', note: PHRASE })
    render(
      <MovedBanner
        target={newAddress()}
        onExportGarden={() => ({ text: plain })}
        persistence={{ readOnly: false, writeError: 'The device is full.' }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(await screen.findByRole('link', { name: 'Open garden.example.org' })).toBeInTheDocument()
    expect(savedText()).toBe(plain)
  })
})
