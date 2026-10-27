// With its extension, so Node can load this file as it is (see below).
import { isReminderTime } from './reminderTime.ts'

/**
 * A daily garden visit, as a calendar file (docs/Voyager c.9).
 *
 * A web page cannot remind anyone by itself: notifications need a push
 * server, which this garden will never have. The gardener's own calendar does
 * it instead. Settings hands over a small iCalendar file (RFC 5545) holding
 * one event that comes round every day with an alert as it starts, and the
 * gardener removes it as they would any other event. Nothing in it comes from
 * the journal.
 *
 * Pure, and loaded with Settings alone. It imports only lib/reminderTime,
 * which imports nothing at run time, so scripts/reminder-files.mjs can run
 * the same code in Node to write the static files in public/reminders/.
 */

/** The morning check-in, offered first. */
export const MORNING_REMINDER_TIME = '08:00'

/** The evening's Moonlight: on the hour the gardener's evening starts. */
export function eveningReminderTime(opensHour: number): string {
  return `${two(opensHour)}:00`
}

/**
 * What the calendar shows. An event's title can appear on a lock screen or in
 * a calendar someone else can see, so it says nothing about the gardener and
 * nothing from what they have written.
 */
export const REMINDER_TITLE = 'Garden time 🦋'

/** How long the visit fills in the calendar. */
const REMINDER_DURATION = 'PT10M'

export interface CalendarReminder {
  /** "HH:MM" on a 24-hour clock, the gardener's own local time. */
  time: string
  /** The local date ("YYYY-MM-DD") of the first visit. */
  firstDay: string
  /** The event's own id, which lets a calendar recognise the same file twice. */
  uid: string
  /** When the file was made (DTSTAMP, written in UTC). */
  madeAt: Date
  /**
   * The PWA's own address, as a way back. The Android app has none to give,
   * so without one the event simply says to open the app.
   */
  link?: string
}

const LOCAL_DATE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/**
 * The calendar file for a daily visit: CRLF line endings, long lines folded
 * and text escaped as RFC 5545 asks, ending with a line break of its own.
 *
 * The start is in floating time, with no zone and no Z: 8:00 stays 8:00
 * wherever the gardener is, which is what a daily habit means. The alert is a
 * plain display alert as the visit starts; the event is marked free, so ten
 * minutes in the garden never shows anyone else's calendar as busy.
 */
export function calendarReminderText(reminder: CalendarReminder): string {
  const { time, firstDay, uid, madeAt, link } = reminder
  if (!isReminderTime(time)) throw new RangeError(`Not a time of day: ${reminder.time}`)
  if (!LOCAL_DATE.test(firstDay)) throw new RangeError(`Not a date: ${firstDay}`)
  if (Number.isNaN(madeAt.getTime())) throw new RangeError('Not a moment in time.')
  // Parsed, so only a well-formed address can reach the file, where a line
  // break in it would otherwise start a property of its own.
  const address = link === undefined ? undefined : new URL(link).href
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//The Butterfly Garden//Garden time//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${utcStamp(madeAt)}`,
    `DTSTART:${firstDay.replaceAll('-', '')}T${time.replace(':', '')}00`,
    `DURATION:${REMINDER_DURATION}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeText(REMINDER_TITLE)}`,
    `DESCRIPTION:${escapeText(reminderDescription(address))}`,
    ...(address ? [`URL:${address}`] : []),
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(REMINDER_TITLE)}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** The event's notes: the way back, and the way to stop. */
function reminderDescription(address: string | undefined): string {
  return [
    address ? `Open The Butterfly Garden: ${address}` : 'Open The Butterfly Garden.',
    'To stop these reminders, delete the event from your calendar.',
  ].join('\n')
}

/**
 * A TEXT value as RFC 5545 (3.3.11) writes it: backslashes, semicolons and
 * commas escaped with a backslash, and every kind of line break as \n.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** The longest a line may be, in octets of UTF-8, before its line break. */
const MAX_LINE_OCTETS = 75

/** How many octets a code point takes in UTF-8. */
function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1
  if (codePoint < 0x800) return 2
  return codePoint < 0x10000 ? 3 : 4
}

