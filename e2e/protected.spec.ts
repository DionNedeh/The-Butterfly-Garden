import { readFile } from 'node:fs/promises'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * A protected backup (plan c.5): made in Settings with a passphrase chosen
 * twice, downloaded, then restored into a garden on another "device" (a
 * fresh browser context, with storage of its own) through its passphrase,
 * the usual preview and the usual restore. Swept with axe in both themes.
 */

const PASSPHRASE = 'quiet meadow lantern'
const NOTE = 'Written before the move, kept under lock'

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

/** Another device: a context with storage of its own, shaped like this project's. */
async function anotherDevice(browser: Browser, baseURL: string | undefined) {
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, reducedMotion } =
    test.info().project.use
  const context = await browser.newContext({
    baseURL,
    viewport,
    isMobile,
    hasTouch,
    userAgent,
    deviceScaleFactor,
    reducedMotion,
  })
  const page = await context.newPage()
  await page.goto('/The-Butterfly-Garden/')
  return { context, page }
}

test('a protected backup is downloaded, then restored on another device with its passphrase', async ({
  page,
  browser,
  baseURL,
}) => {
  // Two gardens, two derivations at the full count, five axe sweeps.
  test.slow()
  await enterGarden(page)
  await goTo(page, 'Today')
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill(NOTE)
  await page.getByRole('button', { name: /save check-in/i }).click()

  await goTo(page, 'Settings')
  await expect(
    page.getByText('A protected backup needs a passphrase to open, so nobody can read your garden from the file without it.'),
  ).toBeVisible()
  const make = page.getByRole('button', { name: 'Download a protected backup…' })
  await make.click()
  const dialog = page.getByRole('dialog', { name: 'Download a protected backup' })
  await expect(dialog.getByRole('heading', { name: 'Download a protected backup' })).toBeFocused()
  await expect(dialog.getByText(/not you if it is forgotten/)).toBeVisible()
  expect(await seriousViolations(page, 'Protected backup, choosing a passphrase')).toEqual([])

  const first = dialog.getByLabel('Passphrase', { exact: true })
  const second = dialog.getByLabel('Passphrase again')
  await first.fill('short')
  await expect(dialog.getByText('Too short: at least 8 characters.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Lock the backup' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Use at least 8 characters for the passphrase.')
  await expect(first).toBeFocused()

  // The garden's own name, run together and dressed up, is weak; the
  // passphrase of unrelated words reads as good, and humbly.
  await first.fill('ButterflyGarden1')
  await expect(dialog.getByText(/^Weak: /)).toBeVisible()
  await first.fill(PASSPHRASE)
  await expect(
    dialog.getByText('Good: long, with no pattern this check can see. Longer and less guessable is stronger still.'),
  ).toBeVisible()
  await second.fill('quiet meadow lanterns')
  await dialog.getByRole('button', { name: 'Lock the backup' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('The two passphrases are not the same. Type the second one again.')
  await expect(second).toBeFocused()

  await second.fill(PASSPHRASE)
  await dialog.getByRole('button', { name: 'Lock the backup' }).click()
  const download = dialog.getByRole('button', { name: 'Download protected backup' })
  await expect(download).toBeFocused({ timeout: 15_000 })
  expect(await seriousViolations(page, 'Protected backup, ready')).toEqual([])

  const downloading = page.waitForEvent('download')
  await download.click()
  const file = await downloading
  expect(file.suggestedFilename()).toMatch(/^butterfly-garden-protected-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await file.path())!
  const text = await readFile(path, 'utf8')
  // Locked at the full count, and nothing of the journal or the passphrase shows.
  const envelope = JSON.parse(text) as { format: string; formatVersion: number; kdf: { iterations: number } }
  expect(envelope).toMatchObject({
    format: 'the-butterfly-garden-sealed',
    formatVersion: 1,
    kdf: { iterations: 600_000 },
  })
  expect(text).not.toContain(NOTE)
  expect(text).not.toContain('Sunlit Sanctuary')
  expect(text).not.toContain(PASSPHRASE)
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(/^Protected backup started\. Check your downloads/)).toBeVisible()
  await expect(make).toBeFocused()

  // The dialog by night, then put away with Escape.
  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-night/)
  await make.click()
  await expect(dialog.getByRole('heading', { name: 'Download a protected backup' })).toBeFocused()
  expect(await seriousViolations(page, 'Protected backup by night')).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(make).toBeFocused()

  // Another device: a new garden, then the protected file.
  const { context, page: other } = await anotherDevice(browser, baseURL)
  try {
    await enterGarden(other)
    await goTo(other, 'Settings')
    await other.getByRole('button', { name: 'Restore from a backup' }).click()
    await other.getByLabel('Backup file').setInputFiles(path)
    const prompt = other.getByRole('dialog', { name: 'This backup is protected' })
    await expect(prompt.getByRole('heading', { name: 'This backup is protected' })).toBeFocused()
    expect(await seriousViolations(other, 'Protected backup, asking for its passphrase')).toEqual([])

    const field = prompt.getByLabel('Passphrase', { exact: true })
    await field.fill('quiet meadow lanterN')
    await prompt.getByRole('button', { name: 'Open the backup' }).click()
    await expect(prompt.getByRole('alert')).toHaveText(
      'That passphrase does not open this backup. Check it and try again.',
      { timeout: 15_000 },
    )
    await expect(field).toBeFocused()
    await expect(prompt.getByText('Passphrases are exact: capitals, spaces and punctuation all count.')).toBeVisible()
    expect(await seriousViolations(other, 'Protected backup, a wrong passphrase')).toEqual([])

    await field.fill(PASSPHRASE)
    await prompt.getByRole('button', { name: 'Open the backup' }).click()
    const preview = other.getByRole('heading', { name: 'This backup holds Sunlit Sanctuary' })
    await expect(preview).toBeFocused({ timeout: 15_000 })
    await expect(prompt).toHaveCount(0)
    await expect(other.getByText('A protected backup, opened with its passphrase')).toBeVisible()
    await expect(other.getByText(/^1 check-in,/)).toBeVisible()

    await other.getByRole('button', { name: 'Switch to night mode' }).click()
    await expect(other.locator('.app-shell')).toHaveClass(/theme-night/)
    expect(await seriousViolations(other, 'Protected backup’s restore preview by night')).toEqual([])

    await other.getByRole('button', { name: 'Restore this backup' }).click()
    await expect(other.getByText('Your garden was restored from the backup.')).toBeVisible()
    await expect(other.getByRole('button', { name: 'Undo the restore' })).toBeVisible()
    await goTo(other, 'Journal')
    await expect(other.getByText(NOTE)).toBeVisible()
  } finally {
    await context.close()
  }
})

test('a protected backup chosen at the welcome asks for its passphrase and brings the garden', async ({
  page,
  browser,
  baseURL,
}) => {
  test.slow()
  await enterGarden(page)
  await goTo(page, 'Today')
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill(NOTE)
  await page.getByRole('button', { name: /save check-in/i }).click()
  await goTo(page, 'Settings')
  await page.getByRole('button', { name: 'Download a protected backup…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Download a protected backup' })
  await dialog.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE)
  await dialog.getByLabel('Passphrase again').fill(PASSPHRASE)
  await dialog.getByRole('button', { name: 'Lock the backup' }).click()
  const downloading = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Download protected backup' }).click({ timeout: 15_000 })
  const path = (await (await downloading).path())!

  const { context, page: other } = await anotherDevice(browser, baseURL)
  try {
    await other.getByRole('button', { name: 'I have a backup' }).click()
    await other.getByLabel('Choose a backup').setInputFiles(path)
    const prompt = other.getByRole('dialog', { name: 'This backup is protected' })
    await expect(prompt).toBeVisible()
    // Put away, nothing is brought and the welcome stays.
    await prompt.getByRole('button', { name: 'Cancel' }).click()
    await expect(prompt).toHaveCount(0)
    await expect(other.getByRole('heading', { name: 'Welcome to your butterfly garden' })).toBeVisible()

    await other.getByLabel('Choose a backup').setInputFiles(path)
    await prompt.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE)
    await prompt.getByRole('button', { name: 'Open the backup' }).click()
    await expect(other.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible({
      timeout: 15_000,
    })
    await goTo(other, 'Journal')
    await expect(other.getByText(NOTE)).toBeVisible()
  } finally {
    await context.close()
  }
})
