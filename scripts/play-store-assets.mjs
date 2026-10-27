#!/usr/bin/env node
/**
 * Render the Google Play store assets from the Android build itself.
 *
 *   npm run build:android
 *   npx vite preview --mode android --host 127.0.0.1 --port 4174 &
 *   node scripts/play-store-assets.mjs
 *
 * Writes docs/play-store/:
 *   icon-512.png          512×512, 32-bit PNG with alpha (Play's app icon)
 *   feature-graphic.jpg   1024×500 (Play's feature graphic; no alpha)
 *   screenshots/*.jpg     1080×1920 phone screenshots, 9:16
 *
 * Set CHROMIUM_PATH to use a particular Chromium, and ASSETS_URL if the
 * preview is not on http://127.0.0.1:4174.
 *
 * The garden in the screenshots is a demonstration: onboarded through the UI,
 * then grown by writing to its own IndexedDB stores (as the e2e tests do), so
 * every pixel is the real app.
 */
import { mkdir, readdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const BASE = process.env.ASSETS_URL ?? 'http://127.0.0.1:4174'
const OUT = new URL('../docs/play-store/', import.meta.url)
const SHOTS = new URL('screenshots/', OUT)

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
)

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

function nav(page) {
  return page.locator('nav[aria-label$="navigation" i]:visible').first()
}

/**
 * A page by its label, as a gardener reaches it: from its tab, or on a phone
 * from the More sheet, where Shop, Flight, Guide and Settings live.
 */
async function open(page, label) {
  const tab = nav(page).getByRole('button', { name: new RegExp(`^${label}(,|$)`) })
  if (await tab.isVisible()) {
    await tab.click()
    return
  }
  await nav(page).getByRole('button', { name: /^More(,|$)/ }).click()
  await page
    .getByRole('dialog', { name: 'More' })
    .getByRole('button', { name: new RegExp(`^${label}(,|$)`) })
    .click()
}

async function settle(page, ms = 1800) {
  // Entrance animations finish and butterflies spread out across the scene.
  await page.waitForTimeout(ms)
}

/**
 * Bring the card holding `selector` to the top, clear of the sticky header;
 * with `exact`, the element itself rather than its enclosing card.
 */
async function scrollToSection(page, selector, { exact = false } = {}) {
  await page.locator(selector).first().evaluate((element, onlyElement) => {
    const card = onlyElement
      ? element
      : (element.closest('section, .timeline, .boutique-grid') ?? element)
    const header = document.querySelector('.app-header')
    const below = (header?.getBoundingClientRect().height ?? 0) + 16
    const top = card.getBoundingClientRect().top + window.scrollY - below
    window.scrollTo({ top, behavior: 'instant' })
  }, exact)
}

