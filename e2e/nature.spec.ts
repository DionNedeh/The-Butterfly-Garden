import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * Noticed in Nature (plan c.2): a real sighting logged from the Guide, with a
 * photo, then found in the Journal's field notes, kept as a Blob in its own
 * store and carried in a backup as text. Swept with axe at each stage.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/The-Butterfly-Garden/')
})

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
}

/** The Monarch's card in the Guide's species directory. */
function monarchCard(page: Page) {
  return page.locator('.species-directory article.species-card').filter({
    has: page.getByRole('heading', { level: 3, name: 'Monarch', exact: true }),
  })
}

/** What the sightings store holds, read as a browser keeps it. */
function storedSightings(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Array<{ speciesId?: string; note?: string; photoIsBlob: boolean; photoSize: number }>>(
        (resolve, reject) => {
          const request = indexedDB.open('butterfly-garden')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const get = db.transaction('sightings', 'readonly').objectStore('sightings').get('current')
            get.onsuccess = () => {
              db.close()
              const sightings = (get.result ?? []) as Array<Record<string, unknown>>
              resolve(
                sightings.map((sighting) => ({
                  speciesId: sighting.speciesId as string | undefined,
                  note: sighting.note as string | undefined,
                  photoIsBlob: sighting.photo instanceof Blob,
                  photoSize: sighting.photo instanceof Blob ? sighting.photo.size : 0,
                })),
              )
            }
            get.onerror = () => reject(get.error)
          }
        },
      ),
  )
}

test('a sighting logged with a photo from the Guide waits in the Journal’s field notes', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await enterGarden(page)

  // A region, so the form lists its natives first and says what to look for.
  await goTo(page, 'Settings')
  await page.getByLabel('My region').selectOption('north-america')

  await goTo(page, 'Guide')
  const log = monarchCard(page).getByRole('button', { name: 'Log a sighting of Monarch' })
  await log.click()
  const dialog = page.getByRole('dialog', { name: 'Log a sighting' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Log a sighting' })).toBeFocused()
  await expect(dialog.getByRole('radio', { name: /^Monarch/ })).toBeChecked()
  await expect(dialog.locator('.look-for .eyebrow')).toHaveText(/^What to look for in /)
  await expect(dialog.getByText(/nothing needs to be caught or touched/)).toBeVisible()
  await expect(dialog.getByLabel('The day you saw it')).toHaveAttribute('max', /^\d{4}-\d{2}-\d{2}$/)

  // The search finds by any word, and keeps the choice made in view.
  await dialog.getByRole('searchbox', { name: 'Find a butterfly' }).fill('lady')
  await expect(dialog.getByRole('radio', { name: /^Painted Lady/ })).toBeVisible()
  await expect(dialog.getByRole('radio', { name: /^Monarch/ })).toBeChecked()

  await dialog.getByLabel('A few words, if you like').fill('Two of them, over the allotments')
  await dialog.getByLabel('Add a photo, if you like').setInputFiles('src/assets/thumb-cottage-bloom.webp')
  const preview = dialog.getByRole('img', { name: 'Your photo for this sighting' })
  await expect(preview).toBeVisible()
  await expect(preview).not.toHaveJSProperty('naturalWidth', 0)
  expect(await seriousViolations(page, 'Sighting form, with a photo')).toEqual([])

  await dialog.getByRole('button', { name: 'Save sighting' }).click()
  await expect(dialog).toHaveCount(0)
  // Focus goes back to the button that opened the form, and the card says so.
  await expect(log).toBeFocused()
  await expect(page.getByText(/Saved to your field book/)).toBeVisible()
  await expect(monarchCard(page).locator('.seen-in-wild')).toHaveText(/^Seen in the wild on /)
  await expect(monarchCard(page).locator('svg.pressed-flower')).toHaveCount(1)
  expect(await seriousViolations(page, 'Guide, after logging a sighting')).toEqual([])

  // Kept as a Blob, in a store of its own: no location, nothing earned.
  await expect
    .poll(() => storedSightings(page))
    .toEqual([
      expect.objectContaining({
        speciesId: 'monarch',
        note: 'Two of them, over the allotments',
        photoIsBlob: true,
      }),
    ])
  const [stored] = await storedSightings(page)
  expect(stored.photoSize).toBeGreaterThan(0)
  expect(stored.photoSize).toBeLessThanOrEqual(400 * 1024)
  await expect(page.locator('.header-sunlight')).toContainText('0 / 5')

  // In the Journal's field notes: the stamp on the Monarch, and the book itself.
  await goTo(page, 'Journal')
  await page.getByText('Butterflies welcomed').click()
  const fieldNote = page.locator('.field-notes .species-grid article').filter({
    has: page.getByText('Monarch', { exact: true }),
  })
  await expect(fieldNote.locator('.seen-in-wild')).toHaveText(/^Seen in the wild on /)
  await expect(fieldNote.locator('svg.pressed-flower')).toHaveCount(1)
  const book = page.getByRole('region', { name: 'Seen in the wild' })
  await expect(book.getByRole('heading', { level: 3, name: 'Monarch' })).toBeVisible()
  await expect(book.getByText('Two of them, over the allotments')).toBeVisible()
  const photo = book.getByRole('img', { name: 'Your photo of Monarch' })
  await expect(photo).toHaveAttribute('src', /^blob:/)
  await expect(photo).not.toHaveJSProperty('naturalWidth', 0)
  await expect(book.getByRole('link', { name: 'NABA Butterfly Counts (opens in your browser)' })).toHaveAttribute(
    'target',
    '_blank',
  )
  expect(await seriousViolations(page, 'Journal field book')).toEqual([])

  // A backup carries the photo as text, as it carries a personal image.
  await goTo(page, 'Settings')
  await expect(page.getByText(/Your field book keeps 1 photo of what you saw in the wild/)).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download a backup' }).click()
  const download = await downloadPromise
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8')) as {
    garden: { version: number; sightings: Array<{ photo: { mimeType: string; imageData: string } }> }
  }
  expect(backup.garden.version).toBe(8)
  const written = backup.garden.sightings[0].photo
  expect(['image/webp', 'image/jpeg']).toContain(written.mimeType)
  expect(Buffer.from(written.imageData, 'base64').length).toBe(stored.photoSize)
})

