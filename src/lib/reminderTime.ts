import type { AppState } from '../types'

/**
 * The time of day a calendar reminder was last added for (docs/Voyager c.9),
 * as "HH:MM" on a 24-hour clock, the way a time field reports it.
 *
 * Kept apart from the calendar file itself (lib/calendarReminder), which
 * loads with Settings alone: checking a stored garden needs only this. It
 * imports nothing at run time, so scripts/reminder-files.mjs can load the
 * calendar file's code, and this with it, straight into Node.
 */
const REMINDER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function isReminderTime(value: unknown): value is string {
  return typeof value === 'string' && REMINDER_TIME.test(value)
}

/**
 * Remember the time last handed to the calendar, so Settings offers it again.
 * The garden keeps nothing else about a reminder: the calendar does the
 * reminding, and the garden never knows whether the event was kept.
 */
export function setReminderTime(state: AppState, time: string): AppState {
  if (!state.profile || !isReminderTime(time) || state.profile.reminderTime === time)
    return state
  return { ...state, profile: { ...state.profile, reminderTime: time } }
}
