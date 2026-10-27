import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { isSealedBackup } from '../lib/backupFile'
import { saveTextFile } from '../lib/download'
import { createInitialState } from '../lib/progression'
import { sealBackup } from '../lib/sealedBackup'
import { SettingsView } from './SettingsView'

// The real lock, quick: the count is the tests' only change.
vi.mock('../lib/sealedBackup', async (original) => {
  const actual = await original<typeof import('../lib/sealedBackup')>()
  return {
    ...actual,
    sealBackup: vi.fn((text: string, passphrase: string, options: Parameters<typeof actual.sealBackup>[2]) =>
      actual.sealBackup(text, passphrase, { ...options, iterations: 1_000 }),
    ),
  }
})
vi.mock('../lib/download', async (original) => ({
  ...(await original<typeof import('../lib/download')>()),
  saveTextFile: vi.fn(),
}))

const PASSPHRASE = 'quiet meadow lantern'
const save = vi.mocked(saveTextFile)

/** A real backup's text, of a garden with one check-in, made once. */
const PLAIN = plainBackup()
function plainBackup(): string {
  const garden = createInitialState('Tester', 'Wild Garden')
  return JSON.stringify({
    format: 'the-butterfly-garden',
    exportedAt: '2026-10-27T09:00:00.000Z',
    appVersion: '3.3.0',
    garden: {
      ...garden,
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
}

async function protectedFile(): Promise<File> {
  const outcome = await sealBackup(PLAIN, PASSPHRASE)
  if (!outcome.ok) throw new Error('Not sealed')
  return new File([outcome.text], 'butterfly-garden-protected-2026-10-27.json', { type: 'application/json' })
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
    <SettingsView
      state={createInitialState('Tester', 'Test Garden')}
      persistence={persistence}
      {...handlers}
    />,
  )
  return { ...handlers, user: userEvent.setup() }
}

afterEach(() => {
  save.mockReset()
  vi.mocked(sealBackup).mockClear()
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
})

describe('a protected backup in Settings', () => {
  it('sits beside the plain one, with a quiet line about what it is', () => {
    renderSettings()
    expect(screen.getByRole('button', { name: 'Download a backup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download a protected backup…' })).toBeEnabled()
    expect(
      screen.getByText(
        'A protected backup needs a passphrase to open, so nobody can read your garden from the file without it.',
      ),
    ).toBeInTheDocument()
    // Only where the browser can share a file.
    expect(screen.queryByRole('button', { name: 'Share protected backup…' })).toBeNull()
  })

  it('is offered for sharing where the plain backup is', () => {
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    renderSettings()
    expect(screen.getByRole('button', { name: 'Share backup…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share protected backup…' })).toBeInTheDocument()
  })

  it('cannot be made while the stored garden cannot be read', () => {
    renderSettings({ readOnly: true, reason: 'malformed' })
    expect(screen.getByRole('button', { name: 'Download a protected backup…' })).toBeDisabled()
  })

  it('is locked, downloaded and counted as a copy, with focus back where it began', async () => {
    save.mockResolvedValueOnce('started')
    const { onBackupMade, onExportGarden, user } = renderSettings()
    const open = screen.getByRole('button', { name: 'Download a protected backup…' })
    await user.click(open)
    const dialog = await screen.findByRole('dialog', { name: 'Download a protected backup' })
    expect(dialog).toBeInTheDocument()
    await user.type(screen.getByLabelText('Passphrase'), PASSPHRASE)
    await user.type(screen.getByLabelText('Passphrase again'), PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Lock the backup' }))
    await user.click(await screen.findByRole('button', { name: 'Download protected backup' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onExportGarden).toHaveBeenCalledOnce()
    const [fileName, , text] = save.mock.calls[0]
    expect(fileName).toMatch(/^butterfly-garden-protected-\d{4}-\d{2}-\d{2}\.json$/)
    expect(isSealedBackup(text)).toBe(true)
    expect(onBackupMade).toHaveBeenCalledWith(expect.any(Date))
    expect(
      screen.getByText(
        'Protected backup started. Check your downloads, and keep its passphrase somewhere safe, apart from the file.',
      ),
    ).toHaveAttribute('role', 'status')
    await waitFor(() => expect(open).toHaveFocus())
  })

  it('counts nothing when it is put away', async () => {
    const { onBackupMade, user } = renderSettings()
    await user.click(screen.getByRole('button', { name: 'Download a protected backup…' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onBackupMade).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
})

describe('restoring a protected backup in Settings', () => {
  async function chooseProtected() {
    const handlers = renderSettings()
    await handlers.user.click(screen.getByRole('button', { name: 'Restore from a backup' }))
    await handlers.user.upload(screen.getByLabelText('Backup file'), await protectedFile())
    const dialog = await screen.findByRole('dialog', { name: 'This backup is protected' })
    return { ...handlers, dialog }
  }

  it('asks for its passphrase, then shows the usual preview before anything is replaced', async () => {
    const { dialog, onImportGarden, user } = await chooseProtected()
    const field = screen.getByLabelText('Passphrase')

    await user.type(field, 'not the passphrase')
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    expect(await within(dialog).findByText(/That passphrase/)).toHaveTextContent(
      'That passphrase does not open this backup. Check it and try again.',
    )
    expect(screen.queryByRole('heading', { name: /this backup holds/i })).toBeNull()

    await user.clear(field)
    await user.type(field, PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    const preview = await screen.findByRole('heading', { name: 'This backup holds Wild Garden' })
    await waitFor(() => expect(preview).toHaveFocus())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('A protected backup, opened with its passphrase')).toBeInTheDocument()
    expect(screen.getByText(/1 check-in/)).toBeInTheDocument()
    expect(onImportGarden).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Restore this backup' }))
    expect(onImportGarden).toHaveBeenCalledWith(PLAIN)
    expect(await screen.findByText('Restored.')).toBeInTheDocument()
  })

  it('replaces nothing when put away, and gives focus back to the file field', async () => {
    const { onImportGarden, user } = await chooseProtected()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('heading', { name: /this backup holds/i })).toBeNull()
    expect(onImportGarden).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('Backup file')).toHaveFocus())
  })

  it('says why when what it held is not a garden', async () => {
    const outcome = await sealBackup('{"format":"the-butterfly-garden","garden":{"version":99}}', PASSPHRASE)
    const { onImportGarden, user } = renderSettings()
    await user.click(screen.getByRole('button', { name: 'Restore from a backup' }))
    await user.upload(
      screen.getByLabelText('Backup file'),
      new File([(outcome as { text: string }).text], 'newer.json', { type: 'application/json' }),
    )
    await user.type(await screen.findByLabelText('Passphrase'), PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    expect(await screen.findByText(/could not be restored\. It was written by a newer version/)).toBeInTheDocument()
    expect(onImportGarden).not.toHaveBeenCalled()
  })
})
