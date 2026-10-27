import { readFile } from 'node:fs/promises'
import type { AppState } from '../src/types'
import { expect, test } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo, mainNav, moreSheet } from './navigation'

test.beforeEach(async ({ page }) => {
  await page.goto('/The-Butterfly-Garden/')
})

/*
 * The Settings name notes (see nameNotes in SettingsView.tsx) are a
 * deliberate, harmless easter egg: a personal message for a few names. These
 * fixtures are encoded the same way so the messages stay a surprise in the
 * test file too; decodeFixture undoes it.
 */
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
      37258, 24411, 37283, 24415, 37351, 24397, 37294, 24398, 37295, 24346,
      46755, 41269, 37351, 24343, 37351, 24425,
    ],
  ],
  [
    [37268, 24402, 37286, 24404, 37289, 24411],
    [
      37258, 24411, 37283, 24415, 37351, 24397, 37294, 24398, 37295, 24346,
      46755, 41269, 37354, 24346, 37268,
    ],
  ],
  [
    [37268, 24394, 37282, 24404, 37284, 24415, 37301],
    [37267, 24402, 37282, 24346, 37265, 24405, 37294, 24414],
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
    lastVisitOn?: string
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
    id?: string
    name?: string
    stage?: string
    sourcePlantId?: string
    emergeAt?: string
    awaitingName?: boolean
    outfit?: Record<string, string>
  }>
  ownedFlightPatternIds?: string[]
  ownedItemIds?: string[]
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
 * The shop's search and filters. A wide screen shows them inline; a phone
 * (600px or narrower, as in ShopView) keeps them in a sheet behind one
 * Filter button, so there the sheet is opened first, and put away again
 * before the collection beneath it is used.
 */
function onPhone(page: import('@playwright/test').Page) {
  return (page.viewportSize()?.width ?? 1280) <= 600
}

async function openShopFilters(page: import('@playwright/test').Page) {
  if (!onPhone(page)) return
  await page.getByRole('button', { name: /^Filter\b/ }).click()
  await expect(
    page.getByRole('dialog', { name: 'Filter the collection' }),
  ).toBeVisible()
}

async function closeShopFilters(page: import('@playwright/test').Page) {
  if (!onPhone(page)) return
  await page
    .getByRole('dialog', { name: 'Filter the collection' })
    .getByRole('button', { name: /^Show / })
    .click()
  await expect(page.getByRole('button', { name: /^Filter\b/ })).toBeFocused()
}

async function enterGarden(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
}

test('pages live in the address: Back, Forward and a reload all keep their place', async ({
  page,
}) => {
  await enterGarden(page)
  await expect(page).toHaveURL(/\/The-Butterfly-Garden\/$/)

  await goTo(page, 'Journal')
  await expect(page).toHaveURL(/#\/journal$/)
  await goTo(page, 'Shop')
  await expect(page).toHaveURL(/#\/shop$/)

  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible()
  // A reload used to land on the garden whatever page was open.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeVisible()

  // A link straight to a page opens it; one that names no page opens the garden.
  await page.goto('/The-Butterfly-Garden/#/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await page.goto('/The-Butterfly-Garden/#/nowhere')
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
  await expect(page).toHaveURL(/\/The-Butterfly-Garden\/$/)
})

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
  await page.getByRole('button', { name: 'Skip for now' }).click()
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
    name: /meet marigold, your monarch garden guide/i,
  })
  await marigold.focus()
  // Butterflies never stop flying, so Playwright's stability check can never
  // pass here; the click still lands on the element's live position.
  await marigold.click({ force: true })
  // A tap introduces her; a hello is the card's own button.
  const card = page.getByRole('dialog', { name: 'Marigold' })
  await card.getByRole('button', { name: 'Pet Marigold' }).click()
  await expect(card.getByText('Marigold enjoyed that gentle hello.')).toBeVisible()
  await card.getByRole('button', { name: 'Close' }).click()
  await expect(card).toHaveCount(0)
  await expect(marigold).toBeFocused()
  await goTo(page, 'Today')
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill('A little more spacious.')
  await page.getByRole('button', { name: /save check-in/i }).click()

  await page.getByLabel('Add a goal').fill('Drink some water')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await page.getByRole('button', { name: /care for drink some water/i }).click()
  await page
    .locator('#daily-reflection')
    .fill('I noticed sunlight on the kitchen table.')
  await page.getByRole('button', { name: /keep this reflection/i }).click()

  await goTo(page, 'Journal')
  await page.getByText('Butterflies welcomed').click()
  await expect(page.getByText('Blue Morpho')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your rhythm' })).toBeVisible()
  await expect(page.getByLabel('1 of the last 7 days cared for')).toBeVisible()
  await expect(page.getByText(/never sets this back/)).toBeVisible()
  await expect(page.getByText('A little more spacious.')).toBeVisible()
  await expect(
    page.getByText('I noticed sunlight on the kitchen table.'),
  ).toBeVisible()
})

