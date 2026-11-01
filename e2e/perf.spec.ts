import { expect, test } from '@playwright/test'
import { holdStill, plantFixedGarden, welcomeSteps } from './fixedGarden'

/**
 * The garden's motion costs no layout per frame (plan a.4 T3).
 *
 * Every wing, stem and aura moves on a layer of its own, an `<svg>` the
 * compositor can move without the main thread (SpriteFrame). An animation
 * on an element inside an SVG instead makes Chromium recalculate style and
 * lay the page out again on every frame, which is what slowed a dozen
 * butterflies to 22 fps on a slow phone. So: a full garden, every butterfly
 * flying, the CPU slowed four times as on a modest phone, and the browser's
 * own count of layouts (the DevTools protocol's Performance.getMetrics)
 * over four seconds. That count does not depend on how fast the machine is,
 * only on what the page asks for, so it holds on a shared CI runner: a few
 * layouts for the odd change of words, never one a frame.
 *
 * No frame-rate target: frames a second on a shared runner say more about
 * the runner than about the garden, and would fail at random. The only
 * frame count asked for is a loose floor (more than 30 in four seconds), so
 * that a page that stopped drawing cannot pass for one that lays out
 * nothing.
 *
 * Chromium only: the DevTools protocol is Chromium's (playwright.config.ts
 * keeps this file out of the WebKit and Firefox projects, and the Android
 * project runs only its own specs and the style comparison).
 */

test.use({ reducedMotion: 'no-preference', timezoneId: 'UTC', locale: 'en-US' })

test('a garden of twelve butterflies flies without a layout every frame', async ({ page }) => {
  test.setTimeout(120_000)
  await holdStill(page)
  await page.goto('/The-Butterfly-Garden/')
  await welcomeSteps(page, async () => {})
  await plantFixedGarden(page, { theme: 'sunlight', butterflies: 12 })
  // Twelve fly at once at most (GardenView's MAX_VISIBLE_FLYERS).
  await expect(page.locator('.garden-flight-space .flight-traveller')).toHaveCount(12)
  // Let the first layouts (fonts, the scene's images, each flight's track) pass.
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForTimeout(1_500)

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const layouts = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics')
    return metrics.find((metric) => metric.name === 'LayoutCount')?.value ?? Number.NaN
  }
  // Frames drawn meanwhile, counted by the page itself.
  await page.evaluate(() => {
    const counter = window as unknown as { framesDrawn: number }
    counter.framesDrawn = 0
    const tick = () => {
      counter.framesDrawn += 1
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const frames = () => page.evaluate(() => (window as unknown as { framesDrawn: number }).framesDrawn)
  // What is moving: every flying butterfly's two wings, and each plant's
  // sway, by the animations running on those layers. Frames are drawn
  // whether or not anything moves, so this, not the count of frames, is
  // what says the garden was moving.
  const moving = () =>
    page.evaluate(() => {
      const running = new Set(
        document
          .getAnimations()
          .filter((animation) => animation.playState === 'running')
          .map((animation) => (animation.effect as KeyframeEffect | null)?.target),
      )
      const layers = (selector: string) => {
        const all = Array.from(document.querySelectorAll(selector))
        return { layers: all.length, running: all.filter((layer) => running.has(layer)).length }
      }
      return {
        wings: layers('.flight-traveller .butterfly-sprite .wing'),
        sway: layers('.flower-sprite .plant-sway'),
      }
    })
  const expectMoving = async (when: string) => {
    const now = await moving()
    expect(now.wings, `wings flapping ${when}`).toEqual({ layers: 24, running: 24 })
    expect(now.sway.layers, `plants swaying ${when}`).toBeGreaterThan(0)
    expect(now.sway.running, `plants swaying ${when}`).toBe(now.sway.layers)
  }
  await expectMoving('before the count')

  const layoutsBefore = await layouts()
  const framesBefore = await frames()
  await page.waitForTimeout(4_000)
  const laidOut = (await layouts()) - layoutsBefore
  const drawn = (await frames()) - framesBefore
  await expectMoving('after the count')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

  test.info().annotations.push({ type: 'layouts', description: `${laidOut} layouts in ${drawn} frames` })
  // The page went on drawing (a loose floor, not a frame rate)...
  expect(drawn, 'frames drawn in four seconds').toBeGreaterThan(30)
  // ...and, moving as it was, laid out a handful of times, not once a frame.
  expect(laidOut, `${laidOut} layouts in ${drawn} frames`).toBeLessThanOrEqual(Math.max(8, drawn / 10))
})
