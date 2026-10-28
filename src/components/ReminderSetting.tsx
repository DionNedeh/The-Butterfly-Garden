import { useState, type MouseEvent } from 'react'
import {
  calendarReminderText,
  eveningReminderTime,
  MORNING_REMINDER_TIME,
  REMINDER_FILES_ADDRESS,
  reminderFileName,
  staticReminderFor,
} from '../lib/calendarReminder'
import { toLocalDate } from '../lib/date'
import { saveTextFile } from '../lib/download'
import { createId } from '../lib/id'
import { isInstalledApp, isIPhoneOrIPad } from '../lib/install'
import { isReminderTime } from '../lib/reminderTime'
import './reminderSetting.css'

/** "8:00 AM" or "08:00", as the gardener's clock shows it. */
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  return timeFormat.format(new Date(2000, 0, 1, hour, minute))
}

/** The PWA's own address, without the page or anything after it. */
function appAddress(): string {
  return new URL(import.meta.env.BASE_URL, window.location.href).href
}

const BUTTON_LABEL = 'Add a daily garden visit to my calendar'

/**
 * Settings' Reminders (docs/Voyager c.9): a daily visit added to the
 * gardener's own calendar, which does the reminding. The garden sends no
 * notifications and keeps nothing about the reminder but the time last
 * chosen, offered again next time.
 *
 * How the file is handed over depends on where the garden runs:
 * - in the Android app, through Android's own "Save to…" screen, as a backup
 *   is saved (lib/download);
 * - on an iPhone or iPad, for a time public/reminders/ has a file for, as a
 *   plain link to that file, which iOS opens best;
 * - anywhere else, and for any other time, as a download of a file made here.
 */
export function ReminderSetting({
  savedTime,
  eveningHour,
  onChooseTime,
}: {
  /** The time last added to the calendar, if any. */
  savedTime?: string
  /** The hour the gardener's evening starts, for the Moonlight preset. */
  eveningHour: number
  /** Remember the time just handed to the calendar. */
  onChooseTime?: (time: string) => void
}) {
  const [time, setTime] = useState(() =>
    isReminderTime(savedTime) ? savedTime : MORNING_REMINDER_TIME,
  )
  const [note, setNote] = useState('')
  // Inline rather than isAndroidApp(), so the bundler folds the branches.
  const android = import.meta.env.VITE_PLATFORM === 'android'
  const [linkFiles] = useState(
    // Only where the static files were made for, so a copy served elsewhere
    // never links to an event that points back somewhere else.
    () => !android && isIPhoneOrIPad() && appAddress() === REMINDER_FILES_ADDRESS,
  )
  // In a Home Screen web app a link opens over the app rather than in place
  // of it, so a calendar sheet that goes wrong never strands the garden.
  const [installed] = useState(isInstalledApp)
  // The platform checked here as well, so the Android build drops the link.
  const staticFile = !android && linkFiles ? staticReminderFor(time) : undefined
  const presets = [
    {
      label: 'Morning check-in',
      time: MORNING_REMINDER_TIME,
      description: `${formatTime(MORNING_REMINDER_TIME)}, to start the day with a check-in.`,
    },
    {
      label: 'Evening Moonlight',
      time: eveningReminderTime(eveningHour),
      description: `${formatTime(eveningReminderTime(eveningHour))}, when your evening starts and the Moonlight recap opens.`,
    },
  ]

  /** Make the file here and hand it over: a download, or Android's save screen. */
  const saveReminder = async () => {
    setNote('')
    if (!isReminderTime(time)) {
      setNote('Choose a time for the visit first.')
      return
    }
    const text = calendarReminderText({
      time,
      firstDay: toLocalDate(),
      uid: createId(),
      madeAt: new Date(),
      link: android ? undefined : appAddress(),
    })
    try {
      const outcome = await saveTextFile(reminderFileName(time), 'text/calendar', text)
      if (outcome === 'cancelled') {
        setNote('No calendar file was saved.')
        return
      }
      onChooseTime?.(time)
      setNote(
        outcome === 'saved'
          ? 'Calendar file saved. Open it to add the visit to your calendar.'
          : 'Your calendar file is downloading. Open it to add the visit to your calendar.',
      )
    } catch {
      setNote(
        android
          ? 'The calendar file could not be saved there. Try choosing another place.'
          : 'This browser would not start the download.',
      )
    }
  }

  /**
   * The link to a static file. Not cached for offline use (vite.config.ts),
   * so with no connection the file is made here instead.
   */
  const followLink = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!navigator.onLine) {
      event.preventDefault()
      void saveReminder()
      return
    }
    onChooseTime?.(time)
    setNote('Your calendar should now offer to add the visit.')
  }

  return (
    <section className="card reminder-setting" aria-labelledby="reminder-settings-title">
      <p className="eyebrow">Reminders</p>
      <h2 id="reminder-settings-title">A daily garden visit</h2>
      <p className="section-explainer">
        Your calendar will remind you; the garden never sends notifications.
        The event says only “Garden time 🦋”, with nothing from your journal.
      </p>
      <fieldset className="motion-options">
        <legend>When to visit</legend>
        {presets.map((preset) => (
          <label className="toggle-row" key={preset.label}>
            <span>
              <strong>{preset.label}</strong>
              <small>{preset.description}</small>
            </span>
            <input
              type="radio"
              name="reminder-time"
              value={preset.time}
              checked={time === preset.time}
              onChange={() => setTime(preset.time)}
            />
          </label>
        ))}
      </fieldset>
      <label className="reminder-time">
        Remind me at
        <input
          type="time"
          value={time}
          // A field set to show seconds reports them; a visit needs minutes.
          onChange={(event) => setTime(event.target.value.slice(0, 5))}
        />
      </label>
      <div className="form-actions">
        {staticFile ? (
          <a
            className="secondary-button"
            href={`${import.meta.env.BASE_URL}reminders/${staticFile}`}
            target={installed ? '_blank' : undefined}
            rel={installed ? 'noopener' : undefined}
            onClick={followLink}
          >
            {BUTTON_LABEL}
          </a>
        ) : (
          <button className="secondary-button" onClick={() => void saveReminder()}>
            {BUTTON_LABEL}
          </button>
        )}
      </div>
      <p className="subtle-copy">
        To stop, delete the event in your calendar. There is nothing to turn
        off here.
      </p>
      <p className="settings-note" role="status">
        {note}
      </p>
    </section>
  )
}