test('starter goals chosen on the way in wait on Today, two-minute versions and all', async ({
  page,
}) => {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  const heading = page.getByRole('heading', { name: 'Anything to care for each day?' })
  await expect(heading).toBeFocused()
  // Nothing is chosen for the gardener, and skipping is offered alike.
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible()
  expect(await seriousViolations(page, 'Starter goals')).toEqual([])
  await page.getByRole('checkbox', { name: /^Drink a glass of water/ }).check()
  await page.getByRole('checkbox', { name: /^Take three slow breaths/ }).check()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  // Where the garden lives, and the button that keeps a copy of it.
  await expect(
    page.getByText(/open Settings and choose Download a backup/),
  ).toBeVisible()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()

  await goTo(page, 'Today')
  await expect(page.getByRole('button', { name: 'Care for Drink a glass of water' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Care for Take three slow breaths' })).toBeVisible()
  await expect(page.locator('.goal-row')).toHaveCount(2)
  // Neither is offered again as an idea.
  const ideas = page.getByRole('group', { name: 'Ideas' })
  await expect(ideas.getByRole('button', { name: 'Drink a glass of water' })).toHaveCount(0)
  await expect(ideas.getByRole('button', { name: /^Other ideas/ })).toBeVisible()
  expect(await seriousViolations(page, 'Today with ideas')).toEqual([])

  // A gentle day leads with the two-minute version; doing it does the goal.
  await page.getByRole('checkbox', { name: /gentle day/i }).check()
  const tiny = page.getByRole('button', { name: 'Care for Take three sips' })
  await expect(tiny).toBeVisible()
  await tiny.click()
  await expect(page.getByRole('button', { name: 'Done: Take three sips' })).toBeDisabled()
  await expect(page.getByText('Drink a glass of water marked done.')).toBeVisible()
})

test('a check-in can be unsure, a tap can be undone, and support is a link away', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Today')

  // Nothing is chosen for the gardener, and "not sure" is an answer.
  const save = page.getByRole('button', { name: /save check-in/i })
  await expect(save).toBeDisabled()
  await page.getByRole('button', { name: 'Not sure today' }).click()
  await save.click()
  await expect(page.getByRole('button', { name: /update check-in/i })).toBeVisible()

  // Marking a goal done by mistake can be taken back for a few seconds.
  await page.getByLabel('Add a goal').fill('Water the fern')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await page.getByRole('button', { name: /care for water the fern/i }).click()
  await expect(page.getByText('Water the fern marked done.')).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('button', { name: /care for water the fern/i })).toBeEnabled()

  // Support is reachable from Settings, and hands off to the phone.
  await goTo(page, 'Settings')
  await page.getByRole('button', { name: 'If you need support now' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'If you need support now' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Call 116 123' })).toHaveAttribute('href', 'tel:116123')
  expect(await seriousViolations(page, 'Support')).toEqual([])
  await page.getByRole('button', { name: 'Back to Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})

test('a check-in can name feelings and energy, and offers one gentle next step', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Today')

  // Both extras wait for a weather, and are folded away until asked for.
  await page.getByRole('button', { name: /^Rainy/ }).click()
  await expect(page.getByText('All weather is welcome.')).toBeVisible()
  await page.getByRole('button', { name: 'Add feelings or energy' }).click()
  const feelings = page.getByRole('group', { name: 'Feelings' })
  await feelings.getByRole('button', { name: 'tired', exact: true }).click()
  await feelings.getByRole('button', { name: 'hopeful', exact: true }).click()
  await expect(feelings.getByRole('button', { name: 'tired', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('group', { name: 'Energy' }).getByRole('radio', { name: 'low' }).check()
  expect(await seriousViolations(page, 'Today with feelings and energy')).toEqual([])

  // Saving offers one next step in the page, and leaves focus where it was.
  await page.getByRole('button', { name: /save check-in/i }).click()
  await expect(page.getByText('Kept in your journal.')).toBeVisible()
  const offer = page.getByRole('group', { name: /One small thing/ })
  await expect(offer.getByRole('button', { name: 'Make today a gentle day' })).toBeVisible()
  await expect(page.getByRole('button', { name: /update check-in/i })).toBeFocused()
  expect(await seriousViolations(page, 'Today with a next step offered')).toEqual([])
  await offer.getByRole('button', { name: 'Write one line' }).click()
  await expect(page.locator('#daily-reflection')).toBeFocused()
  await expect(offer).toHaveCount(0)

  // The journal says them in words, and finds them.
  await goTo(page, 'Journal')
  await expect(page.getByText('Feeling hopeful, tired · Energy low')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search your journal' }).fill('hopeful')
  await expect(page.getByText('1 day matches')).toBeVisible()
})

test('a goal row keeps everything behind its menu, and a gentle day asks for little', async ({
  page,
}) => {
  // A long walk through Today, with two accessibility sweeps and a reload:
  // more than the default budget on a GPU-less runner's Safari.
  test.slow()
  await enterGarden(page)
  await goTo(page, 'Today')
  for (const title of ['Water the fern', 'Stretch', 'Open a window', 'Step outside']) {
    await page.getByLabel('Add a goal').fill(title)
    await page.getByRole('button', { name: 'Add goal' }).click()
  }

  // Each row is one line; everything else is behind its ⋯ menu. The menu of
  // the first row is drawn over the rows below it, so its items take the
  // click themselves (Playwright refuses a click another row would catch).
  const more = page.getByRole('button', { name: 'More for Water the fern' })
  await more.click()
  const options = page.getByRole('group', { name: 'Water the fern options' })
  await expect(options).toBeVisible()
  expect(await seriousViolations(page, 'Today with a goal menu open')).toEqual([])
  await options.getByRole('button', { name: 'Skip today' }).click()
  await expect(more).toBeFocused()
  await expect(page.getByText('Every day · skipped today')).toBeVisible()
  // Skipping again is how a skip is undone.
  await more.click()
  await options.getByRole('button', { name: 'Bring back today' }).click()

  // Editing changes more than the title, and hands focus back to the row.
  await page.getByRole('button', { name: 'More for Stretch' }).click()
  await page.getByRole('group', { name: 'Stretch options' }).getByRole('button', { name: 'Edit' }).click()
  const title = page.getByRole('textbox', { name: /^Edit goal/ })
  await expect(title).toBeFocused()
  await title.fill('Stretch gently')
  await page.getByRole('combobox', { name: /^Repeat/ }).selectOption('weekdays')
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
    await page.getByRole('checkbox', { name: day }).uncheck()
  }
  await expect(page.getByRole('alert')).toHaveText(/never come round/)
  await page.getByRole('combobox', { name: /^Repeat/ }).selectOption('daily')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'More for Stretch gently' })).toBeFocused()

  // A gentle day: three goals, no counts, and it outlasts a reload.
  await page.getByRole('checkbox', { name: /gentle day/i }).check()
  await expect(page.getByText('Rest counts too.', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^More for / })).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Show the other 1 goal' })).toBeVisible()
  expect(await seriousViolations(page, 'Today on a gentle day')).toEqual([])
  await reloadAfterSave(page)
  await goTo(page, 'Today')
  await expect(page.getByRole('checkbox', { name: /gentle day/i })).toBeChecked()
  await expect(page.getByRole('button', { name: /^More for / })).toHaveCount(3)

  // Archiving from the row takes it away, and can be undone.
  await page.getByRole('button', { name: 'More for Water the fern' }).click()
  await page.getByRole('group', { name: 'Water the fern options' }).getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Goals' })).toBeFocused()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByRole('button', { name: 'More for Water the fern' })).toBeVisible()
})

test('the journal finds words, opens a day from its calendar, and gives readable copies', async ({
  page,
}) => {
  // Two pages, an accessibility sweep and two downloads: more than the
  // default budget on a GPU-less runner's Safari.
  test.slow()
  await enterGarden(page)
  await mainNav(page).getByRole('button', { name: 'Today', exact: true }).click()
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill('Walked by the río')
  await page.getByRole('button', { name: /save check-in/i }).click()
  // Words that would be markup anywhere careless.
  await page.locator('#daily-reflection').fill('A <script>alert(1)</script> moment, =1+1')
  await page.getByRole('button', { name: /keep this reflection/i }).click()

  await mainNav(page).getByRole('button', { name: 'Journal', exact: true }).click()
  expect(await seriousViolations(page, 'Journal with its calendar and search')).toEqual([])

  // Searching forgives accents and case, and never leaves the device.
  const search = page.getByRole('searchbox', { name: 'Search your journal' })
  await search.fill('RIO')
  await expect(page.getByText('1 day matches')).toBeVisible()
  await search.fill('nowhere at all')
  await expect(page.getByText('Nothing in the journal matches that yet.')).toBeVisible()
  await search.press('Escape')
  await expect(search).toHaveValue('')

  // A day in the calendar opens its entry.
  const calendar = page.getByRole('region', { name: 'Weather calendar' })
  await calendar.getByRole('button', { name: /: Bright$/ }).click()
  await expect(page.locator('.timeline-entry time').first()).toBeFocused()

  // The printable page shows the words as words, and can run nothing.
  const htmlDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Printable journal (HTML)' }).click()
  const html = await readFile(await (await htmlDownload).path(), 'utf8')
  expect(html).toContain("default-src 'none'")
  expect(html).toContain('A &lt;script&gt;alert(1)&lt;/script&gt; moment')
  expect(html).not.toContain('<script>')
  await expect(page.getByText('Your download has started.')).toBeVisible()

  // The spreadsheet opens with its accents, and a note cannot become a formula.
  const csvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Check-ins as CSV' }).click()
  const csv = await readFile(await (await csvDownload).path(), 'utf8')
  expect(csv.startsWith('﻿"date","weather","note","feelings","energy","written later"\r\n')).toBe(true)
  expect(csv).toContain('"Bright","Walked by the río"')
})

/**
 * Written later for an earlier day, and given back a month on. The zone and
 * the instant are pinned, so the run can never cross a midnight between
 * choosing the day and looking for it, and "a month ago" always exists: the
 * 15th of September, twelve noon in UTC.
 */
test.describe('an earlier day', () => {
  test.use({ timezoneId: 'UTC' })

  test('an entry for an earlier day is kept with its day, marked, and earns nothing', async ({
    page,
  }) => {
    // Two accessibility sweeps and a reload.
    test.slow()
    const now = new Date('2026-09-15T12:00:00.000Z')
    await page.clock.setFixedTime(now)
    await page.goto('/The-Butterfly-Garden/')
    await enterGarden(page)
    await editGardenRecord(page, (state) => {
      state.profile.createdAt = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString()
    })
    await page.reload()
    await goTo(page, 'Journal')
    await expect(page.getByLabel('0 of the last 7 days cared for')).toBeVisible()

    const day = '2026-08-15'
    const opener = page.getByRole('button', { name: 'Add an entry for an earlier day' })
    const form = page.getByRole('form', { name: 'Add an entry for an earlier day' })
    await opener.click()
    await expect(form.getByLabel('Which day?')).toBeFocused()
    expect(await seriousViolations(page, 'Journal, writing for an earlier day')).toEqual([])
    await form.getByLabel('Which day?').fill(day)
    await form.getByLabel('Inner weather that day').selectOption({ label: 'Rainy' })
    await form.getByLabel('A note about that day, if you want').fill('Caught up on it later')
    await form.getByRole('button', { name: 'Save entry' }).click()

    // The day opens in the timeline, marked as written later.
    const entry = page.locator(`#day-${day}`)
    await expect(entry.locator('time')).toBeFocused()
    await expect(entry.getByText('Written later')).toBeVisible()
    await expect(entry.getByText('Caught up on it later')).toBeVisible()
    // The care happened today, not then: the rhythm is as it was.
    await expect(page.getByLabel('0 of the last 7 days cared for')).toBeVisible()

    // The journal keeps one check-in a day, so that day is offered instead.
    await opener.click()
    await form.getByLabel('Which day?').fill(day)
    await expect(form.getByText(/already has a check-in/)).toBeVisible()
    await form.getByRole('button', { name: 'Cancel' }).click()
    await expect(opener).toBeFocused()

    // Kept through a reload, still marked.
    await reloadAfterSave(page)
    await expect(page.locator(`#day-${day}`).getByText('Written later')).toBeVisible()

    // A month on, the day comes back at the top of the Journal.
    const card = page.getByRole('region', { name: 'A month ago today' })
    await expect(card).toBeVisible()
    await expect(card.getByText('Caught up on it later')).toBeVisible()
    expect(await seriousViolations(page, 'Journal with a day from a month ago')).toEqual([])
    await card.getByRole('button', { name: 'Put away for today' }).click()
    await expect(card).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Journal' })).toBeFocused()
  })
})

/** A local calendar date some days back, by this machine's clock, which the browser shares. */
function localDateDaysAgo(days: number): string {
  const now = new Date()
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, 12)
  return [day.getFullYear(), day.getMonth() + 1, day.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-')
}

test('a garden that keeps giving, and a small welcome back after a few days away', async ({
  page,
}) => {
  // Two accessibility sweeps and a reload.
  test.slow()
  await enterGarden(page)
  await goTo(page, 'Settings')
  const pace = page.getByRole('group', { name: 'Garden pace' })
  await expect(pace.getByRole('radio', { name: /^Classic/ })).toBeChecked()
  await pace.getByRole('radio', { name: /^Keep giving/ }).check()
  await expect(pace.getByRole('radio', { name: /^Keep giving/ })).toBeChecked()
  expect(await seriousViolations(page, 'Settings, garden pace')).toEqual([])

  // The starter milkweed in full bloom, and the last visit five days back.
  await editGardenRecord(page, (state) => {
    state.plants[0].growth = 3
    state.profile.lastVisitOn = localDateDaysAgo(5)
  })
  await page.reload()
  await goTo(page, 'Garden')
  const welcome = page.getByRole('group', { name: 'Welcome back' })
  await expect(welcome).toBeVisible()
  // It never says how long.
  await expect(welcome).not.toHaveText(/\b(\d+|days?|weeks?|missed|lost)\b/i)
  await page.getByRole('button', { name: /^Milkweed 1/ }).click()
  await expect(page.getByText('Blooms again in 7 more days of care.')).toBeVisible()
  expect(await seriousViolations(page, 'Garden, welcome back')).toEqual([])

  await welcome.getByRole('button', { name: 'Put away' }).click()
  await expect(welcome).toHaveCount(0)
  await expect(page.locator('#garden-title')).toBeFocused()

  // Put away for good: a reload the same day does not bring it back.
  await reloadAfterSave(page)
  await expect(page.locator('#garden-title')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Welcome back' })).toHaveCount(0)
})

test('supports plant selection and permanent local reset confirmation', async ({
  page,
}) => {
  await enterGarden(page)
  await page.getByRole('button', { name: /plant a seed/i }).click()
  await page.getByRole('button', { name: /parsley/i }).click()
  await goTo(page, 'Settings')
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
  // Polled: the scene's veil eases in, and WebKit reports the daytime layers
  // until that transition is done.
  const starLayers = () =>
    page.evaluate(() => ({
      shell: getComputedStyle(document.querySelector('.app-shell')!)
        .backgroundImage,
      garden: getComputedStyle(
        document.querySelector('.garden-hero')!,
        '::before',
      ).backgroundImage,
    }))
  await expect.poll(async () => (await starLayers()).garden).toContain('radial-gradient')
  expect((await starLayers()).shell).not.toContain('url(')
  expect(await seriousViolations(page, 'Night garden')).toEqual([])

  await editGardenRecord(page, (state) => {
    state.profile.createdAt = new Date(
      Date.now() - 61 * 24 * 60 * 60 * 1000,
    ).toISOString()
    delete state.profile.selectedBackdropId
    delete state.profile.unlockedBackdropIds
  })
  await page.reload()
  // A garden this old with no copy on record is reminded, quietly, on the
  // way to Settings: on Settings itself, or on More on a phone.
  await expect(
    mainNav(page).getByRole('button', { name: /^(Settings|More), time for a fresh copy/ }),
  ).toBeVisible()
  await goTo(page, 'Settings')
  await expect(page.getByText('You have not saved a copy yet.', { exact: false })).toBeVisible()

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
  await goTo(page, 'Garden')
  await expect(page.locator('.garden-hero')).toHaveClass(
    /backdrop-secret-conservatory/,
  )
})

test('follows the device, and the switch in the header stops following', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await enterGarden(page)
  await goTo(page, 'Settings')
  const shell = page.locator('.app-shell')
  const themes = page.getByRole('group', { name: 'Theme' })
  await themes.getByRole('radio', { name: /^Follow device/ }).check()
  await expect(shell).toHaveClass(/theme-sunlight/)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(shell).toHaveClass(/theme-night/)
  // The browser's own bars match the garden, not only the device.
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
    'content',
    '#07131f',
  )
  await page
    .getByRole('button', { name: 'Switch to sunlight mode and stop following your device' })
    .click()
  await expect(shell).toHaveClass(/theme-sunlight/)
  await expect(themes.getByRole('radio', { name: /^Sunlight/ })).toBeChecked()
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute(
    'content',
    '#f7f3e8',
  )
})

test('shapes the sound: a volume kept across a reload, and night bringing the piano', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  const volume = page.getByRole('slider', { name: 'Volume' })
  await expect(volume).toHaveValue('50')
  // Each key press is a step of its own, stored as it is taken.
  await volume.focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect(volume).toHaveValue('48')
  await expect(page.locator('.sound-volume-value')).toHaveText('48')
  // The whole height of the slider can be pressed.
  expect((await volume.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  expect(await seriousViolations(page, 'Settings, the sound card')).toEqual([])

  await page.getByRole('radio', { name: /^Soft Rain/ }).check()
  await page.getByRole('checkbox', { name: /^Night brings the piano/ }).check()
  await expect(page.getByRole('button', { name: 'Turn on Soft Rain' })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect(page.getByRole('button', { name: 'Turn on Piano Music' })).toBeVisible()
  await expect(
    page.getByRole('radio', { name: /^Soft Rain/ }).locator('xpath=ancestor::label'),
  ).toContainText('Back with the sunlight')
  expect(await seriousViolations(page, 'Settings, the sound card at night')).toEqual([])

  await reloadAfterSave(page)
  await expect(page.getByRole('slider', { name: 'Volume' })).toHaveValue('48')
  await expect(page.getByRole('checkbox', { name: /^Night brings the piano/ })).toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: /^Keep playing when the app is in the background/ }),
  ).toBeChecked()
})

test('sets a larger text size that the header and the dock make room for', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  const rootSize = () => page.evaluate(() => document.documentElement.style.fontSize)
  const sizes = page.getByRole('group', { name: 'Text size' })
  await sizes.getByRole('radio', { name: /^Largest/ }).check()
  await expect.poll(rootSize).toBe('125%')
  expect(await seriousViolations(page, 'Settings at the largest text size')).toEqual([])

  await goTo(page, 'Garden')
  // The header's pills wrap at its end rather than sliding over the icon.
  const icon = await page.locator('.brand img').boundingBox()
  const actions = await page.locator('.header-actions').boundingBox()
  expect(actions!.x).toBeGreaterThanOrEqual(icon!.x + icon!.width - 1)
  // On a wide screen the tabs take a row of their own rather than covering
  // the garden's icon; nothing is drawn over its middle.
  const nav = page.locator('.app-header nav')
  if (await nav.isVisible()) {
    const tabs = (await nav.boundingBox())!
    expect(
      tabs.y >= icon!.y + icon!.height - 1 || tabs.x >= icon!.x + icon!.width - 1,
    ).toBe(true)
  }
  const onTop = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y)
    return Boolean(element?.closest('.brand'))
  }, { x: icon!.x + icon!.width / 2, y: icon!.y + icon!.height / 2 })
  expect(onTop).toBe(true)
  // Every label in the dock stays inside its own tab.
  const spilling = await page
    .locator('.bottom-nav button:visible')
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => {
          const label = button.querySelector('span')?.getBoundingClientRect()
          const tab = button.getBoundingClientRect()
          return label !== undefined && (label.left < tab.left - 0.5 || label.right > tab.right + 0.5)
        })
        .map((button) => button.textContent),
    )
  expect(spilling).toEqual([])
  expect(await seriousViolations(page, 'The garden at the largest text size')).toEqual([])

  // Back to the usual size, which leaves the root as it always was.
  await goTo(page, 'Settings')
  await sizes.getByRole('radio', { name: /^Comfortable/ }).check()
  await expect.poll(rootSize).toBe('')
})

