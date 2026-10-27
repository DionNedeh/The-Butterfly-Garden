import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo, mainNav, moreSheet } from './navigation'

/**
 * The Android app's own bundle (dist-android, served from the root as
 * Capacitor serves it) in a phone-sized Chromium.
 *
 * There is no native side here, so Capacitor's plugins answer with their web
 * implementations. That still exercises everything above the native layer:
 * the build, its Content-Security-Policy, the Android wording, and the back
 * gesture, which is fired through the same App-plugin listener Android calls.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(
    page.getByRole('heading', { name: 'Sunlit Sanctuary' }),
  ).toBeVisible()
}

interface CapacitorGlobal {
  Plugins: {
    App: {
      notifyListeners(event: string, data: unknown): Promise<void>
    }
  }
}

/** Android's back gesture, delivered the way Capacitor delivers it. */
async function pressBack(page: Page) {
  await page.evaluate(async () => {
    const { Capacitor } = window as unknown as { Capacitor: CapacitorGlobal }
    await Capacitor.Plugins.App.notifyListeners('backButton', {
      canGoBack: false,
    })
  })
}

/** The tab marking the page on screen. More stands for the pages behind it. */
function currentPage(page: Page) {
  return mainNav(page).locator('[aria-current="page"]:visible')
}

test('runs from the root with no service worker, install prompt or offline banner', async ({
  page,
  context,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.locator('html')).toHaveClass(/\bandroid-app\b/)
  await enterGarden(page)
  const registrations = await page.evaluate(async () =>
    'serviceWorker' in navigator
      ? (await navigator.serviceWorker.getRegistrations()).length
      : 0,
  )
  expect(registrations).toBe(0)
  await expect(page.getByRole('button', { name: 'Install app' })).toHaveCount(0)
  await context.setOffline(true)
  try {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await expect(page.getByText(/you are offline/i)).toHaveCount(0)
  } finally {
    await context.setOffline(false)
  }
  expect(errors).toEqual([])
})

