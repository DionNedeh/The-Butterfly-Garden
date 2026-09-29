import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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

function mainNav(page: Page) {
  return page.locator('nav[aria-label$="navigation" i]:visible').first()
}

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

function currentPage(page: Page) {
  return mainNav(page).locator('[aria-current="page"]')
}

async function seriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze()
  return results.violations
    .filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    )
    .map((violation) => `${label}: ${violation.id} (${violation.impact})`)
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
  await mainNav(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
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
  await mainNav(page).getByRole('button', { name: 'Shop', exact: true }).click()
  await expect(currentPage(page)).toHaveText('Shop')
  await pressBack(page)
  await expect(currentPage(page)).toHaveText('Garden')

  // An open dialog closes first, leaving its page where it was.
  await mainNav(page).getByRole('button', { name: 'Shop', exact: true }).click()
  await page.getByRole('button', { name: 'Boutique', exact: true }).click()
  await page.getByRole('searchbox').fill('Daisy Bonnet')
  await page.getByRole('button', { name: 'Preview Daisy Bonnet' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await pressBack(page)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(currentPage(page)).toHaveText('Shop')

  // A page opened from Settings returns to Settings.
  await mainNav(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
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

test('the privacy policy and notices open inside the app', async ({ page }) => {
  await enterGarden(page)
  await mainNav(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
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
  await mainNav(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
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
