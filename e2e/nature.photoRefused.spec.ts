import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * Safari's Private Browsing, played in any browser (plan 5.2). There, and in
 * WebKit's test contexts, IndexedDB takes a photo's Blob and then refuses it,
 * and in CI's browsers run the garden's writes after it did not land either:
 * five seconds on, with the photo taken back out, it still said a change
 * could not be saved (e2e/nature.spec.ts in WebKit). This page's IndexedDB is
 * made to behave that way: a write holding a Blob fails after it is taken,
 * and its transaction never finishes, so the stores it named stay held. A
 * sighting logged with a photo is kept without it, the field book says so,
 * and the garden goes on saving (lib/photoCheck).
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const holdsBlob = (value: unknown, depth = 0): boolean => {
      if (value instanceof Blob) return true
      if (depth > 3 || !value || typeof value !== 'object') return false
      return Object.values(value).some((item) => holdsBlob(item, depth + 1))
    }
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (!holdsBlob(value)) return put.call(this, value, key)
      // Taken, then refused...
      put.call(this, 0, 'refused')
      const request = this.add(0, 'refused')
      request.addEventListener('error', (event) => {
        // ...and never finished: the transaction keeps its stores.
        event.preventDefault()
        const hold = () => {
          this.get('refused').onsuccess = hold
        }
        hold()
      })
      return request
    }
  })
  await page.goto('/The-Butterfly-Garden/')
})

async function enterGarden(page: Page) {
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
}

/** What the garden's database holds of the theme and the sightings. */
function stored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ theme: unknown; sightings: Array<{ speciesId: unknown; note: unknown; photo: boolean }> }>(
        (resolve, reject) => {
          const request = indexedDB.open('butterfly-garden')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const tx = db.transaction(['meta', 'sightings'], 'readonly')
            const meta = tx.objectStore('meta').get('current')
            const sightings = tx.objectStore('sightings').get('current')
            tx.oncomplete = () => {
              db.close()
              resolve({
                theme: (meta.result as { profile?: { theme?: unknown } } | undefined)?.profile?.theme,
                sightings: ((sightings.result ?? []) as Array<Record<string, unknown>>).map((sighting) => ({
                  speciesId: sighting.speciesId,
                  note: sighting.note,
                  photo: sighting.photo !== undefined,
                })),
              })
            }
            tx.onerror = () => reject(tx.error)
          }
        },
      ),
  )
}

const NOT_SAVED = 'Your last change could not be saved.'

test('a photo this browser will not keep is let go, and the garden goes on saving', async ({ page }) => {
  test.setTimeout(60_000)
  await enterGarden(page)
  // A change first, as in CI's run: the day's first is kept with a copy of
  // the garden, and the photo's write is then the garden's next.
  await goTo(page, 'Settings')
  await page.getByLabel('My region').selectOption('north-america')

  await goTo(page, 'Guide')
  const card = page.locator('.species-directory article.species-card').filter({
    has: page.getByRole('heading', { level: 3, name: 'Monarch', exact: true }),
  })
  await card.getByRole('button', { name: 'Log a sighting of Monarch' }).click()
  const dialog = page.getByRole('dialog', { name: 'Log a sighting' })
  await dialog.getByLabel('A few words, if you like').fill('One, on the buddleia')
  await dialog.getByLabel('Add a photo, if you like').setInputFiles('src/assets/thumb-cottage-bloom.webp')
  await expect(dialog.getByRole('img', { name: 'Your photo for this sighting' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Save sighting' }).click()
  await expect(dialog).toHaveCount(0)

  // Said plainly, and nothing held up: no word of a change not saved.
  await expect(page.getByText('The photo could not be stored on this device, so it was not kept.')).toBeVisible()
  await expect(card.locator('.seen-in-wild')).toHaveText(/^Seen in the wild on /)
  await expect(page.getByText(NOT_SAVED)).toHaveCount(0)

  // The next change saves too, with the sighting, words and all, kept without its photo.
  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect
    .poll(() => stored(page))
    .toEqual({
      theme: 'night',
      sightings: [{ speciesId: 'monarch', note: 'One, on the buddleia', photo: false }],
    })
  await expect(page.getByText(NOT_SAVED)).toHaveCount(0)

  // In the Journal's field notes, without a photo.
  await goTo(page, 'Journal')
  await page.getByText('Butterflies welcomed').click()
  const book = page.getByRole('region', { name: 'Seen in the wild' })
  await expect(book.getByRole('heading', { level: 3, name: 'Monarch' })).toBeVisible()
  await expect(book.getByText('One, on the buddleia')).toBeVisible()
  await expect(book.getByRole('img', { name: 'Your photo of Monarch' })).toHaveCount(0)
  expect(await seriousViolations(page, 'Journal field book, a photo not kept')).toEqual([])
})
