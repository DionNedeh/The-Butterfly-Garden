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
  await page.getByText('Butterflies welcomed').click()
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
  await expect(
    page.getByRole('heading', { name: 'How everything works' }),
  ).toBeVisible()
  await expect(page.getByText('Seeds and planting')).toBeVisible()
  await expect(page.getByText(/first Sunlight you earn each local day/i)).toBeVisible()
  await page.getByLabel('Your name').fill('Pumpkin')
  await expect(page.getByText('Made for you with ❤️- S')).toBeVisible()
  await page.getByRole('button', { name: /begin deletion/i }).click()
  await expect(page.getByText(/are you certain/i)).toBeVisible()
  await page.getByRole('button', { name: /keep my garden/i }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})

test('toggles starry night mode and unlocks selectable monthly backdrops', async ({
  page,
}) => {
  await enterGarden(page)

  const nightToggle = page.getByRole('button', {
    name: 'Switch to night mode',
  })
  await nightToggle.click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-night/)
  await expect(
    page.getByRole('button', { name: 'Switch to sunlight mode' }),
  ).toBeVisible()
  const starLayers = await page.evaluate(() => ({
    shell: getComputedStyle(document.querySelector('.app-shell')!).backgroundImage,
    garden: getComputedStyle(
      document.querySelector('.garden-hero')!,
      '::before',
    ).backgroundImage,
  }))
  expect(starLayers.shell).not.toContain('radial-gradient')
  expect(starLayers.garden).toContain('radial-gradient')
  const nightResults = await new AxeBuilder({ page }).analyze()
  expect(
    nightResults.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([])

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
            state.profile.createdAt = new Date(
              Date.now() - 61 * 24 * 60 * 60 * 1000,
            ).toISOString()
            delete state.profile.selectedBackdropId
            delete state.profile.unlockedBackdropIds
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
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Settings', exact: true })
    .click()

  const conservatory = page.getByRole('button', {
    name: /Secret Conservatory.*Unlocked - select backdrop/i,
  })
  await conservatory.click()
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Garden', exact: true })
    .click()
  await expect(page.locator('.garden-hero')).toHaveClass(
    /backdrop-secret-conservatory/,
  )
})

test('guide explains the three plant growth stages and their timing', async ({
  page,
}) => {
  await enterGarden(page)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page
    .getByText('Host plants, nectar plants, and growth')
    .click()

  await expect(
    page.getByText(/first Sunlight produces a small sprout/i),
  ).toBeVisible()
  await expect(
    page.getByText(/one Sunlight per day, a new plant takes about three days/i),
  ).toBeVisible()
  await expect(
    page.getByText(/Missed days simply pause growth/i),
  ).toBeVisible()
})

test('earns Nectar, purchases every tier, and persists a selected flight pattern', async ({
  page,
}) => {
  await enterGarden(page)
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Today', exact: true })
    .click()
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByRole('button', { name: /save check-in/i }).click()
  await page.getByLabel('Add a goal').fill('Stretch')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await page.getByRole('button', { name: /complete stretch/i }).click()
  await page.locator('#daily-reflection').fill('A quiet moment.')
  await page.getByRole('button', { name: /keep this reflection/i }).click()
  await expect(page.getByTitle('Nectar balance')).toContainText('9')

  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Shop', exact: true })
    .click()
  await page.waitForTimeout(450)
  const shopA11y = await new AxeBuilder({ page }).analyze()
  expect(
    shopA11y.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([])
  await page.getByRole('button', { name: 'Buy Petal Hop' }).click()
  await expect(page.getByRole('button', { name: 'Owned' }).first()).toBeDisabled()

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('state', 'readwrite')
          const store = tx.objectStore('state')
          const get = store.get('current')
          get.onsuccess = () => {
            const state = get.result
            state.nectar = 126
            store.put(state, 'current')
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  await page.reload()
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Shop', exact: true })
    .click()
  for (const name of [
    'Figure Eight',
    'Sunbeam Swoop',
    'Spiral Rise',
    'Garden Waltz',
  ]) {
    await page.getByRole('button', { name: `Buy ${name}` }).click()
  }
  await expect(page.getByTitle('Nectar balance')).toContainText('0')

  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Flight Patterns', exact: true })
    .click()
  await page.waitForTimeout(450)
  const patternsA11y = await new AxeBuilder({ page }).analyze()
  expect(
    patternsA11y.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([])
  await page.getByRole('button', { name: /Garden Waltz.*Owned - select pattern/i }).click()
  await page.reload()
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Flight Patterns', exact: true })
    .click()
  await expect(page.getByRole('button', { name: /Garden Waltz.*Selected/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Garden', exact: true })
    .click()
  await expect(page.locator('.flying-butterfly').first()).toHaveClass(
    /pattern-garden-waltz/,
  )
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
  await page.getByLabel('Reduce garden motion').check()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/reduce-motion/)
})

test('shows plant details, protects active hosts, and frees a full garden space', async ({
  page,
}) => {
  await enterGarden(page)
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden', 1)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('state', 'readwrite')
          const store = tx.objectStore('state')
          const get = store.get('current')
          get.onsuccess = () => {
            const state = get.result
            state.creatures[0].sourcePlantId = state.plants[0].id
            while (state.plants.length < 8) {
              state.plants.push({
                id: `extra-${state.plants.length}`,
                plantId: 'zinnia',
                growth: 0,
                plantedAt: new Date().toISOString(),
              })
            }
            store.put(state, 'current')
          }
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  await page.reload()
  await expect(page.getByText(/all 8 plant spaces filled/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /plant a seed/i })).toBeDisabled()

  await page.getByRole('button', { name: /View Milkweed/i }).click()
  await expect(page.getByRole('heading', { name: 'Milkweed' })).toBeVisible()
  await expect(page.getByText('Asclepias spp.')).toBeVisible()
  await expect(page.getByText(/chrysalis is still connected/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /remove this plant/i })).toBeDisabled()
  const plantA11y = await new AxeBuilder({ page }).analyze()
  expect(
    plantA11y.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([])

  await page.getByRole('button', { name: /View Aster/i }).click()
  await page.getByRole('button', { name: /remove this plant/i }).click()
  await page.getByRole('button', { name: /yes, remove plant/i }).click()
  await expect(page.getByText('7 / 8')).toBeVisible()
  await expect(page.getByRole('button', { name: /plant a seed/i })).toBeEnabled()
})

test('keeps butterfly field notes collapsed until requested', async ({ page }) => {
  await enterGarden(page)
  await page
    .locator('nav:visible')
    .getByRole('button', { name: 'Journal', exact: true })
    .click()
  await expect(page.locator('.field-notes .species-grid')).toBeHidden()
  await page.getByText('Butterflies welcomed').click()
  await expect(page.locator('.field-notes .species-grid')).toBeVisible()
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
  await page.getByText('Butterflies welcomed').click()
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