test('Settings speaks of the app on this phone, with an About section', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  await expect(page.getByRole('button', { name: 'Save a backup' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Download a backup' }),
  ).toHaveCount(0)
  await expect(
    page.getByText(/your garden lives only in this app, on this phone/i),
  ).toBeVisible()
  await expect(page.getByText(/never copied to Google Drive/i)).toBeVisible()
  await page.getByRole('button', { name: 'Restore from a backup' }).click()
  await expect(page.getByLabel('Backup file')).toHaveAttribute(
    'accept',
    /text\/plain/,
  )
  await expect(
    page.getByRole('heading', { name: /^The Butterfly Garden \d+\.\d+\.\d+$/ }),
  ).toBeVisible()
  await expect(page.getByText(/not a medical device/i)).toBeVisible()
})

test('the back gesture closes, returns, and only then leaves', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enterGarden(page)

  // A page returns to the garden.
  await goTo(page, 'Shop')
  await expect(page).toHaveURL(/#\/shop$/)
  await expect(currentPage(page)).toHaveText('More')
  await pressBack(page)
  await expect(currentPage(page)).toHaveText('Garden')

  // An open dialog closes first, leaving its page where it was: on a phone
  // the shop's filters are one, and focus goes back to the button that
  // opened them.
  await goTo(page, 'Shop')
  await page.getByRole('button', { name: 'Boutique', exact: true }).click()
  await page.getByRole('button', { name: /^Filter\b/ }).click()
  await page
    .getByRole('dialog', { name: 'Filter the collection' })
    .getByRole('searchbox')
    .fill('Daisy Bonnet')
  await pressBack(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Filter 1 active' }),
  ).toBeFocused()
  await expect(currentPage(page)).toHaveText('Shop')
  await expect(page.locator('.boutique-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Preview Daisy Bonnet' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await pressBack(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/shop$/)

  // A goal's menu, and then the goal editor, are put away before Today is left.
  await goTo(page, 'Today')
  await page.getByLabel('Add a goal').fill('Water the fern')
  await page.getByRole('button', { name: 'Add goal' }).click()
  const more = page.getByRole('button', { name: 'More for Water the fern' })
  await more.click()
  await expect(more).toHaveAttribute('aria-expanded', 'true')
  await pressBack(page)
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await expect(currentPage(page)).toHaveText('Today')
  await more.click()
  await page.getByRole('group', { name: 'Water the fern options' }).getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('textbox', { name: /^Edit goal/ })).toBeVisible()
  await pressBack(page)
  await expect(page.getByRole('textbox', { name: /^Edit goal/ })).toHaveCount(0)
  await expect(currentPage(page)).toHaveText('Today')
  await pressBack(page)
  await expect(currentPage(page)).toHaveText('Garden')

  // A page opened from Settings returns to Settings.
  await goTo(page, 'Settings')
  await page.getByRole('button', { name: 'Privacy policy' }).click()
  await expect(
    page.getByRole('heading', { name: 'Privacy policy', level: 1 }),
  ).toBeVisible()
  await pressBack(page)
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // From the garden, back leaves the app; in a browser that is a no-op.
  await pressBack(page)
  await expect(currentPage(page)).toHaveText('Garden')
  await pressBack(page)
  await expect(currentPage(page)).toHaveText('Garden')
  expect(errors).toEqual([])
})

test('the dock is five tabs, and More opens the rest until the back gesture closes it', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enterGarden(page)
  const dock = mainNav(page)
  await expect(dock).toHaveAttribute('aria-label', 'Mobile navigation')
  await expect(dock.getByRole('button')).toHaveText(['Garden', 'Today', 'Care', 'Journal', 'More'])

  const more = dock.getByRole('button', { name: 'More', exact: true })
  await more.click()
  const sheet = moreSheet(page)
  await expect(sheet.getByRole('heading', { name: 'More' })).toBeVisible()
  await expect(sheet.getByRole('list').getByRole('button')).toHaveText([
    'Shop',
    'Flight',
    'Guide',
    'Settings',
  ])
  await page.waitForTimeout(300)
  expect(await seriousViolations(page, 'More sheet')).toEqual([])

  // Back closes the sheet and nothing else, and focus goes back to More.
  await pressBack(page)
  await expect(sheet).toHaveCount(0)
  await expect(currentPage(page)).toHaveText('Garden')
  await expect(more).toBeFocused()

  // On a page behind More, back closes the sheet first, then leaves the page.
  await goTo(page, 'Guide')
  await expect(page).toHaveURL(/#\/guide$/)
  await expect(currentPage(page)).toHaveText('More')
  await more.click()
  await expect(sheet.getByRole('button', { name: 'Guide', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await pressBack(page)
  await expect(sheet).toHaveCount(0)
  await expect(page).toHaveURL(/#\/guide$/)
  await pressBack(page)
  await expect(currentPage(page)).toHaveText('Garden')
  expect(errors).toEqual([])
})

test('the privacy policy and notices open inside the app', async ({ page }) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByRole('button', { name: 'Privacy policy' }).click()
  const policy = page.frameLocator('iframe[title="Privacy policy"]')
  await expect(policy.getByText(/everything you write in The Butterfly Garden/i)).toBeVisible()
  await expect(
    policy.getByRole('heading', { name: 'Garden Pass purchases' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Back to Settings' }).click()

  await page.getByRole('button', { name: 'Open-source notices' }).click()
  const notices = page.locator('.notices-text')
  await expect(notices).toContainText('Third-party notices')
  await expect(notices).toContainText('MIT License')
})

test('the Android-only pages have no serious accessibility violations', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.waitForTimeout(400)
  const offenders = await seriousViolations(page, 'Settings')
  await page.getByRole('button', { name: 'Privacy policy' }).click()
  await page.waitForTimeout(400)
  offenders.push(...(await seriousViolations(page, 'Privacy policy')))
  await page.getByRole('button', { name: 'Back to Settings' }).click()
  await page.getByRole('button', { name: 'Open-source notices' }).click()
  await expect(page.locator('.notices-text')).toBeVisible()
  offenders.push(...(await seriousViolations(page, 'Notices')))
  expect(offenders).toEqual([])
})

test('the Garden Pass speaks of Google Play, and says when Play cannot be reached', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enterGarden(page)
  await goTo(page, 'Shop')
  await page
    .locator('.shop-tabs')
    .getByRole('button', { name: 'Garden Pass', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'The Garden Pass' }),
  ).toBeVisible()
  await expect(
    page.getByText(/everything else in the garden is free and stays free/i),
  ).toBeVisible()
  // No native billing in a browser, so Play is honestly unreachable.
  await expect(
    page.getByText(/google play cannot be reached right now/i),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Manage or cancel in Google Play' }),
  ).toBeVisible()
  await expect(page.getByText(/preview/i)).toHaveCount(0)
  await expect(page.locator('.pass-piece').first()).toContainText(
    'With the Garden Pass',
  )
  await page.waitForTimeout(300)
  expect(await seriousViolations(page, 'Garden Pass')).toEqual([])

  await page
    .locator('.shop-tabs')
    .getByRole('button', { name: 'Backdrops', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: 'With the Garden Pass' }).first(),
  ).toBeDisabled()

  await goTo(page, 'Settings')
  const passCard = page.locator('.pass-settings-card')
  await expect(passCard).toContainText('Google Play cannot be reached right now.')
  await passCard.getByRole('button', { name: 'See the Garden Pass' }).click()
  await expect(
    page.getByRole('heading', { name: 'The Garden Pass' }),
  ).toBeVisible()
  expect(errors).toEqual([])
})
