import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { MAX_BACKUP_BYTES } from '../lib/backupFile'
import { saveTextFile } from '../lib/download'
import { verifyGardenImages } from '../lib/imageImport'
import { turnLockOn } from '../lib/gardenLockActions'
import { createInitialState } from '../lib/progression'
import { newRecoveryCode } from '../lib/recoveryCode'
import { reloadApp } from '../lib/reload'
import { sealBackup } from '../lib/sealedBackup'
import { gardenRepository } from '../repository/gardenRepository'
import { ArrayBufferFileReader, unreadablePhoto } from '../test/fileReader'
import type { AppState } from '../types'
import { SafeMode } from './SafeMode'

// The real lock, quick: the count is the tests' only change.
vi.mock('../lib/sealing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sealing')>()
  return {
    ...actual,
    deriveKey: (secret: string, salt: Uint8Array) => actual.deriveKey(secret, salt, 1_000),
  }
})
vi.mock('../lib/download', async (original) => ({
  ...(await original<typeof import('../lib/download')>()),
  saveTextFile: vi.fn(),
}))
vi.mock('../lib/imageImport', () => ({ verifyGardenImages: vi.fn() }))
vi.mock('../lib/reload', () => ({ reloadApp: vi.fn() }))

const save = vi.mocked(saveTextFile)

function backupFile(garden: unknown, name = 'backup.json') {
  return new File(
    [JSON.stringify({ format: 'the-butterfly-garden', exportedAt: '', appVersion: '3.0.0', garden })],
    name,
    { type: 'application/json' },
  )
}

function renderSafeMode(message = 'A damaged entry') {
  render(<SafeMode error={new Error(message)} />)
  return userEvent.setup()
}

const note = () => screen.getByRole('status')
const restoreInput = () => screen.getByLabelText('Restore a backup')

let readRaw: MockInstance<typeof gardenRepository.readRaw>
beforeEach(() => {
  readRaw = vi.spyOn(gardenRepository, 'readRaw').mockResolvedValue({ garden: { v: 6 } })
})

// The prompt's code is fetched when a sealed file is chosen; fetched once
// here, so no test's first wait is spent compiling it on a busy machine.
beforeAll(async () => {
  await import('./backup/SealedBackupPrompt')
})

afterEach(() => {
  vi.restoreAllMocks()
  save.mockReset()
  vi.mocked(verifyGardenImages).mockReset()
  vi.mocked(reloadApp).mockReset()
})

