import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * "Your garden's year" (plan c.4): opened from the Journal's quiet link,
 * swept with axe, quoting a line only once it is starred, and ending in a
 * postcard drawn on the device, previewed, and saved as a download.
 *
 * The zone and the instant are pinned to a morning in late October, when the
 * Journal offers the year as a quiet link rather than its December line, and
 * the year on the page and the postcard is 2026.
 */
test.use({ timezoneId: 'UTC' })

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
}

test('the year opens from the Journal, quotes only a starred line, and makes a postcard', async ({
  page,
  browserName,
}) => {
  // Two accessibility sweeps, four pages and an image drawn and saved.
  test.slow()
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00.000Z'))
  await page.goto('/The-Butterfly-Garden/')
  await enterGarden(page)
  await goTo(page, 'Today')
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill('The light on the river after work')
  await page.getByRole('button', { name: /save check-in/i }).click()

  await goTo(page, 'Journal')
  const link = page.getByRole('link', { name: 'Your garden’s year' })
  await link.click()
  await expect(page).toHaveURL(/#\/year$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Your garden’s 2026' })).toBeFocused()
  const journal = page.getByRole('region', { name: 'What you wrote' })
  await expect(journal.getByText('In 2026 you checked in on one day.')).toBeVisible()
  await expect(journal.getByText(/^Days you cared for yourself: \d+\.$/)).toBeVisible()
  const weather = page.getByRole('region', { name: 'The year’s weather' })
  await expect(weather.getByRole('img', { name: /: Bright$/ })).toHaveCount(1)
  const lines = page.getByRole('region', { name: 'Lines you starred' })
  // Never a line the gardener did not star.
  await expect(lines.getByText('The light on the river after work')).toHaveCount(0)
  await expect(lines.getByText('A line you star in your journal can be kept here.')).toBeVisible()
  expect(await seriousViolations(page, 'Your garden’s year')).toEqual([])

  // Back in the Journal at the link that opened it; starred, the line is kept.
  await page.getByRole('button', { name: 'Back to the Journal' }).click()
  await expect(link).toBeFocused()
  await page.locator('#day-2026-10-27').getByRole('button', { name: 'Star this line' }).click()
  await link.click()
  await expect(lines.getByText('The light on the river after work')).toBeVisible()

  // The postcard is made only when asked, here, and goes nowhere by itself.
  const postcard = page.getByRole('region', { name: 'A postcard of your garden' })
  await expect(postcard.getByRole('img')).toHaveCount(0)
  await postcard.getByRole('button', { name: 'Make a postcard' }).click()
  await expect(postcard.getByRole('status')).toHaveText('Your postcard is ready.')
  const preview = postcard.getByRole('img', { name: /^A postcard of Sunlit Sanctuary for 2026/ })
  await expect(preview).toBeVisible()
  // Drawn here, at the postcard's own size, from the scene and Marigold, the
  // garden's one butterfly so far.
  expect(await preview.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([1500, 1000])
  if (browserName === 'chromium') {
    await expect(preview).toHaveAttribute(
      'alt',
      'A postcard of Sunlit Sanctuary for 2026: a Monarch, over the Sunlit Meadow.',
    )
  }
  await expect(postcard.getByRole('button', { name: 'Make it again' })).toBeFocused()
  expect(await seriousViolations(page, 'Your garden’s year, with its postcard')).toEqual([])

  const download = page.waitForEvent('download')
  await postcard.getByRole('button', { name: 'Save image' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('butterfly-garden-postcard-2026.jpg')
  const bytes = await readFile(await file.path())
  // A JPEG, made on this device.
  expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
  await expect(postcard.getByRole('status')).toHaveText(
    'Your postcard is downloading. Check your downloads.',
  )

  // Escape leaves, as the back gesture does, for the Journal and its link.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible()
  await expect(link).toBeFocused()
})