test('guide explains how plants grow and when eggs appear', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Guide')

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
  // Four pages, two accessibility sweeps, a reload and two settings: about
  // thirty seconds in Safari on a GPU-less runner, the default budget's edge.
  test.slow()
  await enterGarden(page)
  await goTo(page, 'Today')
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByRole('button', { name: /save check-in/i }).click()
  await page.getByLabel('Add a goal').fill('Stretch')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await page.getByRole('button', { name: /care for stretch/i }).click()
  await page.locator('#daily-reflection').fill('A quiet moment.')
  await page.getByRole('button', { name: /keep this reflection/i }).click()
  await expect(page.getByTitle('Nectar balance')).toContainText('9')

  await goTo(page, 'Shop')
  await page.waitForTimeout(450)
  expect(await seriousViolations(page, 'Shop')).toEqual([])
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
  await goTo(page, 'Shop')
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

  await goTo(page, 'Flight')
  await page.waitForTimeout(450)
  expect(await seriousViolations(page, 'Flight patterns')).toEqual([])
  await page
    .getByRole('button', { name: /Garden Waltz.*Owned - select pattern/i })
    .click()
  await reloadAfterSave(page)
  await goTo(page, 'Flight')
  await expect(
    page.getByRole('button', { name: /Garden Waltz.*Selected/i }),
  ).toHaveAttribute('aria-pressed', 'true')
  await goTo(page, 'Garden')
  await expect(page.locator('.flight-traveller').first()).toHaveAttribute(
    'data-pattern',
    'garden-waltz',
  )
  await goTo(page, 'Settings')
  await page.getByLabel('Calm garden motion').check()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/calm-motion/)
  await page.getByLabel('Reduce garden motion').check()
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/reduce-motion/)
  await expect(page.locator('.app-shell')).not.toHaveClass(/calm-motion/)
})

