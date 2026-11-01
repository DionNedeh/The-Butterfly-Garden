import { afterEach, describe, expect, it, vi } from 'vitest'

// A stand-in for Capacitor. What matters here is what the app asks of it.
const addDailyEvent = vi.hoisted(() => vi.fn())
const registerPlugin = vi.hoisted(() => vi.fn(() => ({ addDailyEvent })))
vi.mock('@capacitor/core', () => ({ registerPlugin }))

/** A fresh copy of the modules, so a plugin registered in one test is not reused. */
async function loadCalendarEvent() {
  vi.resetModules()
  return import('./calendarEvent')
}

/**
 * The app's native side, as Capacitor's Android bridge lists it before the
 * page loads: GardenFiles with its methods.
 */
function inTheApp(methods = ['saveDocument', 'saveBinaryDocument', 'addDailyEvent']) {
  vi.stubEnv('VITE_PLATFORM', 'android')
  vi.stubGlobal('Capacitor', {
    PluginHeaders: [
      { name: 'GardenBilling', methods: [{ name: 'addDailyEvent', rtype: 'promise' }] },
      { name: 'GardenFiles', methods: methods.map((name) => ({ name, rtype: 'promise' })) },
    ],
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('6.11 a daily visit through the calendar’s own screen, in the Android app', () => {
  it('asks GardenFiles for the new-event screen at the chosen time, with nothing from the journal', async () => {
    inTheApp()
    addDailyEvent.mockResolvedValueOnce({ opened: true })
    const { addDailyEventInCalendar } = await loadCalendarEvent()
    await expect(addDailyEventInCalendar('20:30')).resolves.toBe(true)
    expect(registerPlugin).toHaveBeenCalledWith('GardenFiles')
    expect(addDailyEvent).toHaveBeenCalledTimes(1)
    expect(addDailyEvent).toHaveBeenCalledWith({
      title: 'Garden time 🦋',
      description:
        'Open The Butterfly Garden.\nTo stop these reminders, delete the event from your calendar.',
      hour: 20,
      minute: 30,
    })
  })

  it('answers false when no app on the phone has that screen, so the file is saved instead', async () => {
    inTheApp()
    addDailyEvent.mockResolvedValueOnce({ opened: false })
    const { addDailyEventInCalendar } = await loadCalendarEvent()
    await expect(addDailyEventInCalendar('08:00')).resolves.toBe(false)
    expect(addDailyEvent).toHaveBeenCalledWith(expect.objectContaining({ hour: 8, minute: 0 }))
  })

  it('answers false, and never throws, when the native side cannot be reached', async () => {
    inTheApp()
    addDailyEvent.mockRejectedValueOnce(new Error('"GardenFiles.addDailyEvent()" is not implemented on web'))
    const { addDailyEventInCalendar } = await loadCalendarEvent()
    await expect(addDailyEventInCalendar('07:00')).resolves.toBe(false)
  })

  it('does nothing outside the app, nor for a time that is not one', async () => {
    const { addDailyEventInCalendar } = await loadCalendarEvent()
    await expect(addDailyEventInCalendar('08:00')).resolves.toBe(false)
    inTheApp()
    await expect(addDailyEventInCalendar('25:00')).resolves.toBe(false)
    expect(registerPlugin).not.toHaveBeenCalled()
    expect(addDailyEvent).not.toHaveBeenCalled()
  })

  it('saves the file at once where the native side has no such method, as the Android bundle in a browser has none', async () => {
    const { addDailyEventInCalendar } = await loadCalendarEvent()
    vi.stubEnv('VITE_PLATFORM', 'android')
    await expect(addDailyEventInCalendar('08:00')).resolves.toBe(false)
    inTheApp(['saveDocument', 'saveBinaryDocument'])
    await expect(addDailyEventInCalendar('08:00')).resolves.toBe(false)
    expect(registerPlugin).not.toHaveBeenCalled()
    expect(addDailyEvent).not.toHaveBeenCalled()
  })
})
