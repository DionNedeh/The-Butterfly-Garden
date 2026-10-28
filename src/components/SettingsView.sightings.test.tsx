import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { FileCopy } from '../lib/sightingPhotos'
import type { AppState, Sighting } from '../types'
import { SettingsView } from './SettingsView'

function renderSettings(
  state: AppState,
  onExportGarden: () => Promise<FileCopy | undefined> = vi.fn(() => Promise.resolve({ text: '{}' })),
) {
  render(
    <SettingsView
      state={state}
      persistence={{ readOnly: false }}
      onUpdateProfile={vi.fn()}
      onSelectAmbientTrack={vi.fn()}
      onSelectBackdrop={vi.fn()}
      onExportGarden={onExportGarden}
      onImportGarden={vi.fn(() => Promise.resolve({ ok: true, message: '' }))}
      onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
    />,
  )
  return userEvent.setup()
}

const photo = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/webp' })
const sighting = (id: string, extra: Partial<Sighting> = {}) =>
  ({ id, date: '2026-10-01', kind: 'butterfly', speciesId: 'monarch', createdAt: '', ...extra }) as Sighting

describe('Settings and the field book', () => {
  const garden = createInitialState('Tester', 'Wild Garden')

  it('says how many sighting photos are kept and how much room they take', () => {
    renderSettings({
      ...garden,
      sightings: [sighting('a', { photo: photo(150_000) }), sighting('b', { photo: photo(100_000) }), sighting('c')],
    })
    expect(screen.getByText(/Your field book keeps 2 photos of what you saw in the wild, about 244 KB, of the 50 it can hold/)).toBeInTheDocument()
  })

  it('says nothing of photos while there are none', () => {
    renderSettings({ ...garden, sightings: [sighting('a')] })
    expect(screen.queryByText(/Your field book keeps/)).toBeNull()
  })

  it('lists a backup’s sightings and photos before restoring it', async () => {
    const user = renderSettings(garden)
    const backup = {
      format: 'the-butterfly-garden',
      garden: {
        ...garden,
        sightings: [
          sighting('a', { photo: { mimeType: 'image/webp', imageData: btoa('RIFF') } as unknown as Blob }),
          sighting('b'),
        ],
      },
    }
    await user.click(screen.getByRole('button', { name: /restore from a backup/i }))
    await user.upload(
      screen.getByLabelText('Backup file'),
      new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }),
    )
    expect(await screen.findByText('2 sightings in the field book, with 1 photo')).toBeInTheDocument()
  })
})

describe('a backup of a field book with photos', () => {
  const garden = createInitialState('Tester', 'Wild Garden')
  const withPhotos = { ...garden, sightings: [sighting('a', { photo: photo(1000) })] }

  /** A browser download, watched: what was saved, if anything. */
  function stubDownload() {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:garden'), revokeObjectURL: vi.fn() })
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  }

  function stubShareSheet() {
    const sheet = { canShare: vi.fn(() => true), share: vi.fn(() => Promise.resolve()) }
    Object.defineProperty(navigator, 'canShare', { value: sheet.canShare, configurable: true })
    Object.defineProperty(navigator, 'share', { value: sheet.share, configurable: true })
    return sheet
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'canShare')
    Reflect.deleteProperty(navigator, 'share')
    Reflect.deleteProperty(navigator, 'userActivation')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('says so when the backup cannot be made, for a download or a share, rather than nothing', async () => {
    const sheet = stubShareSheet()
    const click = stubDownload()
    const failing = vi.fn(() => Promise.reject(new DOMException('gone', 'NotReadableError')))
    const user = renderSettings(withPhotos, failing)
    await user.click(screen.getByRole('button', { name: /download a backup/i }))
    expect(await screen.findByText(/Your backup could not be made just now, so nothing was saved/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Share backup…' }))
    await waitFor(() => expect(failing).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/Your backup could not be made just now/)).toBeInTheDocument()
    expect(click).not.toHaveBeenCalled()
    expect(sheet.share).not.toHaveBeenCalled()
  })

  it('says which photos the file had to leave out', async () => {
    stubDownload()
    const leftOut = 'One photo in the field book could not be read on this device, so the file keeps its sighting without it.'
    const user = renderSettings(withPhotos, vi.fn(() => Promise.resolve({ text: '{}', leftOut })))
    await user.click(screen.getByRole('button', { name: /download a backup/i }))
    expect(
      await screen.findByText(`Backup started. Check your downloads and keep the file somewhere safe. ${leftOut}`),
    ).toBeInTheDocument()
  })

  it('holds the buttons while the photos are written out, so a second tap makes no second backup', async () => {
    stubShareSheet()
    stubDownload()
    let finish: (copy: FileCopy) => void = () => undefined
    const exportGarden = vi.fn(() => new Promise<FileCopy>((resolve) => (finish = resolve)))
    const user = renderSettings(withPhotos, exportGarden)
    const download = screen.getByRole('button', { name: /download a backup/i })
    await user.click(download)
    expect(screen.getByText('Getting your backup ready, photos and all…')).toBeInTheDocument()
    expect(download).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Share backup…' })).toHaveAttribute('aria-disabled', 'true')
    // Held, not disabled: the button keeps the focus it was given.
    expect(download).toHaveFocus()
    await user.click(download)
    await user.click(screen.getByRole('button', { name: 'Share backup…' }))
    expect(exportGarden).toHaveBeenCalledOnce()
    finish({ text: '{}' })
    expect(await screen.findByText(/^Backup started/)).toBeInTheDocument()
    expect(download).not.toHaveAttribute('aria-disabled')
  })

  it('leaves no "getting it ready" behind when the share sheet is closed', async () => {
    const sheet = stubShareSheet()
    sheet.share.mockImplementation(() => Promise.reject(new DOMException('Closed', 'AbortError')))
    const user = renderSettings(withPhotos)
    await user.click(screen.getByRole('button', { name: 'Share backup…' }))
    await waitFor(() => expect(sheet.share).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(screen.queryByText('Getting your backup ready, photos and all…')).toBeNull(),
    )
  })

  it('downloads instead of sharing once the tap that allowed a share has passed, and says so', async () => {
    const sheet = stubShareSheet()
    const click = stubDownload()
    Object.defineProperty(navigator, 'userActivation', {
      value: { isActive: false, hasBeenActive: true },
      configurable: true,
    })
    const user = renderSettings(withPhotos)
    await user.click(screen.getByRole('button', { name: 'Share backup…' }))
    expect(
      await screen.findByText(
        'Getting your backup ready took a while, so it was downloaded rather than shared. Check your downloads and keep the file somewhere safe.',
      ),
    ).toBeInTheDocument()
    expect(click).toHaveBeenCalledOnce()
    expect(sheet.share).not.toHaveBeenCalled()
  })
})
