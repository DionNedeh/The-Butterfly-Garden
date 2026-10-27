import { describe, expect, it } from 'vitest'
import {
  calendarReminderText,
  escapeText,
  eveningReminderTime,
  foldLine,
  MORNING_REMINDER_TIME,
  REMINDER_FILES,
  REMINDER_FILES_ADDRESS,
  REMINDER_TITLE,
  reminderFileName,
  staticReminderFor,
  staticReminderName,
  staticReminderText,
  type CalendarReminder,
} from './calendarReminder'

const ADDRESS = 'https://dionnedeh.github.io/The-Butterfly-Garden/'

/** A visit at quarter past eight, made on a late October evening in New York. */
function reminder(overrides: Partial<CalendarReminder> = {}): CalendarReminder {
  return {
    time: '08:15',
    firstDay: '2026-10-27',
    uid: '0b8f4f6e-6c39-4a8e-9d3c-2f0e3c1a7b55',
    // 9:30pm on the 27th in New York is 01:30 on the 28th in UTC.
    madeAt: new Date(2026, 9, 27, 21, 30, 5),
    link: ADDRESS,
    ...overrides,
  }
}

const octets = (line: string) => new TextEncoder().encode(line).length

/** The content lines as a calendar reads them: folds undone (RFC 5545 3.1). */
function unfolded(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, '').split('\r\n').slice(0, -1)
}

/** The value of the first property with this name. */
function property(text: string, name: string): string | undefined {
  return unfolded(text)
    .find((line) => line.startsWith(`${name}:`))
    ?.slice(name.length + 1)
}

