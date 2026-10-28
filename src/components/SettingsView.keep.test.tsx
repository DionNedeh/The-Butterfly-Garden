import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { createInitialState } from '../lib/progression'
import { loadBackupFile } from '../lib/autoBackupFile'
import { storageStatus } from '../lib/storage'
import { gardenRepository } from '../repository/gardenRepository'
import { fakeFile, installSavePicker, recordInMemory } from '../test/fileSystemAccess'
import type { AppState } from '../types'
import type { CopiesKept } from './backup/EarlierCopies'
import { SettingsView } from './SettingsView'

/*
 * Settings → Backup and restore, what it keeps on its own: a backup file kept
 * up to date where the browser can keep a file, and the earlier copies on
 * this device, looked at in the usual restore preview and put back with the
 * usual undo.
 */

vi.mock('../lib/storage', async (original) => ({
  ...(await original<typeof import('../lib/storage')>()),
  storageStatus: vi.fn(() => Promise.resolve({ protection: 'unknown' })),
}))

const LOCKED = 'Automatic backups pause while your garden is locked, because the file would not be.'
const garden = createInitialState('Tester', 'Test Garden')

const COPIES: CopiesKept = {
  copies: [
    { id: 'daily-2026-10-27', day: '2026-10-27', held: { checkIns: 12, reflections: 1, goals: 3 } },
    { id: 'daily-2026-10-25', day: '2026-10-25' },
  ],
  bytes: 1.5 * 1024 * 1024,
}

beforeEach(() => {
  gardenRepository.forget()
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 27, 14, 5) })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function renderSettings(
  extra: Partial<Parameters<typeof SettingsView>[0]> = {},
  persistence: PersistenceStatus = { readOnly: false },
) {
  const handlers = {
    onUpdateProfile: vi.fn(),
    onSelectAmbientTrack: vi.fn(),
    onSelectBackdrop: vi.fn(),
    onExportGarden: vi.fn(() => ({ text: '{"format":"the-butterfly-garden"}' })),
    onBackupMade: vi.fn(),
    onImportGarden: vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' })),
    onDeleteAll: vi.fn(() => Promise.resolve({ ok: true })),
  }
  const view = render(
    <SettingsView state={garden} persistence={persistence} {...handlers} {...extra} />,
  )
  return { ...handlers, view, user: userEvent.setup() }
}

const heading = () => screen.queryByRole('heading', { name: 'Keep a backup file up to date' })

