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
  await page.getByRole('button', { name: 'Skip for now' }).click()
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
  // The sound always rests while the app is in the background, so there is
  // no switch to keep it playing, only a line that says so.
  await expect(
    page.getByText(/The sound rests while the app is in the background/),
  ).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: /^Keep playing when the app is in the background/ }),
  ).toHaveCount(0)
  // The earlier copies speak of the app; a file kept up to date is the
  // browser's alone, never the app's, even where its WebView has the API.
  await expect(
    page.getByRole('heading', { name: 'Earlier copies on this device' }),
  ).toBeVisible()
  await expect(
    page.getByText(/cannot help if the app is uninstalled or its storage cleared/),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Keep a backup file up to date' }),
  ).toHaveCount(0)
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
  // Still the shop, whose tab on a phone is More.
  await expect(page).toHaveURL(/#\/shop$/)
  await expect(currentPage(page)).toHaveText('More')
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

  // The Guide, opened by a "What does this do?" link, returns to its page.
  await goTo(page, 'Care')
  await page.getByRole('link', { name: /^What does this do\? Bond levels/ }).click()
  await expect(page).toHaveURL(/#\/guide\/bond$/)
  await expect(page.getByRole('heading', { name: 'Bond levels', level: 2 })).toBeFocused()
  await pressBack(page)
  await expect(currentPage(page)).toHaveText('Care')
  // As the Guide's own Back button does: focus on the link pressed.
  await expect(
    page.getByRole('link', { name: /^What does this do\? Bond levels/ }),
  ).toBeFocused()
  await pressBack(page)
  await expect(currentPage(page)).toHaveText('Garden')

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

test('the back gesture leaves breathing for the page that offered it, mid-session', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByRole('button', { name: 'If you need support now' }).click()
  await page.getByRole('link', { name: 'breathe with Marigold' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Breathe with Marigold' })).toBeVisible()
  await page.getByRole('button', { name: 'Start breathing' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeFocused()
  expect(await seriousViolations(page, 'Breathing in the Android app')).toEqual([])

  await pressBack(page)
  await expect(
    page.getByRole('heading', { level: 1, name: 'If you need support now' }),
  ).toBeVisible()
  await pressBack(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the back gesture leaves the comfort plan for the page that opened it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByRole('link', { name: 'Write a comfort plan' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My comfort plan' })).toBeVisible()
  const people = page.getByRole('region', { name: 'People I can reach' })
  await people.getByRole('textbox', { name: 'Name' }).fill('Sam')
  await people.getByRole('textbox', { name: 'Phone number (optional)' }).fill('0161 496 0000')
  await people.getByRole('button', { name: 'Add to People I can reach' }).click()
  // The phone's dialler takes the number, as it does on the support page.
  await expect(people.getByRole('link', { name: 'Call Sam' })).toHaveAttribute(
    'href',
    'tel:01614960000',
  )
  expect(await seriousViolations(page, 'Comfort plan in the Android app')).toEqual([])

  await pressBack(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  // At the link that opened it, as its Back button leaves it.
  await expect(page.getByRole('link', { name: 'Your comfort plan' })).toBeFocused()
  await expect(page.getByRole('link', { name: 'Your comfort plan' })).toBeInViewport()
  await pressBack(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
  expect(errors).toEqual([])
})

test('a calendar reminder goes through the app, which carries no calendar files of its own', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  const card = page.locator('section', {
    has: page.getByRole('heading', { name: 'A daily garden visit' }),
  })
  await expect(card.getByLabel('Remind me at')).toHaveValue('08:00')
  // No link, whatever the time: the file goes to Android's own save screen,
  // through the app's native plugin. A browser has none, so the app says the
  // file could not be saved rather than claiming it was.
  await expect(card.getByRole('link', { name: /calendar/ })).toHaveCount(0)
  await card.getByRole('button', { name: 'Add a daily garden visit to my calendar' }).click()
  await expect(card.getByRole('status')).toHaveText(
    'The calendar file could not be saved there. Try choosing another place.',
  )
  // The files for common times are the PWA's alone.
  const response = await page.request.get('/reminders/morning-0800.ics')
  expect(response.headers()['content-type'] ?? '').not.toMatch(/text\/calendar/)
})

test('a sighting is logged with a photo in the app, and the back gesture puts its form away', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Guide')
  const log = page.getByRole('button', { name: 'Log a sighting of Monarch' })
  await log.click()
  const dialog = page.getByRole('dialog', { name: 'Log a sighting' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Log a sighting' })).toBeFocused()
  // On the Monarch whose card opened it: a small dot beside its name, chosen.
  const monarch = dialog.getByRole('radio', { name: /^Monarch/ })
  await expect(monarch).toBeChecked()
  expect((await monarch.boundingBox())!.width).toBeLessThanOrEqual(24)
  // Back closes the form and stays on the Guide, with focus where it was.
  await pressBack(page)
  await expect(dialog).toHaveCount(0)
  await expect(log).toBeFocused()
  await expect(page.getByRole('heading', { level: 1, name: 'How the garden works' })).toBeVisible()

  await log.click()
  await dialog.getByLabel('Add a photo, if you like').setInputFiles('src/assets/thumb-cottage-bloom.webp')
  await expect(dialog.getByRole('img', { name: 'Your photo for this sighting' })).toBeVisible()
  expect(await seriousViolations(page, 'Android sighting form')).toEqual([])
  await dialog.getByRole('button', { name: 'Save sighting' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(log).toBeFocused()
  await expect(page.getByText(/Saved to your field book/)).toBeVisible()
})

test('the year’s postcard is saved through the app, and the back gesture returns to the Journal', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enterGarden(page)
  await goTo(page, 'Journal')
  // A quiet link most of the year; a line of its own in December and January.
  const link = page.getByRole('link', { name: /^(Your garden’s year|look back on your garden’s \d{4})$/ })
  await link.click()
  await expect(page.getByRole('heading', { level: 1, name: /^Your garden’s \d{4}$/ })).toBeFocused()

  const postcard = page.getByRole('region', { name: 'A postcard of your garden' })
  await postcard.getByRole('button', { name: 'Make a postcard' }).click()
  await expect(postcard.getByRole('status')).toHaveText('Your postcard is ready.')
  await expect(postcard.getByRole('img', { name: /^A postcard of Sunlit Sanctuary for \d{4}/ })).toBeVisible()
  // The app has its own save screen and no share sheet of the browser's.
  await expect(postcard.getByRole('button', { name: /^Share/ })).toHaveCount(0)
  expect(await seriousViolations(page, 'Your garden’s year in the Android app')).toEqual([])
  // A browser has no native side, so the app says the image could not be
  // saved rather than claiming it was.
  await postcard.getByRole('button', { name: 'Save image' }).click()
  await expect(postcard.getByRole('status')).toHaveText(
    'The postcard could not be saved there. Try choosing another place.',
  )

  await pressBack(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible()
  await expect(link).toBeFocused()
  await pressBack(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
  expect(errors).toEqual([])
})

test('a locked garden opens to the lock screen, where the back gesture leaves the app', async ({
  page,
}) => {
  test.slow()
  const deriving = { timeout: 30_000 }
  const passcode = 'heron over the river'
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enterGarden(page)
  await goTo(page, 'Settings')
  const lockSection = page.getByRole('region', { name: 'The garden lock' })
  await expect(lockSection.getByText(/software that already controls this phone/)).toBeVisible()
  await expect(lockSection.getByText(/traces of it can stay on the phone’s storage/)).toBeVisible()
  // No passkeys in the app's WebView.
  await expect(lockSection.getByRole('button', { name: 'Add a passkey…' })).toHaveCount(0)
  await lockSection.getByRole('button', { name: 'Lock my garden…' }).click()
  const setup = page.getByRole('dialog', { name: 'Choose a passcode' })
  await setup.getByLabel('Passcode', { exact: true }).fill(passcode)
  await setup.getByLabel('The same passcode again').fill(passcode)
  await setup.getByRole('button', { name: 'Next: your recovery code' }).click()
  const sheet = page.getByRole('dialog', { name: 'Save your recovery code' })
  // The app saves the sheet through its own save screen, and prints nothing.
  await expect(sheet.getByRole('button', { name: 'Save the sheet' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Print the sheet' })).toHaveCount(0)
  const words = await sheet.getByRole('listitem').allTextContents()
  await sheet.getByRole('button', { name: 'I have kept the words' }).click()
  const check = page.getByRole('dialog', { name: 'Check two words' })
  for (const field of await check.getByRole('textbox', { name: /^Word \d+$/ }).all()) {
    const label = (await field.evaluate((element) => element.closest('label')?.textContent)) ?? ''
    await field.fill(words[Number(/\d+/.exec(label)?.[0]) - 1])
  }
  await check.getByRole('button', { name: 'Lock my garden' }).click()
  const done = page.getByRole('dialog', { name: 'Your garden is locked' })
  await expect(done).toBeVisible(deriving)
  // The app is one window, with no tabs to speak of.
  await expect(done.getByText(/It stays open in the app until you lock it/)).toBeVisible()
  await expect(done).not.toContainText(/\btabs?\b/)
  await done.getByRole('button', { name: 'Done' }).click()
  await expect(done).toHaveCount(0)
  await expect(lockSection.getByRole('heading', { name: 'The garden lock' })).toBeFocused()
  await expect(lockSection.getByText(/It is open on this phone now\./)).toBeVisible()
  await expect(lockSection).not.toContainText(/\btabs?\b/)

  await lockSection.getByRole('button', { name: 'Lock now' }).click()
  const resting = page.getByRole('heading', { level: 1, name: 'Your garden is resting' })
  await expect(resting).toBeVisible()
  expect(await seriousViolations(page, 'Android lock screen')).toEqual([])
  // Back leaves the app from here; in a browser that is a no-op, and the
  // lock screen is never stepped past.
  await pressBack(page)
  await expect(resting).toBeVisible()
  await expect(mainNav(page)).toHaveCount(0)

  await page.getByLabel('Passcode', { exact: true }).fill(passcode)
  await page.getByRole('button', { name: 'Open my garden' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeFocused(deriving)

  // A new passcode seals the garden again in the app's own storage: the old
  // one opens nothing from then on, and no copy is left behind.
  await lockSection.getByRole('button', { name: 'Change my passcode…' }).click()
  const change = page.getByRole('dialog', { name: 'Change my passcode' })
  await change.getByLabel('Current passcode').fill(passcode)
  await change.getByLabel('New passcode', { exact: true }).fill('kestrel above the field')
  await change.getByLabel('The new passcode again').fill('kestrel above the field')
  await change.getByRole('button', { name: 'Change my passcode' }).click()
  await page.getByRole('dialog', { name: 'Your passcode is changed' }).getByRole('button', { name: 'Done' }).click(deriving)
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name)),
  ).not.toContain('butterfly-garden-switch')
  await lockSection.getByRole('button', { name: 'Lock now' }).click()
  await page.getByLabel('Passcode', { exact: true }).fill(passcode)
  await page.getByRole('button', { name: 'Open my garden' }).click()
  await expect(page.getByRole('alert')).toHaveText('That passcode didn’t open your garden. Please try again.', deriving)
  await page.getByLabel('Passcode', { exact: true }).fill('kestrel above the field')
  await page.getByRole('button', { name: 'Open my garden' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeFocused(deriving)
})

/** Android sending the app to the background, or bringing it back, as Capacitor reports it. */
async function setAppActive(page: Page, isActive: boolean) {
  await page.evaluate(async (active) => {
    const { Capacitor } = window as unknown as { Capacitor: CapacitorGlobal }
    await Capacitor.Plugins.App.notifyListeners('appStateChange', { isActive: active })
  }, isActive)
}

test('the auto-lock waits while a sighting is written and its photo chosen, and locks once it is put away', async ({
  page,
}) => {
  test.slow()
  const deriving = { timeout: 30_000 }
  const passcode = 'curlew on the estuary'
  const note = 'Two of them over the buddleia'
  // The page's own clock, run forward below. Until then it keeps time as usual.
  await page.clock.install()
  await page.goto('/')
  await enterGarden(page)
  await goTo(page, 'Settings')
  const lockSection = page.getByRole('region', { name: 'The garden lock' })
  await lockSection.getByRole('button', { name: 'Lock my garden…' }).click()
  const setup = page.getByRole('dialog', { name: 'Choose a passcode' })
  await setup.getByLabel('Passcode', { exact: true }).fill(passcode)
  await setup.getByLabel('The same passcode again').fill(passcode)
  await setup.getByRole('button', { name: 'Next: your recovery code' }).click()
  const sheet = page.getByRole('dialog', { name: 'Save your recovery code' })
  const words = await sheet.getByRole('listitem').allTextContents()
  await sheet.getByRole('button', { name: 'I have kept the words' }).click()
  const check = page.getByRole('dialog', { name: 'Check two words' })
  for (const field of await check.getByRole('textbox', { name: /^Word \d+$/ }).all()) {
    const label = (await field.evaluate((element) => element.closest('label')?.textContent)) ?? ''
    await field.fill(words[Number(/\d+/.exec(label)?.[0]) - 1])
  }
  await check.getByRole('button', { name: 'Lock my garden' }).click()
  await page.getByRole('dialog', { name: 'Your garden is locked' }).getByRole('button', { name: 'Done' }).click(deriving)
  const choice = lockSection.getByRole('combobox', { name: 'Lock by itself' })
  await choice.selectOption({ label: 'After 1 minute out of sight' })
  await expect(lockSection.getByRole('status')).toHaveText(
    'Saved. The garden will lock itself after that long out of sight.',
  )
  await expect(choice).toHaveAccessibleDescription(/^It waits while you are choosing a photo or a file/)

  // A sighting begun, and a photo chosen: the picker sends the app to the
  // background for longer than the auto-lock allows.
  await goTo(page, 'Guide')
  await page.getByRole('button', { name: 'Log a sighting of Monarch' }).click()
  const dialog = page.getByRole('dialog', { name: 'Log a sighting' })
  await dialog.getByLabel('A few words, if you like').fill(note)
  const chooser = page.waitForEvent('filechooser')
  await dialog.getByLabel('Add a photo, if you like').click()
  await setAppActive(page, false)
  await page.clock.fastForward('05:00')
  await setAppActive(page, true)
  await (await chooser).setFiles('src/assets/thumb-cottage-bloom.webp')
  const resting = page.getByRole('heading', { level: 1, name: 'Your garden is resting' })
  await expect(dialog.getByRole('img', { name: 'Your photo for this sighting' })).toBeVisible()
  await expect(dialog.getByLabel('A few words, if you like')).toHaveValue(note)
  await expect(resting).toHaveCount(0)

  // Still open with its words, out of sight again: it waits.
  await setAppActive(page, false)
  await page.clock.fastForward('05:00')
  await setAppActive(page, true)
  await expect(dialog.getByLabel('A few words, if you like')).toHaveValue(note)
  await expect(resting).toHaveCount(0)

  // Saved and put away, the next time out of sight counts as ever.
  await dialog.getByRole('button', { name: 'Save sighting' }).click()
  await expect(dialog).toHaveCount(0)
  await setAppActive(page, false)
  await page.clock.fastForward('01:30')
  await setAppActive(page, true)
  await expect(resting).toBeVisible()
  await page.getByLabel('Passcode', { exact: true }).fill(passcode)
  await page.getByRole('button', { name: 'Open my garden' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'How the garden works' })).toBeFocused(deriving)
})

test('a protected backup goes to the app’s own save screen, and says honestly when it could not be saved', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let downloads = 0
  page.on('download', () => (downloads += 1))
  await enterGarden(page)
  await goTo(page, 'Settings')
  // The app's own words, and no share sheet: its save screen reaches every app.
  await expect(page.getByRole('button', { name: /^Download a protected backup/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Share protected backup/ })).toHaveCount(0)
  const make = page.getByRole('button', { name: 'Save a protected backup…' })
  await make.click()
  const dialog = page.getByRole('dialog', { name: 'Save a protected backup' })
  await expect(dialog.getByRole('heading', { name: 'Save a protected backup' })).toBeFocused()

  // Back puts it away, with focus where it began.
  await pressBack(page)
  await expect(dialog).toHaveCount(0)
  await expect(make).toBeFocused()

  await make.click()
  await dialog.getByLabel('Passphrase', { exact: true }).fill('quiet meadow lantern')
  await dialog.getByLabel('Passphrase again').fill('quiet meadow lantern')
  await dialog.getByRole('button', { name: 'Lock the backup' }).click()
  const save = dialog.getByRole('button', { name: 'Save protected backup' })
  await expect(save).toBeFocused({ timeout: 15_000 })
  expect(await seriousViolations(page, 'Android protected backup, ready to save')).toEqual([])

  // A browser has no native side, so the app says the file could not be
  // saved rather than claiming it was, and keeps it for another try.
  await save.click()
  await expect(dialog.getByRole('alert')).toHaveText(
    'The protected backup could not be saved there. Try choosing another place.',
  )
  await expect(dialog).toBeVisible()
  await expect(page.getByText(/^Protected backup saved/)).toHaveCount(0)
  expect(downloads).toBe(0)

  await pressBack(page)
  await expect(dialog).toHaveCount(0)
  await expect(make).toBeFocused()
  expect(errors).toEqual([])
})

test.describe('the night garden in the app', () => {
  // 14 July 2026 in UTC: summer in the north, and an ordinary day, so the
  // night's line is known (e2e/seasons.spec.ts has the web's whole story).
  test.use({ timezoneId: 'UTC', reducedMotion: 'no-preference' })

  test('says a night line and lets the fireflies out, its words and lights loaded from the app’s own bundle', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.clock.setFixedTime(new Date('2026-07-14T21:00:00.000Z'))
    await page.goto('/')
    await enterGarden(page)
    await expect(page.locator('.garden-hero')).toHaveAttribute('data-season', 'summer')
    await expect(page.locator('.garden-observation')).toHaveText(
      'A quiet garden can hold many kinds of weather.',
    )
    await page.getByRole('button', { name: 'Switch to night mode' }).click()
    await expect(page.locator('.garden-observation')).toHaveText('The garden is resting under the moon.')
    await expect(page.locator('.hero-firefly')).toHaveCount(5)
    expect(await seriousViolations(page, 'Android, the night garden')).toEqual([])
    expect(errors).toEqual([])
  })
})

test('a move file goes to the app’s own save screen, and arriving offers no camera the WebView cannot use', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let downloads = 0
  page.on('download', () => (downloads += 1))

  // The welcome offers to arrive; the WebView has no BarcodeDetector, so
  // the code is typed, and nothing asks for the camera.
  const arrive = page.getByRole('button', { name: 'Arrive from another device' })
  await arrive.click()
  const arriving = page.getByRole('dialog', { name: 'Arrive from another device' })
  await expect(arriving.getByRole('heading', { name: 'Arrive from another device' })).toBeFocused()
  expect(await seriousViolations(page, 'Android arriving, choosing the file')).toEqual([])
  await pressBack(page)
  await expect(arriving).toHaveCount(0)
  await expect(arrive).toBeFocused()

  await enterGarden(page)
  await goTo(page, 'Settings')
  const make = page.getByRole('button', { name: 'Move my garden to another device…' })
  await make.click()
  const dialog = page.getByRole('dialog', { name: /^(Move my garden to another device|Send the move file)$/ })
  await expect(dialog.getByRole('heading', { name: 'Move my garden to another device' })).toBeFocused()
  // Back puts it away, with focus where it began.
  await pressBack(page)
  await expect(dialog).toHaveCount(0)
  await expect(make).toBeFocused()

  await make.click()
  await dialog.getByRole('button', { name: 'Make the move file' }).click()
  const save = dialog.getByRole('button', { name: 'Save the move file' })
  await expect(save).toBeFocused({ timeout: 15_000 })
  await expect(dialog.getByRole('button', { name: /Share/ })).toHaveCount(0)
  expect(await seriousViolations(page, 'Android move file, ready to save')).toEqual([])

  // A browser has no native side, so the app says the file could not be
  // saved rather than claiming it was, keeps it, and shows no code yet.
  await save.click()
  await expect(dialog.getByRole('alert')).toHaveText(
    'The move file could not be saved there. Try choosing another place.',
  )
  await expect(page.getByRole('heading', { name: 'Your one-time code' })).toHaveCount(0)
  expect(downloads).toBe(0)

  await pressBack(page)
  await expect(dialog).toHaveCount(0)
  await expect(make).toBeFocused()
  expect(errors).toEqual([])
})
