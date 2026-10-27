import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * Breathing with a butterfly (plan c.1): offered after a stormy check-in and
 * on the support page, a minute's session run on the page's own clock,
 * stopped early, and swept with axe at each stage.
 */

const GARDEN = { level: 1, name: 'Sunlit Sanctuary' } as const
const BREATHE = { level: 1, name: 'Breathe with Marigold' } as const

test.beforeEach(async ({ page }) => {
  // The page's own clock, which the tests run forward: a minute's session
  // takes a moment. Until then it keeps time as usual.
  await page.clock.install()
  await page.goto('/The-Butterfly-Garden/')
})

/**
 * Hold the page's clock still, a moment ahead, so a session's count can be
 * read second by second however long the machine takes between steps.
 * Accessibility sweeps run with it flowing again.
 */
async function holdClock(page: Page) {
  await page.clock.pauseAt(Date.now() + 1_000)
}

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.getByRole('heading', GARDEN)).toBeVisible()
}

/** How many animations each wing has: one while a session moves it, else none. */
function wingAnimations(page: Page) {
  return page
    .locator('.breath-pacer .wing')
    .evaluateAll((wings) => wings.map((wing) => wing.getAnimations().length))
}

test('a stormy check-in offers a minute of breathing, which counts as care once a day', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Today')
  await page.getByRole('button', { name: /^Stormy/ }).click()
  await page.getByRole('button', { name: /save check-in/i }).click()
  await expect(page.locator('.header-sunlight')).toContainText('1 / 5')
  const offer = page.getByRole('group', { name: /One small thing/ })
  await offer.getByRole('button', { name: 'Breathe with Marigold' }).click()

  await expect(page).toHaveURL(/#\/breathe$/)
  await expect(page.getByRole('heading', BREATHE)).toBeFocused()
  await expect(page.getByText('In… 4 · Out… 6')).toBeVisible()
  await expect(page.getByText('If you feel light-headed, breathe normally.')).toBeVisible()
  expect(await seriousViolations(page, 'Breathing, before a session')).toEqual([])

  await holdClock(page)
  await page.getByRole('button', { name: 'Start breathing' }).click()
  const stop = page.getByRole('button', { name: 'Stop' })
  await expect(stop).toBeFocused()
  await expect(stop).toBeInViewport()
  await expect(page.locator('.breath-count')).toHaveText('In… 1')
  // The wings move on the compositor, unless motion is to be kept still.
  const still = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  expect(await wingAnimations(page)).toEqual(still ? [0, 0] : [1, 1])
  await page.clock.runFor(4_100)
  await expect(page.locator('.breath-count')).toHaveText('Out… 1')
  await page.clock.resume()
  expect(await seriousViolations(page, 'Breathing, during a session')).toEqual([])

  await page.clock.runFor(60_000)
  await expect(page.getByRole('heading', { level: 2, name: 'All done' })).toBeFocused()
  await expect(page.getByText('That counts as care today.')).toBeVisible()
  await expect(page.locator('.header-sunlight')).toContainText('2 / 5')
  expect(await wingAnimations(page)).toEqual([0, 0])
  expect(await seriousViolations(page, 'Breathing, at the end')).toEqual([])

  // Again the same day: said to be counted already, and nothing more earned.
  await page.getByRole('button', { name: 'Breathe again' }).click()
  await page.clock.runFor(61_000)
  await expect(page.getByText('Already counted today.')).toBeVisible()
  await expect(page.locator('.header-sunlight')).toContainText('2 / 5')

  await page.getByRole('button', { name: 'Back to Today' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
})

test('Stop is one tap and counts nothing, and Escape goes back to support', async ({ page }) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByRole('button', { name: 'If you need support now' }).click()
  await page.getByRole('link', { name: 'breathe with Marigold' }).click()
  await expect(page.getByRole('heading', BREATHE)).toBeVisible()

  // The cyclic sigh, for three minutes.
  await page.getByRole('radio', { name: /Cyclic sigh/ }).check()
  await expect(page.getByText('In… 2 · In again… 1 · Out… 6')).toBeVisible()
  await expect(page.getByLabel('Breathe in')).toHaveCount(0)
  await page.getByRole('radio', { name: '3 minutes' }).check()
  expect(await seriousViolations(page, 'Breathing, choices made')).toEqual([])

  await holdClock(page)
  await page.getByRole('button', { name: 'Start breathing' }).click()
  await page.clock.runFor(2_100)
  await expect(page.locator('.breath-count')).toHaveText('In again… 1')
  await page.clock.runFor(20_000)
  await page.getByRole('button', { name: 'Stop' }).click()
  await expect(page.getByRole('button', { name: 'Start breathing' })).toBeFocused()
  await expect(page.getByText('Stopped. Come back whenever you like.')).toBeVisible()
  await page.clock.runFor(200_000)
  await expect(page.getByRole('heading', { name: 'All done' })).toHaveCount(0)
  await expect(page.locator('.header-sunlight')).toContainText('0 / 5')
  await page.clock.resume()
  expect(await seriousViolations(page, 'Breathing, stopped')).toEqual([])

  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { level: 1, name: 'If you need support now' })).toBeVisible()
})
