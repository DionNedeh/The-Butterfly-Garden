import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { AppState, Sighting } from '../types'
import { SettingsView } from './SettingsView'

function renderSettings(state: AppState) {
  render(
    <SettingsView
      state={state}
      persistence={{ readOnly: false }}
      onUpdateProfile={vi.fn()}
      onSelectAmbientTrack={vi.fn()}
      onSelectBackdrop={vi.fn()}
      onExportGarden={vi.fn(() => Promise.resolve('{}'))}
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