test('buys reusable jars, places, moves, replaces, and removes them', async ({
  page,
}) => {
  await enterGarden(page)
  await editGardenRecord(page, (state) => {
    state.nectar = 18
  })
  await page.reload()
  await goTo(page, 'Shop')
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

  await goTo(page, 'Garden')
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
  await expect(page.getByText(/all 8 spaces are growing/i)).toBeVisible()
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
  expect(await seriousViolations(page, 'Plant details')).toEqual([])

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
  await goTo(page, 'Journal')
  await expect(page.locator('.field-notes .species-grid')).toBeHidden()
  await page.getByText('Butterflies welcomed').click()
  await expect(page.locator('.field-notes .species-grid')).toBeVisible()
})

test('a new egg is offered a name of its own on the Care page', async ({ page }) => {
  await enterGarden(page)
  await editGardenRecord(page, (state) => {
    // An egg just found on a host plant, as one arrives from now on.
    state.creatures[0].stage = 'egg'
    state.creatures[0].awaitingName = true
  })
  await page.reload()
  await goTo(page, 'Care')
  const arrival = page.getByRole('region', { name: /Would you like to name your .* egg\?/ })
  await expect(arrival).toBeVisible()
  expect(await seriousViolations(page, 'Care with a new arrival')).toEqual([])
  await arrival.getByLabel('Name', { exact: true }).fill('Pip')
  await arrival.getByRole('button', { name: 'Save name' }).click()
  await expect(arrival).toHaveCount(0)

  // Answered once, it is not asked again.
  await reloadAfterSave(page)
  await goTo(page, 'Care')
  await expect(page.getByText('Pip').first()).toBeVisible()
  await expect(page.getByRole('region', { name: /Would you like to name/ })).toHaveCount(0)
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
  await goTo(page, 'Journal')
  await page.getByText('Butterflies welcomed').click()
  await expect(page.getByText('Danaus plexippus')).toBeVisible()
  await expect(page.getByText('Welcomed as Luna')).toBeVisible()
})

