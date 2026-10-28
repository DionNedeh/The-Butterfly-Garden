import { readFile } from 'node:fs/promises'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * Move to a new device (plan c.6): Settings makes a move file, a protected
 * backup locked with a one-time code, shown as twelve numbered words.
 * The file is downloaded, then a fresh browser context (a
 * new device, with storage of its own) arrives with it, typing the words.
 * Swept with axe in both themes.
 */

const NOTE = 'Written before the move, carried across'
/** Making or opening a move file runs the full key derivation. */
const DERIVING = { timeout: 15_000 }
/** The arriving dialog, named by its step's heading: the file, then its code. */
const ARRIVING = /^(Arrive from another device|Open the move file)$/

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

async function checkIn(page: Page) {
  await goTo(page, 'Today')
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill(NOTE)
  await page.getByRole('button', { name: /save check-in/i }).click()
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

/** Settings → Move my garden, made and downloaded: the file's path and the code shown. */
async function makeMoveFile(page: Page, label: string) {
  await goTo(page, 'Settings')
  const open = page.getByRole('button', { name: 'Move my garden to another device…' })
  await open.click()
  const dialog = page.getByRole('dialog', {
    name: /^(Move my garden to another device|Send the move file|Your one-time code)$/,
  })
  await expect(dialog.getByRole('heading', { name: 'Move my garden to another device' })).toBeFocused()
  await expect(dialog.getByText(/because the code never travels with it/)).toBeVisible()
  expect(await seriousViolations(page, `Move, before the file ${label}`)).toEqual([])

  await dialog.getByRole('button', { name: 'Make the move file' }).click()
  const download = dialog.getByRole('button', { name: 'Download the move file' })
  await expect(download).toBeVisible(DERIVING)
  const share = dialog.getByRole('button', { name: 'Share the move file…' })
  await expect(await share.count() ? share : download).toBeFocused(DERIVING)
  expect(await seriousViolations(page, `Move, the file ready ${label}`)).toEqual([])

  const downloading = page.waitForEvent('download')
  await download.click()
  const file = await downloading
  expect(file.suggestedFilename()).toMatch(/^butterfly-garden-move-\d{4}-\d{2}-\d{2}\.json$/)
  const path = (await file.path())!

  await expect(dialog.getByRole('heading', { name: 'Your one-time code' })).toBeFocused()
  await expect(dialog.getByRole('status')).toHaveText('Move file downloading. Check your downloads.')
  await expect(dialog.getByText(/This code is shown once, only on this screen/)).toBeVisible()
  const words = await dialog
    .getByRole('list', { name: 'The one-time code, 12 words' })
    .getByRole('listitem')
    .allTextContents()
  expect(words).toHaveLength(12)
  for (const word of words) expect(word).toMatch(/^[a-z]{3,8}$/)
  expect(await seriousViolations(page, `Move, the code shown ${label}`)).toEqual([])
  return { path, words, open, dialog }
}

test('a move file is downloaded with a one-time code, and a fresh device arrives by typing the words', async ({
  page,
  browser,
  baseURL,
}) => {
  // Two derivations at the full count, and many axe sweeps.
  test.slow()
  await enterGarden(page)
  await checkIn(page)
  const { path, words, open, dialog } = await makeMoveFile(page, 'by day')

  // Locked at the full count, marked as a move file, and nothing of the
  // journal or the code shows in it.
  const text = await readFile(path, 'utf8')
  const envelope = JSON.parse(text) as Record<string, unknown>
  expect(envelope).toMatchObject({
    format: 'the-butterfly-garden-sealed',
    formatVersion: 1,
    opensWith: 'move-code',
    kdf: { iterations: 600_000 },
  })
  expect(text).not.toContain(NOTE)
  expect(text).not.toContain('Sunlit Sanctuary')
  expect(text).not.toContain(words.join(' '))

  // Done forgets the code; focus goes back where it began.
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(open).toBeFocused()
  await expect(page.getByText(words.join(' '))).toHaveCount(0)

  // Another device: arrive from the welcome, with the words typed carelessly.
  const { context, page: other } = await anotherDevice(browser, baseURL)
  try {
    const arrive = other.getByRole('button', { name: 'Arrive from another device' })
    await arrive.click()
    const arriving = other.getByRole('dialog', { name: ARRIVING })
    await expect(arriving.getByRole('heading', { name: 'Arrive from another device' })).toBeFocused()
    expect(await seriousViolations(other, 'Arrive, choosing the file')).toEqual([])

    await arriving.getByLabel('Choose the move file').setInputFiles(path)
    await expect(arriving.getByRole('heading', { name: 'Open the move file' })).toBeFocused()
    const field = arriving.getByLabel('The 12 words')

    // A slip is named, with the word it was probably meant to be.
    const slip = `${words[0]}x`
    await field.fill([slip, ...words.slice(1)].join(' '))
    await arriving.getByRole('button', { name: 'Open the file' }).click()
    await expect(arriving.getByRole('alert')).toContainText(`“${slip}” is not one of the code’s words.`)
    await expect(field).toBeFocused()
    expect(await seriousViolations(other, 'Arrive, a misspelt word')).toEqual([])

    await field.fill(`1. ${words.slice(0, 6).join('  ').toUpperCase()}\n${words.slice(6).join(' ')}`)
    await arriving.getByRole('button', { name: 'Open the file' }).click()
    await expect(other.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible(DERIVING)
    await expect(arriving).toHaveCount(0)
    await goTo(other, 'Journal')
    await expect(other.getByText(NOTE)).toBeVisible()
  } finally {
    await context.close()
  }
})

test('by night, a move file arrives through Settings’ restore, with the usual preview', async ({
  page,
  browser,
  baseURL,
}) => {
  test.slow()
  await enterGarden(page)
  await checkIn(page)
  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-night/)
  const { path, words, dialog, open } = await makeMoveFile(page, 'by night')

  // Escape puts it away, and the code with it.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(open).toBeFocused()

  const { context, page: other } = await anotherDevice(browser, baseURL)
  try {
    await enterGarden(other)
    await other.getByRole('button', { name: 'Switch to night mode' }).click()
    await expect(other.locator('.app-shell')).toHaveClass(/theme-night/)
    await goTo(other, 'Settings')
    await other.getByRole('button', { name: 'Restore from a backup' }).click()
    await other.getByRole('button', { name: 'Arrive from another device…' }).click()
    const arriving = other.getByRole('dialog', { name: ARRIVING })
    await expect(arriving.getByRole('heading', { name: 'Arrive from another device' })).toBeFocused()
    expect(await seriousViolations(other, 'Arrive by night, choosing the file')).toEqual([])
    await arriving.getByLabel('Choose the move file').setInputFiles(path)
    await expect(arriving.getByRole('heading', { name: 'Open the move file' })).toBeFocused()
    expect(await seriousViolations(other, 'Arrive by night, the code')).toEqual([])

    await arriving.getByLabel('The 12 words').fill(words.join(' '))
    await arriving.getByRole('button', { name: 'Open the file' }).click()
    const preview = other.getByRole('heading', { name: 'This backup holds Sunlit Sanctuary' })
    await expect(preview).toBeFocused(DERIVING)
    await expect(other.getByText('A move file, opened with its one-time code')).toBeVisible()
    await expect(other.getByText(/^1 check-in,/)).toBeVisible()
    expect(await seriousViolations(other, 'Arrive by night, the restore preview')).toEqual([])

    await other.getByRole('button', { name: 'Restore this backup' }).click()
    await expect(other.getByText('Your garden was restored from the backup.')).toBeVisible()
    await goTo(other, 'Journal')
    await expect(other.getByText(NOTE)).toBeVisible()
  } finally {
    await context.close()
  }
})

test('the code holds together at the largest text on a narrow phone', async ({ page }) => {
  test.slow()
  await page.setViewportSize({ width: 360, height: 780 })
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByRole('group', { name: 'Text size' }).getByRole('radio', { name: /^Largest/ }).check()
  const { dialog } = await makeMoveFile(page, 'at the largest text')
  const fits = await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
  expect(fits).toBe(true)
  for (const button of await dialog.getByRole('button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})

test.describe('arrival when the app cannot draw', () => {
  test.use({ serviceWorkers: 'block' })
  test('safe mode opens the move file and keeps the restored garden under the current lock', async ({ page }) => {
    test.slow()
    await enterGarden(page)
    await checkIn(page)
    const { path, words, dialog } = await makeMoveFile(page, 'for safe mode')
    await dialog.getByRole('button', { name: 'Done' }).click()
    const watch = /\/assets\/LockWatch-[\w-]+\.js$/
    await page.route(watch, (route) => route.abort())
    await goTo(page, 'Settings')
    await page.getByRole('button', { name: 'Lock my garden…' }).click()
    const setup = page.getByRole('dialog', { name: 'Choose a passcode' })
    const passcode = 'kingfisher at the old mill'
    await setup.getByLabel('Passcode', { exact: true }).fill(passcode)
    await setup.getByLabel('The same passcode again').fill(passcode)
    await setup.getByRole('button', { name: 'Next: your recovery code' }).click()
    const sheet = page.getByRole('dialog', { name: 'Save your recovery code' })
    const recovery = await sheet.getByRole('listitem').allTextContents()
    await sheet.getByRole('button', { name: 'I have kept the words' }).click()
    const confirm = page.getByRole('dialog', { name: 'Check two words' })
    for (const field of await confirm.getByRole('textbox', { name: /^Word \d+$/ }).all()) {
      const position = Number(/\d+/.exec((await field.evaluate((element) => element.closest('label')?.textContent)) ?? '')?.[0])
      await field.fill(recovery[position - 1])
    }
    await confirm.getByRole('button', { name: 'Lock my garden' }).click()
    await expect(page.getByRole('heading', { name: 'The garden hit a problem it could not draw' })).toBeVisible(DERIVING)
    await page.unroute(watch)
    await page.getByRole('button', { name: 'Arrive from another device' }).click()
    await page.getByLabel('Choose the move file').setInputFiles(path)
    await page.getByLabel('The 12 words').fill(words.join(' '))
    await expect(page.getByRole('button', { name: 'Scan the QR code' })).toHaveCount(0)
    expect(await seriousViolations(page, 'Safe mode, arriving with words')).toEqual([])
    await page.getByRole('button', { name: 'Open the file' }).click()
    await expect(page.getByRole('heading', { name: 'Your garden is resting' })).toBeVisible(DERIVING)
    await page.getByLabel('Passcode', { exact: true }).fill(passcode)
    await page.getByRole('button', { name: 'Open my garden', exact: true }).click()
    await goTo(page, 'Journal')
    await expect(page.getByText(NOTE)).toBeVisible()
  })
})
