import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await page.goto('/The-Butterfly-Garden/')
})

async function enterGarden(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
}

test('onboards, completes care, and writes a private journal entry', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: /welcome to your butterfly garden/i }),
  ).toBeVisible()
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByLabel('Your name').fill('River')
  await page.getByLabel('Garden name').fill('Willowlight Garden')
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await expect(
    page.getByRole('heading', { name: /how your sanctuary grows/i }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chrysalises' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Emerging butterflies' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Seeds and host plants' }),
  ).toBeVisible()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()

  await expect(
    page.getByRole('heading', { name: 'Willowlight Garden' }),
  ).toBeVisible()
  const marigold = page.getByRole('button', {
    name: /pet marigold, your monarch garden guide/i,
  })
  await marigold.click()
  await expect(
    page.getByText(/marigold, your monarch garden guide enjoyed that gentle hello/i),
  ).toBeVisible()
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Today', exact: true })
    .click()
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill('A little more spacious.')
  await page.getByRole('button', { name: /save check-in/i }).click()

  await page.getByLabel('Add a goal').fill('Drink some water')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await page
    .getByRole('button', { name: /complete drink some water/i })
    .click()
  await page
    .locator('#daily-reflection')
    .fill('I noticed sunlight on the kitchen table.')
  await page.getByRole('button', { name: /keep this reflection/i }).click()

  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Journal', exact: true })
    .click()
  await expect(page.getByText('Blue Morpho')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Sunlight streak' }),
  ).toBeVisible()
  await expect(page.getByLabel('1 day streak')).toBeVisible()
  await expect(page.getByText('Today is counted')).toBeVisible()
  await expect(page.getByText('A little more spacious.')).toBeVisible()
  await expect(
    page.getByText('I noticed sunlight on the kitchen table.'),
  ).toBeVisible()
})

test('supports plant selection and permanent local reset confirmation', async ({ page }) => {
  await enterGarden(page)
  await page.getByRole('button', { name: /plant a seed/i }).click()
  await page.getByRole('button', { name: /parsley/i }).click()
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
  await page.getByLabel('Your name').fill('Pumpkin')
  await expect(page.getByText('Made for you with ❤️- S')).toBeVisible()
  await page.getByRole('button', { name: /begin deletion/i }).click()
  await expect(page.getByText(/are you certain/i)).toBeVisible()
  await page.getByRole('button', { name: /keep my garden/i }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})

test('persists emergence and selects the new butterfly as companion', async ({ page }) => {
  await enterGarden(page)
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const openRequest = indexedDB.open('butterfly-garden', 1)
        openRequest.onerror = () => reject(openRequest.error)
        openRequest.onsuccess = () => {
          const db = openRequest.result
          const transaction = db.transaction('state', 'readwrite')
          const store = transaction.objectStore('state')
          const getRequest = store.get('current')
          getRequest.onsuccess = () => {
            const state = getRequest.result
            state.creatures[0].emergeAt = new Date(Date.now() - 1000).toISOString()
            store.put(state, 'current')
          }
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          transaction.onerror = () => reject(transaction.error)
        }
      }),
  )
  await page.reload()
  await expect(page.getByText('Exploring with you')).toBeVisible()
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Journal', exact: true })
    .click()
  await expect(page.getByText('Danaus plexippus')).toBeVisible()
})

test('has no serious accessibility violations and relaunches offline', async ({
  page,
  context,
}) => {
  await enterGarden(page)
  await page.waitForTimeout(450)
  const results = await new AxeBuilder({ page }).analyze()
  const seriousViolations = results.violations.filter(
    (violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  )
  expect(seriousViolations).toEqual([])

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Sunlit Sanctuary' }),
  ).toBeVisible()
  await context.setOffline(true)
  try {
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Sunlit Sanctuary' }),
    ).toBeVisible()
    await expect(page.getByText(/you are offline/i)).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