/**
 * Whether this engine's Playwright build can reload a page while emulating
 * offline. WebKit's fails the navigation itself ("WebKit encountered an
 * internal error") before the service worker can answer, so there the offline
 * relaunch is left to Chromium and Firefox, and the report says so.
 */
function canReloadOffline(browserName: string): boolean {
  if (browserName !== 'webkit') return true
  test.info().annotations.push({
    type: 'not run in WebKit',
    description:
      'The offline reload: Playwright WebKit fails it under offline emulation. Chromium and Firefox cover it.',
  })
  return false
}

test('has no serious accessibility violations and relaunches offline', async ({
  page,
  context,
  browserName,
}) => {
  await enterGarden(page)
  await page.waitForTimeout(450)
  expect(await seriousViolations(page, 'Garden')).toEqual([])

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Sunlit Sanctuary' }),
  ).toBeVisible()
  if (!canReloadOffline(browserName)) return
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
  // Eight full axe runs: more than the default timeout allows in a slower engine.
  test.slow()
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
    await goTo(page, view)
    // Let entrance animations settle so axe sees final contrast and sizing.
    await page.waitForTimeout(400)
    offenders.push(...(await seriousViolations(page, view)))
  }
  expect(offenders).toEqual([])
})

test('a phone has five tabs in one solid row, and More holds the other four', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The dock and its More sheet are for phones; a wider screen has a tab for every page.')
  await enterGarden(page)
  const dock = page.getByRole('navigation', { name: 'Mobile navigation' })
  const tabs = dock.getByRole('button')
  await expect(tabs).toHaveText(['Garden', 'Today', 'Care', 'Journal', 'More'])
  const tops = await tabs.evaluateAll((buttons) =>
    buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
  )
  expect(new Set(tops).size).toBe(1)
  for (const box of await tabs.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect()),
  )) {
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  // Solid, so no page text reads through the labels, and no blur to redraw.
  const fill = await dock.evaluate((nav) => {
    const style = getComputedStyle(nav)
    return { background: style.backgroundColor, blur: style.backdropFilter }
  })
  expect(fill.background).toMatch(/^rgb\(/)
  expect(fill.blur === 'none' || fill.blur === '').toBe(true)

  const more = dock.getByRole('button', { name: 'More', exact: true })
  await more.click()
  const sheet = moreSheet(page)
  await expect(sheet.getByRole('heading', { name: 'More' })).toBeVisible()
  const pages = sheet.getByRole('list').getByRole('button')
  await expect(pages).toHaveText(['Shop', 'Flight', 'Guide', 'Settings'])
  // Let the sheet finish rising so axe sees it where it rests.
  await page.waitForTimeout(400)
  expect(await seriousViolations(page, 'More sheet')).toEqual([])

  await sheet.getByRole('button', { name: 'Flight', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Flight Patterns' })).toBeVisible()
  await expect(page).toHaveURL(/#\/flight$/)
  await expect(more).toHaveAttribute('aria-current', 'page')
  await expect(more).toBeFocused()

  // Escape puts it away too, and so does a tap above it.
  await more.click()
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(more).toBeFocused()
  await more.click()
  await expect(sheet).toBeVisible()
  await page.mouse.click(20, 20)
  await expect(sheet).toHaveCount(0)
  await expect(more).toBeFocused()

  await goTo(page, 'Today')
  await expect(more).not.toHaveAttribute('aria-current')

  // On its side, a large phone still shares the width among the five.
  await page.setViewportSize({ width: 915, height: 412 })
  const sideways = await tabs.evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect()
      return { width: box.width, height: box.height, top: Math.round(box.top) }
    }),
  )
  expect(new Set(sideways.map((box) => box.top)).size).toBe(1)
  for (const box of sideways) {
    expect(box.width).toBeGreaterThanOrEqual(150)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
})

test('every shop tab is reachable and accessible', async ({ page }) => {
  test.slow()
  await enterGarden(page)
  await goTo(page, 'Shop')
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
    offenders.push(...(await seriousViolations(page, tab)))
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
    page.getByRole('heading', { name: /anything to care for each day/i }),
  ).toBeVisible()
  expect(await clipped()).toEqual([])

  await page.getByRole('button', { name: 'Skip for now' }).click()
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
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await goTo(page, 'Guide')
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

    await goTo(page, 'Today')
    await expect(page.getByText('Round out your day')).toBeVisible()
    await page.getByRole('button', { name: 'Begin' }).click()

    await expect(
      page.getByRole('heading', { name: 'Here is your day.' }),
    ).toBeVisible()

    // The recap is a full view but is deliberately absent from the navigation,
    // so the sweep over every nav destination never reaches it.
    expect(await seriousViolations(page, 'Evening recap')).toEqual([])

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

    await goTo(page, 'Journal')
    await expect(page.getByText('Walked to the river.')).toBeVisible()
    await expect(page.getByText('The unanswered email.')).toBeVisible()
    await expect(
      page.getByText(/Became a goal: Book the appointment/),
    ).toBeVisible()

    // And it survives a reload: the recap is stored, not just rendered.
    await reloadAfterSave(page)
    await goTo(page, 'Journal')
    await expect(page.getByText('Walked to the river.')).toBeVisible()
  })

  test('ends by fading the garden to night, and lets the sound fade', async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date('2026-09-09T01:00:00.000Z'))
    await page.goto('/The-Butterfly-Garden/')
    await enterGarden(page)
    await page.getByRole('button', { name: /^Turn on / }).click()

    await goTo(page, 'Today')
    await page.getByRole('button', { name: 'Begin' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    for (let step = 0; step < 4; step += 1) {
      await page.getByRole('button', { name: 'Skip this one' }).click()
    }
    // The ordinary finish is still the first choice.
    const finishes = page.locator('.recap-finish button')
    await expect(finishes.first()).toHaveText('Collect Moonlight')
    expect(await seriousViolations(page, 'The end of the recap')).toEqual([])
    await page.getByRole('button', { name: 'Fade the garden to night and close' }).click()

    // Collected, night, and back in the garden with focus on its name.
    await expect(page.locator('#garden-title')).toBeFocused()
    await expect(page.locator('.app-shell')).toHaveClass(/theme-night/)
    await expect(page.locator('.stardust-wallet strong')).toHaveText('1')
    await goTo(page, 'Settings')
    await expect(page.getByText(/The sound fades away at/)).toBeVisible()
  })
})