test('a sighting is changed, crossed out, and put back with Undo', async ({ page }) => {
  await enterGarden(page)
  await goTo(page, 'Journal')
  await page.getByText('Butterflies welcomed').click()
  const book = page.getByRole('region', { name: 'Seen in the wild' })
  await book.getByRole('button', { name: 'Log a sighting' }).click()
  const dialog = page.getByRole('dialog', { name: 'Log a sighting' })
  await dialog.getByRole('radio', { name: 'A plant' }).check()
  await dialog.getByRole('radio', { name: 'Milkweed' }).check()
  await dialog.getByRole('button', { name: 'Save sighting' }).click()
  await expect(book.getByRole('heading', { level: 3, name: 'Milkweed' })).toBeFocused()

  await book.getByRole('button', { name: /^Edit Milkweed/ }).click()
  const editor = page.getByRole('dialog', { name: 'Change this sighting' })
  await editor.getByLabel('A few words, if you like').fill('A whole verge of it')
  await editor.getByRole('button', { name: 'Save changes' }).click()
  await expect(book.getByRole('heading', { level: 3, name: 'Milkweed' })).toBeFocused()
  await expect(book.getByText('A whole verge of it')).toBeVisible()

  await book.getByRole('button', { name: /^Delete Milkweed/ }).click()
  await expect(book.getByRole('heading', { level: 2, name: 'Seen in the wild' })).toBeFocused()
  await expect(book.getByRole('heading', { level: 3, name: 'Milkweed' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(book.getByRole('heading', { level: 3, name: 'Milkweed' })).toBeFocused()
  expect(await seriousViolations(page, 'Journal field book, after Undo')).toEqual([])
})

test('the sighting form opened on a plant far down its list shows it chosen, a dot beside its name, at the largest text by night', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await enterGarden(page)
  // The UK and Europe's own plants come first, which puts Milkweed far down.
  await goTo(page, 'Settings')
  await page.getByLabel('My region').selectOption('europe')
  await page.getByRole('group', { name: 'Text size' }).getByRole('radio', { name: /^Largest/ }).check()
  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-night/)

  await goTo(page, 'Guide')
  await monarchCard(page).getByRole('button', { name: 'Log a sighting of Milkweed' }).click()
  const dialog = page.getByRole('dialog', { name: 'Log a sighting' })
  const heading = dialog.getByRole('heading', { name: 'Log a sighting' })
  await expect(heading).toBeFocused()
  const milkweed = dialog.getByRole('radio', { name: /^Milkweed/ })
  await expect(milkweed).toBeChecked()

  // The list has scrolled itself to show the choice whole; nothing else has,
  // so the focused heading is still in sight at the dialog's top.
  const list = dialog.locator('.sighting-choice-list')
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0)
  await expect(heading).toBeInViewport()
  const shown = await list.evaluate((element) => {
    const top = element.getBoundingClientRect().top + element.clientTop
    const row = element.querySelector('input:checked')!.closest('label')!.getBoundingClientRect()
    return { above: top - row.top, below: row.bottom - (top + element.clientHeight) }
  })
  expect(shown.above).toBeLessThanOrEqual(0.5)
  expect(shown.below).toBeLessThanOrEqual(0.5)

  // Every radio is a small dot, its name right beside it, not a text
  // field's full width pushing the name into a narrow column.
  const radios = await dialog.locator('input[type="radio"]').evaluateAll((inputs) =>
    inputs.map((input) => {
      const dot = input.getBoundingClientRect()
      const name = input.nextElementSibling?.getBoundingClientRect()
      return { width: dot.width, gap: name ? name.left - dot.right : 0 }
    }),
  )
  expect(radios.length).toBeGreaterThan(20)
  for (const { width, gap } of radios) {
    expect(width).toBeLessThanOrEqual(24)
    expect(gap).toBeLessThanOrEqual(16)
  }
  expect(await seriousViolations(page, 'Sighting form at the largest text, by night')).toEqual([])
})
