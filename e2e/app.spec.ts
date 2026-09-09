import { readFile } from 'node:fs/promises'
import type { AppState } from '../src/types'
import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await page.goto('/The-Butterfly-Garden/')
})

const PROFILE_NOTE_KEY = 0x5f3a91c7

const decodeFixture = (codes: readonly number[]) =>
  codes
    .map((code, index) =>
      String.fromCodePoint(
        code ^ ((PROFILE_NOTE_KEY >>> ((index % 2) * 16)) & 0xffff),
      ),
    )
    .join('')

/** Name values that render an inline note, paired with the expected text. */
const profileNoteFixtures: ReadonlyArray<readonly [number[], number[]]> = [
  [
    [37271, 24399, 37290, 24394, 37292, 24403, 37289],
    [
      37258, 24411, 37283, 24415, 37351, 24412, 37288, 24392, 37351, 24387,
      37288, 24399, 37351, 24397, 37294, 24398, 37295, 24346, 46755, 41269,
      37354, 24346, 37268,
    ],
  ],
  [
    [37268, 24402, 37286, 24404, 37289, 24411],
    [
      37258, 24411, 37283, 24415, 37351, 24397, 37294, 24398, 37295, 24346,
      46755, 41269, 37354, 24346, 37268,
    ],
  ],
]

/**
 * The stored garden, as the tests need to reach into it. The garden lives in
 * one store per collection now, so this is assembled from the parts the tests
 * touch and written back to those same parts.
 */
interface GardenRecord {
  profile: {
    createdAt: string
    selectedBackdropId?: string
    unlockedBackdropIds?: string[]
  }
  nectar: number
  stardust: number
  plants: Array<{
    id: string
    plantId: string
    growth: number
    plantedAt: string
  }>
  creatures: Array<{
    stage?: string
    sourcePlantId?: string
    emergeAt?: string
  }>
}

/**
 * Edit the stored garden directly, the way a test needs to fast-forward time
 * or top up a balance. Waits out the app's write first, and opens the database
 * at whatever version it is currently on.
 *
 * The garden is stored across one record per collection, so this reads the
 * three parts the tests reach into, presents them as a single object, and
 * writes the parts back. Deliberately white-box: this is the one place
 * outside the repository that is allowed to know how storage is laid out.
 */
