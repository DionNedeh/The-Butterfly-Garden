import { expect, type Page } from '@playwright/test'

/**
 * A garden that is the same on every run, for the suites that compare one
 * run with another (e2e/visual.spec.ts, e2e/perf.spec.ts): the same day, the
 * same "random" numbers, the same plants and butterflies.
 */

/** The page's clock, held at mid-morning on a June day in UTC. */
export const FIXED_NOW = new Date('2026-06-16T10:00:00.000Z')

/**
 * Hold the clock still and make Math.random repeat itself, from the first
 * script the page runs. Timers still run; only the date stands still.
 */
export async function holdStill(page: Page) {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.addInitScript(() => {
    // mulberry32, from a fixed seed: the same sequence on every load.
    let seed = 0x5eed
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
  })
}

/** The garden's parts the fixture writes, as the repository stores them. */
interface Stored {
  meta: Record<string, unknown> & { profile: Record<string, unknown> }
  plants: Array<Record<string, unknown>>
  creatures: Array<Record<string, unknown>>
  jars: Array<Record<string, unknown>>
  placements: Array<Record<string, unknown>>
}

/**
 * Edit the stored garden directly, as e2e/app.spec.ts does (see
 * editGardenRecord there): the one other place outside the repository that
 * knows how storage is laid out.
 */
async function editStored(page: Page, mutate: (stored: Stored) => void) {
  // Let the app's own write land first, or this edit would be overwritten.
  await page.waitForTimeout(400)
  const names = ['meta', 'plants', 'creatures', 'jars', 'placements'] as const
  const stored = await page.evaluate(
    (stores) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction([...stores], 'readonly')
          const parts: Record<string, unknown> = {}
          for (const name of stores) {
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
    [...names],
  )
  const parts = stored as unknown as Stored
  parts.jars ??= []
  parts.placements ??= []
  mutate(parts)
  await page.evaluate(
    ({ stores, next }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction([...stores], 'readwrite')
          for (const name of stores) tx.objectStore(name).put(next[name], 'current')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { stores: [...names], next: parts as unknown as Record<string, unknown> },
  )
}

/** The theme the stored garden holds, once the app has saved it. */
export function storedTheme(page: Page): Promise<unknown> {
  return page.evaluate(
    () =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const get = db.transaction('meta', 'readonly').objectStore('meta').get('current')
          get.onsuccess = () => {
            db.close()
            resolve((get.result as { profile?: { theme?: unknown } } | undefined)?.profile?.theme)
          }
          get.onerror = () => reject(get.error)
        }
      }),
  )
}

const PLANTS: ReadonlyArray<readonly [plantId: string, growth: number]> = [
  ['milkweed', 3],
  ['parsley', 2],
  ['zinnia', 3],
  ['aster', 1],
  ['coneflower', 0],
  ['willow', 2],
  ['passionflower', 3],
  ['violet', 1],
]

const SPECIES = [
  'monarch',
  'blue-morpho',
  'painted-lady',
  'red-admiral',
  'tiger-swallowtail',
  'glasswing',
  'gulf-fritillary',
  'zebra-longwing',
  'common-buckeye',
  'mourning-cloak',
  'spring-azure',
  'atala',
]

/**
 * Plant the garden through the app's own welcome, then make it the fixed
 * one: eight plants at every stage, a jar on the first, the starter
 * companion with `butterflies` grown butterflies beside it, something in the
 * purse, and the theme asked for. Reloads into it.
 */
export async function plantFixedGarden(
  page: Page,
  { theme, butterflies }: { theme: 'sunlight' | 'night'; butterflies: number },
) {
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await expect(page.locator('#garden-title')).toBeVisible()
  const seed = () =>
    editStored(page, ({ meta, plants, creatures, jars, placements }) => {
      meta.profile.theme = theme
      meta.nectar = 240
      meta.stardust = 60
      const planted = plants[0]?.plantedAt ?? FIXED_NOW.toISOString()
      plants.splice(
        0,
        plants.length,
        ...PLANTS.map(([plantId, growth], index) => ({
          id: `fixed-plant-${index}`,
          plantId,
          growth,
          plantedAt: planted,
        })),
      )
      // A jar on the milkweed, so where a jar sits against its plant is drawn.
      jars.splice(0, jars.length, { id: 'fixed-jar', character: 'R', colorId: 'blue', purchasedAt: planted })
      placements.splice(0, placements.length, { plantId: 'fixed-plant-0', jarId: 'fixed-jar' })
      const starter = creatures[0]
      creatures.splice(
        1,
        creatures.length,
        ...SPECIES.slice(0, butterflies).map((speciesId, index) => {
          const butterfly: Record<string, unknown> = {
            ...starter,
            id: `fixed-butterfly-${index}`,
            name: `Flutter ${index + 1}`,
            speciesId,
            stage: 'butterfly',
            outfit: {},
          }
          delete butterfly.awaitingName
          delete butterfly.sourcePlantId
          return butterfly
        }),
      )
    })
  // The app's own write of the new garden can land after this one on a busy
  // machine, and put the garden back as it was planted: then again.
  await expect(async () => {
    await seed()
    await page.reload()
    await expect(page.getByText(/all 8 spaces are growing/i)).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 60_000 })
}

/** Through the welcome to its last page, the names and goals filled the same way each time. */
export async function welcomeSteps(page: Page, at: (step: string) => Promise<void>) {
  await expect(page.getByRole('heading', { name: /welcome to your butterfly garden/i })).toBeVisible()
  await at('welcome')
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByLabel('Your name').fill('River')
  await page.getByLabel('Garden name').fill('Willowlight Garden')
  await at('names')
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await expect(page.getByRole('heading', { name: 'Anything to care for each day?' })).toBeFocused()
  await page.getByRole('checkbox', { name: /^Drink a glass of water/ }).check()
  await at('starter goals')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Seeds and host plants' })).toBeVisible()
  await at('how it grows')
}
