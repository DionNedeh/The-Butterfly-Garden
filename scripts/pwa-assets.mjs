#!/usr/bin/env node
/**
 * Render the PWA's install assets from the web build itself.
 *
 *   npm run build
 *   npx vite preview --host 127.0.0.1 --port 4180 --strictPort &
 *   node scripts/pwa-assets.mjs
 *
 * Writes, for the web manifest (src/pwaManifest.ts):
 *   public/icons/shortcut-*.png   192×192 icons for the home-screen shortcuts
 *   public/screenshots/*.png      the install sheet's screenshots
 *
 * The screenshots are written as Playwright takes them, about 1 MB each.
 * Shrink them to a 256-colour palette before committing, to about 300 kB,
 * for example with Pillow. Fast octree with a few k-means passes keeps the
 * page's soft background gradient smooth; dithering would double the size.
 *   python3 -c "import sys; from PIL import Image; [Image.open(f).convert('RGB')
 *     .quantize(256, method=Image.Quantize.FASTOCTREE, kmeans=3)
 *     .save(f, optimize=True) for f in sys.argv[1:]]" public/screenshots/*.png
 *
 * Set CHROMIUM_PATH to use a particular Chromium, and ASSETS_URL if the
 * preview is not on http://127.0.0.1:4180/The-Butterfly-Garden.
 *
 * The garden in the screenshots is a demonstration: onboarded through the UI,
 * then grown by writing to its own IndexedDB stores (as the e2e tests and
 * scripts/play-store-assets.mjs do), so every pixel is the real app.
 */
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.ASSETS_URL ?? 'http://127.0.0.1:4180/The-Butterfly-Garden'
const ICONS = new URL('../public/icons/', import.meta.url)
const SHOTS = new URL('../public/screenshots/', import.meta.url)

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)

/**
 * The app's own navigation icons (src/components/Icons.tsx), on the theme's
 * forest green: a weather sun for the check-in, Today's calendar, the journal.
 */
const SHORTCUT_ICONS = {
  'check-in':
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  today:
    '<path d="M7 3v3M17 3v3M4 9h16"/><rect x="4" y="5" width="16" height="16" rx="3"/><path d="m8 15 2.5 2.5L16 12"/>',
  journal:
    '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M8 4v16M11 9h5M11 13h5"/>',
}

async function shortcutIcons() {
  const context = await browser.newContext({ viewport: { width: 192, height: 192 } })
  const page = await context.newPage()
  for (const [name, paths] of Object.entries(SHORTCUT_ICONS)) {
    await page.setContent(`<!doctype html>
      <style>html,body{margin:0;background:transparent}</style>
      <svg width="192" height="192" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg">
        <circle cx="96" cy="96" r="96" fill="#315c4b"/>
        <g transform="translate(48 48) scale(4)" fill="none" stroke="#fdf1ce"
           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
      </svg>`)
    await page.screenshot({
      path: new URL(`shortcut-${name}.png`, ICONS).pathname,
      omitBackground: true,
    })
  }
  await context.close()
}

async function readGarden(page, names) {
  return page.evaluate(
    (stores) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(stores, 'readonly')
          const parts = {}
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
    names,
  )
}

async function writeGarden(page, parts) {
  await page.evaluate(
    (next) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(Object.keys(next), 'readwrite')
          for (const [name, value] of Object.entries(next))
            tx.objectStore(name).put(value, 'current')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    parts,
  )
}

/** Onboard a garden through the UI, then grow it a few weeks on. */
async function grownGarden(page) {
  await page.goto(`${BASE}/`)
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByLabel('Your name').fill('River')
  await page.getByLabel('Garden name').fill('Willowlight Garden')
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await page.waitForTimeout(600)

  const { meta, plants, creatures } = await readGarden(page, ['meta', 'plants', 'creatures'])
  const plantedAt = new Date(Date.now() - 24 * 86_400_000).toISOString()
  const grown = ['milkweed', 'coneflower', 'parsley', 'zinnia', 'violet', 'aster'].map(
    (plantId, index) => ({
      id: plants[index]?.id ?? `demo-plant-${index}`,
      plantId,
      growth: 3,
      plantedAt,
    }),
  )
  const butterflies = [
    ['monarch', 'Sol'],
    ['painted-lady', 'Wren'],
    ['black-swallowtail', 'Juniper'],
    ['common-buckeye', 'Clover'],
  ].map(([speciesId, name], index) => ({
    ...creatures[0],
    id: index === 0 ? creatures[0].id : `demo-butterfly-${index}`,
    speciesId,
    name,
    stage: 'butterfly',
    bond: 40 + index * 10,
    discoveredAt: plantedAt,
  }))
  await writeGarden(page, {
    // Backed up yesterday, so Settings has nothing to suggest.
    meta: {
      ...meta,
      nectar: 140,
      stardust: 12,
      profile: {
        ...meta.profile,
        createdAt: plantedAt,
        lastBackupAt: new Date(Date.now() - 86_400_000).toISOString(),
      },
    },
    plants: grown,
    creatures: butterflies,
  })
  await page.reload()
  await page.getByRole('heading', { name: 'Willowlight Garden' }).waitFor()
  // Entrance animations finish and butterflies spread out across the scene.
  await page.waitForTimeout(7000)
}

/**
 * Mid-morning today, whatever the hour this runs at, so the evening's
 * Moonlight card and its late-night wording stay out of the pictures.
 */
function morning() {
  const time = new Date()
  time.setHours(10, 30, 0, 0)
  return time
}

/** Bring the card holding `selector` to the top, clear of the sticky header. */
async function scrollToCard(page, selector) {
  await page.locator(selector).first().evaluate((element) => {
    const card = element.closest('section') ?? element
    const header = document.querySelector('.app-header')
    const below = (header?.getBoundingClientRect().height ?? 0) + 16
    const top = card.getBoundingClientRect().top + window.scrollY - below
    window.scrollTo({ top, behavior: 'instant' })
  })
}

async function screenshots() {
  await mkdir(SHOTS, { recursive: true })

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  })
  await phone.clock.setFixedTime(morning())
  const page = await phone.newPage()
  await grownGarden(page)
  await page.screenshot({ path: new URL('garden-narrow.png', SHOTS).pathname })

  await page.goto(`${BASE}/#/today`)
  await page.getByRole('heading', { level: 1, name: 'Today' }).waitFor()
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill('A slow, sunny morning.')
  await page.getByRole('button', { name: /save check-in/i }).click()
  for (const goal of ['Drink some water', 'Ten minutes outside', 'Text Mum back']) {
    await page.getByLabel('Add a goal').fill(goal)
    await page.getByRole('button', { name: 'Add goal' }).click()
  }
  await page.getByRole('button', { name: /care for drink some water/i }).click()
  // The offer to undo it has gone by the time anyone would look.
  await page.locator('.undo-toast').waitFor({ state: 'detached', timeout: 15_000 })
  await scrollToCard(page, '#mood-title')
  await page.waitForTimeout(1800)
  await page.screenshot({ path: new URL('today-narrow.png', SHOTS).pathname })
  await phone.close()

  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
  })
  await desktop.clock.setFixedTime(morning())
  const wide = await desktop.newPage()
  await grownGarden(wide)
  await wide.screenshot({ path: new URL('garden-wide.png', SHOTS).pathname })
  await desktop.close()
}

try {
  await shortcutIcons()
  await screenshots()
  console.log('Wrote shortcut icons and screenshots into public/')
} finally {
  await browser.close()
}