describe('safe mode', () => {
  it('says what went wrong, or that it was unexpected', () => {
    renderSafeMode('')
    expect(screen.getByText('An unexpected error.')).toBeInTheDocument()
  })

  it('downloads everything stored, saying where it went', async () => {
    const user = renderSafeMode()
    save.mockResolvedValueOnce('started')
    await user.click(screen.getByRole('button', { name: "Download what's stored" }))
    await waitFor(() => expect(note()).toHaveTextContent(/^Download started/))
    expect(save).toHaveBeenCalledWith(
      expect.stringMatching(/^butterfly-garden-everything-stored-\d{4}-\d\d-\d\d\.json$/),
      'application/json',
      JSON.stringify({ garden: { v: 6 } }, null, 2),
    )

    save.mockResolvedValueOnce('saved')
    await user.click(screen.getByRole('button', { name: "Download what's stored" }))
    await waitFor(() => expect(note()).toHaveTextContent(/^Saved\./))
  })

  it('keeps everything stored when a photo cannot be read, leaving out that photo alone, and says so', async () => {
    vi.stubGlobal('FileReader', ArrayBufferFileReader)
    const sound = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' })
    readRaw.mockResolvedValueOnce({
      stores: {
        moods: { current: [{ id: 'm', note: 'Still here.' }] },
        sightings: { current: [{ id: 'lost', photo: unreadablePhoto() }, { id: 'kept', photo: sound }] },
      },
    })
    const user = renderSafeMode()
    save.mockResolvedValueOnce('started')
    await user.click(screen.getByRole('button', { name: "Download what's stored" }))
    await waitFor(() =>
      expect(note()).toHaveTextContent(
        /^Download started\..* One photo in the field book could not be read on this device, so the file keeps its sighting without it\.$/,
      ),
    )
    const written = JSON.parse(save.mock.calls[0][2]) as {
      stores: { moods: unknown; sightings: { current: Array<{ photo: unknown }> } }
    }
    expect(written.stores.moods).toEqual({ current: [{ id: 'm', note: 'Still here.' }] })
    expect(written.stores.sightings.current.map((item) => item.photo)).toEqual([
      { mimeType: 'image/webp', unreadable: true },
      { mimeType: 'image/webp', imageData: 'AQID' },
    ])
    // A copy was kept, so starting again is allowed.
    await user.click(screen.getByRole('button', { name: 'Start a new garden instead…' }))
    expect(screen.getByRole('button', { name: 'Delete and start again' })).toBeEnabled()
    vi.unstubAllGlobals()
  })

  it('says so when nothing was saved, or the store could not be read', async () => {
    const user = renderSafeMode()
    save.mockResolvedValueOnce('cancelled')
    await user.click(screen.getByRole('button', { name: "Download what's stored" }))
    await waitFor(() => expect(note()).toHaveTextContent('Nothing was saved.'))

    readRaw.mockRejectedValueOnce(new Error('blocked'))
    await user.click(screen.getByRole('button', { name: "Download what's stored" }))
    await waitFor(() => expect(note()).toHaveTextContent('What is stored could not be read just now.'))
  })

  it('starts again only after a copy is kept, and only when asked twice', async () => {
    const clear = vi.spyOn(gardenRepository, 'clear').mockResolvedValue()
    const user = renderSafeMode()
    await user.click(screen.getByRole('button', { name: 'Start a new garden instead…' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Download what is stored first/)
    expect(screen.getByRole('button', { name: 'Delete and start again' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByRole('alert')).toBeNull()

    save.mockResolvedValueOnce('started')
    await user.click(screen.getByRole('button', { name: "Download what's stored" }))
    await user.click(screen.getByRole('button', { name: 'Start a new garden instead…' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/This deletes everything stored here/)
    await user.click(screen.getByRole('button', { name: 'Delete and start again' }))
    expect(clear).toHaveBeenCalledOnce()
    expect(reloadApp).toHaveBeenCalledOnce()
  })

  it('tries again from the start', async () => {
    const user = renderSafeMode()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reloadApp).toHaveBeenCalledOnce()
  })

  it('says why the garden could not be cleared', async () => {
    const clear = vi.spyOn(gardenRepository, 'clear').mockRejectedValue(new Error('The storage is locked.'))
    const user = renderSafeMode()
    save.mockResolvedValueOnce('started')
    await user.click(screen.getByRole('button', { name: "Download what's stored" }))
    await user.click(screen.getByRole('button', { name: 'Start a new garden instead…' }))
    await user.click(screen.getByRole('button', { name: 'Delete and start again' }))
    expect(await screen.findByText('The storage is locked.')).toBeInTheDocument()

    clear.mockRejectedValueOnce('no reason')
    await user.click(screen.getByRole('button', { name: 'Delete and start again' }))
    expect(await screen.findByText('The garden could not be cleared.')).toBeInTheDocument()
    expect(reloadApp).not.toHaveBeenCalled()
  })
})

describe('restoring from safe mode', () => {
  it('puts a sound backup back, keeping a copy of what it replaces', async () => {
    const replace = vi.spyOn(gardenRepository, 'replace').mockResolvedValue([])
    const user = renderSafeMode()
    await user.upload(restoreInput(), backupFile(createInitialState('Robin', 'From The File')))
    await waitFor(() => expect(replace).toHaveBeenCalledOnce())
    const [restored, options] = replace.mock.calls[0]
    expect(restored.profile?.gardenName).toBe('From The File')
    expect(options).toEqual({ snapshot: true })
    expect(verifyGardenImages).not.toHaveBeenCalled()
    expect(reloadApp).toHaveBeenCalledOnce()
  })

  it('checks the images in a backup before replacing anything', async () => {
    const replace = vi.spyOn(gardenRepository, 'replace').mockResolvedValue([])
    vi.mocked(verifyGardenImages).mockRejectedValueOnce(
      new Error('The image “Meadow” could not be verified.'),
    )
    const garden: AppState = {
      ...createInitialState('Robin', 'With A Picture'),
      customBackdrops: [
        {
          id: 'image-1',
          name: 'Meadow',
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
          mimeType: 'image/png',
          width: 10,
          height: 10,
          byteLength: 3,
          imageData: btoa('abc'),
          crop: { x: 0.5, y: 0.5, zoom: 1 },
        },
      ],
    }
    const user = renderSafeMode()
    await user.upload(restoreInput(), backupFile(garden))
    expect(await screen.findByText(/could not be verified/)).toBeInTheDocument()
    expect(verifyGardenImages).toHaveBeenCalledOnce()
    expect(replace).not.toHaveBeenCalled()
  })

  it('refuses what is not a backup, in plain words', async () => {
    const replace = vi.spyOn(gardenRepository, 'replace')
    const user = renderSafeMode()
    await user.upload(restoreInput(), new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(await screen.findByRole('status')).toHaveTextContent('That file is not a garden backup.')

    await user.upload(restoreInput(), backupFile({ version: 99 }))
    expect(await screen.findByText(/^That backup could not be restored\./)).toBeInTheDocument()

    const huge = new File(['{}'], 'huge.json', { type: 'application/json' })
    Object.defineProperty(huge, 'size', { value: MAX_BACKUP_BYTES + 1 })
    await user.upload(restoreInput(), huge)
    expect(await screen.findByText('That file is too large to be a garden backup.')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('says why a backup could not be written', async () => {
    const replace = vi.spyOn(gardenRepository, 'replace').mockRejectedValueOnce(new Error('The disk is full.'))
    const user = renderSafeMode()
    await user.upload(restoreInput(), backupFile(createInitialState('Robin', 'Full')))
    expect(await screen.findByText('The disk is full.')).toBeInTheDocument()

    replace.mockRejectedValueOnce(new Error(''))
    await user.upload(restoreInput(), backupFile(createInitialState('Robin', 'Full')))
    expect(await screen.findByText('That file is not a garden backup.')).toBeInTheDocument()
  })
})

describe('restoring a protected backup from safe mode', () => {
  const PASSPHRASE = 'quiet meadow lantern'

  async function protectedBackup(garden: unknown) {
    const plain = await backupFile(garden).text()
    const outcome = await sealBackup(plain, PASSPHRASE, { iterations: 1_000 })
    return new File([(outcome as { text: string }).text], 'protected.json', { type: 'application/json' })
  }

  it('asks for its passphrase, then puts the garden inside back as any backup', async () => {
    const replace = vi.spyOn(gardenRepository, 'replace').mockResolvedValue([])
    const user = renderSafeMode()
    await user.upload(restoreInput(), await protectedBackup(createInitialState('Robin', 'Locked Away')))
    const dialog = await screen.findByRole('dialog', { name: 'This backup is protected' })
    // A readable garden is replaced the moment it opens: said so, and no look promised.
    expect(dialog).toHaveAccessibleDescription(
      /Once it opens, it is restored straight away, in place of what is stored here\.$/,
    )
    expect(dialog).not.toHaveAccessibleDescription(/Nothing is replaced until/)

    await user.type(within(dialog).getByLabelText('Passphrase'), 'the wrong words')
    await user.click(within(dialog).getByRole('button', { name: 'Open the backup' }))
    expect(await within(dialog).findByText(/does not open this backup/)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()

    await user.clear(within(dialog).getByLabelText('Passphrase'))
    await user.type(within(dialog).getByLabelText('Passphrase'), PASSPHRASE)
    await user.click(within(dialog).getByRole('button', { name: 'Open the backup' }))
    await waitFor(() => expect(replace).toHaveBeenCalledOnce())
    const [restored, options] = replace.mock.calls[0]
    expect(restored.profile?.gardenName).toBe('Locked Away')
    expect(options).toEqual({ snapshot: true })
    expect(reloadApp).toHaveBeenCalledOnce()
  })

  it('replaces nothing when the prompt is put away', async () => {
    const replace = vi.spyOn(gardenRepository, 'replace').mockResolvedValue([])
    const user = renderSafeMode()
    await user.upload(restoreInput(), await protectedBackup(createInitialState('Robin', 'Locked Away')))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
    expect(reloadApp).not.toHaveBeenCalled()
  })

  it('refuses what opens but is not a garden, in plain words', async () => {
    const replace = vi.spyOn(gardenRepository, 'replace').mockResolvedValue([])
    const user = renderSafeMode()
    const outcome = await sealBackup('not a backup', PASSPHRASE, { iterations: 1_000 })
    await user.upload(
      restoreInput(),
      new File([(outcome as { text: string }).text], 'odd.json', { type: 'application/json' }),
    )
    await user.type(await screen.findByLabelText('Passphrase'), PASSPHRASE)
    await user.click(screen.getByRole('button', { name: 'Open the backup' }))
    expect(await screen.findByText('That file is not a garden backup.')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('safe mode with the garden lock on', () => {
  const PASSCODE = 'kingfisher at dawn'
  const NOTE = 'Lavender tea at the window'

  /** A garden with the lock on, open in this tab, as when the app fails to draw it. */
  async function lockedGarden() {
    readRaw.mockRestore()
    const words = newRecoveryCode()
    const garden = createInitialState('Robin', 'Quiet Corner')
    await gardenRepository.save({
      ...garden,
      moods: [
        {
          id: 'mood-1',
          localDate: '2026-10-20',
          level: 3,
          note: NOTE,
          createdAt: '2026-10-20T09:00:00.000Z',
          updatedAt: '2026-10-20T09:00:00.000Z',
        },
      ],
    })
    await turnLockOn(PASSCODE, words)
    return words
  }

  afterEach(async () => {
    await gardenRepository.clear().catch(() => undefined)
  })

  /** Download what is stored, and hand back the file's text. */
  async function download(user: ReturnType<typeof userEvent.setup>): Promise<string> {
    save.mockResolvedValueOnce('saved')
    await user.click(screen.getByRole('button', { name: "Download what's stored" }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    return save.mock.calls[0][2]
  }

  it('says the copy is sealed with the lock, and what opens it', async () => {
    await lockedGarden()
    const user = renderSafeMode()
    const text = await download(user)
    expect(text).not.toContain(NOTE)
    await waitFor(() =>
      expect(note()).toHaveTextContent(
        'Saved. This copy is sealed with your lock: it keeps everything, but it can only be opened by this app, with your passcode or recovery code.',
      ),
    )
    expect(note()).not.toHaveTextContent(/Keep this file: it holds everything this app had stored, and can be restored later/)
  })

  it('restores that copy with the passcode after starting again, so starting again loses nothing', async () => {
    await lockedGarden()
    const user = renderSafeMode()
    const text = await download(user)

    // The copy can be restored, so starting again is allowed, behind its confirmation.
    await user.click(screen.getByRole('button', { name: 'Start a new garden instead…' }))
    expect(screen.getByRole('alert')).toHaveTextContent('This deletes everything stored here and starts a new garden.')
    await user.click(screen.getByRole('button', { name: 'Delete and start again' }))
    await waitFor(() => expect(reloadApp).toHaveBeenCalledOnce())
    expect((await gardenRepository.load()).status).toBe('empty')

    // The kept copy, chosen to restore: it asks for the lock's passcode.
    await user.upload(restoreInput(), new File([text], 'everything-stored.json', { type: 'application/json' }))
    const dialog = await screen.findByRole('dialog', { name: 'This copy is locked' })
    expect(dialog).toHaveAccessibleDescription(
      /Once it opens, it is restored straight away, in place of what is stored here\./,
    )
    await user.type(within(dialog).getByLabelText('Passcode'), PASSCODE)
    await user.click(within(dialog).getByRole('button', { name: 'Open the copy' }))
    await waitFor(() => expect(reloadApp).toHaveBeenCalledTimes(2))

    const back = await gardenRepository.load()
    expect(back.status).toBe('loaded')
    expect(back.state.profile?.gardenName).toBe('Quiet Corner')
    expect(back.state.moods.map((mood) => mood.note)).toEqual([NOTE])
  })

  it('restores that copy with the recovery code, in place of the garden still stored, under its lock', async () => {
    const words = await lockedGarden()
    const user = renderSafeMode()
    const text = await download(user)
    const replace = vi.spyOn(gardenRepository, 'replace')

    await user.upload(restoreInput(), new File([text], 'everything-stored.json', { type: 'application/json' }))
    const dialog = await screen.findByRole('dialog', { name: 'This copy is locked' })
    await user.click(within(dialog).getByRole('button', { name: 'Use the recovery code instead' }))
    await user.type(within(dialog).getByLabelText('Recovery code'), words.join(' '))
    await user.click(within(dialog).getByRole('button', { name: 'Open the copy' }))
    await waitFor(() => expect(replace).toHaveBeenCalledOnce())
    expect(replace.mock.calls[0][0].moods[0].note).toBe(NOTE)
    expect(replace.mock.calls[0][1]).toEqual({ snapshot: true })
    await waitFor(() => expect(reloadApp).toHaveBeenCalledOnce())
    // Written under the lock this garden has, never in the clear.
    expect(JSON.stringify(await gardenRepository.readRaw())).not.toContain(NOTE)
    expect(gardenRepository.lockState()).toBe('unlocked')
  })
})
