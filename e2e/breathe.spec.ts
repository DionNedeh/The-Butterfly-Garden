import { expect, test, type Locator, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * Breathing with a butterfly (plan c.1): offered after a stormy check-in, on
 * a breathing goal and on the support page, a minute's session run on the
 * page's own clock, stopped early, and swept with axe at each stage; the way
 * back to the link that opened it; and where the count and Stop sit on a
 * short screen.
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
  await expect(page.getByRole('combobox', { name: 'Breathe in' })).toHaveCount(0)
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

/** The support page's way into breathing, from Settings. */
async function breatheFromSupport(page: Page) {
  await goTo(page, 'Settings')
  await page.getByRole('button', { name: 'If you need support now' }).click()
  await page.getByRole('link', { name: 'breathe with Marigold' }).click()
  await expect(page.getByRole('heading', BREATHE)).toBeFocused()
}

async function box(locator: Locator) {
  const found = await locator.boundingBox()
  expect(found).not.toBeNull()
  return found!
}

type Box = Awaited<ReturnType<typeof box>>

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

const scrollY = (page: Page) => page.evaluate(() => window.scrollY)

test('back from a breathing goal puts focus on its "Breathe now", where it was', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Today')
  for (const title of ['Water the fern', 'Stretch', 'Open a window', 'Take three slow breaths']) {
    await page.getByLabel('Add a goal').fill(title)
    await page.getByRole('button', { name: 'Add goal' }).click()
  }
  const link = page.getByRole('link', { name: 'Breathe now' })
  await expect(link).toHaveCount(1)
  await link.focus()
  const before = await scrollY(page)

  // By its Back button.
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', BREATHE)).toBeFocused()
  await page.getByRole('button', { name: 'Back to Today' }).click()
  await expect(link).toBeFocused()
  expect(Math.abs((await scrollY(page)) - before)).toBeLessThanOrEqual(1)

  // And by Escape.
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', BREATHE)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(link).toBeFocused()
  expect(Math.abs((await scrollY(page)) - before)).toBeLessThanOrEqual(1)
})

test('Start does not jump the page: the count stays in view below the header', async ({ page }) => {
  // The count is the only pacer with the wings still. A phone on its side.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enterGarden(page)
  await breatheFromSupport(page)
  await page.setViewportSize({ width: 844, height: 390 })

  // Scrolled down until Start sits just above the dock, where a thumb
  // presses it. Taking the choices away must not jump the page to its end.
  const start = page.getByRole('button', { name: 'Start breathing' })
  await start.evaluate((button) => {
    const dock = document.querySelector('.bottom-nav')!.getBoundingClientRect()
    window.scrollBy(0, button.getBoundingClientRect().bottom - (dock.top - 12))
  })
  await start.click()
  const stop = page.getByRole('button', { name: 'Stop' })
  await expect(stop).toBeFocused()
  const count = await box(page.locator('.breath-count'))
  const header = await box(page.locator('.app-header'))
  expect(count.y).toBeGreaterThanOrEqual(header.y + header.height - 0.5)
  expect(count.y + count.height).toBeLessThanOrEqual(390)
  expect(overlap(await box(stop), count)).toBe(false)
})

test('at the largest text on a short screen, Stop never covers the count', async ({ page }) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByRole('group', { name: 'Text size' }).getByRole('radio', { name: /^Largest/ }).check()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.textSize))
    .toBe('largest')
  await page.getByRole('button', { name: 'If you need support now' }).click()
  await page.getByRole('link', { name: 'breathe with Marigold' }).click()
  await expect(page.getByRole('heading', BREATHE)).toBeFocused()

  const start = page.getByRole('button', { name: 'Start breathing' })
  const stop = page.getByRole('button', { name: 'Stop' })
  const count = page.locator('.breath-count')
  for (const viewport of [
    { width: 1024, height: 600 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    // By keyboard from the top of the page, where Start begins behind the dock.
    await page.evaluate(() => window.scrollTo(0, 0))
    await start.focus()
    await page.keyboard.press('Enter')
    await expect(stop).toBeFocused()
    if (viewport.height === 600) {
      // Room for both: the count below the header, Stop above the dock.
      const header = await box(page.locator('.app-header'))
      const dock = await box(page.locator('.bottom-nav'))
      expect((await box(count)).y).toBeGreaterThanOrEqual(header.y + header.height - 0.5)
      const stopBox = await box(stop)
      expect(stopBox.y + stopBox.height).toBeLessThanOrEqual(dock.y + 0.5)
    }
    // Wherever the page is scrolled while it runs, Stop is never over the count.
    for (const top of [0, 120, 10_000]) {
      await page.evaluate((y) => window.scrollTo(0, y), top)
      expect(overlap(await box(stop), await box(count))).toBe(false)
    }
    await stop.click()
    await expect(start).toBeFocused()
  }
})
