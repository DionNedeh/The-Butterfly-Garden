import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { MAX_BACKUP_BYTES } from '../lib/backupFile'
import { saveTextFile } from '../lib/download'
import { reloadApp } from '../lib/reload'
import { sealBackup } from '../lib/sealedBackup'
import { RecoveryScreen } from './RecoveryScreen'

vi.mock('../lib/download', async (original) => ({
  ...(await original<typeof import('../lib/download')>()),
  saveTextFile: vi.fn(),
}))
vi.mock('../lib/reload', () => ({ reloadApp: vi.fn() }))

const save = vi.mocked(saveTextFile)

function renderRecovery(reason: PersistenceStatus['reason'] = 'malformed') {
  const handlers = {
    onRestore: vi.fn((text: string) =>
      Promise.resolve({ ok: true, message: `Restored ${text.length} characters.` }),
    ),
    onDownloadSetAside: vi.fn<() => Promise<string | undefined>>(() =>
      Promise.resolve('{"garden":{}}'),
    ),
    onStartFresh: vi.fn<() => Promise<{ ok: boolean; message?: string }>>(() =>
      Promise.resolve({ ok: true }),
    ),
  }
  render(<RecoveryScreen reason={reason} {...handlers} />)
  return { ...handlers, user: userEvent.setup() }
}

const note = () => screen.getByRole('status')

afterEach(() => {
  save.mockReset()
  vi.mocked(reloadApp).mockReset()
  vi.unstubAllEnvs()
})

describe('explaining what happened', () => {
  it('points a garden from a newer version at an update', () => {
    renderRecovery('incompatible')
    expect(screen.getByText(/written by a newer version of the app/)).toBeInTheDocument()
  })

  it('offers only to try again when storage would not open, in the words of each build', async () => {
    const { user } = renderRecovery('unavailable')
    expect(screen.getByText(/This browser would not open its storage/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /set-aside copy/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Start a new garden/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reloadApp).toHaveBeenCalledOnce()
  })

  it('speaks of a phone in the Android app', () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    renderRecovery('unavailable')
    expect(screen.getByText(/could not open its storage on this phone/)).toBeInTheDocument()
  })

  it('says a damaged garden was set aside untouched', () => {
    renderRecovery('malformed')
    expect(screen.getByText(/a copy has been set aside untouched/)).toBeInTheDocument()
  })
})

describe('keeping the set-aside copy', () => {
  it('downloads it, and says to keep it safe', async () => {
    const { user } = renderRecovery()
    save.mockResolvedValueOnce('started')
    await user.click(screen.getByRole('button', { name: 'Download the set-aside copy' }))
    expect(save).toHaveBeenCalledWith(
      expect.stringMatching(/^butterfly-garden-set-aside-copy-/),
      'application/json',
      '{"garden":{}}',
    )
    expect(note()).toHaveTextContent(/Keep that file safe/)

    save.mockResolvedValueOnce('cancelled')
    await user.click(screen.getByRole('button', { name: 'Download the set-aside copy' }))
    expect(note()).toHaveTextContent('Nothing was saved.')
  })

  it('says when there is no copy yet, or it could not be saved', async () => {
    const { onDownloadSetAside, user } = renderRecovery()
    onDownloadSetAside.mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: 'Download the set-aside copy' }))
    expect(note()).toHaveTextContent('There is no set-aside copy to download yet.')
    expect(save).not.toHaveBeenCalled()

    save.mockRejectedValueOnce(new Error('denied'))
    await user.click(screen.getByRole('button', { name: 'Download the set-aside copy' }))
    expect(note()).toHaveTextContent('The set-aside copy could not be saved there.')
  })
})

describe('putting a backup back', () => {
  const upload = (user: ReturnType<typeof userEvent.setup>, file: File) =>
    user.upload(screen.getByLabelText('Restore a backup'), file)

  it('hands the file to the restore and shows what it said', async () => {
    const { onRestore, user } = renderRecovery()
    await upload(user, new File(['{"a":1}'], 'backup.json', { type: 'application/json' }))
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('{"a":1}'))
    expect(note()).toHaveTextContent('Restored 7 characters.')
  })

  it('refuses a file too large to be a backup without reading it', async () => {
    const { onRestore, user } = renderRecovery()
    const huge = new File(['{}'], 'huge.json', { type: 'application/json' })
    Object.defineProperty(huge, 'size', { value: MAX_BACKUP_BYTES + 1 })
    await upload(user, huge)
    expect(await screen.findByText('That file is too large to be a garden backup.')).toBeInTheDocument()
    expect(onRestore).not.toHaveBeenCalled()
  })

  it('says so when the chosen file can no longer be read', async () => {
    const { onRestore, user } = renderRecovery()
    const gone = new File(['{}'], 'gone.json', { type: 'application/json' })
    gone.text = () => Promise.reject(new DOMException('gone', 'NotReadableError'))
    await upload(user, gone)
    expect(await screen.findByText(/could not be read. Try choosing it again/)).toBeInTheDocument()
    expect(onRestore).not.toHaveBeenCalled()
  })
})

describe('putting a protected backup back', () => {
  const PASSPHRASE = 'quiet meadow lantern'

  async function protectedFile(plain: string) {
    const outcome = await sealBackup(plain, PASSPHRASE, { iterations: 1_000 })
    return new File([(outcome as { text: string }).text], 'protected.json', { type: 'application/json' })
  }

  it('asks for its passphrase, then restores the backup inside as any other', async () => {
    const { onRestore, user } = renderRecovery()
    await user.upload(screen.getByLabelText('Restore a backup'), await protectedFile('{"a":1}'))
    const dialog = await screen.findByRole('dialog', { name: 'This backup is protected' })
    expect(onRestore).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('Passphrase'), 'not it at all')
    await user.click(within(dialog).getByRole('button', { name: 'Open the backup' }))
    expect(await within(dialog).findByText(/does not open this backup/)).toBeInTheDocument()
    expect(onRestore).not.toHaveBeenCalled()

    await user.clear(within(dialog).getByLabelText('Passphrase'))
    await user.type(within(dialog).getByLabelText('Passphrase'), PASSPHRASE)
    await user.click(within(dialog).getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('{"a":1}'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(note()).toHaveTextContent('Restored 7 characters.')
  })

  it('restores nothing when it is put away', async () => {
    const { onRestore, user } = renderRecovery()
    await user.upload(screen.getByLabelText('Restore a backup'), await protectedFile('{"a":1}'))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onRestore).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('starting a new garden', () => {
  it('asks first, and can be put off', async () => {
    const { onStartFresh, user } = renderRecovery()
    await user.click(screen.getByRole('button', { name: 'Start a new garden instead…' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/set-aside copy stays on this device/)
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onStartFresh).not.toHaveBeenCalled()
  })

  it('starts one, or says why it could not', async () => {
    const { onStartFresh, user } = renderRecovery()
    await user.click(screen.getByRole('button', { name: 'Start a new garden instead…' }))
    const start = screen.getByRole('button', { name: 'Start a new garden' })

    await user.click(start)
    expect(onStartFresh).toHaveBeenCalledOnce()
    expect(screen.queryByRole('status')).toBeNull()

    onStartFresh.mockResolvedValueOnce({ ok: false, message: 'There is no set-aside copy of your garden yet.' })
    await user.click(start)
    expect(await screen.findByText('There is no set-aside copy of your garden yet.')).toBeInTheDocument()

    onStartFresh.mockRejectedValueOnce(new Error('blocked'))
    await user.click(start)
    expect(await screen.findByText('A new garden could not be started just now.')).toBeInTheDocument()
  })
})
