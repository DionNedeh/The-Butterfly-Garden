import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { REMINDER_FILES_ADDRESS } from '../lib/calendarReminder'
import { toLocalDate } from '../lib/date'
import { saveTextFile } from '../lib/download'
import { createInitialState } from '../lib/progression'
import { ReminderSetting } from './ReminderSetting'
import { SettingsView } from './SettingsView'

vi.mock('../lib/download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/download')>()),
  saveTextFile: vi.fn(),
}))

const save = vi.mocked(saveTextFile)

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const LABEL = 'Add a daily garden visit to my calendar'

/** Navigator properties a test sets, put back afterwards. */
const stubbed: string[] = []

function onNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { value, configurable: true })
    stubbed.push(key)
  }
}

/** An iPhone, opening the PWA where it is served, so the static files apply. */
function onIPhoneAtHome(extra: Record<string, unknown> = {}) {
  onNavigator({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, ...extra })
  vi.stubEnv('BASE_URL', REMINDER_FILES_ADDRESS)
}

function renderReminders(props: { savedTime?: string; eveningHour?: number } = {}) {
  const onChooseTime = vi.fn()
  render(<ReminderSetting eveningHour={18} onChooseTime={onChooseTime} {...props} />)
  return { onChooseTime }
}

const timeField = () => screen.getByLabelText('Remind me at')

/** The file handed to the device, as text. */
function savedFile(): { name: string; type: string; text: string } {
  const [name, type, text] = save.mock.calls[0]
  return { name, type, text: text.replace(/\r\n /g, '') }
}

/** Clicks reach a link's own handler, then stop short of a navigation. */
function watchNavigation() {
  const seen: boolean[] = []
  const listener = (event: Event) => {
    seen.push(event.defaultPrevented)
    event.preventDefault()
  }
  document.addEventListener('click', listener)
  return {
    prevented: () => seen,
    stop: () => document.removeEventListener('click', listener),
  }
}

afterEach(() => {
  for (const key of stubbed.splice(0)) Reflect.deleteProperty(navigator, key)
  vi.unstubAllEnvs()
  save.mockReset()
})