async function editGardenRecord(
  page: import('@playwright/test').Page,
  mutate: (state: GardenRecord) => void,
) {
  // Let the app's write land first, or this edit would be overwritten.
  await page.waitForTimeout(250)
  const stored = await page.evaluate(
    () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        // No pinned version: the schema gains stores over time.
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const names = ['meta', 'plants', 'creatures']
          const tx = db.transaction(names, 'readonly')
          const parts: Record<string, unknown> = {}
          for (const name of names) {
            const get = tx.objectStore(name).get('current')
            get.onsuccess = () => {
              parts[name] = get.result
            }
          }
          tx.oncomplete = () => {
            db.close()
            resolve(parts)
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )

  const state = {
    ...(stored.meta as Record<string, unknown>),
    plants: stored.plants,
    creatures: stored.creatures,
  } as unknown as GardenRecord

  // The mutation runs here in Node rather than being eval'd in the page, which
  // the app's Content-Security-Policy rightly forbids.
  mutate(state)

  const { plants, creatures, ...meta } = state as GardenRecord &
    Record<string, unknown>
  await page.evaluate(
    (next) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(
            ['meta', 'plants', 'creatures'],
            'readwrite',
          )
          tx.objectStore('meta').put(next.meta, 'current')
          tx.objectStore('plants').put(next.plants, 'current')
          tx.objectStore('creatures').put(next.creatures, 'current')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { meta, plants, creatures },
  )
}

/**
 * Reload once the app's write has had a moment to commit. No app can promise
 * durability against a reload fired in the same instant as a click, so tests
 * that reload right after a mutation give the transaction a beat to land.
 */
async function reloadAfterSave(page: import('@playwright/test').Page) {
  await page.waitForTimeout(250)
  await page.reload()
}

/**
 * The app's own navigation, whichever of the header or bottom bar is showing.
 * Scoped by label so it never picks up the shop's own <nav> of tabs.
 */
function mainNav(page: import('@playwright/test').Page) {
  return page.locator('nav[aria-label$="navigation" i]:visible').first()
}

async function enterGarden(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
}

test('onboards, completes care, and writes a private journal entry', async ({
  page,
}) => {
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
  await expect(
    page.getByRole('heading', { name: 'Four stages of life' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Companions for life' }),
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
  await marigold.focus()
  await marigold.click()
  await expect(
    page.getByText(
      /marigold, your monarch garden guide enjoyed that gentle hello/i,
    ),
  ).toBeVisible()
  await mainNav(page)
    .getByRole('button', { name: 'Today', exact: true })
    .click()
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill('A little more spacious.')
  await page.getByRole('button', { name: /save check-in/i }).click()

  await page.getByLabel('Add a goal').fill('Drink some water')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await page.getByRole('button', { name: /complete drink some water/i }).click()
  await page
    .locator('#daily-reflection')
    .fill('I noticed sunlight on the kitchen table.')
  await page.getByRole('button', { name: /keep this reflection/i }).click()

  await mainNav(page)
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

test('supports plant selection and permanent local reset confirmation', async ({
  page,
}) => {
  await enterGarden(page)
  await page.getByRole('button', { name: /plant a seed/i }).click()
  await page.getByRole('button', { name: /parsley/i }).click()
  await mainNav(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Backup and restore' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'This garden stays on this device' }),
  ).toBeVisible()
  for (const [nameCodes, noteCodes] of profileNoteFixtures) {
    await page.getByLabel('Your name').fill(decodeFixture(nameCodes))
    await expect(
      page.getByText(decodeFixture(noteCodes), { exact: true }),
    ).toBeVisible()
  }
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
  // Stars belong to the garden scene; the shell only takes on the night veil.
  const starLayers = await page.evaluate(() => ({
    shell: getComputedStyle(document.querySelector('.app-shell')!)
      .backgroundImage,
    garden: getComputedStyle(
      document.querySelector('.garden-hero')!,
      '::before',
    ).backgroundImage,
  }))
  expect(starLayers.garden).toContain('radial-gradient')
  expect(starLayers.shell).not.toContain('url(')
  const nightResults = await new AxeBuilder({ page }).analyze()
  expect(
    nightResults.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([])

  await editGardenRecord(page, (state) => {
    state.profile.createdAt = new Date(
      Date.now() - 61 * 24 * 60 * 60 * 1000,
    ).toISOString()
    delete state.profile.selectedBackdropId
    delete state.profile.unlockedBackdropIds
  })
  await page.reload()
  await mainNav(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click()

  const conservatory = page
    .locator('.scene-card')
    .filter({
      has: page.getByRole('heading', {
        name: 'Secret Conservatory',
        exact: true,
      }),
    })
    .getByRole('button')
  await conservatory.click()
  await expect(conservatory).toHaveText('In your garden')
  await mainNav(page)
    .getByRole('button', { name: 'Garden', exact: true })
    .click()
  await expect(page.locator('.garden-hero')).toHaveClass(
    /backdrop-secret-conservatory/,
  )
})

test('guide explains how plants grow and when eggs appear', async ({
  page,
}) => {
  await enterGarden(page)
  await mainNav(page)
    .getByRole('button', { name: 'Guide', exact: true })
    .click()

  await expect(
    page.getByRole('heading', { name: 'How the garden works' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Seeds, plants, and butterfly eggs' }),
  ).toBeVisible()
  await expect(
    page.getByText(/seed, sprout, budding, full bloom/i),
  ).toBeVisible()
  await expect(page.getByText(/Missed days simply pause growth/i)).toBeVisible()
})

test('earns Nectar, purchases every tier, and persists a selected flight pattern', async ({
  page,
}) => {
  await enterGarden(page)
  await mainNav(page)
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

  await mainNav(page).getByRole('button', { name: 'Shop', exact: true }).click()
  await page.waitForTimeout(450)
  const shopA11y = await new AxeBuilder({ page }).analyze()
  expect(
    shopA11y.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([])
  // Flight patterns live behind their own tab; the shop opens on Supplies.
  await page
    .locator('.shop-tabs')
    .getByRole('button', { name: 'Flight', exact: true })
    .click()
  await page.getByRole('button', { name: 'Buy Petal Hop' }).click()
  await expect(
    page.getByRole('button', { name: 'Owned' }).first(),
  ).toBeDisabled()

  // Top up both currencies: the pricier patterns are bought with Stardust.
  await editGardenRecord(page, (state) => {
    state.nectar = 126
    state.stardust = 20
  })
  await page.reload()
  await mainNav(page).getByRole('button', { name: 'Shop', exact: true }).click()
  await page
    .locator('.shop-tabs')
    .getByRole('button', { name: 'Flight', exact: true })
    .click()
  for (const name of [
    'Figure Eight',
    'Sunbeam Swoop',
    'Spiral Rise',
    'Garden Waltz',
  ]) {
    await page.getByRole('button', { name: `Buy ${name}` }).click()
  }
  // 126 - 18 - 27 Nectar, and 20 - 7 - 10 Stardust.
  await expect(page.getByTitle('Nectar balance')).toContainText('81')
  await expect(page.getByTitle('Stardust balance')).toContainText('3')

  await mainNav(page)
    .getByRole('button', { name: 'Flight', exact: true })
    .click()
  await page.waitForTimeout(450)
  const patternsA11y = await new AxeBuilder({ page }).analyze()
  expect(
    patternsA11y.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    ),
  ).toEqual([])
  await page
    .getByRole('button', { name: /Garden Waltz.*Owned - select pattern/i })
    .click()
  await reloadAfterSave(page)
  await mainNav(page)
    .getByRole('button', { name: 'Flight', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /Garden Waltz.*Selected/i }),
  ).toHaveAttribute('aria-pressed', 'true')
  await mainNav(page)
    .getByRole('button', { name: 'Garden', exact: true })
    .click()
  await expect(page.locator('.flight-traveller').first()).toHaveAttribute(
    'data-pattern',
    'garden-waltz',
  )
  await mainNav(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
  await page.getByLabel('Reduce garden motion').check()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/reduce-motion/)
})

test('buys reusable jars, places, moves, replaces, and removes them', async ({
  page,
}) => {
  await enterGarden(page)
  await editGardenRecord(page, (state) => {
    state.nectar = 18
  })
  await page.reload()
  await mainNav(page).getByRole('button', { name: 'Shop', exact: true }).click()
  await page
    .locator('.shop-tabs')
    .getByRole('button', { name: 'Jars', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Buy letters and numbers' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Buy Blue A jar' }).click()
  await page.getByRole('button', { name: 'S', exact: true }).click()
  await page.getByRole('button', { name: 'Yellow', exact: true }).click()
  await page.getByRole('button', { name: 'Buy Yellow S jar' }).click()
  await expect(page.getByTitle('Nectar balance')).toContainText('6')

  await mainNav(page)
    .getByRole('button', { name: 'Garden', exact: true })
    .click()
  await page.getByRole('button', { name: /View Milkweed/i }).click()
  await page
    .getByRole('button', { name: /Place Blue A jar on Milkweed/i })
    .click()
  await expect(
    page.getByRole('button', { name: /View Milkweed.*Blue A jar/i }),
  ).toBeVisible()

  await reloadAfterSave(page)
  await expect(
    page.getByRole('button', { name: /View Milkweed.*Blue A jar/i }),
  ).toBeVisible()
  await page.getByRole('button', { name: /View Aster/i }).click()
  await page
    .getByRole('button', { name: /Move from Milkweed Blue A jar on Aster/i })
    .click()
  await expect(
    page.getByRole('button', { name: /View Aster.*Blue A jar/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: /View Milkweed/i }).click()
  await page
    .getByRole('button', { name: /Place Yellow S jar on Milkweed/i })
    .click()
  await page
    .getByRole('button', { name: /Move from Aster Blue A jar on Milkweed/i })
    .click()
  await expect(
    page.getByRole('button', { name: /View Milkweed.*Blue A jar/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Place Yellow S jar on Milkweed/i }),
  ).toBeVisible()
  await page.getByRole('button', { name: /Return to inventory/i }).click()
  await expect(page.getByText(/This plant spot is empty/i)).toBeVisible()
})

test('shows plant details, protects active hosts, and frees a full garden space', async ({
  page,
}) => {
  await enterGarden(page)
  await editGardenRecord(page, (state) => {
    state.creatures[0].sourcePlantId = state.plants[0].id
    while (state.plants.length < 8) {
      state.plants.push({
        id: `extra-${state.plants.length}`,
        plantId: 'zinnia',
        growth: 0,
        plantedAt: new Date().toISOString(),
      })
    }
  })
  await page.reload()
  await expect(page.getByText(/all 8 plant spaces filled/i)).toBeVisible()
  await expect(
    page.getByRole('button', { name: /plant a seed/i }),
  ).toBeDisabled()

  await page.getByRole('button', { name: /View Milkweed/i }).click()
  await expect(page.getByRole('heading', { name: 'Milkweed' })).toBeVisible()
  await expect(page.getByText('Asclepias spp.')).toBeVisible()
  await expect(
    page.getByText(/is still growing on this host plant/i),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /remove this plant/i }),
  ).toBeDisabled()
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
  await expect(
    page.getByRole('button', { name: /plant a seed/i }),
  ).toBeEnabled()
})

test('keeps butterfly field notes collapsed until requested', async ({
  page,
}) => {
  await enterGarden(page)
  await mainNav(page)
    .getByRole('button', { name: 'Journal', exact: true })
    .click()
  await expect(page.locator('.field-notes .species-grid')).toBeHidden()
  await page.getByText('Butterflies welcomed').click()
  await expect(page.locator('.field-notes .species-grid')).toBeVisible()
})

test('persists emergence and selects the new butterfly as companion', async ({
  page,
}) => {
  await enterGarden(page)
  await editGardenRecord(page, (state) => {
    // A legacy 1.x chrysalis carrying an emergence timer that has now passed.
    state.creatures[0].stage = 'chrysalis'
    state.creatures[0].emergeAt = new Date(Date.now() - 1000).toISOString()
  })
  await page.reload()
  await expect(page.getByText('Exploring with you')).toBeVisible()
  await page.getByLabel('Name for Sol').fill('Luna')
  await page.getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByText('Luna')).toBeVisible()
  await reloadAfterSave(page)
  await expect(page.getByLabel('Name for Luna')).toHaveValue('Luna')
  await mainNav(page)
    .getByRole('button', { name: 'Journal', exact: true })
    .click()
  await page.getByText('Butterflies welcomed').click()
  await expect(page.getByText('Danaus plexippus')).toBeVisible()
  await expect(page.getByText('Welcomed as Luna')).toBeVisible()
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

test('has no serious accessibility violations on any view', async ({
  page,
}) => {
  await enterGarden(page)
  const views = [
    'Garden',
    'Care',
    'Today',
    'Journal',
    'Shop',
    'Flight',
    'Guide',
    'Settings',
  ]
  const offenders: string[] = []
  for (const view of views) {
    await mainNav(page).getByRole('button', { name: view, exact: true }).click()
    // Let entrance animations settle so axe sees final contrast and sizing.
    await page.waitForTimeout(400)
    const results = await new AxeBuilder({ page }).analyze()
    for (const violation of results.violations) {
      if (violation.impact === 'serious' || violation.impact === 'critical') {
        offenders.push(`${view}: ${violation.id} (${violation.impact})`)
      }
    }
  }
  expect(offenders).toEqual([])
})

test('every shop tab is reachable and accessible', async ({ page }) => {
  await enterGarden(page)
  await mainNav(page).getByRole('button', { name: 'Shop', exact: true }).click()
  const offenders: string[] = []
  for (const tab of [
    'Supplies',
    'Boutique',
    'Jars',
    'Flight',
    'Backdrops',
    'Garden Pass',
  ]) {
    await page
      .locator('.shop-tabs')
      .getByRole('button', { name: tab, exact: true })
      .click()
    await page.waitForTimeout(300)
    const results = await new AxeBuilder({ page }).analyze()
    for (const violation of results.violations) {
      if (violation.impact === 'serious' || violation.impact === 'critical') {
        offenders.push(`${tab}: ${violation.id} (${violation.impact})`)
      }
    }
  }
  expect(offenders).toEqual([])
})

/**
 * Gradient headings paint only inside their padding box, so a descender that
 * escapes a tight line box is sliced flat rather than merely overflowing. The
 * onboarding titles were missing from the rule that leaves room for it, which
 * cut the tails off the first words a gardener ever reads.
 */
test('gradient headings leave room for their descenders', async ({ page }) => {
  const clipped = () =>
    page.evaluate(() => {
      const bad: string[] = []
      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const style = getComputedStyle(el)
        const clip = style.webkitBackgroundClip || style.backgroundClip
        // Only elements that paint their text through a gradient, and only
        // where overflow is visible -- a clipped box has nothing to measure.
        if (clip !== 'text' || style.overflow !== 'visible') continue
        if (el.scrollHeight > el.clientHeight) {
          const name = `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`
          bad.push(`${name}: "${(el.textContent ?? '').trim().slice(0, 32)}"`)
        }
      }
      return bad
    })

  await expect(
    page.getByRole('heading', { name: /welcome to your butterfly garden/i }),
  ).toBeVisible()
  expect(await clipped()).toEqual([])

  await page.getByRole('button', { name: /enter the garden/i }).click()
  await expect(
    page.getByRole('heading', { name: /what shall we call this place/i }),
  ).toBeVisible()
  expect(await clipped()).toEqual([])

  await page.getByLabel('Your name').fill('Gardener')
  await page.getByLabel('Garden name').fill('Sunlit Sanctuary')
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await expect(
    page.getByRole('heading', { name: /here is how your sanctuary grows/i }),
  ).toBeVisible()
  expect(await clipped()).toEqual([])

  // And once inside, where the garden title and page headers live.
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(
    page.getByRole('heading', { name: 'Sunlit Sanctuary' }),
  ).toBeVisible()
  expect(await clipped()).toEqual([])
})

/**
 * The guide cards carry a decorative warm glow. It used to sit in a narrow box
 * offset inside the card -- right: -20%, width: 60% -- and because a circle
 * gradient is measured to the farthest corner, in a box that tall and narrow
 * the gold was still near full strength when the box ran out. So it did not
 * fade in, it began: a hard vertical seam at 60% of every guide card.
 *
 * An overlay that covers the whole card cannot draw an edge inside it. If a
 * future design wants a smaller overlay, its gradient has to reach transparent
 * before its own box edge, and this expectation should move with it.
 */
test('the guide card glow has no edge inside the card', async ({ page }) => {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByLabel('Your name').fill('Gardener')
  await page.getByLabel('Garden name').fill('Sunlit Sanctuary')
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await mainNav(page)
    .getByRole('button', { name: 'Guide', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: /how the garden works/i }),
  ).toBeVisible()

  const overlays = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.guide-card')].map((card) => {
      const glow = getComputedStyle(card, '::after')
      return {
        width: parseFloat(glow.width),
        height: parseFloat(glow.height),
        cardWidth: card.clientWidth,
        cardHeight: card.clientHeight,
      }
    }),
  )

  expect(overlays.length).toBeGreaterThan(0)
  for (const glow of overlays) {
    // Sub-pixel slack only: the glow spans the card, not a band of it.
    expect(glow.width).toBeGreaterThanOrEqual(glow.cardWidth - 1)
    expect(glow.height).toBeGreaterThanOrEqual(glow.cardHeight - 1)
  }
})

/**
 * The Moonlight window is gated on a local wall-clock hour, so this block
 * pins both the zone and the instant. 01:00 UTC is 21:00 the evening before
 * in New York, which is squarely inside the evening window.
 */
test.describe('rounding out the day', () => {
  test.use({ timezoneId: 'America/New_York' })

  test('collects Moonlight and keeps the recap in the journal', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-09-09T01:00:00.000Z'))
    await page.goto('/The-Butterfly-Garden/')
    await enterGarden(page)

    const stardust = page.locator('.stardust-wallet strong')
    await expect(stardust).toHaveText('0')

    await mainNav(page)
      .getByRole('button', { name: 'Today', exact: true })
      .click()
    await expect(page.getByText('Round out your day')).toBeVisible()
    await page.getByRole('button', { name: 'Begin' }).click()

    await expect(
      page.getByRole('heading', { name: 'Here is your day.' }),
    ).toBeVisible()

    // The recap is a full view but is deliberately absent from the navigation,
    // so the sweep over every nav destination never reaches it.
    const recapAudit = await new AxeBuilder({ page }).analyze()
    expect(
      recapAudit.violations.filter(
        (violation) =>
          violation.impact === 'serious' || violation.impact === 'critical',
      ),
    ).toEqual([])

    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: /bright/i }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('textbox').fill('Walked to the river.')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('textbox').fill('The unanswered email.')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('textbox').fill('Book the appointment')
    await page.getByRole('button', { name: /add to tomorrow/i }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Collect Moonlight' }).click()

    // Back on Today, with the night collected and the bonus in the wallet.
    await expect(page.getByText('The day is rounded out.')).toBeVisible()
    await expect(stardust).toHaveText('1')

    await mainNav(page)
      .getByRole('button', { name: 'Journal', exact: true })
      .click()
    await expect(page.getByText('Walked to the river.')).toBeVisible()
    await expect(page.getByText('The unanswered email.')).toBeVisible()
    await expect(
      page.getByText(/Became a goal: Book the appointment/),
    ).toBeVisible()

    // And it survives a reload: the recap is stored, not just rendered.
    await reloadAfterSave(page)
    await mainNav(page)
      .getByRole('button', { name: 'Journal', exact: true })
      .click()
    await expect(page.getByText('Walked to the river.')).toBeVisible()
  })
})

test('personal backdrop crops, survives reload and backup restore, and rejects corrupt media', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000)
  await enterGarden(page)
  await mainNav(page).getByRole('button', { name: 'Shop', exact: true }).click()
  await page.getByRole('button', { name: 'Backdrops', exact: true }).click()
  await page.getByRole('button', { name: /Add your own backdrop/ }).click()
  const editor = page.getByRole('dialog')
  await editor
    .locator('input[type=file]')
    .setInputFiles({
      name: 'broken.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    })
  await expect(editor.getByRole('alert')).toContainText('not a readable')
  await editor
    .locator('input[type=file]')
    .setInputFiles('src/assets/garden-cottage-bloom.webp')
  await editor.getByLabel('Image name').fill('My quiet corner')
  await editor.getByLabel('Zoom', { exact: true }).fill('1.5')
  await editor.getByRole('button', { name: 'Phone preview' }).click()
  await expect(editor.locator('.custom-scene-image')).toBeVisible()
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(
    accessibility.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    ),
  ).toEqual([])
  await editor.getByRole('button', { name: 'Save & use backdrop' }).click()
  await expect(editor).not.toBeVisible()
  await page.reload()
  await expect(page.locator('.custom-scene-layer img')).toBeVisible()
  await expect(page.locator('.custom-scene-layer img')).toHaveJSProperty(
    'naturalWidth',
    1600,
  )
  await mainNav(page)
    .getByRole('button', { name: 'Settings', exact: true })
    .click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download a backup' }).click()
  const download = await downloadPromise
  const path = await download.path()
  const text = await readFile(path!, 'utf8')
  const backup = JSON.parse(text) as { garden: AppState }
  const image = backup.garden.customBackdrops[0]
  expect(image.name).toBe('My quiet corner')
  expect(image.crop.zoom).toBe(1.5)
  expect(image.byteLength).toBe(Buffer.from(image.imageData, 'base64').length)
  expect(image.byteLength).toBeLessThanOrEqual(1024 * 1024)
  const corrupted = structuredClone(backup)
  corrupted.garden.profile!.gardenName = 'Must not replace the garden'
  corrupted.garden.customBackdrops[0].imageData = Buffer.alloc(
    image.byteLength,
  ).toString('base64')
  await page.getByRole('button', { name: 'Restore from a backup' }).click()
  await page
    .getByLabel('Backup file')
    .setInputFiles({
      name: 'damaged.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(corrupted)),
    })
  await expect(page.getByText(/not a readable JPEG/)).toBeVisible()
  await expect(page.getByLabel('Garden name', { exact: true })).not.toHaveValue(
    'Must not replace the garden',
  )
  await page
    .getByLabel('Backup file')
    .setInputFiles({
      name: 'garden.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    })
  await expect(page.getByText(/restored/i).last()).toBeVisible()
  await mainNav(page)
    .getByRole('button', { name: 'Garden', exact: true })
    .click()
  await expect(page.locator('.custom-scene-layer img')).toHaveAttribute(
    'src',
    `data:${image.mimeType};base64,${image.imageData}`,
  )
  await page.evaluate(() => navigator.serviceWorker.ready)
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.custom-scene-layer img')).toBeVisible()
  await expect(page.locator('.custom-scene-layer img')).toHaveJSProperty(
    'complete',
    true,
  )
})

test('boutique filters and try-on leave balances and outfits unchanged', async ({
  page,
}) => {
  await enterGarden(page)
  await mainNav(page).getByRole('button', { name: 'Shop', exact: true }).click()
  await page.getByRole('button', { name: 'Boutique', exact: true }).click()
  await page.getByRole('searchbox').fill('Daisy Bonnet')
  await expect(page.locator('.boutique-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Preview Daisy Bonnet' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTitle('Nectar balance')).toContainText('10')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('combobox', { name: /^Type/ }).selectOption('aura')
  await expect(page.locator('.boutique-card')).toHaveCount(7)
  await page.getByRole('searchbox').fill('no such treasure')
  await expect(
    page.getByRole('heading', { name: 'Nothing in this little corner yet' }),
  ).toBeVisible()
})

test('species seed guidance opens the right seed without planting it', async ({
  page,
}) => {
  await enterGarden(page)
  await mainNav(page)
    .getByRole('button', { name: 'Guide', exact: true })
    .click()
  await page.getByRole('searchbox').fill('Queen')
  await expect(page.locator('.species-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Show Milkweed seed' }).click()
  await expect(page.locator('.seed-highlight')).toContainText('Milkweed')
  await expect(page.locator('.seed-highlight')).toBeInViewport()
  await expect(page.locator('.garden-plant')).toHaveCount(2)
})

test('flight stays full-sized through turns and respects reduced motion', async ({
  page,
}) => {
  await enterGarden(page)
  const traveller = page.locator('.flight-traveller').first()
  await expect
    .poll(() => traveller.evaluate((el) => el.getAnimations().length))
    .toBe(1)
  const determinants = await page
    .locator('.flight-heading')
    .first()
    .evaluate((el) => {
      const animation = el.getAnimations()[0]
      animation.pause()
      const values: number[] = []
      for (let time = 0; time <= 20000; time += 137) {
        animation.currentTime = time
        const matrix = new DOMMatrix(getComputedStyle(el).transform)
        values.push(Math.abs(matrix.a * matrix.d - matrix.b * matrix.c))
      }
      return values
    })
  expect(Math.min(...determinants)).toBeGreaterThan(0.2)
  const clipped = await page.locator('.garden-flight-space').evaluate(frame => {
    const traveller = frame.querySelector('.flight-traveller')!
    const heading = frame.querySelector('.flight-heading')!
    const bounds = frame.getBoundingClientRect()
    const animations = [...traveller.getAnimations(), ...heading.getAnimations()]
    animations.forEach(animation => animation.pause())
    for (let time = 0; time <= 25000; time += 191) {
      animations.forEach(animation => { animation.currentTime = time })
      const rect = heading.getBoundingClientRect()
      if (rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom) return true
    }
    return false
  })
  expect(clipped).toBe(false)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(() => traveller.evaluate((el) => el.getAnimations().length))
    .toBe(0)
  const before = await traveller.getAttribute('style')
  await page.waitForTimeout(150)
  expect(await traveller.getAttribute('style')).toBe(before)
})
