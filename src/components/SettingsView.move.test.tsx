import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { sealedKind } from '../lib/backupFile'
import { saveTextFile } from '../lib/download'
import { newMoveCode } from '../lib/moveCode'
import { createInitialState } from '../lib/progression'
import { sealBackup } from '../lib/sealedBackup'
import type { LockState } from '../repository/gardenRepository'
import { SettingsView } from './SettingsView'

/** Text entered all at once, as a paste: twelve words key by key are slow on a busy machine. */
async function enter(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.click(field)
  await user.paste(text)
}

// The real lock, quick: the count is the tests' only change.
vi.mock('../lib/sealedBackup', async (original) => {
  const actual = await original<typeof import('../lib/sealedBackup')>()
  return {
    ...actual,
    sealBackup: vi.fn((text: string, secret: string, options: Parameters<typeof actual.sealBackup>[2]) =>
      actual.sealBackup(text, secret, { ...options, iterations: 1_000 }),
    ),
  }
})
vi.mock('../lib/download', async (original) => ({
  ...(await original<typeof import('../lib/download')>()),
  saveTextFile: vi.fn(),
}))
const lock = vi.hoisted((): { state: LockState } => ({ state: 'none' }))
vi.mock('../hooks/useLockState', () => ({ useLockState: () => lock.state }))

const save = vi.mocked(saveTextFile)

/** A real backup's text, of a garden with one check-in. */
const PLAIN = JSON.stringify({
  format: 'the-butterfly-garden',
  exportedAt: '2026-10-27T09:00:00.000Z',
  appVersion: '3.3.0',
  garden: {
    ...createInitialState('Tester', 'Wild Garden'),
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-10-21',
        level: 4,
        note: 'Kept safe',
        createdAt: '2026-10-21T08:00:00.000Z',
        updatedAt: '2026-10-21T08:00:00.000Z',
      },
    ],
  },
})

async function moveFile(): Promise<{ file: File; words: string[] }> {
  const words = await newMoveCode()
  const outcome = await sealBackup(PLAIN, words.join(' '), { opensWith: 'move-code' })
  if (!outcome.ok) throw new Error('Not sealed')
  return { file: new File([outcome.text], 'butterfly-garden-move-2026-10-27.json'), words }
}

function renderSettings(persistence: PersistenceStatus = { readOnly: false }) {
  const handlers = {
    onUpdateProfile: vi.fn(),
    onSelectAmbientTrack: vi.fn(),
    onSelectBackdrop: vi.fn(),
    onExportGarden: vi.fn(() => ({ text: PLAIN })),
    onBackupMade: vi.fn(),
    onImportGarden: vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' })),
    onDeleteAll: vi.fn(() => Promise.resolve({ ok: true })),
  }
  render(
    <SettingsView state={createInitialState('Tester', 'Test Garden')} persistence={persistence} {...handlers} />,
  )
  return { ...handlers, user: userEvent.setup() }
}

afterEach(() => {
  save.mockReset()
  vi.mocked(sealBackup).mockClear()
  lock.state = 'none'
})