describe('Reminders in Settings', () => {
  it('offers a morning check-in first, and Moonlight on the hour the evening starts', () => {
    renderReminders({ eveningHour: 20 })
    expect(screen.getByRole('heading', { name: 'A daily garden visit' })).toBeInTheDocument()
    expect(
      screen.getByText(/^Your calendar will remind you; the garden never sends notifications\./),
    ).toBeInTheDocument()
    expect(screen.getByText(/^To stop, delete the event in your calendar\./)).toBeInTheDocument()
    const morning = screen.getByRole('radio', { name: /^Morning check-in/ })
    const evening = screen.getByRole('radio', { name: /^Evening Moonlight/ })
    expect(morning).toBeChecked()
    expect(timeField()).toHaveValue('08:00')

    fireEvent.click(evening)
    expect(evening).toBeChecked()
    expect(timeField()).toHaveValue('20:00')

    // Any other time is the gardener's own; neither preset claims it.
    fireEvent.change(timeField(), { target: { value: '07:45' } })
    expect(timeField()).toHaveValue('07:45')
    expect(morning).not.toBeChecked()
    expect(evening).not.toBeChecked()
  })

  it('offers the time last added again, or the morning when what was kept is not a time', () => {
    renderReminders({ savedTime: '18:00' })
    expect(timeField()).toHaveValue('18:00')
    expect(screen.getByRole('radio', { name: /^Evening Moonlight/ })).toBeChecked()
  })

  it('falls back to the morning for a kept value that is not a time', () => {
    renderReminders({ savedTime: 'soon' })
    expect(timeField()).toHaveValue('08:00')
  })

  it('makes the file here and hands it to the device, remembering the time', async () => {
    const user = userEvent.setup()
    save.mockResolvedValueOnce('started')
    const { onChooseTime } = renderReminders()
    fireEvent.change(timeField(), { target: { value: '07:45' } })
    await user.click(screen.getByRole('button', { name: LABEL }))

    const file = savedFile()
    expect(file.name).toBe('butterfly-garden-reminder-0745.ics')
    expect(file.type).toBe('text/calendar')
    expect(file.text).toContain(`DTSTART:${toLocalDate().replaceAll('-', '')}T074500\r\n`)
    expect(file.text).toContain('RRULE:FREQ=DAILY\r\n')
    expect(file.text).toContain('SUMMARY:Garden time 🦋\r\n')
    // The way back is this copy's own address, not the page it was made on.
    const address = new URL('/', window.location.href).href
    expect(file.text).toContain(`DESCRIPTION:Open The Butterfly Garden: ${address}\\n`)
    expect(file.text).toContain(`URL:${address}\r\n`)
    expect(file.text).toMatch(/\r\nUID:[0-9a-f-]{36}\r\n/)
    expect(onChooseTime).toHaveBeenCalledWith('07:45')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your calendar file is downloading. Open it to add the visit to your calendar.',
    )
  })

  it('gives each file an id of its own', async () => {
    const user = userEvent.setup()
    save.mockResolvedValue('started')
    renderReminders()
    await user.click(screen.getByRole('button', { name: LABEL }))
    await user.click(screen.getByRole('button', { name: LABEL }))
    const ids = save.mock.calls.map(([, , text]) => /UID:(.+)\r\n/.exec(text)?.[1])
    expect(ids[0]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })

  it('says so when nothing was saved, and remembers nothing', async () => {
    const user = userEvent.setup()
    save.mockResolvedValueOnce('cancelled')
    const { onChooseTime } = renderReminders()
    await user.click(screen.getByRole('button', { name: LABEL }))
    expect(screen.getByRole('status')).toHaveTextContent('No calendar file was saved.')
    expect(onChooseTime).not.toHaveBeenCalled()
  })

  it('says so when the browser will not download it', async () => {
    const user = userEvent.setup()
    save.mockRejectedValueOnce(new Error('no'))
    const { onChooseTime } = renderReminders()
    await user.click(screen.getByRole('button', { name: LABEL }))
    expect(screen.getByRole('status')).toHaveTextContent('This browser would not start the download.')
    expect(onChooseTime).not.toHaveBeenCalled()
  })

  it('asks for a time when the field is empty', async () => {
    const user = userEvent.setup()
    renderReminders()
    fireEvent.change(timeField(), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: LABEL }))
    expect(screen.getByRole('status')).toHaveTextContent('Choose a time for the visit first.')
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps its status line in the page while it is empty, so it is heard when it fills', () => {
    renderReminders()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})

