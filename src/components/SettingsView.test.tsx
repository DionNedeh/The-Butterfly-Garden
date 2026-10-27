import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { recordBackup } from '../lib/gardenActions'
import { createInitialState } from '../lib/progression'
import type { AppState } from '../types'
import { SettingsView } from './SettingsView'

function renderSettings<Extra extends Record<string, unknown>>(
  persistence: PersistenceStatus = { readOnly: false },
  overrides: Extra = {} as Extra,
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

describe('SettingsView garden motion', () => {
  it('offers full, calm and reduced motion, and saves the choice', async () => {
    const user = userEvent.setup()
    const { onUpdateProfile } = renderSettings()
    const group = screen.getByRole('group', { name: 'Garden motion' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /full garden motion/i })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: /calm garden motion/i }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(onUpdateProfile).toHaveBeenLastCalledWith('Tester', 'Test Garden', 'calm')

    await user.click(screen.getByRole('radio', { name: /reduce garden motion/i }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(onUpdateProfile).toHaveBeenLastCalledWith('Tester', 'Test Garden', 'reduce')
  })
})

describe('SettingsView theme and text size', () => {
  /** A garden with these profile choices. */
  function gardenWith(profile: Partial<NonNullable<AppState['profile']>>): AppState {
    const seed = createInitialState('Tester', 'Test Garden')
    return { ...seed, profile: { ...seed.profile!, ...profile } }
  }

  it('offers four themes, each named by its visible label, and chooses one at once', async () => {
    const user = userEvent.setup()
    const { onChooseTheme } = renderSettings(undefined, { onChooseTheme: vi.fn() })
    const group = screen.getByRole('group', { name: 'Theme' })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual([
      'sunlight',
      'night',
      'device',
      'evening',
    ])
    expect(within(group).getByRole('radio', { name: /^Sunlight/ })).toBeChecked()
    expect(within(group).getByRole('radio', { name: /^Night/ })).not.toBeChecked()

    await user.click(within(group).getByRole('radio', { name: /^Follow device/ }))
    expect(onChooseTheme).toHaveBeenLastCalledWith('device')
    await user.click(within(group).getByRole('radio', { name: /^Follow evening/ }))
    expect(onChooseTheme).toHaveBeenLastCalledWith('evening')
    await user.click(within(group).getByRole('radio', { name: /^Night/ }))
    expect(onChooseTheme).toHaveBeenLastCalledWith('night')
  })

  it('shows what the garden follows, and when a followed evening is night', () => {
    renderSettings(undefined, {
      onChooseTheme: vi.fn(),
      state: gardenWith({ theme: 'night', themeFollows: 'evening', recapOpensHour: 21 }),
    })
    const group = screen.getByRole('group', { name: 'Theme' })
    expect(within(group).getByRole('radio', { name: /^Follow evening/ })).toBeChecked()
    // The hand-chosen night waits underneath, but is not what is chosen now.
    expect(within(group).getByRole('radio', { name: /^Night/ })).not.toBeChecked()
    expect(
      within(group).getByText(/^Night from 9\sPM, when your evening starts, until 6\sAM\.$/),
    ).toBeInTheDocument()
    expect(within(group).getByText('Night whenever this device is set to dark.')).toBeInTheDocument()
  })

  it('offers three text sizes, each shown at its own size, and sets one at once', async () => {
    const user = userEvent.setup()
    const { onSetTextSize } = renderSettings(undefined, {
      onSetTextSize: vi.fn(),
      state: gardenWith({ textSize: 'larger' }),
    })
    const group = screen.getByRole('group', { name: 'Text size' })
    expect(within(group).getAllByRole('radio')).toHaveLength(3)
    expect(within(group).getByRole('radio', { name: /^Larger/ })).toBeChecked()
    expect(within(group).getByText('Largest').style.fontSize).toBe('1.25em')

    await user.click(within(group).getByRole('radio', { name: /^Largest/ }))
    expect(onSetTextSize).toHaveBeenLastCalledWith('largest')
    // Comfortable is the usual size, which stores nothing.
    await user.click(within(group).getByRole('radio', { name: /^Comfortable/ }))
    expect(onSetTextSize).toHaveBeenLastCalledWith(undefined)
  })

  it('starts at Comfortable', () => {
    renderSettings(undefined, { onSetTextSize: vi.fn() })
    expect(screen.getByRole('radio', { name: /^Comfortable/ })).toBeChecked()
    // The phone's own text size is the Android app's to mention.
    expect(screen.queryByText(/own text size/)).not.toBeInTheDocument()
    // Only the text size was offered here, so there is no theme group.
    expect(screen.queryByRole('group', { name: 'Theme' })).not.toBeInTheDocument()
  })

  it('has no card for the look when neither can be changed', () => {
    renderSettings()
    expect(screen.queryByRole('region', { name: 'How the garden looks' })).not.toBeInTheDocument()
  })
})

describe('SettingsView rhythm, sound and support', () => {
  it('hides and shows day counts at once', async () => {
    const user = userEvent.setup()
    const { onSetDayCountsHidden } = renderSettings(undefined, { onSetDayCountsHidden: vi.fn() })
    const toggle = screen.getByRole('checkbox', { name: /show day counts/i })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(onSetDayCountsHidden).toHaveBeenCalledWith(true)
  })

  it('chooses a fade-out, says it is not a sleep aid, and when the sound will fade', async () => {
    const user = userEvent.setup()
    const { onChooseFadeOut } = renderSettings(undefined, { onChooseFadeOut: vi.fn() })
    expect(screen.getByText(/It is not a sleep aid/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Fade out after'), '30')
    expect(onChooseFadeOut).toHaveBeenLastCalledWith(30)
    await user.selectOptions(screen.getByLabelText('Fade out after'), '')
    expect(onChooseFadeOut).toHaveBeenLastCalledWith(undefined)
  })

  it('says when a running fade ends, or that it waits for the sound', () => {
    renderSettings(undefined, {
      onChooseFadeOut: vi.fn(),
      fadeOutMinutes: 15,
      fadeOutEndsAt: new Date(2026, 9, 26, 22, 45).getTime(),
    })
    expect(screen.getByText(/The sound fades away at/)).toBeInTheDocument()
  })

  it('opens the support page from About', async () => {
    const onOpenSupport = vi.fn()
    renderSettings(undefined, { onOpenSupport })
    await userEvent.setup().click(screen.getByRole('button', { name: 'If you need support now' }))
    expect(onOpenSupport).toHaveBeenCalledOnce()
  })
})

describe('SettingsView evening hours', () => {
  /** A garden whose gardener chose their own hours. */
  function gardenWithHours(recapOpensHour: number, recapGraceEndsHour: number) {
    const seed = createInitialState('Tester', 'Test Garden')
    return { ...seed, profile: { ...seed.profile!, recapOpensHour, recapGraceEndsHour } }
  }

  it('starts the evening at 6pm and ends a late night at 4am until they are chosen', () => {
    renderSettings(undefined, { onSetRecapHours: vi.fn() })
    expect(screen.getByLabelText('My evening starts at')).toHaveValue('18')
    expect(screen.getByLabelText('My evening starts at')).toHaveDisplayValue(/^6\sPM$/)
    expect(screen.getByLabelText('A late night lasts until')).toHaveValue('4')
    expect(screen.getByLabelText('A late night lasts until')).toHaveDisplayValue(/^4\sAM$/)
  })

  it('shows the hours the gardener chose', () => {
    renderSettings(undefined, { onSetRecapHours: vi.fn(), state: gardenWithHours(21, 0) })
    expect(screen.getByLabelText('My evening starts at')).toHaveValue('21')
    expect(screen.getByLabelText('A late night lasts until')).toHaveDisplayValue('Midnight')
  })

  it('offers an evening from noon to 11pm, and a late night until midnight to 10am', () => {
    renderSettings(undefined, { onSetRecapHours: vi.fn() })
    const evenings = within(screen.getByLabelText('My evening starts at')).getAllByRole('option')
    expect(evenings.map((option) => (option as HTMLOptionElement).value)).toEqual(
      ['12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'],
    )
    expect(evenings[0]).toHaveTextContent(/^12\sPM$/)
    expect(evenings.at(-1)).toHaveTextContent(/^11\sPM$/)

    const lateNights = within(screen.getByLabelText('A late night lasts until')).getAllByRole('option')
    expect(lateNights.map((option) => (option as HTMLOptionElement).value)).toEqual(
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    )
    expect(lateNights[0]).toHaveTextContent('Midnight')
    expect(lateNights[1]).toHaveTextContent(/^1\sAM$/)
    expect(lateNights.at(-1)).toHaveTextContent(/^10\sAM$/)
  })

  it('saves both hours when either one changes', async () => {
    const user = userEvent.setup()
    const { onSetRecapHours } = renderSettings(undefined, {
      onSetRecapHours: vi.fn(),
      state: gardenWithHours(21, 2),
    })

    await user.selectOptions(screen.getByLabelText('My evening starts at'), '20')
    expect(onSetRecapHours).toHaveBeenLastCalledWith({ opensHour: 20, graceEndsHour: 2 })

    await user.selectOptions(screen.getByLabelText('A late night lasts until'), '0')
    expect(onSetRecapHours).toHaveBeenLastCalledWith({ opensHour: 21, graceEndsHour: 0 })
    expect(onSetRecapHours).toHaveBeenCalledTimes(2)
  })

  it('keeps the rhythm card to what can be set', () => {
    renderSettings(undefined, { onSetRecapHours: vi.fn() })
    expect(screen.getByRole('region', { name: 'Days and numbers' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /show day counts/i })).not.toBeInTheDocument()
  })

  it('leaves the evening hours out when they cannot be changed', () => {
    renderSettings(undefined, { onSetDayCountsHidden: vi.fn() })
    expect(screen.getByRole('region', { name: 'Days and numbers' })).toBeInTheDocument()
    expect(screen.queryByLabelText('My evening starts at')).not.toBeInTheDocument()
  })

  it('has no rhythm card when there is nothing in it to set', () => {
    renderSettings()
    expect(screen.queryByRole('region', { name: 'Days and numbers' })).not.toBeInTheDocument()
    expect(screen.queryByText('Your rhythm')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('My evening starts at')).not.toBeInTheDocument()
  })
})

describe('SettingsView backup habits', () => {
  const DAY = 86_400_000

  /** A garden started `days` ago, with a copy kept `backedUp` days ago if given. */
  function gardenOf(days: number, backedUp?: number): AppState {
    const seed = createInitialState('Tester', 'Test Garden', new Date(Date.now() - days * DAY))
    return backedUp === undefined
      ? seed
      : recordBackup(seed, new Date(Date.now() - backedUp * DAY))
  }

  /** Settings over a garden that really changes when a backup is made. */
  function StatefulSettings({ initial, onBackupMade }: {
    initial: AppState
    onBackupMade: (madeAt: Date) => void
  }) {
    const [state, setState] = useState(initial)
    return (
      <SettingsView
        state={state}
        persistence={{ readOnly: false }}
        onUpdateProfile={vi.fn()}
        onSelectAmbientTrack={vi.fn()}
        onSelectBackdrop={vi.fn()}
        onExportGarden={() => '{"format":"the-butterfly-garden"}'}
        onBackupMade={(madeAt) => {
          onBackupMade(madeAt)
          setState((current) => recordBackup(current, madeAt))
        }}
        onImportGarden={vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))}
        onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
      />
    )
  }

  function stubDownload() {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:garden'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  }

  function stubShareSheet(
    canShare: (data?: ShareData) => boolean,
    share: (data?: ShareData) => Promise<void> = () => Promise.resolve(),
  ) {
    const sheet = { canShare: vi.fn(canShare), share: vi.fn(share) }
    Object.defineProperty(navigator, 'canShare', { value: sheet.canShare, configurable: true })
    Object.defineProperty(navigator, 'share', { value: sheet.share, configurable: true })
    return sheet
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'canShare')
    Reflect.deleteProperty(navigator, 'share')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('says nothing about backups to a garden with a recent copy', () => {
    renderSettings(undefined, { state: gardenOf(90, 3) })
    expect(screen.queryByText(/your last copy/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/not saved a copy/i)).not.toBeInTheDocument()
  })

  it('says nothing to a garden too new to need a copy yet', () => {
    renderSettings()
    expect(screen.queryByText(/not saved a copy/i)).not.toBeInTheDocument()
  })

  it('names the month of the last copy once it is a month old', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 27, 12))
    const seed = createInitialState('Tester', 'Test Garden', new Date(2026, 0, 5))
    renderSettings(undefined, { state: recordBackup(seed, new Date(2026, 2, 14, 9)) })
    expect(
      screen.getByText('Your last copy is from March. A fresh copy keeps everything written since.'),
    ).toBeInTheDocument()
  })

  it('suggests a first copy, and lets it go once the download starts', async () => {
    stubDownload()
    const user = userEvent.setup()
    const onBackupMade = vi.fn()
    render(<StatefulSettings initial={gardenOf(45)} onBackupMade={onBackupMade} />)
    expect(screen.getByText(/You have not saved a copy yet\./)).toBeInTheDocument()

    const before = Date.now()
    await user.click(screen.getByRole('button', { name: 'Download a backup' }))

    expect(onBackupMade).toHaveBeenCalledOnce()
    const [madeAt] = onBackupMade.mock.calls[0] as [Date]
    expect(madeAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(screen.queryByText(/not saved a copy/i)).not.toBeInTheDocument()
    expect(screen.getByText(/backup started/i)).toBeInTheDocument()
  })

  it('does not count a download the browser would not start', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => {
        throw new Error('blocked')
      }),
    })
    const user = userEvent.setup()
    const { onBackupMade } = renderSettings(undefined, { onBackupMade: vi.fn() })
    await user.click(screen.getByRole('button', { name: 'Download a backup' }))
    expect(screen.getByText('This browser would not start the download.')).toBeInTheDocument()
    expect(onBackupMade).not.toHaveBeenCalled()
  })

  it('keeps quiet about backups while the stored garden cannot be read', () => {
    renderSettings({ readOnly: true, reason: 'malformed' }, { state: gardenOf(45) })
    expect(screen.queryByText(/not saved a copy/i)).not.toBeInTheDocument()
  })

  it('offers no share button where the browser cannot share a file', () => {
    renderSettings()
    expect(screen.queryByRole('button', { name: /share backup/i })).not.toBeInTheDocument()

    stubShareSheet(() => false)
    renderSettings()
    expect(screen.queryByRole('button', { name: /share backup/i })).not.toBeInTheDocument()
  })

  it('shares the backup as a file where the browser can, and counts it', async () => {
    const sheet = stubShareSheet((data) => data?.files?.[0]?.type === 'application/json')
    const user = userEvent.setup()
    const onBackupMade = vi.fn()
    render(<StatefulSettings initial={gardenOf(45)} onBackupMade={onBackupMade} />)
    expect(screen.getByText(/or handed to an app you choose\./)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Share backup…' }))

    const [shared] = sheet.share.mock.calls[0]
    const file = shared?.files?.[0]
    expect(file?.name).toMatch(/^butterfly-garden-\d{4}-\d{2}-\d{2}\.json$/)
    expect(file?.type).toBe('application/json')
    expect(await file?.text()).toBe('{"format":"the-butterfly-garden"}')
    expect(onBackupMade).toHaveBeenCalledOnce()
    expect(screen.getByText('Backup shared. Keep the file somewhere safe.')).toBeInTheDocument()
    expect(screen.queryByText(/not saved a copy/i)).not.toBeInTheDocument()
  })

  it('takes a closed share sheet quietly, as nothing kept', async () => {
    stubShareSheet(
      () => true,
      () => Promise.reject(new DOMException('Share canceled', 'AbortError')),
    )
    const user = userEvent.setup()
    const onBackupMade = vi.fn()
    render(<StatefulSettings initial={gardenOf(45)} onBackupMade={onBackupMade} />)
    await user.click(screen.getByRole('button', { name: 'Share backup…' }))
    expect(onBackupMade).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText(/You have not saved a copy yet\./)).toBeInTheDocument()
  })

  it('says so when the browser will not share the file after all', async () => {
    stubShareSheet(
      () => true,
      () => Promise.reject(new DOMException('No gesture', 'NotAllowedError')),
    )
    const user = userEvent.setup()
    const { onBackupMade } = renderSettings(undefined, { onBackupMade: vi.fn() })
    await user.click(screen.getByRole('button', { name: 'Share backup…' }))
    expect(
      await screen.findByText('This browser would not share the file. Download it instead.'),
    ).toBeInTheDocument()
    expect(onBackupMade).not.toHaveBeenCalled()
  })

  it('shares nothing while the stored garden cannot be read', async () => {
    const sheet = stubShareSheet(() => true)
    const user = userEvent.setup()
    renderSettings(undefined, { onExportGarden: vi.fn(() => undefined) })
    await user.click(screen.getByRole('button', { name: 'Share backup…' }))
    expect(screen.getByText(/saving a backup is paused/i)).toBeInTheDocument()
    expect(sheet.share).not.toHaveBeenCalled()
  })
})

