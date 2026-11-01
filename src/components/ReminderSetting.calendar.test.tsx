import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDailyEventInCalendar } from '../lib/calendarEvent'
import { saveTextFile } from '../lib/download'
import { ReminderSetting } from './ReminderSetting'

vi.mock('../lib/download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/download')>()),
  saveTextFile: vi.fn(),
}))
vi.mock('../lib/calendarEvent', () => ({ addDailyEventInCalendar: vi.fn() }))

const save = vi.mocked(saveTextFile)
const calendar = vi.mocked(addDailyEventInCalendar)

const LABEL = 'Add a daily garden visit to my calendar'

function renderReminders() {
  const onChooseTime = vi.fn()
  render(<ReminderSetting eveningHour={18} onChooseTime={onChooseTime} />)
  return { onChooseTime }
}

afterEach(() => {
  vi.unstubAllEnvs()
  save.mockReset()
  calendar.mockReset()
})

describe('6.11 the daily visit in the Android app', () => {
  it('opens the calendar’s own new-event screen, filled in, and saves no file', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const user = userEvent.setup()
    calendar.mockResolvedValueOnce(true)
    const { onChooseTime } = renderReminders()
    await user.click(screen.getByRole('radio', { name: /Evening Moonlight/ }))
    await user.click(screen.getByRole('button', { name: LABEL }))

    expect(calendar).toHaveBeenCalledWith('18:00')
    expect(save).not.toHaveBeenCalled()
    expect(onChooseTime).toHaveBeenCalledWith('18:00')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your calendar opened with the daily visit filled in. Save it there to add it.',
    )
  })

  it('saves the calendar file, as before, where no calendar app has that screen', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const user = userEvent.setup()
    calendar.mockResolvedValueOnce(false)
    save.mockResolvedValueOnce('saved')
    const { onChooseTime } = renderReminders()
    await user.click(screen.getByRole('button', { name: LABEL }))

    expect(calendar).toHaveBeenCalledWith('08:00')
    expect(save).toHaveBeenCalledTimes(1)
    const [name, type, text] = save.mock.calls[0]
    expect(name).toBe('butterfly-garden-reminder-0800.ics')
    expect(type).toBe('text/calendar')
    expect(text).toContain('RRULE:FREQ=DAILY')
    expect(text).not.toContain('URL:')
    expect(onChooseTime).toHaveBeenCalledWith('08:00')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Calendar file saved. Open it to add the visit to your calendar.',
    )
  })

  it('never asks for the calendar’s screen in a browser, nor for a time that is not set', async () => {
    const user = userEvent.setup()
    save.mockResolvedValueOnce('started')
    renderReminders()
    await user.click(screen.getByRole('button', { name: LABEL }))
    expect(calendar).not.toHaveBeenCalled()
    expect(save).toHaveBeenCalledTimes(1)

    vi.stubEnv('VITE_PLATFORM', 'android')
    save.mockReset()
    const field = screen.getByLabelText('Remind me at')
    await user.clear(field)
    await user.click(screen.getByRole('button', { name: LABEL }))
    expect(calendar).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Choose a time for the visit first.')
  })
})