// A busy machine (a CI runner, other suites at once) is given time for whole flows.
describe('moving the garden from Settings', { timeout: 20_000 }, () => {
  it('is offered in the backup card, with a line on what it does', () => {
    renderSettings()
    const backup = within(screen.getByRole('region', { name: 'Backup and restore' }))
    expect(backup.getByRole('button', { name: 'Move my garden to another device…' })).toBeEnabled()
    expect(
      backup.getByText(
        'Moving to a new phone or computer? Move my garden makes a locked file and shows a one-time code to open it there.',
      ),
    ).toBeInTheDocument()
  })

  it('cannot be made while the stored garden cannot be read', () => {
    renderSettings({ readOnly: true, reason: 'malformed' })
    expect(screen.getByRole('button', { name: 'Move my garden to another device…' })).toBeDisabled()
  })

  it('makes the file and shows the code, counts no backup, and returns focus where it began', async () => {
    save.mockResolvedValueOnce('started')
    const { onBackupMade, onExportGarden, user } = renderSettings()
    const open = screen.getByRole('button', { name: 'Move my garden to another device…' })
    await user.click(open)
    await screen.findByRole('dialog', { name: 'Move my garden to another device' })
    expect(screen.queryByText(/Your garden lock stays on this device/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Make the move file' }))
    await user.click(await screen.findByRole('button', { name: 'Download the move file' }))
    await screen.findByRole('heading', { name: 'Your one-time code' })
    expect(onExportGarden).toHaveBeenCalledOnce()
    expect(sealedKind(save.mock.calls[0][2])).toBe('backup')
    expect(within(screen.getByRole('list', { name: 'The one-time code, 12 words' })).getAllByRole('listitem')).toHaveLength(12)

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    // Once its code is gone the file opens for nobody: it is not a backup.
    expect(onBackupMade).not.toHaveBeenCalled()
    await waitFor(() => expect(open).toHaveFocus())
  })

  it('is allowed with the lock on, and says the new garden will not be locked', async () => {
    lock.state = 'unlocked'
    const { user } = renderSettings()
    await user.click(screen.getByRole('button', { name: 'Move my garden to another device…' }))
    expect(
      await screen.findByText(
        'Your garden lock stays on this device. The garden on your new device will not be locked until you turn the lock on there, in Settings.',
      ),
    ).toBeInTheDocument()
  })
})

describe('arriving from another device in Settings', { timeout: 20_000 }, () => {
  it('is offered with the restore, and shows the usual preview before anything is replaced', async () => {
    const { file, words } = await moveFile()
    const { onImportGarden, user } = renderSettings()
    expect(screen.queryByRole('button', { name: 'Arrive from another device…' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Restore from a backup' }))
    const arrive = screen.getByRole('button', { name: 'Arrive from another device…' })
    await user.click(arrive)
    await user.upload(await screen.findByLabelText('Choose the move file'), file)
    await enter(user, await screen.findByLabelText('The 12 words'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))

    const preview = await screen.findByRole('heading', { name: 'This backup holds Wild Garden' })
    await waitFor(() => expect(preview).toHaveFocus())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('A move file, opened with its one-time code')).toBeInTheDocument()
    expect(screen.getByText(/1 check-in/)).toBeInTheDocument()
    expect(onImportGarden).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Restore this backup' }))
    expect(onImportGarden).toHaveBeenCalledWith(PLAIN)
    expect(await screen.findByText('Restored.')).toBeInTheDocument()
  })

  it('takes a plain backup chosen there through the usual preview too', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('button', { name: 'Restore from a backup' }))
    await user.click(screen.getByRole('button', { name: 'Arrive from another device…' }))
    await user.upload(await screen.findByLabelText('Choose the move file'), new File([PLAIN], 'plain.json'))
    expect(await screen.findByRole('heading', { name: 'This backup holds Wild Garden' })).toBeInTheDocument()
    expect(screen.queryByText(/opened with its/)).toBeNull()
  })

  it('gives focus back to its button when put away', async () => {
    const { user } = renderSettings()
    await user.click(screen.getByRole('button', { name: 'Restore from a backup' }))
    const arrive = screen.getByRole('button', { name: 'Arrive from another device…' })
    await user.click(arrive)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(arrive).toHaveFocus())
  })

  it('asks a move file chosen with Restore for its code, and says so in the preview', async () => {
    const { file, words } = await moveFile()
    const { user } = renderSettings()
    await user.click(screen.getByRole('button', { name: 'Restore from a backup' }))
    await user.upload(screen.getByLabelText('Backup file'), file)
    await screen.findByRole('dialog', { name: 'Open the move file' })
    await enter(user, screen.getByLabelText('The 12 words'), words.join(' '))
    await user.click(screen.getByRole('button', { name: 'Open the file' }))
    expect(await screen.findByText('A move file, opened with its one-time code')).toBeInTheDocument()
  })
})
