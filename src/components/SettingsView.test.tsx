import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { createInitialState } from '../lib/progression'
import { SettingsView } from './SettingsView'

function renderSettings(
  persistence: PersistenceStatus = { readOnly: false },
  overrides: Record<string, unknown> = {},
) {
  const handlers = {
    onUpdateProfile: vi.fn(),
    onSelectAmbientTrack: vi.fn(),
    onSelectBackdrop: vi.fn(),
    onExportGarden: vi.fn(() => '{"format":"the-butterfly-garden"}'),
    onImportGarden: vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' })),
    onDeleteAll: vi.fn(() => Promise.resolve({ ok: true })),
    ...overrides,
  }
  render(
    <SettingsView
      state={createInitialState('Tester', 'Test Garden')}
      persistence={persistence}
      {...handlers}
    />,
  )
  return handlers
}

describe('SettingsView data management', () => {
  it('offers a backup and hands the file straight to the device', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:garden')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    // Watched, not replaced: the clock keeps running so user-event still works.
    const scheduleSpy = vi.spyOn(window, 'setTimeout')

    const { onExportGarden } = renderSettings()
    await user.click(screen.getByRole('button', { name: /download a backup/i }))

    expect(onExportGarden).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(screen.getByText(/backup started/i)).toBeInTheDocument()

    // The blob URL has to outlive the click. Revoking it in the same tick can
    // cancel the download before the browser has read it, and the click itself
    // never reports that failure -- the gardener would be told their only copy
    // was saved when nothing was written.
    expect(revokeObjectURL).not.toHaveBeenCalled()

    // It is released later, so nothing leaks. Nothing is uploaded either: the
    // only URL this creates is a local blob.
    const release = scheduleSpy.mock.calls.find(
      ([, delay]) => delay === 60_000,
    )?.[0] as (() => void) | undefined
    expect(release).toBeTypeOf('function')
    release?.()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:garden')

    scheduleSpy.mockRestore()
    click.mockRestore()
    vi.unstubAllGlobals()
  })

  it('warns that restoring replaces the current garden before taking a file', async () => {
    const user = userEvent.setup()
    renderSettings()

    expect(screen.queryByLabelText('Backup file')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /restore from a backup/i }))
    expect(
      screen.getByText(/restoring replaces everything currently in this browser/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Backup file')).toBeInTheDocument()
  })

  it('explains why saving is paused when the stored garden could not be read', () => {
    renderSettings({ readOnly: true, reason: 'incompatible' })
    expect(
      screen.getByText(/saving is paused because the stored garden could not be read/i),
    ).toBeInTheDocument()
  })

  it('surfaces a failed deletion instead of pretending it worked', async () => {
    const user = userEvent.setup()
    renderSettings(
      { readOnly: false },
      {
        onDeleteAll: vi.fn(() =>
          Promise.resolve({
            ok: false,
            message: 'Another open tab of the garden is holding your data.',
          }),
        ),
      },
    )

    await user.click(screen.getByRole('button', { name: /begin deletion/i }))
    await user.click(screen.getByRole('button', { name: /yes, delete everything/i }))

    expect(
      await screen.findByText(/another open tab of the garden is holding your data/i),
    ).toBeInTheDocument()
  })
})
