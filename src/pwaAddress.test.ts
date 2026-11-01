import { describe, expect, it } from 'vitest'
import script from '../scripts/reminder-files.mjs?raw'
import { REMINDER_FILES_ADDRESS, REMINDER_FILES, staticReminderText } from './lib/calendarReminder'
import pwa from './pwaAddress.json' with { type: 'json' }

/*
 * Where the PWA is served is written down once, in pwaAddress.json, and read
 * by the app (lib/calendarReminder) and by scripts/reminder-files.mjs, which
 * writes the calendar files that link back to it. Moving the garden to an
 * address of its own (docs/moving-the-garden.md) changes it there, and
 * nowhere else in the code.
 */
describe('5.1 the address the PWA is served from', () => {
  it('is a whole https address, ending at the app’s own path', () => {
    const address = new URL(pwa.address)
    expect(address.protocol).toBe('https:')
    expect(address.href).toBe(pwa.address)
    expect(address.pathname.endsWith('/')).toBe(true)
    expect(address.search + address.hash).toBe('')
  })

  it('is the one the calendar files link back to', () => {
    expect(REMINDER_FILES_ADDRESS).toBe(pwa.address)
    expect(staticReminderText(REMINDER_FILES[0])).toContain(`URL:${pwa.address}`)
  })

  it('is read by the script that writes those files, which keeps no copy of its own', () => {
    expect(script).toContain("from '../src/pwaAddress.json' with { type: 'json' }")
    expect(script).not.toMatch(/https:\/\//)
  })
})