describe('Settings: garden pace', () => {
  it('offers Classic and Keep giving, starting at Classic, and chooses at once', async () => {
    const user = userEvent.setup()
    const { onSetGardenPace } = renderSettings(undefined, { onSetGardenPace: vi.fn() })
    const group = screen.getByRole('group', { name: 'Garden pace' })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
    expect(within(group).getByRole('radio', { name: /^Classic/ })).toBeChecked()
    await user.click(within(group).getByRole('radio', { name: /^Keep giving/ }))
    expect(onSetGardenPace).toHaveBeenLastCalledWith('keep-giving')
  })

  it('shows Keep giving as chosen, and Classic stores nothing', async () => {
    const user = userEvent.setup()
    const seed = createInitialState('Tester', 'Test Garden')
    const { onSetGardenPace } = renderSettings(undefined, {
      onSetGardenPace: vi.fn(),
      state: { ...seed, profile: { ...seed.profile!, gardenPace: 'keep-giving' } },
    })
    const group = screen.getByRole('group', { name: 'Garden pace' })
    expect(within(group).getByRole('radio', { name: /^Keep giving/ })).toBeChecked()
    expect(within(group).getByText(/blooms again after 7 more days of care/)).toBeInTheDocument()
    await user.click(within(group).getByRole('radio', { name: /^Classic/ }))
    expect(onSetGardenPace).toHaveBeenLastCalledWith(undefined)
  })

  it('has no pace card where it cannot be changed', () => {
    renderSettings()
    expect(screen.queryByRole('group', { name: 'Garden pace' })).not.toBeInTheDocument()
  })
})
