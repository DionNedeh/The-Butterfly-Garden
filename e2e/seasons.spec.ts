import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * The garden's seasons (plan c.7) and its night (plan b G5), without new art:
 * the season the scene carries for the art to come, the line under the
 * garden's name by day, by night and on a season day, and fireflies at night
 * with motion allowed and none without. Swept with axe at night.
 *
 * The zone and the instant are pinned, so the season and each day's line are
 * known. 14 July 2026 is summer in the north and winter in the south, and not
 * one of the days the garden speaks of the season; 15 July is. A new garden's
 * companion is still a caterpillar, so its lines are the ones any garden says.
 */
const ORDINARY_EVENING = new Date('2026-07-14T21:00:00.000Z')
const SEASON_DAY = new Date('2026-07-15T12:00:00.000Z')

test.use({ timezoneId: 'UTC' })

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
}

const scene = (page: Page) => page.locator('.garden-hero')
const gardenLine = (page: Page) => page.locator('.garden-observation')
const fireflies = (page: Page) => page.locator('.hero-firefly')
const petals = (page: Page) => page.locator('.hero-petal')

test.describe('the night garden', () => {
  // About motion itself, so it is on where a project turns it off (WebKit in
  // CI; see playwright.config.ts).
  test.use({ reducedMotion: 'no-preference' })

  test('says a night line, and fireflies drift in place of the petals while motion is allowed', async ({
    page,
  }) => {
    test.slow()
    await page.clock.setFixedTime(ORDINARY_EVENING)
    await page.goto('/The-Butterfly-Garden/')
    await enterGarden(page)

    // By day, the day's own line, the petals, and the season for the art.
    await expect(scene(page)).toHaveAttribute('data-season', 'summer')
    await expect(gardenLine(page)).toHaveText('A quiet garden can hold many kinds of weather.')
    await expect(petals(page)).toHaveCount(7)
    await expect(fireflies(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Switch to night mode' }).click()
    await expect(page.locator('.app-shell')).toHaveClass(/theme-night/)
    await expect(gardenLine(page)).toHaveText('The garden is resting under the moon.')
    await expect(gardenLine(page)).not.toHaveText(/morning|sun/i)

    // A handful of fireflies, each moving and glowing on the compositor.
    await expect(fireflies(page)).toHaveCount(5)
    await expect(petals(page)).toHaveCount(0)
    const animations = await fireflies(page)
      .first()
      .evaluate((firefly) =>
        firefly.getAnimations().map((animation) => ({
          name: (animation as CSSAnimation).animationName,
          state: animation.playState,
        })),
      )
    expect(animations).toEqual([
      { name: 'firefly-drift', state: 'running' },
      { name: 'firefly-glow', state: 'running' },
    ])
    expect(await seriousViolations(page, 'Night garden with fireflies')).toEqual([])

    // The device asking for reduced motion takes them away, and back.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(fireflies(page)).toHaveCount(0)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(fireflies(page)).toHaveCount(5)

    // Out of view, they pause, as the sprites do.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(page.locator('.hero-fireflies')).toHaveAttribute('data-offscreen', '')
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.locator('.hero-fireflies')).not.toHaveAttribute('data-offscreen')

    // Australia and New Zealand: July is winter there, and a winter night has
    // no fireflies. The night's line is the same, for it is about the night.
    await goTo(page, 'Settings')
    await page.getByLabel('My region').selectOption('australasia')
    await goTo(page, 'Garden')
    await expect(scene(page)).toHaveAttribute('data-season', 'winter')
    await expect(gardenLine(page)).toHaveText('The garden is resting under the moon.')
    await expect(fireflies(page)).toHaveCount(0)
    expect(await seriousViolations(page, 'Night garden in winter')).toEqual([])
  })

  test('keeps fireflies away with the garden’s own reduced or calm motion', async ({ page }) => {
    test.slow()
    await page.clock.setFixedTime(ORDINARY_EVENING)
    await page.goto('/The-Butterfly-Garden/')
    await enterGarden(page)
    await page.getByRole('button', { name: 'Switch to night mode' }).click()
    await expect(fireflies(page)).toHaveCount(5)

    for (const label of ['Reduce garden motion', 'Calm garden motion']) {
      await goTo(page, 'Settings')
      await page.getByLabel(label).check()
      await page.getByRole('button', { name: 'Save settings' }).click()
      await goTo(page, 'Garden')
      await expect(gardenLine(page)).toHaveText('The garden is resting under the moon.')
      await expect(fireflies(page)).toHaveCount(0)
      await expect(petals(page)).toHaveCount(0)
    }
    expect(await seriousViolations(page, 'Night garden in calm motion')).toEqual([])
  })
})

test('one day in three, the garden says what the season is doing where the gardener gardens', async ({
  page,
}) => {
  await page.clock.setFixedTime(SEASON_DAY)
  await page.goto('/The-Butterfly-Garden/')
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByLabel('My region').selectOption('europe')
  await goTo(page, 'Garden')
  await expect(scene(page)).toHaveAttribute('data-season', 'summer')
  await expect(gardenLine(page)).toHaveText(/^In the UK, .*\.$/)
  expect(await seriousViolations(page, 'Garden on a season day')).toEqual([])
})
