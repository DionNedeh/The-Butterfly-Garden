import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyState, createInitialState } from '../lib/progression'
import { gardenRepository } from '../repository/gardenRepository'
import App from '../App'
import { ErrorBoundary } from './ErrorBoundary'
import { SafeMode } from './SafeMode'
import { SettingsView } from './SettingsView'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => undefined],
    updateServiceWorker: () => Promise.resolve(),
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('a garden that could not be read', () => {
  it('is never greeted as a new gardener', async () => {
    // The audit's D4: an unreadable garden used to show onboarding, asking
    // someone with years of entries to name a brand-new garden.
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'withheld',
      state: createEmptyState(),
      reason: 'malformed',
    })
    render(<App />)
    expect(
      await screen.findByRole(
        'heading',
        { name: /your saved garden could not be opened/i },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/welcome to your butterfly garden/i)).toBeNull()
    expect(
      screen.getByRole('button', { name: /download the set-aside copy/i }),
    ).toBeInTheDocument()
  })

  it('offers to try again, not to start over, when storage would not open', async () => {
    vi.spyOn(gardenRepository, 'load').mockResolvedValue({
      status: 'withheld',
      state: createEmptyState(),
      reason: 'unavailable',
    })
    render(<App />)
    expect(
      await screen.findByRole('button', { name: /try again/i }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/start a new garden/i)).toBeNull()
  })
})

describe('when something fails to draw', () => {
  function Broken(): never {
    throw new Error('A damaged entry')
  }

  it('shows safe mode with a way to keep a copy, instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary fallback={(error) => <SafeMode error={error} />}>
        <Broken />
      </ErrorBoundary>,
    )
    expect(
      screen.getByRole('heading', { name: /could not draw/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /download what's stored/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('A damaged entry')).toBeInTheDocument()
  })

  it('gives a page a fresh chance when the gardener moves on', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let fail = true
    function Maybe() {
      if (fail) throw new Error('once')
      return <p>Recovered</p>
    }
    const { rerender } = render(
      <ErrorBoundary resetKey="journal" fallback={() => <p>Problem</p>}>
        <Maybe />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Problem')).toBeInTheDocument()
    fail = false
    rerender(
      <ErrorBoundary resetKey="garden" fallback={() => <p>Problem</p>}>
        <Maybe />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })
})

describe('restoring from Settings', () => {
  function renderSettings(overrides: Record<string, unknown> = {}) {
    const handlers = {
      onUpdateProfile: vi.fn(),
      onSelectAmbientTrack: vi.fn(),
      onSelectBackdrop: vi.fn(),
      onExportGarden: vi.fn(() => ({ text: '{"format":"the-butterfly-garden"}' })),
      onImportGarden: vi.fn(() =>
        Promise.resolve({ ok: true, message: 'Your garden was restored.' }),
      ),
      onDeleteAll: vi.fn(() => Promise.resolve({ ok: true })),
      ...overrides,
    }
    render(
      <SettingsView
        state={createInitialState('Tester', 'Here Now')}
        persistence={{ readOnly: false }}
        {...handlers}
      />,
    )
    return handlers
  }

  it('shows what a backup holds before replacing anything', async () => {
    const user = userEvent.setup()
    const { onImportGarden } = renderSettings()
    const backup = createInitialState('Tester', 'From The File')
    backup.moods = [
      {
        id: 'm1',
        localDate: '2026-03-02',
        level: 4,
        note: 'Spring',
        createdAt: '',
        updatedAt: '',
      },
    ]
    const file = new File(
      [
        JSON.stringify({
          format: 'the-butterfly-garden',
          exportedAt: '2026-10-01T10:00:00.000Z',
          appVersion: '3.0.0',
          garden: backup,
        }),
      ],
      'backup.json',
      { type: 'application/json' },
    )

    await user.click(screen.getByRole('button', { name: /restore from a backup/i }))
    await user.upload(screen.getByLabelText('Backup file'), file)

    expect(
      await screen.findByRole('heading', { name: /this backup holds from the file/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 check-in,/)).toBeInTheDocument()
    expect(onImportGarden).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /restore this backup/i }))
    await waitFor(() => expect(onImportGarden).toHaveBeenCalledOnce())
  })

  it('names the problem with a backup it will not restore', async () => {
    const user = userEvent.setup()
    const { onImportGarden } = renderSettings()
    const file = new File(['{"garden": {"version": 99}}'], 'backup.json', {
      type: 'application/json',
    })
    await user.click(screen.getByRole('button', { name: /restore from a backup/i }))
    await user.upload(screen.getByLabelText('Backup file'), file)
    expect(await screen.findByText(/newer version/i)).toBeInTheDocument()
    expect(onImportGarden).not.toHaveBeenCalled()
  })

  it('does not offer a backup of a garden it could not read', () => {
    render(
      <SettingsView
        state={createEmptyState()}
        persistence={{ readOnly: true, reason: 'malformed' }}
        onUpdateProfile={vi.fn()}
        onSelectAmbientTrack={vi.fn()}
        onSelectBackdrop={vi.fn()}
        onExportGarden={() => undefined}
        onImportGarden={vi.fn()}
        onDownloadSetAside={vi.fn(() => Promise.resolve({ text: '{}' }))}
        onDeleteAll={vi.fn()}
      />,
    )
    expect(
      screen.getByRole('button', { name: /download a backup/i }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /download the set-aside copy/i }),
    ).toBeInTheDocument()
  })
})