async function screenshots() {
  await mkdir(SHOTS, { recursive: true })
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/`)
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await page.getByLabel('Your name').fill('River')
  await page.getByLabel('Garden name').fill('Willowlight Garden')
  await page.getByRole('button', { name: /meet your garden guide/i }).click()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await page.getByRole('button', { name: /plant my first seeds/i }).click()
  await page.waitForTimeout(600)

  // A garden a few weeks in: plants in bloom, butterflies welcomed.
  const { meta, plants, creatures } = await readGarden(page, [
    'meta',
    'plants',
    'creatures',
  ])
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
    meta: {
      ...meta,
      nectar: 140,
      stardust: 12,
      profile: { ...meta.profile, createdAt: plantedAt },
    },
    plants: grown,
    creatures: butterflies,
  })
  await page.reload()
  await page.getByRole('heading', { name: 'Willowlight Garden' }).waitFor()

  await settle(page, 7000)
  await page.screenshot({ path: new URL('01-garden.jpg', SHOTS).pathname, type: 'jpeg', quality: 92 })

  await nav(page).getByRole('button', { name: 'Today', exact: true }).click()
  await page.getByRole('button', { name: /bright/i }).click()
  await page.getByLabel('A note, if you want').fill('A slow, sunny morning.')
  await page.getByRole('button', { name: /save check-in/i }).click()
  for (const goal of ['Drink some water', 'Ten minutes outside', 'Text Mum back']) {
    await page.getByLabel('Add a goal').fill(goal)
    await page.getByRole('button', { name: 'Add goal' }).click()
  }
  await page.getByRole('button', { name: /care for drink some water/i }).click()
  await scrollToSection(page, '#mood-title')
  await settle(page)
  await page.screenshot({ path: new URL('02-today.jpg', SHOTS).pathname, type: 'jpeg', quality: 92 })

  await nav(page).getByRole('button', { name: 'Care', exact: true }).click()
  await settle(page)
  await page.screenshot({ path: new URL('03-care.jpg', SHOTS).pathname, type: 'jpeg', quality: 92 })

  await nav(page).getByRole('button', { name: 'Journal', exact: true }).click()
  await scrollToSection(page, '.timeline')
  await settle(page)
  await page.screenshot({ path: new URL('04-journal.jpg', SHOTS).pathname, type: 'jpeg', quality: 92 })

  await open(page, 'Shop')
  await page.getByRole('button', { name: 'Boutique', exact: true }).click()
  await scrollToSection(page, '.boutique-card')
  await settle(page)
  await page.screenshot({ path: new URL('05-boutique.jpg', SHOTS).pathname, type: 'jpeg', quality: 92 })

  await nav(page).getByRole('button', { name: 'Garden', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await settle(page, 5000)
  await page.screenshot({ path: new URL('06-night-garden.jpg', SHOTS).pathname, type: 'jpeg', quality: 92 })

  await open(page, 'Guide')
  await scrollToSection(page, '.species-grid', { exact: true })
  await settle(page)
  await page.screenshot({ path: new URL('07-guide.jpg', SHOTS).pathname, type: 'jpeg', quality: 92 })
  await context.close()
}

/**
 * A page of our own HTML at the preview's origin (served by Playwright, never
 * by the app), so the app's images and fonts load same-origin with no CSP.
 */
async function assetPage(context, html) {
  const page = await context.newPage()
  const url = `${BASE}/__play-store-asset.html`
  await page.route(url, (route) =>
    route.fulfill({ contentType: 'text/html', body: `<!doctype html>${html}` }),
  )
  await page.goto(url)
  return page
}

async function icon() {
  const context = await browser.newContext({ viewport: { width: 512, height: 512 } })
  const page = await assetPage(
    context,
    `<style>html,body{margin:0;background:transparent}img{display:block;width:512px;height:512px}</style>
     <img src="${BASE}/icons/icon-512.webp" alt="">`,
  )
  await page.locator('img').evaluate((img) => img.decode())
  await page.screenshot({ path: new URL('icon-512.png', OUT).pathname, omitBackground: true })
  await context.close()
}

async function featureGraphic() {
  const assets = await readdir(new URL('../dist-android/assets/', import.meta.url))
  const backdrop = assets.find((name) => name.startsWith('garden-background-'))
  const display = assets.find((name) => name.startsWith('fraunces-normal-latin-') && !name.includes('ext'))
  const body = assets.find((name) => name.startsWith('nunito-sans-normal-latin-') && !name.includes('ext'))
  const context = await browser.newContext({ viewport: { width: 1024, height: 500 } })
  const page = await assetPage(context, `
    <style>
      @font-face { font-family: Fraunces; src: url(${BASE}/assets/${display}) format('woff2'); font-weight: 100 900; }
      @font-face { font-family: Nunito; src: url(${BASE}/assets/${body}) format('woff2'); font-weight: 200 1000; }
      html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; }
      .frame {
        position: relative; width: 1024px; height: 500px;
        background: url(${BASE}/assets/${backdrop}) center 62% / cover;
        display: flex; align-items: center; gap: 44px; padding: 0 72px; box-sizing: border-box;
      }
      .frame::before {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(90deg, rgba(248,242,223,0.94) 0%, rgba(248,242,223,0.82) 48%, rgba(248,242,223,0.05) 78%);
      }
      img { position: relative; width: 196px; height: 196px; border-radius: 44px;
        box-shadow: 0 18px 44px rgba(34,68,56,0.28); }
      .words { position: relative; max-width: 470px; color: #224438; }
      h1 { margin: 0 0 14px; font: 600 58px/1.02 Fraunces, Georgia, serif; letter-spacing: -0.01em; }
      p { margin: 0; font: 600 24px/1.4 Nunito, system-ui, sans-serif; color: #315c4b; }
    </style>
    <div class="frame">
      <img src="${BASE}/icons/icon-512.webp" alt="">
      <div class="words">
        <h1>The Butterfly Garden</h1>
        <p>Small acts of self-care grow a sanctuary of butterflies.</p>
      </div>
    </div>`)
  await page.evaluate(() => document.fonts.ready)
  await page.locator('img').evaluate((img) => img.decode())
  await page.waitForTimeout(300)
  await page.screenshot({ path: new URL('feature-graphic.jpg', OUT).pathname, type: 'jpeg', quality: 94 })
  await context.close()
}

try {
  await mkdir(OUT, { recursive: true })
  await icon()
  await featureGraphic()
  await screenshots()
  console.log('Wrote', OUT.pathname)
} finally {
  await browser.close()
}
