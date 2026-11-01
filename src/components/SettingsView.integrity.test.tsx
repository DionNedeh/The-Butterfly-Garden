import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { backupCopy } from '../lib/backupIntegrity'
import { createInitialState } from '../lib/progression'
import { storedVersionOf } from '../repository/validateGarden'
import { SettingsView } from './SettingsView'

/*
 * A plain backup carries a check of its garden (lib/backupIntegrity). The
 * restore's preview says whether the file is as it was saved, and warns of
 * one changed since, by hand or by damage: never a reason to refuse it.
 */

function renderSettings() {
  const onImportGarden = vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))
  render(
    <SettingsView
      state={createInitialState('Tester', 'Here Now')}
      persistence={{ readOnly: false }}
      onUpdateProfile={vi.fn()}
      onSelectAmbientTrack={vi.fn()}
      onSelectBackdrop={vi.fn()}
      onExportGarden={vi.fn(() => undefined)}
      onImportGarden={onImportGarden}
      onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
    />,
  )
  return { onImportGarden, user: userEvent.setup() }
}

async function madeHere(): Promise<string> {
  return (
    await backupCopy({
      format: 'the-butterfly-garden',
      exportedAt: '2026-11-01T10:00:00.000Z',
      appVersion: '3.7.0',
      revision: 4,
      garden: { ...createInitialState('Tester', 'From The File'), version: storedVersionOf() },
    })
  ).text
}

async function choose(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('button', { name: /restore from a backup/i }))
  await user.upload(
    screen.getByLabelText('Backup file'),
    new File([text], 'backup.json', { type: 'application/json' }),
  )
  return screen.findByRole('heading', { name: /this backup holds/i })
}

describe('4.3 the restore preview and a backup’s own check', () => {
  it('says a backup is unchanged since it was saved', async () => {
    const { user } = renderSettings()
    await choose(user, await madeHere())
    expect(screen.getByText('Unchanged since it was saved')).toBeInTheDocument()
    expect(screen.queryByText(/Changed since it was saved/)).toBeNull()
  })

  it('warns of a file changed since it was saved, and still restores it', async () => {
    const { onImportGarden, user } = renderSettings()
    const edited = (await madeHere()).replace('From The File', 'From The Filf')
    expect(await choose(user, edited)).toHaveTextContent('This backup holds From The Filf')
    expect(
      screen.getByText(
        'Changed since it was saved, by hand or by damage. It can still be restored: look over what it holds first.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Unchanged since it was saved')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Restore this backup' }))
    await waitFor(() => expect(onImportGarden).toHaveBeenCalledOnce())
    expect(await screen.findByText('Restored.')).toBeInTheDocument()
  })

  it('says nothing of a check an older backup does not have', async () => {
    const { user } = renderSettings()
    const older = JSON.stringify({
      format: 'the-butterfly-garden',
      exportedAt: '2026-10-01T10:00:00.000Z',
      appVersion: '3.6.0',
      garden: createInitialState('Tester', 'From The File'),
    })
    await choose(user, older)
    expect(screen.getByText(/by version 3\.6\.0/)).toBeInTheDocument()
    expect(screen.queryByText(/since it was saved/)).toBeNull()
  })
})
