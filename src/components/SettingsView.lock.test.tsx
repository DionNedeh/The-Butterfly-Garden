import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { LockState } from '../repository/gardenRepository'
import { SettingsView } from './SettingsView'

const lock = vi.hoisted((): { state: LockState } => ({ state: 'none' }))
vi.mock('../hooks/useLockState', () => ({ useLockState: () => lock.state }))

function renderSettings() {
  render(
    <SettingsView
      state={createInitialState('Tester', 'Test Garden')}
      persistence={{ readOnly: false }}
      onUpdateProfile={vi.fn()}
      onSelectAmbientTrack={vi.fn()}
      onSelectBackdrop={vi.fn()}
      onExportGarden={vi.fn(() => ({ text: '{}' }))}
      onImportGarden={vi.fn(() => Promise.resolve({ ok: true, message: '' }))}
      onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
    />,
  )
}

afterEach(() => {
  cleanup()
  lock.state = 'none'
})

describe('Settings: the garden lock', () => {
  it('lives in the privacy card, small print and all', () => {
    renderSettings()
    const privacy = within(screen.getByRole('region', { name: 'This garden stays on this device' }))
    expect(privacy.getByRole('region', { name: 'The garden lock' })).toBeInTheDocument()
    expect(privacy.getByRole('button', { name: 'Lock my garden…' })).toBeInTheDocument()
    expect(
      privacy.getByText(/It can’t protect the garden while it is open, from someone using the device then, or from other code running at the same web address as the garden\./),
    ).toBeInTheDocument()
  })

  it('says beside the backup button, while the lock is on, that a backup is not locked', () => {
    renderSettings()
    const note = 'This copy is not locked; keep it somewhere private, or use a protected backup.'
    expect(screen.queryByText(note)).toBeNull()
    cleanup()
    lock.state = 'unlocked'
    renderSettings()
    const backup = within(screen.getByRole('region', { name: 'Backup and restore' }))
    expect(backup.getByText(note)).toBeInTheDocument()
  })
})