test('personal backdrop crops, survives reload and backup restore, and rejects corrupt media', async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(60_000)
  await enterGarden(page)
  await goTo(page, 'Shop')
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
  expect(await seriousViolations(page, 'Backdrop editor')).toEqual([])
  await editor.getByRole('button', { name: 'Save & use backdrop' }).click()
  await expect(editor).not.toBeVisible()
  await page.reload()
  // A reload keeps its page now (#/shop); the image shows in the garden.
  await expect(page.getByRole('heading', { level: 1, name: /stock up/i })).toBeVisible()
  await goTo(page, 'Garden')
  await expect(page.locator('.custom-scene-layer img')).toBeVisible()
  await expect(page.locator('.custom-scene-layer img')).toHaveJSProperty(
    'naturalWidth',
    1600,
  )
  await goTo(page, 'Settings')
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
  // A restore shows what the file holds first, and replaces nothing until
  // the gardener agrees. The damaged image is caught on that agreement.
  await expect(
    page.getByRole('heading', { name: /this backup holds/i }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Restore this backup' }).click()
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
  await page.getByRole('button', { name: 'Restore this backup' }).click()
  await expect(page.getByText(/restored/i).last()).toBeVisible()
  // The garden it replaced was kept, so the restore can be undone.
  await expect(
    page.getByRole('button', { name: 'Undo the restore' }),
  ).toBeVisible()
  await goTo(page, 'Garden')
  await expect(page.locator('.custom-scene-layer img')).toHaveAttribute(
    'src',
    `data:${image.mimeType};base64,${image.imageData}`,
  )
  await page.evaluate(() => navigator.serviceWorker.ready)
  if (!canReloadOffline(browserName)) return
  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.custom-scene-layer img')).toBeVisible()
  await expect(page.locator('.custom-scene-layer img')).toHaveJSProperty(
    'complete',
    true,
  )
})

test('a look saved on one companion is worn by another, and their story kept', async ({
  page,
}) => {
  await enterGarden(page)
  await editGardenRecord(page, (state) => {
    // Sol, the starter caterpillar, in a cap the garden owns, and Fern, a
    // butterfly with nothing on yet.
    state.ownedItemIds = ['sprout-cap']
    const sol = state.creatures[0]
    sol.outfit = { headwear: 'sprout-cap' }
    state.creatures.push({ ...sol, id: 'fern', name: 'Fern', stage: 'butterfly', outfit: {} })
  })
  await page.reload()
  await goTo(page, 'Care')

  // What the next bond level asks and brings, under the meter.
  await expect(page.locator('.bond-next')).toContainText(
    'Next bond level: 10 more bond points',
  )

  await page.getByRole('button', { name: 'Save this look' }).click()
  await page.getByRole('textbox', { name: 'Name this look' }).fill('Little cap')
  await page.getByRole('button', { name: 'Save look' }).click()
  await expect(page.getByRole('heading', { name: 'Saved looks' })).toBeFocused()

  await page.getByRole('tab', { name: /^Fern/ }).click()
  await page.getByRole('button', { name: 'Wear Little cap' }).click()
  await expect(page.locator('.look-status')).toHaveText('Fern is wearing Little cap.')

  await page.getByText('Fern’s story').click()
  await expect(page.getByText('Outfits worn')).toBeVisible()
  expect(await seriousViolations(page, 'Care with saved looks and a story')).toEqual([])

  // Kept: the look is still there after a reload, and the shop knows who
  // wears the cap and what fits whom.
  await reloadAfterSave(page)
  await goTo(page, 'Care')
  await expect(page.getByRole('button', { name: 'Wear Little cap' })).toBeVisible()
  await goTo(page, 'Shop')
  await page.getByRole('button', { name: 'Boutique', exact: true }).click()
  await openShopFilters(page)
  await page.getByRole('combobox', { name: /^Companion/ }).selectOption({ label: 'Fits Sol now' })
  await closeShopFilters(page)
  await expect(page.getByRole('heading', { name: 'Star Diadem' })).toHaveCount(0)
  await expect(
    page.locator('.boutique-card', { has: page.getByRole('heading', { name: 'Sprout Cap' }) }),
  ).toContainText('Owned · worn by Sol and Fern')
})

test('boutique filters and try-on leave balances and outfits unchanged', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Shop')
  await page.getByRole('button', { name: 'Boutique', exact: true }).click()
  await openShopFilters(page)
  await page.getByRole('searchbox').fill('Daisy Bonnet')
  await closeShopFilters(page)
  await expect(page.locator('.boutique-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Preview Daisy Bonnet' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTitle('Nectar balance')).toContainText('10')
  await openShopFilters(page)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await page.getByRole('combobox', { name: /^Type/ }).selectOption('aura')
  await closeShopFilters(page)
  await expect(page.locator('.boutique-card')).toHaveCount(7)
  await openShopFilters(page)
  await page.getByRole('searchbox').fill('no such treasure')
  await closeShopFilters(page)
  await expect(
    page.getByRole('heading', { name: 'Nothing in this little corner yet' }),
  ).toBeVisible()
})

test('species seed guidance opens the right seed without planting it', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Guide')
  await page.getByRole('searchbox').fill('Queen')
  await expect(page.locator('.species-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Show Milkweed seed' }).click()
  await expect(page.locator('.seed-highlight')).toContainText('Milkweed')
  await expect(page.locator('.seed-highlight')).toBeInViewport()
  await expect(page.locator('.garden-plant')).toHaveCount(2)
})

