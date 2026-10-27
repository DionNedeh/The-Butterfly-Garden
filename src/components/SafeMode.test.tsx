import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { MAX_BACKUP_BYTES } from '../lib/backupFile'
import { saveTextFile } from '../lib/download'
import { verifyGardenImages } from '../lib/imageImport'
import { createInitialState } from '../lib/progression'
import { reloadApp } from '../lib/reload'
import { gardenRepository } from '../repository/gardenRepository'
import { ArrayBufferFileReader, unreadablePhoto } from '../test/fileReader'
import type { AppState } from '../types'
import { SafeMode } from './SafeMode'

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
