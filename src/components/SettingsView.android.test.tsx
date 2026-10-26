import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'

vi.mock('../lib/native', () => ({ saveTextDocument: vi.fn() }))

/**
 * SettingsView as the Android app renders it. Loaded fresh after the platform
 * is set, because what the restore picker accepts is decided at load time.
 */
async function renderAndroidSettings() {
  vi.stubEnv('VITE_PLATFORM', 'android')
  vi.resetModules()
  const { SettingsView } = await import('./SettingsView')
  const native = await import('../lib/native')
  const onExportGarden = vi.fn(() => '{"format":"the-butterfly-garden"}')
  render(
    <SettingsView
      state={createInitialState('Tester', 'Test Garden')}
      persistence={{ readOnly: false }}
      onUpdateProfile={vi.fn()}
      onSelectAmbientTrack={vi.fn()}
      onSelectBackdrop={vi.fn()}
      onExportGarden={onExportGarden}
      onImportGarden={vi.fn(() =>
        Promise.resolve({ ok: true, message: 'Restored.' }),
      )}
      onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
    />,
  )
  return { save: vi.mocked(native.saveTextDocument), onExportGarden }
}

describe('SettingsView in the Android app', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('saves a backup where the gardener chooses and says so plainly', async () => {
    const user = userEvent.setup()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const { save, onExportGarden } = await renderAndroidSettings()
    save.mockResolvedValueOnce(true)

    await user.click(screen.getByRole('button', { name: 'Save a backup' }))

    expect(onExportGarden).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith(
      expect.stringMatching(/^butterfly-garden-\d{4}-\d{2}-\d{2}\.json$/),
      'application/json',
      '{"format":"the-butterfly-garden"}',
    )
    expect(await screen.findByText(/backup saved/i)).toBeInTheDocument()
    // Android's WebView ignores download links; none is used.
    expect(click).not.toHaveBeenCalled()
  })

  it('says nothing was saved when the gardener backs out', async () => {
    const user = userEvent.setup()
    const { save } = await renderAndroidSettings()
    save.mockResolvedValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Save a backup' }))
    expect(await screen.findByText('No backup was saved.')).toBeInTheDocument()
  })

  it('says so when the chosen place could not be written', async () => {
    const user = userEvent.setup()
    const { save } = await renderAndroidSettings()
    save.mockRejectedValueOnce(new Error('disk full'))
    await user.click(screen.getByRole('button', { name: 'Save a backup' }))
    expect(
      await screen.findByText(/could not be saved there/i),
    ).toBeInTheDocument()
  })

  it('lets the restore picker see backups however a storage app labels them', async () => {
    const user = userEvent.setup()
    await renderAndroidSettings()
    await user.click(
      screen.getByRole('button', { name: 'Restore from a backup' }),
    )
    expect(
      screen.getByText('Restoring replaces everything currently in this app.'),
    ).toBeInTheDocument()
    const accept = screen.getByLabelText('Backup file').getAttribute('accept')
    expect(accept?.split(',')).toEqual([
      'application/json',
      '.json',
      'text/plain',
      'application/octet-stream',
    ])
  })
})
