import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * Move and keep (plan c.6): the earlier copies kept on this device, one a
 * day the garden changed, looked at and put back with the usual preview and
 * undo; and a backup file kept up to date, offered only where the browser
 * has a save screen that hands the page a file to keep.
 *
 * The zone is pinned, and the clock fixed and then moved on, so a "next
 * day" is a day later by the garden's own calendar. The file chosen is one
 * in the origin's private file system (navigator.storage.getDirectory): a
 * real file handle, which IndexedDB keeps and the page can read back, behind
 * a stand-in for the save screen a person would answer.
 */
test.use({ timezoneId: 'UTC' })

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
}

async function checkIn(page: Page, note: string) {
  await goTo(page, 'Today')
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill(note)
  await page.getByRole('button', { name: /(?:save|update) check-in/i }).click()
  // Let the write land before anything reloads or reads it.
  await page.waitForTimeout(250)
}

test('a day’s copy is kept before its first change, and one is put back and undone', async ({
  page,
}) => {
  // Two days, a reload, three accessibility sweeps.
  test.slow()
  await page.clock.setFixedTime(new Date('2026-10-26T10:00:00.000Z'))
  await page.goto('/The-Butterfly-Garden/')
  await enterGarden(page)
  await checkIn(page, 'Before the move')

  // The next day.
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00.000Z'))
  await page.reload()
  await checkIn(page, 'A second day')

  await goTo(page, 'Settings')
  await expect(page.getByRole('heading', { name: 'Earlier copies on this device' })).toBeVisible()
  await expect(
    page.getByText(/cannot help if the browser clears the site’s storage; a backup file can/),
  ).toBeVisible()
  const latest = page.getByRole('button', { name: 'Look at this copy, from Tuesday, October 27, 2026' })
  const earliest = page.getByRole('button', { name: 'Look at this copy, from Monday, October 26, 2026' })
  await expect(latest).toBeVisible()
  await expect(earliest).toBeVisible()
  await expect(page.getByRole('listitem').filter({ has: latest })).toContainText(
    '1 check-in, 0 reflections and 0 goals',
  )
  await expect(page.getByRole('listitem').filter({ has: earliest })).toContainText(
    '0 check-ins, 0 reflections and 0 goals',
  )
  await expect(page.getByText(/of it for earlier copies\./)).toBeVisible()
  expect(await seriousViolations(page, 'Settings, earlier copies')).toEqual([])

  // Looked at in the restore preview, then kept as it is.
  await latest.click()
  const preview = page.getByRole('heading', { name: 'This copy holds Sunlit Sanctuary' })
  await expect(preview).toBeFocused()
  await expect(
    page.getByText('Kept on this device before your changes on Tuesday, October 27, 2026'),
  ).toBeVisible()
  await expect(page.getByText('1 check-in, 0 reflections and 0 evening recaps')).toBeVisible()
  expect(await seriousViolations(page, 'Settings, an earlier copy’s preview')).toEqual([])
  await page.getByRole('button', { name: 'Keep the garden as it is' }).click()
  await expect(preview).toHaveCount(0)
  await expect(latest).toBeFocused()

  // Put back: the day's own check-in goes, and the undo takes the focus.
  await latest.click()
  await page.getByRole('button', { name: 'Put this copy back' }).click()
  await expect(
    page.getByText(
      'Your garden is back to how it was before your changes on Tuesday, October 27, 2026.',
    ),
  ).toBeVisible()
  const undo = page.getByRole('button', { name: 'Undo the restore' })
  await expect(undo).toBeFocused()
  await goTo(page, 'Journal')
  await expect(page.getByText('Before the move')).toBeVisible()
  await expect(page.getByText('A second day')).toHaveCount(0)

  // And undone, as any restore is.
  await goTo(page, 'Settings')
  await page.getByRole('button', { name: 'Undo the restore' }).click()
  await expect(page.getByText('Your garden is back to how it was before the restore.')).toBeVisible()
  await goTo(page, 'Journal')
  await expect(page.getByText('A second day')).toBeVisible()

  // The pre-restore copy remains reachable after a reload, beyond the toast.
  await checkIn(page, 'Written after undo')
  await goTo(page, 'Settings')
  await page.reload()
  const keptRestore = page.getByRole('listitem').filter({ hasText: 'Before a restore' }).first()
  await keptRestore.getByRole('button', { name: /Look at this copy/ }).click()
  await expect(page.getByText(/Kept before a restore on/)).toBeVisible()
  await page.getByRole('button', { name: 'Put this copy back' }).click()
  await goTo(page, 'Journal')
  await expect(page.getByText('A second day')).toBeVisible()
  await expect(page.getByText('Written after undo')).toHaveCount(0)
  await goTo(page, 'Settings')
  const restoreRow = page.getByRole('listitem').filter({ hasText: 'Before a restore' }).first()
  const beforeCount = await page.getByRole('listitem').filter({ hasText: 'Before a restore' }).count()
  await restoreRow.getByRole('button', { name: /^Discard copy,/ }).click()
  await restoreRow.getByRole('button', { name: 'Discard this copy' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Before a restore' })).toHaveCount(beforeCount - 1)
  expect(await seriousViolations(page, 'Settings, kept restore after reload and discard')).toEqual([])
})

test('a backup file kept up to date is not offered where the browser has no save screen for it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Window.prototype, 'showSaveFilePicker')
    Reflect.deleteProperty(window, 'showSaveFilePicker')
  })
  await page.goto('/The-Butterfly-Garden/')
  await enterGarden(page)
  await goTo(page, 'Settings')
  await expect(page.getByRole('button', { name: 'Download a backup' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Earlier copies on this device' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Keep a backup file up to date' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Choose a backup file…' })).toHaveCount(0)
})

/** What the file in the origin's private file system holds, or '' before it exists. */
async function fileText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const folder = await navigator.storage.getDirectory()
    try {
      const handle = await folder.getFileHandle('garden-backup.json')
      return await (await handle.getFile()).text()
    } catch {
      return ''
    }
  })
}