test('the Guide finds things, marks what lives where you garden, and explains a meter', async ({
  page,
}) => {
  await enterGarden(page)

  // "What does this do?" beside Today's Sunlight, and the way back.
  await goTo(page, 'Today')
  await page.getByRole('link', { name: /^What does this do\? Sunlight/ }).click()
  await expect(page).toHaveURL(/#\/guide\/sunlight$/)
  await expect(
    page.getByRole('heading', { level: 2, name: 'Sunlight — care for yourself first' }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Back to Today' }).click()
  await expect(page).toHaveURL(/#\/today$/)

  // A region chosen by hand, never from a location.
  await goTo(page, 'Settings')
  await page.getByLabel('My region').selectOption('europe')
  await goTo(page, 'Guide')
  const contents = page.getByRole('navigation', { name: 'In this guide' })
  await contents.getByRole('link', { name: 'Where you live' }).click()
  await expect(page).toHaveURL(/#\/guide\/region$/)
  await expect(
    page.getByRole('heading', { level: 2, name: 'Butterflies where you live' }),
  ).toBeFocused()
  await expect(page.getByText('Holly and ivy, for holly blues')).toBeVisible()

  // One search for the sections and the butterflies.
  await page.getByRole('searchbox', { name: 'Search the guide' }).fill('red admiral')
  await expect(page.locator('.species-card')).toHaveCount(1)
  await expect(
    page.locator('.species-card').getByText(/^Native to the UK and Europe/).first(),
  ).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Letter jars' })).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(await seriousViolations(page, 'Guide with a region and a search')).toEqual([])
})

test.describe('the garden in flight', () => {
  // These are about motion itself, so they keep it on where a project turns
  // it off for everything else (WebKit in CI; see playwright.config.ts).
  test.use({ reducedMotion: 'no-preference' })

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

  test('butterflies keep flying while hovered, tapped, and holding focus', async ({
    page,
  }) => {
    await enterGarden(page)
    const flyer = page.locator('.garden-flight-space .flight-traveller').first()
    await expect
      .poll(() => flyer.evaluate((el) => el.getAnimations().length))
      .toBe(1)

    /** Travel, facing and the CSS wing flap, for one butterfly. */
    const flightState = () =>
      flyer.evaluate((el) => {
        const wing = el.querySelector('.wing')
        return {
          travel: el.getAnimations().map((a) => a.playState),
          heading: (
            el.querySelector('.flight-heading')?.getAnimations() ?? []
          ).map((a) => a.playState),
          wing: wing ? getComputedStyle(wing).animationPlayState : 'none',
          paused: el.classList.contains('flight-paused'),
        }
      })

    const stillFlying = async (moment: string) => {
      const state = await flightState()
      expect(state.travel, `${moment}: travel`).not.toContain('paused')
      expect(state.heading, `${moment}: heading`).not.toContain('paused')
      expect(state.wing, `${moment}: wing flap`).not.toBe('paused')
      expect(state.paused, `${moment}: flight-paused class`).toBe(false)
    }

    const marigold = flyer.locator('.butterfly')
    await stillFlying('at rest')

    await marigold.hover({ force: true })
    await stillFlying('while hovered')

    // A tap opens the butterfly's card; closing it leaves focus on the
    // butterfly. None of it may stop flight.
    await marigold.click({ force: true })
    const card = page.getByRole('dialog', { name: 'Marigold' })
    await expect(card).toBeVisible()
    await stillFlying('with its card open')
    await page.keyboard.press('Escape')
    await expect(card).toHaveCount(0)
    await expect(marigold).toBeFocused()
    await stillFlying('after a tap')

    await page.mouse.move(4, 4)
    await page.waitForTimeout(200)
    await stillFlying('pointer away, still focused')

    // Work nobody can see still stops: scrolling the scene out of view pauses
    // it, and bringing it back resumes it.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(async () => (await flightState()).paused).toBe(true)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(async () => (await flightState()).paused).toBe(false)
  })
})

test('a butterfly in the garden opens a card, and Care gives it a flight of its own', async ({
  page,
}) => {
  await enterGarden(page)
  await editGardenRecord(page, (state) => {
    // The starter companion has emerged, and a second pattern is owned.
    state.creatures[0].stage = 'butterfly'
    state.ownedFlightPatternIds = ['gentle-drift', 'petal-hop']
  })
  await page.reload()
  const sol = page.getByRole('button', { name: /^Meet Sol,/ })
  await sol.focus()
  await page.keyboard.press('Enter')
  const card = page.getByRole('dialog', { name: 'Sol' })
  await expect(card).toBeVisible()
  await expect(card.getByText('Bond level 1')).toBeVisible()
  expect(await seriousViolations(page, 'A butterfly\'s card')).toEqual([])
  await card.getByRole('button', { name: 'Pet Sol' }).click()
  await expect(card.getByText('Sol enjoyed that gentle hello.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)
  await expect(sol).toBeFocused()

  await page.keyboard.press('Enter')
  await card.getByRole('button', { name: 'Care for Sol' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Care & nurture' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Sol/ })).toBeFocused()
  // By role: the navigation's Flight button carries the same name.
  const flight = page.getByRole('combobox', { name: 'Flight', exact: true })
  await expect(flight).toHaveValue('')
  await flight.selectOption({ label: 'Petal Hop' })
  expect(await seriousViolations(page, 'Care with a flight of its own')).toEqual([])

  await reloadAfterSave(page)
  await goTo(page, 'Garden')
  await expect(page.locator('[data-flyer="marigold-guide"]')).toHaveAttribute(
    'data-pattern',
    'gentle-drift',
  )
  await expect(
    page.locator('.flight-traveller', { has: page.getByRole('button', { name: /^Meet Sol,/ }) }),
  ).toHaveAttribute('data-pattern', 'petal-hop')
  await goTo(page, 'Flight')
  await expect(
    page.getByRole('button', { name: /Petal Hop/ }).getByText('Flown by Sol'),
  ).toBeVisible()
})

test('a garden that cannot be read opens recovery, never onboarding', async ({
  page,
}) => {
  await enterGarden(page)
  await page.getByRole('heading', { level: 1 }).first().waitFor()
  // Damage one stored collection, the way a failed disk or a bad hand-edit
  // might, then open the app again.
  await page.waitForTimeout(250)
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('moods', 'readwrite')
          tx.objectStore('moods').put('not a collection', 'current')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  await page.reload()

  await expect(
    page.getByRole('heading', { name: /your saved garden could not be opened/i }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /welcome to your butterfly garden/i }),
  ).toHaveCount(0)

  // The set-aside copy is the garden exactly as it was stored.
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: /download the set-aside copy/i })
    .click()
  const download = await downloadPromise
  const copy = JSON.parse(await readFile((await download.path())!, 'utf8')) as {
    garden: { moods: unknown }
  }
  expect(copy.garden.moods).toBe('not a collection')

  expect(await seriousViolations(page, 'Recovery')).toEqual([])
})