describe('a daily garden visit as a calendar file', () => {
  const text = calendarReminderText(reminder())

  it('is one calendar holding one event and its alert, in that order', () => {
    expect(unfolded(text).filter((line) => /^(BEGIN|END):/.test(line))).toEqual([
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'BEGIN:VALARM',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ])
    expect(property(text, 'PRODID')).toBe('-//The Butterfly Garden//Garden time//EN')
    expect(property(text, 'VERSION')).toBe('2.0')
    expect(property(text, 'CALSCALE')).toBe('GREGORIAN')
    expect(property(text, 'METHOD')).toBe('PUBLISH')
  })

  it('ends every line with CRLF, the last one too, and has no bare line feed or return', () => {
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('keeps every line within 75 octets', () => {
    const lines = text.split('\r\n')
    for (const line of lines) expect(octets(line)).toBeLessThanOrEqual(75)
    // The description is long enough to have been folded.
    expect(lines.some((line) => line.startsWith(' '))).toBe(true)
  })

  it('starts in floating local time, which follows the gardener across time zones', () => {
    expect(property(text, 'DTSTART')).toBe('20261027T081500')
    expect(unfolded(text).some((line) => line.includes('TZID'))).toBe(false)
  })

  it('is stamped in UTC', () => {
    expect(property(text, 'DTSTAMP')).toBe('20261028T013005Z')
  })

  it('comes round every day, for ten minutes, and is marked free', () => {
    expect(property(text, 'RRULE')).toBe('FREQ=DAILY')
    expect(property(text, 'DURATION')).toBe('PT10M')
    expect(property(text, 'TRANSP')).toBe('TRANSPARENT')
  })

  it('carries its own id, and a neutral title with nothing from the journal', () => {
    expect(property(text, 'UID')).toBe('0b8f4f6e-6c39-4a8e-9d3c-2f0e3c1a7b55')
    expect(property(text, 'SUMMARY')).toBe('Garden time 🦋')
    expect(REMINDER_TITLE).toBe('Garden time 🦋')
  })

  it('alerts with a display alert as the visit starts', () => {
    const lines = unfolded(text)
    const alarm = lines.slice(lines.indexOf('BEGIN:VALARM') + 1, lines.indexOf('END:VALARM'))
    expect(alarm).toEqual(['ACTION:DISPLAY', 'DESCRIPTION:Garden time 🦋', 'TRIGGER:PT0M'])
  })

  it("links back to the app's own address, and says how to stop", () => {
    expect(property(text, 'DESCRIPTION')).toBe(
      `Open The Butterfly Garden: ${ADDRESS}\\nTo stop these reminders\\, delete the event from your calendar.`,
    )
    expect(property(text, 'URL')).toBe(ADDRESS)
  })

  it('in the Android app, which has no address, says to open the app', () => {
    const android = calendarReminderText(reminder({ link: undefined }))
    expect(property(android, 'DESCRIPTION')).toBe(
      'Open The Butterfly Garden.\\nTo stop these reminders\\, delete the event from your calendar.',
    )
    expect(property(android, 'URL')).toBeUndefined()
  })

  it('writes an address only as a URL reads it, so it cannot add a line of its own', () => {
    const odd = calendarReminderText(reminder({ link: 'https://example.org/a b\r\nX-INJECTED:1' }))
    expect(unfolded(odd).some((line) => line.startsWith('X-INJECTED'))).toBe(false)
    expect(() => calendarReminderText(reminder({ link: 'not an address' }))).toThrow()
  })

  it('refuses a time, a day or a moment that is not one', () => {
    for (const time of ['8:15', '24:00', '08:60', '', '08:15:00'])
      expect(() => calendarReminderText(reminder({ time }))).toThrow(RangeError)
    for (const firstDay of ['2026-13-01', '27-10-2026', ''])
      expect(() => calendarReminderText(reminder({ firstDay }))).toThrow(RangeError)
    expect(() => calendarReminderText(reminder({ madeAt: new Date(Number.NaN) }))).toThrow(
      RangeError,
    )
  })

  it('reads, line by line, as it always has', () => {
    expect(text.split('\r\n')).toMatchSnapshot()
  })
})

describe('text in a calendar file', () => {
  it('escapes backslashes, semicolons, commas and every kind of line break', () => {
    expect(escapeText('a\\b')).toBe('a\\\\b')
    expect(escapeText('one; two, three')).toBe('one\\; two\\, three')
    expect(escapeText('a\nb\r\nc\rd')).toBe('a\\nb\\nc\\nd')
    // The backslash first, so an escape is never escaped again.
    expect(escapeText('\\;')).toBe('\\\\\\;')
    expect(escapeText('Garden time: 8:00')).toBe('Garden time: 8:00')
  })
})

describe('folding a long line', () => {
  it('leaves a line of 75 octets as it is', () => {
    const line = `SUMMARY:${'a'.repeat(67)}`
    expect(octets(line)).toBe(75)
    expect(foldLine(line)).toBe(line)
  })

  it('continues a longer one after a space, which counts toward the next 75', () => {
    // 212 octets: 75 on the first line, then a space and 74 at most.
    const line = `DESCRIPTION:${'b'.repeat(200)}`
    const parts = foldLine(line).split('\r\n')
    expect(parts.map(octets)).toEqual([75, 75, 64])
    expect(parts.slice(1).every((part) => part.startsWith(' ') && part[1] === 'b')).toBe(true)
    expect(foldLine(line).replace(/\r\n /g, '')).toBe(line)
  })

  it('never splits a character between lines', () => {
    // Each butterfly is four octets, so 75 is never reached exactly.
    const line = `SUMMARY:${'🦋'.repeat(40)}`
    const parts = foldLine(line).split('\r\n')
    for (const part of parts) {
      expect(octets(part)).toBeLessThanOrEqual(75)
      expect(part).not.toContain('�')
      expect(new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(part))).toBe(part)
    }
    expect(octets(parts[0])).toBe(72)
    expect(foldLine(line).replace(/\r\n /g, '')).toBe(line)
    // Two- and three-octet characters too.
    const mixed = `DESCRIPTION:${'é€'.repeat(30)}`
    expect(foldLine(mixed).replace(/\r\n /g, '')).toBe(mixed)
    for (const part of foldLine(mixed).split('\r\n')) expect(octets(part)).toBeLessThanOrEqual(75)
  })
})

describe('the times Settings offers', () => {
  it('starts the morning at 8:00, and the evening on the hour it starts', () => {
    expect(MORNING_REMINDER_TIME).toBe('08:00')
    expect(eveningReminderTime(18)).toBe('18:00')
    expect(eveningReminderTime(21)).toBe('21:00')
  })

  it("names a file made in the garden by its time", () => {
    expect(reminderFileName('08:15')).toBe('butterfly-garden-reminder-0815.ics')
  })
})

/**
 * public/reminders/, as the build will serve it. Read raw, so line endings
 * are compared exactly: a file whose CRLFs were converted fails here.
 */
const servedFiles = import.meta.glob<string>('/public/reminders/*', {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('the calendar files for common times', () => {
  it('are each exactly what this code writes for them', () => {
    expect(Object.keys(servedFiles).sort()).toEqual(
      REMINDER_FILES.map((file) => `/public/reminders/${staticReminderName(file.time)}`).sort(),
    )
    for (const file of REMINDER_FILES) {
      const served = servedFiles[`/public/reminders/${staticReminderName(file.time)}`]
      expect(served, `${staticReminderName(file.time)}: run node scripts/reminder-files.mjs`).toBe(
        staticReminderText(file),
      )
    }
  })

  it('cover the morning and the default evening, each with an id of its own', () => {
    expect(staticReminderFor('08:00')).toBe('morning-0800.ics')
    expect(staticReminderFor('18:00')).toBe('evening-1800.ics')
    expect(staticReminderFor('20:30')).toBe('evening-2030.ics')
    expect(staticReminderFor('08:15')).toBeUndefined()
    expect(new Set(REMINDER_FILES.map((file) => file.uid)).size).toBe(REMINDER_FILES.length)
  })

  it('link back to where the PWA is served', () => {
    expect(REMINDER_FILES_ADDRESS).toBe(ADDRESS)
    const morning = staticReminderText(REMINDER_FILES[1])
    expect(property(morning, 'DTSTART')).toBe('20261027T080000')
    expect(property(morning, 'URL')).toBe(ADDRESS)
  })
})
