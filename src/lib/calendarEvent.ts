import { REMINDER_TITLE, reminderDescription } from './calendarReminder'
import { inAppPlugin } from './native'
import { isReminderTime } from './reminderTime'

/**
 * The Android app's daily garden visit, added through the calendar's own
 * new-event screen (docs/Voyager c.9) rather than as a file to open.
 *
 * Google Calendar on Android may not import a calendar file opened from
 * Files, so the app hands the visit to whichever calendar app the phone has,
 * filled in: GardenFilesPlugin.addDailyEvent starts Android's insert-event
 * screen with the next occurrence of the chosen time, ten minutes long,
 * every day, marked free. It needs no calendar permission: the calendar app
 * writes the event, and only if the gardener saves it there. The event
 * carries the title and the notes a calendar file would (lib/calendarReminder),
 * and nothing from the journal.
 *
 * Apart from lib/native, which loads with the app, so that none of this is in
 * the first load: it arrives with Settings.
 */

interface GardenCalendar {
  addDailyEvent(options: {
    title: string
    description: string
    hour: number
    minute: number
  }): Promise<{ opened: boolean }>
}

/** What Capacitor's Android bridge says of each plugin, before the page loads. */
interface PluginHeader {
  name: string
  methods?: ReadonlyArray<{ name: string }>
}

/**
 * Whether this app's native side has addDailyEvent. Capacitor's Android
 * bridge lists every plugin's methods as `Capacitor.PluginHeaders` before any
 * of the page's code runs, so this is known at once, without loading
 * Capacitor: where it is not listed (the Android bundle in a browser), the
 * file is saved straight away, as it always was.
 */
function hasDailyEvent(): boolean {
  const { Capacitor } = window as { Capacitor?: { PluginHeaders?: readonly PluginHeader[] } }
  return Boolean(
    Capacitor?.PluginHeaders?.some(
      (plugin) =>
        plugin.name === 'GardenFiles' &&
        plugin.methods?.some((method) => method.name === 'addDailyEvent'),
    ),
  )
}

/**
 * Open the calendar's new-event screen with the daily visit at `time`
 * ("HH:MM") filled in. True once it opened; false where no app on the phone
 * has that screen, the native side could not be reached, or this is not the
 * Android app, so the caller saves the calendar file instead. Never throws.
 */
export async function addDailyEventInCalendar(time: string): Promise<boolean> {
  if (import.meta.env.VITE_PLATFORM !== 'android' || !isReminderTime(time) || !hasDailyEvent())
    return false
  const [hour, minute] = time.split(':').map(Number)
  try {
    const { plugin } = await inAppPlugin<GardenCalendar>('GardenFiles')
    const { opened } = await plugin.addDailyEvent({
      title: REMINDER_TITLE,
      description: reminderDescription(undefined),
      hour,
      minute,
    })
    return opened === true
  } catch {
    return false
  }
}
