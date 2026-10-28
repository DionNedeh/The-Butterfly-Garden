import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * Calendar reminders (docs/Voyager c.9): a daily garden visit handed to the
 * gardener's own calendar as a file, and the files the PWA serves for a few
 * common times, which an iPhone or iPad is linked to.
 */

const BUTTON = 'Add a daily garden visit to my calendar'

test.beforeEach(async ({ page }) => {
  await page.goto('/The-Butterfly-Garden/')
})

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
}

function remindersCard(page: Page) {
  return page.locator('section', {
    has: page.getByRole('heading', { name: 'A daily garden visit' }),
  })
}

/** The content lines as a calendar reads them, with their folds undone. */
function contentLines(text: string): string[] {
  return text.replace(/\r\n[ \t]/g, '').split('\r\n')
}

test('adds a daily garden visit to the calendar as a file, and offers its time again', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  const card = remindersCard(page)
  await expect(
    card.getByText(/^Your calendar will remind you; the garden never sends notifications\./),
  ).toBeVisible()
  await expect(card.getByText(/^To stop, delete the event in your calendar\./)).toBeVisible()
  const time = card.getByLabel('Remind me at')
  await expect(time).toHaveValue('08:00')
  await expect(card.getByRole('radio', { name: /^Morning check-in/ })).toBeChecked()
  // Moonlight comes at the gardener's evening, 6pm until they move it.
  await card.getByRole('radio', { name: /^Evening Moonlight/ }).check()
  await expect(time).toHaveValue('18:00')
  await time.fill('07:45')
  await expect(card.getByRole('radio', { name: /^Morning check-in/ })).not.toBeChecked()
  await expect(card.getByRole('radio', { name: /^Evening Moonlight/ })).not.toBeChecked()
  expect(await seriousViolations(page, 'Settings, reminders')).toEqual([])

  const downloadPromise = page.waitForEvent('download')
  await card.getByRole('button', { name: BUTTON }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('butterfly-garden-reminder-0745.ics')
  const text = await readFile((await download.path())!, 'utf8')

  // CRLF line ends throughout, and no line longer than 75 octets.
  expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
  expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  for (const line of text.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75)
  const lines = contentLines(text)
  expect(lines[0]).toBe('BEGIN:VCALENDAR')
  expect(lines).toContain('VERSION:2.0')
  // Floating local time: no zone and no Z, so 7:45 stays 7:45 anywhere.
  expect(lines.find((line) => line.startsWith('DTSTART'))).toMatch(/^DTSTART:\d{8}T074500$/)
  expect(lines.find((line) => line.startsWith('DTSTAMP'))).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/)
  expect(lines).toContain('RRULE:FREQ=DAILY')
  expect(lines).toContain('DURATION:PT10M')
  expect(lines).toContain('SUMMARY:Garden time 🦋')
  expect(lines).toContain('ACTION:DISPLAY')
  expect(lines).toContain('TRIGGER:PT0M')
  // The way back is this copy of the garden's own address.
  const address = new URL('/The-Butterfly-Garden/', page.url()).href
  expect(lines).toContain(`URL:${address}`)
  expect(lines.find((line) => line.startsWith('DESCRIPTION:Open'))).toBe(
    `DESCRIPTION:Open The Butterfly Garden: ${address}\\nTo stop these reminders\\, delete the event from your calendar.`,
  )
  await expect(card.getByRole('status')).toHaveText(
    'Your calendar file is downloading. Open it to add the visit to your calendar.',
  )

  // The time is all the garden keeps of it, and Settings offers it again.
  await page.waitForTimeout(250)
  await page.reload()
  await expect(remindersCard(page).getByLabel('Remind me at')).toHaveValue('07:45')
})

test('serves the files for common times as calendar files', async ({ page }) => {
  const response = await page.request.get('/The-Butterfly-Garden/reminders/morning-0800.ics')
  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toMatch(/^text\/calendar/)
  const lines = contentLines(await response.text())
  expect(lines[0]).toBe('BEGIN:VCALENDAR')
  expect(lines).toContain('DTSTART:20261027T080000')
  expect(lines).toContain('RRULE:FREQ=DAILY')
  expect(lines).toContain('URL:https://dionnedeh.github.io/The-Butterfly-Garden/')
})

test("a link to one reaches the file, not the app the service worker keeps", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Chromium downloads a calendar file it is sent to.')
  await enterGarden(page)
  // Once the service worker is active it answers every navigation in its
  // scope; a calendar file must be passed through to the server.
  await page.evaluate(() => navigator.serviceWorker.ready)
  const downloadPromise = page.waitForEvent('download')
  await page.goto('/The-Butterfly-Garden/reminders/evening-1800.ics').catch(() => undefined)
  const download = await downloadPromise
  const lines = contentLines(await readFile((await download.path())!, 'utf8'))
  expect(lines).toContain('DTSTART:20261027T180000')
})