describe('Reminders on an iPhone or iPad', () => {
  it('links to the file the garden serves for a common time, which iOS opens best', () => {
    onIPhoneAtHome()
    renderReminders()
    expect(screen.getByRole('link', { name: LABEL })).toHaveAttribute(
      'href',
      `${REMINDER_FILES_ADDRESS}reminders/morning-0800.ics`,
    )
    expect(screen.getByRole('link', { name: LABEL })).not.toHaveAttribute('target')
    expect(screen.queryByRole('button', { name: LABEL })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /^Evening Moonlight/ }))
    expect(screen.getByRole('link', { name: LABEL })).toHaveAttribute(
      'href',
      `${REMINDER_FILES_ADDRESS}reminders/evening-1800.ics`,
    )

    // A time with no file of its own is made here.
    fireEvent.change(timeField(), { target: { value: '06:10' } })
    expect(screen.queryByRole('link', { name: LABEL })).toBeNull()
    expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument()
  })

  it('follows the link, remembering the time', () => {
    onIPhoneAtHome()
    const { onChooseTime } = renderReminders()
    const navigation = watchNavigation()
    try {
      fireEvent.click(screen.getByRole('link', { name: LABEL }))
      expect(navigation.prevented()).toEqual([false])
    } finally {
      navigation.stop()
    }
    expect(onChooseTime).toHaveBeenCalledWith('08:00')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your calendar should now offer to add the visit.',
    )
    expect(save).not.toHaveBeenCalled()
  })

  it('makes the file here instead while offline, since the files are not kept for it', async () => {
    onIPhoneAtHome({ onLine: false })
    save.mockResolvedValueOnce('started')
    const { onChooseTime } = renderReminders()
    const navigation = watchNavigation()
    try {
      fireEvent.click(screen.getByRole('link', { name: LABEL }))
      expect(navigation.prevented()).toEqual([true])
    } finally {
      navigation.stop()
    }
    expect(await screen.findByText(/^Your calendar file is downloading/)).toBeInTheDocument()
    expect(savedFile().name).toBe('butterfly-garden-reminder-0800.ics')
    expect(onChooseTime).toHaveBeenCalledWith('08:00')
  })

  it('opens the link over a Home Screen app rather than in place of it', () => {
    onIPhoneAtHome({ standalone: true })
    renderReminders()
    const link = screen.getByRole('link', { name: LABEL })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
  })

  it('makes the file here when the garden is served anywhere else', () => {
    onNavigator({ userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })
    renderReminders()
    expect(screen.queryByRole('link', { name: LABEL })).toBeNull()
    expect(screen.getByRole('button', { name: LABEL })).toBeInTheDocument()
  })
})

describe('Reminders in the Android app', () => {
  it("saves the file through Android's own save screen, saying to open the app", async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    // Even with an iPhone's words, there is no link: the app has no address.
    onIPhoneAtHome()
    const user = userEvent.setup()
    save.mockResolvedValueOnce('saved')
    const { onChooseTime } = renderReminders()
    expect(screen.queryByRole('link', { name: LABEL })).toBeNull()
    await user.click(screen.getByRole('button', { name: LABEL }))

    const file = savedFile()
    expect(file.type).toBe('text/calendar')
    expect(file.text).toContain('DESCRIPTION:Open The Butterfly Garden.\\n')
    expect(file.text).not.toContain('URL:')
    expect(onChooseTime).toHaveBeenCalledWith('08:00')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Calendar file saved. Open it to add the visit to your calendar.',
    )
  })

  it('says so when the file could not be saved there', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const user = userEvent.setup()
    save.mockRejectedValueOnce(new Error('no'))
    renderReminders()
    await user.click(screen.getByRole('button', { name: LABEL }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'The calendar file could not be saved there. Try choosing another place.',
    )
  })
})

describe('Reminders, as Settings shows them', () => {
  it("offers Moonlight at the gardener's own evening, and remembers the time added", async () => {
    const user = userEvent.setup()
    save.mockResolvedValueOnce('started')
    const state = createInitialState('Tester', 'Test Garden')
    const onSetReminderTime = vi.fn()
    render(
      <SettingsView
        state={{ ...state, profile: { ...state.profile!, recapOpensHour: 19 } }}
        persistence={{ readOnly: false }}
        onUpdateProfile={vi.fn()}
        onSelectAmbientTrack={vi.fn()}
        onSelectBackdrop={vi.fn()}
        onExportGarden={vi.fn(() => ({ text: '{}' }))}
        onImportGarden={vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))}
        onDeleteAll={vi.fn(() => Promise.resolve({ ok: true }))}
        onSetReminderTime={onSetReminderTime}
      />,
    )
    const card = screen
      .getByRole('heading', { name: 'A daily garden visit' })
      .closest('section')!
    fireEvent.click(within(card).getByRole('radio', { name: /^Evening Moonlight/ }))
    expect(within(card).getByLabelText('Remind me at')).toHaveValue('19:00')
    await user.click(within(card).getByRole('button', { name: LABEL }))
    expect(onSetReminderTime).toHaveBeenCalledWith('19:00')
  })
})