/**
 * One content line, folded as RFC 5545 (3.1) asks: no line longer than 75
 * octets, each continuation starting with a single space, which counts
 * toward its 75. A character is never split between lines, so the butterfly
 * in the title arrives whole whatever reads it.
 */
export function foldLine(line: string): string {
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const character of line) {
    const length = utf8Length(character.codePointAt(0) ?? 0)
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1
    if (size + length > limit) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += character
    size += length
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function two(value: number): string {
  return String(value).padStart(2, '0')
}

/** A moment in UTC, as DTSTAMP takes it: 20261027T091500Z. */
function utcStamp(date: Date): string {
  return (
    `${String(date.getUTCFullYear()).padStart(4, '0')}${two(date.getUTCMonth() + 1)}${two(date.getUTCDate())}` +
    `T${two(date.getUTCHours())}${two(date.getUTCMinutes())}${two(date.getUTCSeconds())}Z`
  )
}

/** A file made in the garden: butterfly-garden-reminder-0815.ics. */
export function reminderFileName(time: string): string {
  return `butterfly-garden-reminder-${time.replace(':', '')}.ics`
}

/**
 * Where the PWA is served, the address the static files link back to. The app
 * offers a static file only when it is served from here itself, so a copy
 * served anywhere else never hands out a link to somewhere it is not.
 */
export const REMINDER_FILES_ADDRESS = 'https://dionnedeh.github.io/The-Butterfly-Garden/'

/**
 * public/reminders/: a calendar file for each of a few common times.
 *
 * iOS opens a calendar file most reliably from a plain link to it, served as
 * text/calendar; a file made on the device has to go through a download. So
 * for these times an iPhone or iPad gets a link (components/ReminderSetting).
 * Each keeps its own id, so a calendar that already has the event knows it
 * again. scripts/reminder-files.mjs writes them, and a test checks they still
 * match what this file would write.
 */
export const REMINDER_FILES: ReadonlyArray<{ readonly time: string; readonly uid: string }> = [
  { time: '07:00', uid: 'dbced16d-a924-45e0-a83f-e39878e3def5' },
  { time: '08:00', uid: 'acd018b7-e6a4-469c-ae80-848db13a0843' },
  { time: '09:00', uid: 'a6c0de92-05fb-4264-8cdf-7931bbb9b61d' },
  { time: '18:00', uid: '8e206c77-b221-44e8-a59f-ee3ce70fa6c1' },
  { time: '19:00', uid: '67754001-5252-4323-8497-f48c5ccb7907' },
  { time: '20:00', uid: '7ea10d3f-40b1-448e-bc72-166f4bfdac95' },
  { time: '20:30', uid: 'ac6dd3cc-b776-4903-8ce9-59e07a1f75a0' },
  { time: '21:00', uid: '59d0a768-1444-4098-b6fe-45901b18a8ca' },
]

/**
 * When the static files were made, and their first day: fixed, so writing
 * them again gives the same bytes. A first day in the past is harmless; a
 * daily event simply comes round from today.
 */
const REMINDER_FILES_MADE_AT = new Date('2026-10-27T00:00:00Z')
const REMINDER_FILES_FIRST_DAY = '2026-10-27'

/** A static file's name: morning-0800.ics, evening-1800.ics. */
export function staticReminderName(time: string): string {
  return `${time < '12:00' ? 'morning' : 'evening'}-${time.replace(':', '')}.ics`
}

/** A static file's text, exactly as public/reminders/ holds it. */
export function staticReminderText(file: { readonly time: string; readonly uid: string }): string {
  return calendarReminderText({
    time: file.time,
    firstDay: REMINDER_FILES_FIRST_DAY,
    uid: file.uid,
    madeAt: REMINDER_FILES_MADE_AT,
    link: REMINDER_FILES_ADDRESS,
  })
}

/** The static file for a time, by its name in public/reminders/, if there is one. */
export function staticReminderFor(time: string): string | undefined {
  return REMINDER_FILES.some((file) => file.time === time) ? staticReminderName(time) : undefined
}
