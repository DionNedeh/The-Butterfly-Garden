import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PersistenceStatus } from '../hooks/useGardenState'
import { createInitialState } from '../lib/progression'
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
