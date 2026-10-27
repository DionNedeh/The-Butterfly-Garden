import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * The app's shell: the Home Screen guide on an iPhone or iPad, and an update
 * moving every open tab along together.
 */

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const GARDEN = { level: 1, name: 'Sunlit Sanctuary' } as const

test.beforeEach(async ({ page }) => {
  await page.goto('/The-Butterfly-Garden/')
})

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.getByRole('heading', GARDEN)).toBeVisible()
}

test.describe('on an iPhone, in the browser', () => {
  test.use({ userAgent: IPHONE_SAFARI })

  test('the garden shows how to add it to the Home Screen, once, and Settings keeps the advice', async ({
    page,
  }) => {
    await enterGarden(page)
    const guide = page.getByRole('region', { name: 'Add the garden to your Home Screen' })
    await expect(guide).toBeVisible()
    await expect(guide.getByRole('listitem')).toHaveText([
      /^Tap Share/,
      /^Choose Add to Home Screen/,
      'Tap Add.',
    ])
    expect(await seriousViolations(page, 'The Home Screen guide')).toEqual([])

    await guide.getByRole('button', { name: 'Got it' }).click()
    await expect(guide).toHaveCount(0)
    // The card left with its button; focus went to the garden's name.
    await expect(page.getByRole('heading', GARDEN)).toBeFocused()

    // Put away for good on this device: the draft is written, and a reload
    // does not bring it back.
    await page.waitForTimeout(800)
    await page.reload()
    await expect(page.getByRole('heading', GARDEN)).toBeVisible()
    // Long enough for the drafts to be read and the card to have come back.
    await page.waitForTimeout(1000)
    await expect(guide).toHaveCount(0)

    // Settings keeps a short line while the browser has not agreed to keep
    // the garden.
    const kept = await page.evaluate(() => navigator.storage?.persisted?.() ?? false)
    await goTo(page, 'Settings')
    await expect(
      page.getByText(/Add the garden to your Home Screen to keep it/),
    ).toHaveCount(kept ? 0 : 1)
  })
})

/**
 * Make the stored garden one last opened on the release before this one, as
 * it is the first time an updated app opens. White-box, like the editing in
 * app.spec.ts: the profile is kept in the `meta` record.
 */
async function lastSawRelease(page: Page, releaseId: string) {
  // Let the app's own write land first, or this one would be overwritten.
  await page.waitForTimeout(250)
  await page.evaluate(
    (id) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('meta', 'readwrite')
          const store = tx.objectStore('meta')
          const read = store.get('current')
          read.onsuccess = () => {
            const meta = read.result as { profile: Record<string, unknown> }
            store.put({ ...meta, profile: { ...meta.profile, lastSeenReleaseId: id } }, 'current')
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    releaseId,
  )
}

test("after an update, What's new opens by itself, once", async ({ page }) => {
  await enterGarden(page)
  await lastSawRelease(page, 'release-3-0')
  await page.reload()
  const whatsNew = page.getByRole('heading', { level: 1, name: "What's new in the garden" })
  await expect(whatsNew).toBeVisible()
  await expect(page).toHaveURL(/#\/whats-new$/)
  expect(await seriousViolations(page, "What's new, opened by itself")).toEqual([])

  // Read now: the garden it opened over has no notice left, and opening the
  // app again goes to the garden.
  await page.goBack()
  await expect(page.getByRole('heading', GARDEN)).toBeVisible()
  await expect(page.getByText('Your garden has grown.')).toHaveCount(0)
  await page.waitForTimeout(250)
  await page.reload()
  await expect(page.getByRole('heading', GARDEN)).toBeVisible()
  await expect(whatsNew).toHaveCount(0)
})

test('an update applied in one tab reloads every other, keeping what they were writing', async ({
  page,
  context,
}) => {
  await enterGarden(page)
  await goTo(page, 'Today')
  const other = await context.newPage()
  await other.goto('/The-Butterfly-Garden/')
  await expect(other.getByRole('heading', GARDEN)).toBeVisible()

  // Words typed a moment ago, before a draft would normally be written down.
  await page.locator('#daily-reflection').fill('Words typed just before the update')
  const reloaded = [page.waitForEvent('load'), other.waitForEvent('load')]
  // The tab that applied the update says so on the tabs' own channel. It is
  // sent from a page of the same address that is not the app, so the sender
  // is not itself reloaded in the middle of saying it.
  const sender = await context.newPage()
  await sender.goto('/The-Butterfly-Garden/privacy.html')
  await sender.evaluate(() => {
    const channel = new BroadcastChannel('butterfly-garden-update')
    channel.postMessage({ type: 'reload-for-update' })
    channel.close()
  })
  await Promise.all(reloaded)
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.locator('#daily-reflection')).toHaveValue('Words typed just before the update')
  await expect(other.getByRole('heading', GARDEN)).toBeVisible()
  await sender.close()
  await other.close()
})