describe('a backup file kept up to date', () => {
  it('is not offered where the browser cannot keep a file, and the download stays', async () => {
    recordInMemory()
    renderSettings()
    expect(screen.getByRole('button', { name: 'Download a backup' })).toBeInTheDocument()
    await act(async () => {
      await Promise.resolve()
    })
    expect(heading()).not.toBeInTheDocument()
  })

  it('writes the chosen file at once, counts it as a backup, and says when', async () => {
    const kept = recordInMemory()
    const file = fakeFile()
    const picker = installSavePicker(file)
    const { user, onBackupMade } = renderSettings()
    expect(await screen.findByRole('heading', { name: 'Keep a backup file up to date' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Choose a backup file…' }))
    expect(picker).toHaveBeenCalledTimes(1)
    const status = await screen.findByText(/^garden-backup\.json was last written today at 2:05/i)
    await waitFor(() => expect(status).toHaveFocus())
    expect(file.contents).toBe('{"format":"the-butterfly-garden"}')
    expect(onBackupMade).toHaveBeenCalledWith(new Date(2026, 9, 27, 14, 5))
    expect(kept.record?.writtenAt).toBe(new Date(2026, 9, 27, 14, 5).toISOString())
    expect(screen.queryByRole('button', { name: 'Keep updating my backup file' })).not.toBeInTheDocument()
  })

  it('keeps nothing when the save screen is closed', async () => {
    const kept = recordInMemory()
    installSavePicker(fakeFile(), true)
    const { user } = renderSettings()
    const choose = await screen.findByRole('button', { name: 'Choose a backup file…' })
    await user.click(choose)
    expect(kept.record).toBeUndefined()
    expect(choose).toHaveFocus()
  })

  it('asks the browser for permission only when tapped, then writes', async () => {
    const file = fakeFile()
    file.permission = 'prompt'
    recordInMemory({ handle: file.handle, writtenAt: new Date(2026, 9, 26, 21, 10).toISOString() })
    installSavePicker(file)
    const { user, onBackupMade } = renderSettings()
    const ask = await screen.findByRole('button', { name: 'Keep updating my backup file' })
    expect(screen.getByText(/was last written yesterday at 9:10/i)).toBeInTheDocument()
    expect(file.requested).toBe(0)
    await user.click(ask)
    expect(file.requested).toBe(1)
    await waitFor(() => expect(file.writes).toBe(1))
    expect(onBackupMade).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Keep updating my backup file' })).not.toBeInTheDocument(),
    )
  })

  it('says so when permission is refused on the tap', async () => {
    const file = fakeFile()
    file.permission = 'prompt'
    file.answer = 'denied'
    recordInMemory({ handle: file.handle, writtenAt: new Date(2026, 9, 26).toISOString() })
    installSavePicker(file)
    const { user } = renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Keep updating my backup file' }))
    expect(
      await screen.findByText('The browser did not give permission, so the file was not written.'),
    ).toBeInTheDocument()
    expect(file.writes).toBe(0)
    expect(screen.getByText(/could not be written today at 2:05.*needs your permission again/i)).toBeInTheDocument()
  })

  it('offers to choose the file again once it has moved', async () => {
    const moved = fakeFile('old.json')
    recordInMemory({
      handle: moved.handle,
      writtenAt: new Date(2026, 9, 26).toISOString(),
      problem: { kind: 'missing', at: new Date(2026, 9, 27, 9).toISOString() },
    })
    const replacement = fakeFile('new.json')
    installSavePicker(replacement)
    const { user } = renderSettings()
    expect(await screen.findByText(/old\.json could not be written today at 9:00.*moved, renamed or deleted/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Choose the file again…' }))
    await waitFor(() => expect(replacement.writes).toBe(1))
    expect(await screen.findByText(/^new\.json was last written today/i)).toBeInTheDocument()
  })

  it('forgets the file when turned off, and says the file stays as it was', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle, writtenAt: new Date(2026, 9, 27, 9).toISOString() })
    installSavePicker(file)
    const { user } = renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Stop updating this file' }))
    expect(kept.record).toBeUndefined()
    expect(
      await screen.findByText('garden-backup.json stays as it was last written, and is no longer updated.'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Choose a backup file…' })).toHaveFocus(),
    )
  })

  it('pauses while the garden is locked, and says why', async () => {
    const file = fakeFile()
    recordInMemory({ handle: file.handle, writtenAt: new Date(2026, 9, 27, 9).toISOString() })
    installSavePicker(file)
    gardenRepository.unlock({} as CryptoKey, 'lock-1')
    const { user } = renderSettings()
    expect(await screen.findByText(LOCKED)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Keep updating my backup file' })).not.toBeInTheDocument()
    // Turning it off is still the gardener's to do.
    await user.click(await screen.findByRole('button', { name: 'Stop updating this file' }))
    expect(screen.queryByRole('button', { name: 'Choose a backup file…' })).not.toBeInTheDocument()
    await waitFor(() => expect(heading()).toHaveFocus())
    expect(file.writes).toBe(0)
  })

  it('cannot be chosen while saving is paused', async () => {
    recordInMemory()
    installSavePicker(fakeFile())
    renderSettings({}, { readOnly: true, reason: 'malformed' })
    expect(await screen.findByRole('button', { name: 'Choose a backup file…' })).toBeDisabled()
  })

  it('says when the save screen would not open', async () => {
    recordInMemory()
    vi.stubGlobal('showSaveFilePicker', () => Promise.reject(new DOMException('no', 'SecurityError')))
    const { user } = renderSettings()
    await user.click(await screen.findByRole('button', { name: 'Choose a backup file…' }))
    expect(await screen.findByText('This browser would not open its save screen.')).toBeInTheDocument()
  })
})

describe('earlier copies on this device', () => {
  it('lists each day and what it held, and says what they cannot do', async () => {
    vi.mocked(storageStatus).mockResolvedValue({ protection: 'best-effort', usage: 12 * 1024 * 1024 })
    renderSettings({ onListEarlierCopies: () => Promise.resolve(COPIES) })
    const list = await screen.findByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/October 27, 2026.*12 check-ins, 1 reflection and 3 goals/)
    expect(items[1]).toHaveTextContent('This copy cannot be opened here.')
    expect(within(items[1]).getByRole('button', { name: /^Look at this copy/ })).toBeDisabled()
    expect(screen.getByText(/cannot help if the browser clears the site’s storage; a backup file can/)).toBeInTheDocument()
    expect(
      await screen.findByText(/use about 12 MB here, about 1.5 MB of it for earlier copies\./),
    ).toBeInTheDocument()
  })

  it('says when there are none yet', async () => {
    renderSettings({ onListEarlierCopies: () => Promise.resolve({ copies: [], bytes: 0 }) })
    expect(
      await screen.findByText('None yet: one is kept before the first change you make on a day.'),
    ).toBeInTheDocument()
  })

  it('says when they could not be read', async () => {
    renderSettings({ onListEarlierCopies: () => Promise.reject(new Error('blocked')) })
    expect(await screen.findByText('The earlier copies could not be read just now.')).toBeInTheDocument()
  })

  it('shows a copy in the restore preview, and returns to it if kept as is', async () => {
    const copy: AppState = { ...garden, moods: [] }
    const onReadCopy = vi.fn(() => Promise.resolve(copy))
    const { user } = renderSettings({
      onListEarlierCopies: () => Promise.resolve(COPIES),
      onReadCopy,
      onPutBackCopy: vi.fn(),
    })
    const look = await screen.findByRole('button', { name: /^Look at this copy, from .*October 27/ })
    await user.click(look)
    expect(onReadCopy).toHaveBeenCalledWith('daily-2026-10-27')
    const preview = await screen.findByRole('heading', { name: 'This copy holds Test Garden' })
    await waitFor(() => expect(preview).toHaveFocus())
    expect(screen.getByText(/Kept on this device before your changes on .*October 27/)).toBeInTheDocument()
    expect(screen.getByText(/0 check-ins/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep the garden as it is' }))
    expect(screen.queryByRole('heading', { name: 'This copy holds Test Garden' })).not.toBeInTheDocument()
    await waitFor(() => expect(look).toHaveFocus())
  })

  it('says when a copy could not be read', async () => {
    const { user } = renderSettings({
      onListEarlierCopies: () => Promise.resolve(COPIES),
      onReadCopy: () => Promise.resolve(undefined),
    })
    await user.click(await screen.findByRole('button', { name: /^Look at this copy, from .*October 27/ }))
    expect(await screen.findByText('That copy could not be read.')).toBeInTheDocument()
  })

  it('puts a copy back as a restore, and offers its undo', async () => {
    const onUndoRestore = vi.fn(() => Promise.resolve({ ok: true, message: 'Back as it was.' }))
    const onPutBackCopy = vi.fn()
    function Harness() {
      const [persistence, setPersistence] = useState<PersistenceStatus>({ readOnly: false })
      return (
        <SettingsView
          state={garden}
          persistence={persistence}
          onUpdateProfile={vi.fn()}
          onSelectAmbientTrack={vi.fn()}
          onSelectBackdrop={vi.fn()}
          onExportGarden={vi.fn(() => ({ text: '{}' }))}
          onImportGarden={vi.fn(() => Promise.resolve({ ok: true, message: '' }))}
          onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
          onUndoRestore={onUndoRestore}
          onListEarlierCopies={() => Promise.resolve(COPIES)}
          onReadCopy={() => Promise.resolve(garden)}
          onPutBackCopy={(id: string) => {
            onPutBackCopy(id)
            // As usePersistence does: the undo offer, then the answer.
            setPersistence({ readOnly: false, lastRestoreSnapshotId: 'restore-1' })
            return Promise.resolve({ ok: true, message: 'Your garden is back to that earlier copy.' })
          }}
        />
      )
    }
    render(<Harness />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^Look at this copy, from .*October 27/ }))
    await user.click(await screen.findByRole('button', { name: 'Put this copy back' }))
    expect(onPutBackCopy).toHaveBeenCalledWith('daily-2026-10-27')
    expect(
      await screen.findByText(/^Your garden is back to how it was before your changes on .*October 27/),
    ).toBeInTheDocument()
    const undo = screen.getByRole('button', { name: 'Undo the restore' })
    await waitFor(() => expect(undo).toHaveFocus())
    await user.click(undo)
    expect(onUndoRestore).toHaveBeenCalledWith('restore-1')
  })

  it('says when a copy could not be put back', async () => {
    const { user } = renderSettings({
      onListEarlierCopies: () => Promise.resolve(COPIES),
      onReadCopy: () => Promise.resolve(garden),
      onPutBackCopy: () => Promise.resolve({ ok: false, message: 'That copy could not be read.' }),
    })
    await user.click(await screen.findByRole('button', { name: /^Look at this copy, from .*October 27/ }))
    await user.click(await screen.findByRole('button', { name: 'Put this copy back' }))
    expect(await screen.findByText('That copy could not be read.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'This copy holds Test Garden' })).toBeInTheDocument()
  })
})

describe('the record read as Settings opens', () => {
  it('is read again from storage, so another tab’s write is seen', async () => {
    const file = fakeFile()
    const kept = recordInMemory({ handle: file.handle, writtenAt: new Date(2026, 9, 27, 9).toISOString() })
    installSavePicker(file)
    renderSettings()
    expect(await screen.findByText(/was last written today at 9:00/i)).toBeInTheDocument()
    kept.record = { ...kept.record!, writtenAt: new Date(2026, 9, 27, 13).toISOString() }
    await act(async () => {
      await loadBackupFile()
    })
    expect(screen.getByText(/was last written today at 1:00/i)).toBeInTheDocument()
  })
})
