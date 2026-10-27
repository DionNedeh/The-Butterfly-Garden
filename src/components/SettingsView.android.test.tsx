import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'

vi.mock('../lib/native', () => ({ saveTextDocument: vi.fn() }))

/**
 * SettingsView as the Android app renders it. Loaded fresh after the platform
 * is set, because what the restore picker accepts is decided at load time.
 */
async function renderAndroidSettings(
  state = createInitialState('Tester', 'Test Garden'),
  extra: {
    onChooseTheme?: () => void
    onSetTextSize?: () => void
    onSetSoundInBackground?: () => void
  } = {},
) {
  vi.stubEnv('VITE_PLATFORM', 'android')
  vi.resetModules()
  const { SettingsView } = await import('./SettingsView')
  const native = await import('../lib/native')
  const onExportGarden = vi.fn(() => ({ text: '{"format":"the-butterfly-garden"}' }))
  const onBackupMade = vi.fn()
  render(
    <SettingsView
      state={state}
      persistence={{ readOnly: false }}
      onUpdateProfile={vi.fn()}
      onSelectAmbientTrack={vi.fn()}
      onSelectBackdrop={vi.fn()}
      onExportGarden={onExportGarden}
      onBackupMade={onBackupMade}
      onImportGarden={vi.fn(() =>
        Promise.resolve({ ok: true, message: 'Restored.' }),
      )}
      onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
      {...extra}
    />,
  )
  return { save: vi.mocked(native.saveTextDocument), onExportGarden, onBackupMade }
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
    const { save, onExportGarden, onBackupMade } = await renderAndroidSettings()
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
    expect(onBackupMade).toHaveBeenCalledOnce()
  })

  it('says nothing was saved when the gardener backs out', async () => {
    const user = userEvent.setup()
    const { save, onBackupMade } = await renderAndroidSettings()
    save.mockResolvedValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'Save a backup' }))
    expect(await screen.findByText('No backup was saved.')).toBeInTheDocument()
    expect(onBackupMade).not.toHaveBeenCalled()
  })

  it('suggests a copy as the browser does, but leaves sharing to the save screen', async () => {
    // Even where the WebView would answer yes: Android's own "Save to…"
    // screen already reaches every app a share sheet would.
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    try {
      const old = createInitialState('Tester', 'Test Garden', new Date(Date.now() - 60 * 86_400_000))
      await renderAndroidSettings(old)
      expect(screen.getByText(/You have not saved a copy yet\./)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /share backup/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/handed to an app/)).not.toBeInTheDocument()
    } finally {
      Reflect.deleteProperty(navigator, 'canShare')
      Reflect.deleteProperty(navigator, 'share')
    }
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

  it('speaks of the phone when following its dark setting, and of its own text size', async () => {
    await renderAndroidSettings(undefined, { onChooseTheme: vi.fn(), onSetTextSize: vi.fn() })
    expect(screen.getByText('Night whenever this phone is set to dark.')).toBeInTheDocument()
    expect(
      screen.getByText('Your phone’s own text size applies as well, so the two add up.'),
    ).toBeInTheDocument()
  })

  it('says the sound rests in the background, rather than offering to keep it playing', async () => {
    await renderAndroidSettings(undefined, { onSetSoundInBackground: vi.fn() })
    expect(
      screen.getByText(/The sound rests while the app is in the background/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('checkbox', { name: /^Keep playing when the app is in the background/ }),
    ).not.toBeInTheDocument()
  })

  it('saves a protected backup through the app’s own save screen, and says plainly what happened', async () => {
    const user = userEvent.setup()
    const { save, onExportGarden, onBackupMade } = await renderAndroidSettings()
    expect(screen.queryByRole('button', { name: /^Download a protected/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save a protected backup…' }))
    await screen.findByRole('dialog', { name: 'Save a protected backup' })
    await user.type(screen.getByLabelText('Passphrase'), 'quiet meadow lantern')
    await user.type(screen.getByLabelText('Passphrase again'), 'quiet meadow lantern')
    await user.click(screen.getByRole('button', { name: 'Lock the backup' }))
    const button = await screen.findByRole('button', { name: 'Save protected backup' }, { timeout: 10_000 })

    // Backing out of the save screen saves nothing, and says so.
    save.mockResolvedValueOnce(false)
    await user.click(button)
    expect(await screen.findByText('Nothing was saved. Choose Save again to pick a place.')).toBeInTheDocument()
    expect(onBackupMade).not.toHaveBeenCalled()

    save.mockResolvedValueOnce(true)
    await user.click(button)
    expect(
      await screen.findByText('Protected backup saved. Keep its passphrase somewhere safe, apart from the file.'),
    ).toBeInTheDocument()
    expect(onExportGarden).toHaveBeenCalledOnce()
    const [fileName, mimeType, text] = save.mock.lastCall!
    expect(fileName).toMatch(/^butterfly-garden-protected-\d{4}-\d{2}-\d{2}\.json$/)
    expect(mimeType).toBe('application/json')
    const { sealedKind } = await import('../lib/backupFile')
    expect(sealedKind(text)).toBe('backup')
    // Written at the full count: nothing in the app asks for fewer.
    expect((JSON.parse(text) as { kdf: { iterations: number } }).kdf.iterations).toBe(600_000)
    expect(onBackupMade).toHaveBeenCalledOnce()
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