/** The page hidden, as switching tabs or closing it does, or shown again. */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((hide) => {
    if (hide) Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    else Reflect.deleteProperty(document, 'visibilityState')
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

test('a backup file is chosen once, written then and as the page is hidden, and can be let go', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'The kept-file picker is a Chromium desktop API; other engines keep ordinary downloads.')
  // Two accessibility sweeps and a file read back three times.
  test.slow()
  await page.addInitScript(() => {
    // The save screen, answered: a file in the origin's own private file system.
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      value: async () =>
        (await navigator.storage.getDirectory()).getFileHandle('garden-backup.json', { create: true }),
    })
  })
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00.000Z'))
  await page.goto('/The-Butterfly-Garden/')
  await enterGarden(page)
  await goTo(page, 'Settings')
  await expect(page.getByRole('heading', { name: 'Keep a backup file up to date' })).toBeVisible()
  expect(await seriousViolations(page, 'Settings, a backup file to keep')).toEqual([])

  await page.getByRole('button', { name: 'Choose a backup file…' }).click()
  const status = page.getByText(/^garden-backup\.json was last written today at 10:00/i)
  await expect(status).toBeFocused({ timeout: 15_000 })
  await expect.poll(() => fileText(page)).toContain('"format": "the-butterfly-garden"')
  expect(await fileText(page)).toContain('Sunlit Sanctuary')
  expect(await seriousViolations(page, 'Settings, a backup file kept')).toEqual([])

  // A change is not written at once; it is as the page is hidden.
  await page.clock.setFixedTime(new Date('2026-10-27T10:01:00.000Z'))
  await checkIn(page, 'Kept in the file too')
  expect(await fileText(page)).not.toContain('Kept in the file too')
  await page.clock.setFixedTime(new Date('2026-10-27T10:15:00.000Z'))
  await setHidden(page, true)
  await expect.poll(() => fileText(page)).toContain('Kept in the file too')
  await setHidden(page, false)

  await goTo(page, 'Settings')
  await expect(page.getByText(/^garden-backup\.json was last written today at 10:15/i)).toBeVisible()
  await page.getByRole('button', { name: 'Stop updating this file' }).click()
  await expect(
    page.getByText('garden-backup.json stays as it was last written, and is no longer updated.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose a backup file…' })).toBeFocused()
})
