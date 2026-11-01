import { Blob as NodeBlob } from 'node:buffer'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGardenState } from '../hooks/useGardenState'
import { MAX_SIGHTING_PHOTOS } from '../lib/customBackdrops'
import { verifyGardenImages } from '../lib/imageImport'
import { createInitialState } from '../lib/progression'
import { gardenRepository } from '../repository/gardenRepository'
import { storedVersionOf } from '../repository/validateGarden'
import { ArrayBufferFileReader } from '../test/fileReader'
import { SettingsView } from './SettingsView'

/*
 * A backup's photos are written as base64 and turned back into Blobs as the
 * file is read (validateGarden). Settings reads the file to show what it
 * holds, and the restore then takes that reading, rather than read every
 * photo again: on a slow phone a full field book would freeze it twice.
 */

// The pictures' own check (createImageBitmap) is not jsdom's to make.
vi.mock('../lib/imageImport', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  verifyGardenImages: vi.fn(),
}))

beforeEach(async () => {
  // A Blob fake-indexeddb can store, as a browser's can.
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('FileReader', ArrayBufferFileReader)
  vi.mocked(verifyGardenImages).mockClear()
  await gardenRepository.clear().catch(() => undefined)
  await gardenRepository.save(createInitialState('Tester', 'Here Now'))
})
afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await gardenRepository.clear().catch(() => undefined)
})

/** Settings over the garden as the app holds it, restoring through it. */
function Harness() {
  const garden = useGardenState()
  if (garden.loading || !garden.state) return null
  return (
    <SettingsView
      state={garden.state}
      persistence={garden.persistence}
      onUpdateProfile={garden.updateProfile}
      onSelectAmbientTrack={garden.selectAmbientTrack}
      onSelectBackdrop={garden.selectBackdrop}
      onExportGarden={garden.exportGarden}
      onImportGarden={garden.importGarden}
      onDeleteAll={garden.deleteAll}
    />
  )
}

/** A field book of `count` sightings, each with a photo of its own. */
function fieldBook(count: number): { text: string; photos: string[] } {
  const photos = Array.from({ length: count }, (_, index) =>
    btoa(String.fromCharCode(82, 73, 70, 70, index, 8, 7, 6, 5)),
  )
  const garden = {
    ...createInitialState('Tester', 'Field Book'),
    version: storedVersionOf(),
    sightings: photos.map((imageData, index) => ({
      id: `sighting-${index}`,
      date: '2026-10-20',
      kind: 'butterfly',
      speciesId: 'monarch',
      createdAt: '2026-10-20T09:00:00.000Z',
      photo: { mimeType: 'image/webp', imageData },
    })),
  }
  return {
    text: JSON.stringify({
      format: 'the-butterfly-garden',
      exportedAt: '2026-10-30T10:00:00.000Z',
      appVersion: '3.6.0',
      garden,
    }),
    photos,
  }
}

describe('4.5 restoring a field book full of photos', () => {
  it('decodes each photo once, for the preview, and restores every one', { timeout: 20_000 }, async () => {
    const { text, photos } = fieldBook(MAX_SIGHTING_PHOTOS)
    expect(photos).toHaveLength(50)
    render(<Harness />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /restore from a backup/i }))
    const decode = vi.spyOn(globalThis, 'atob')
    await user.upload(
      screen.getByLabelText('Backup file'),
      new File([text], 'backup.json', { type: 'application/json' }),
    )
    expect(await screen.findByRole('heading', { name: 'This backup holds Field Book' })).toBeInTheDocument()
    expect(screen.getByText(/50 sightings in the field book, with 50 photos/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restore this backup' }))
    expect(await screen.findByText('Your garden was restored from the backup.')).toBeInTheDocument()

    const decoded = new Map<string, number>()
    for (const [value] of decode.mock.calls) decoded.set(value, (decoded.get(value) ?? 0) + 1)
    expect(photos.map((photo) => decoded.get(photo) ?? 0)).toEqual(photos.map(() => 1))
    // The pictures are still checked before anything is replaced.
    expect(verifyGardenImages).toHaveBeenCalledOnce()
    await waitFor(async () => {
      const stored = (await gardenRepository.load()).state
      expect(stored.profile?.gardenName).toBe('Field Book')
      expect(stored.sightings.filter((sighting) => sighting.photo instanceof NodeBlob)).toHaveLength(50)
    })
  })

  it('still reads the text itself when no preview came first', async () => {
    const { text, photos } = fieldBook(2)
    const decode = vi.spyOn(globalThis, 'atob')
    const { result } = renderHook(() => useGardenState())
    await waitFor(() => expect(result.current.loading).toBe(false))
    let outcome: { ok: boolean } | undefined
    await act(async () => {
      outcome = await result.current.importGarden(text)
    })
    expect(outcome).toMatchObject({ ok: true })
    expect(decode.mock.calls.filter(([value]) => photos.includes(value))).toHaveLength(2)
  })
})
