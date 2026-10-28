#!/usr/bin/env node
/**
 * Write the calendar files for common reminder times into public/reminders/.
 *
 *   node scripts/reminder-files.mjs
 *
 * iOS opens a calendar file most reliably from a plain link to one served as
 * text/calendar, so Settings links an iPhone or iPad to these for the times
 * they cover (src/lib/calendarReminder.ts, components/ReminderSetting.tsx).
 * They are written by the same code the app uses for any other time, run
 * here as TypeScript (Node 22.18 and later strip the types), and
 * src/lib/calendarReminder.test.ts fails if a file no longer matches it, so
 * the two never drift. Run this after changing that code, and commit the
 * files it writes. Their CRLF line endings are part of the format; the
 * repository's .gitattributes keeps git from changing them.
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import {
  REMINDER_FILES,
  staticReminderName,
  staticReminderText,
} from '../src/lib/calendarReminder.ts'

const OUT = new URL('../public/reminders/', import.meta.url)

await mkdir(OUT, { recursive: true })
// A time no longer listed leaves no file behind.
const wanted = new Set(REMINDER_FILES.map((file) => staticReminderName(file.time)))
for (const name of await readdir(OUT)) {
  if (name.endsWith('.ics') && !wanted.has(name)) await rm(new URL(name, OUT))
}
for (const file of REMINDER_FILES) {
  const name = staticReminderName(file.time)
  await writeFile(new URL(name, OUT), staticReminderText(file))
  console.log(`public/reminders/${name}`)
}
