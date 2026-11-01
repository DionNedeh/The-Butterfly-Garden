import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { hashForRoute, routeFromHash } from '../src/lib/routes'
import { FIXED_NOW, holdStill, plantFixedGarden, storedTheme, welcomeSteps } from './fixedGarden'
import {
  describeChanges,
  distinctLines,
  readBaselines,
  settle,
  styleLines,
  writeBaselines,
  type Drawn,
} from './styleSnapshot'

/**
 * Every page, in sunlight and at night, at desktop and phone size, plus the
 * welcome and the evening's recap, drawn as it was: a change to a stylesheet or a sprite that alters
 * what any element is drawn with fails here, and says which elements.
 *
 * What is compared is each element's computed style (e2e/styleSnapshot.ts),
 * not pixels, so a baseline holds on any machine with this Chromium,
 * whatever its fonts. They are kept in e2e/style-baselines/, one file per
 * project. After a change that is meant to look different, write them all
 * again, and read the diff before committing it:
 *
 *   UPDATE_STYLE_BASELINES=1 npx playwright test e2e/visual.spec.ts
 *
 * Chromium only (desktop, phone, and a short set in the Android bundle):
 * computedStyleMap is Chromium's, and playwright.config.ts keeps this file
 * out of the WebKit and Firefox projects.
 */

const UPDATE = Boolean(process.env.UPDATE_STYLE_BASELINES)
const COMMAND = 'UPDATE_STYLE_BASELINES=1 npx playwright test e2e/visual.spec.ts'

test.use({ reducedMotion: 'reduce', timezoneId: 'UTC', locale: 'en-US' })

/** The day and the year the fixed garden's clock stands at. */
const DAY = FIXED_NOW.toISOString().slice(0, 10)
const YEAR = DAY.slice(0, 4)

/**
 * Addresses routes.ts matches by a pattern whose parts this test cannot name
 * for itself, named here by hand. A pattern in neither fails the test.
 */
const BY_HAND: Record<string, string[]> = {
  // The Guide at one of its sections: any short name, so one it has.
  GUIDE_SECTION: ['guide/sunlight'],
}

/**
 * The addresses a pattern in routes.ts (`const NAME = /^…$/`) matches, as
 * this test can name them: each word of a choice among words (the shop's
 * tabs), the fixed garden's day for a day, and its year for a year.
 * Undefined for a pattern holding anything else.
 */
function patternPaths(pattern: string): string[] | undefined {
  let rest = pattern.replace(/^\^/, '').replace(/\$$/, '').replace(/\\\//g, '/')
  let paths = ['']
  while (rest) {
    const group = /^\(([^()]*)\)/.exec(rest)
    const literal = /^[\w/-]+/.exec(rest)
    const inner = group?.[1]
    const parts = !group
      ? literal && [literal[0]]
      : inner === '\\d{4}-\\d{2}-\\d{2}'
        ? [DAY]
        : inner === '\\d{4}'
          ? [YEAR]
          : inner && /^[\w-]+(\|[\w-]+)*$/.test(inner)
            ? inner.split('|')
            : undefined
    if (!parts) return undefined
    paths = paths.flatMap((path) => parts.map((part) => path + part))
    rest = rest.slice((group ?? literal)![0].length)
  }
  return paths
}

/**
 * Every address src/lib/routes.ts gives a page, read from the file itself so
 * that a page added there is covered (and fails until its baseline is
 * written): each view's own path, each further address routeFromHash names
 * outright (the shop's Garden Pass tab), and those it matches by a pattern
 * (a Guide section, a year, and any added later). A pattern this test
 * cannot name an address for fails it, so that no page goes undrawn unseen.
 * Two that open the same page (`#/recap` lands on Today) are visited once;
 * the recap itself is opened from Today in the evening (below).
 */
function addresses(): Array<{ name: string; hash: string }> {
  const source = readFileSync('src/lib/routes.ts', 'utf8')
  const paths = /const PATHS[^{]*\{([\s\S]*?)\n\}/.exec(source)?.[1] ?? ''
  const found = [
    ...Array.from(paths.matchAll(/^\s*'?[\w-]+'?:\s*'([^']*)'/gm), (match) => match[1]),
    ...Array.from(source.matchAll(/path === '([^']+)'/g), (match) => match[1]),
  ]
  const unnamed: string[] = []
  for (const [, name, pattern] of source.matchAll(/^const ([A-Z][A-Z_]*) = \/(.+)\/[a-z]*$/gm)) {
    const named = BY_HAND[name] ?? patternPaths(pattern)
    if (!named) unnamed.push(`${name} /${pattern}/: no address can be named for it; add one to BY_HAND`)
    for (const path of named ?? []) {
      if (!new RegExp(pattern).test(path) || !routeFromHash(`#/${path}`))
        unnamed.push(`${name} /${pattern}/: "${path}" opens no page`)
      found.push(path)
    }
  }
  expect(unnamed, 'patterns in src/lib/routes.ts that e2e/visual.spec.ts visits no page for').toEqual([])
  const seen = new Set<string>()
  const out: Array<{ name: string; hash: string }> = []
  for (const path of found) {
    const route = routeFromHash(`#/${path}`)
    if (!route) continue
    const hash = hashForRoute(route)
    if (seen.has(hash)) continue
    seen.add(hash)
    out.push({ name: hash.replace(/^#\//, '') || 'garden', hash })
  }
  return out
}

/** The Android bundle's short set. */
const ANDROID_SET = new Set(['garden', 'today', 'settings'])

/** Evening on the fixed garden's day, when Today offers the recap. */
const EVENING = new Date(`${DAY}T21:00:00.000Z`)

/** Open an address afresh, as a link or a reload would, in the theme expected. */
async function open(page: Page, base: string, hash: string, theme: 'sunlight' | 'night') {
  await page.goto('about:blank')
  await page.goto(`${base}${hash}`)
  await expect(page.locator('#main-content h1').first()).toBeVisible()
  await expect(page.locator(`.app-shell.theme-${theme}`)).toHaveCount(1)
}

test('every page is drawn as it was, in sunlight and at night', async ({ page }, testInfo) => {
  test.setTimeout(300_000)
  const project = testInfo.project.name
  const android = project === 'android-webview'
  const base = android ? '/' : '/The-Butterfly-Garden/'
  const file = `e2e/style-baselines/${project}.json`
  const pages = addresses().filter(({ name }) => !android || ANDROID_SET.has(name))
  expect(pages.length).toBeGreaterThan(android ? 2 : 12)
  const drawn = new Map<string, string[]>()
  const record = async (state: string) => {
    await settle(page)
    drawn.set(state, await styleLines(page))
  }

  await holdStill(page)
  await page.goto(base)
  // The welcome comes before any theme is chosen.
  await welcomeSteps(page, (step) => record(`welcome/${step}`))
  await plantFixedGarden(page, { theme: 'sunlight', butterflies: 3 })
  for (const theme of ['sunlight', 'night'] as const) {
    if (theme === 'night') {
      await open(page, base, '', 'sunlight')
      await page.getByRole('button', { name: 'Switch to night mode' }).click()
      await expect(page.locator('.app-shell.theme-night')).toHaveCount(1)
      // Kept once the app has saved it, which a busy machine can take a moment over.
      await expect.poll(() => storedTheme(page), { timeout: 30_000 }).toBe('night')
    }
    for (const { name, hash } of pages) {
      await open(page, base, hash, theme)
      await record(`${theme}/${name}`)
    }
  }
  // The recap, which no address opens: from Today in the evening, at night
  // and then in sunlight. Last, so no page above is drawn at that hour.
  if (!android) {
    await page.clock.setFixedTime(EVENING)
    for (const theme of ['night', 'sunlight'] as const) {
      if (theme === 'sunlight') {
        await page.getByRole('button', { name: /^Switch to sunlight mode/ }).click()
        await expect.poll(() => storedTheme(page), { timeout: 30_000 }).toBe('sunlight')
      }
      await open(page, base, '#/today', theme)
      await page.getByRole('button', { name: 'Begin' }).click()
      await expect(page.getByRole('heading', { name: 'Here is your day.' })).toBeVisible()
      await record(`${theme}/recap`)
    }
  }

  if (UPDATE) {
    const all: Drawn = new Map([...drawn].map(([state, lines]) => [state, distinctLines(lines)]))
    writeBaselines(
      file,
      all,
      `What every element is drawn with, on every page of e2e/visual.spec.ts in ${project}. Written by: ${COMMAND}`,
    )
    return
  }
  const expected = readBaselines(file)
  for (const [state, lines] of drawn) {
    const before = expected.get(state)
    expect.soft(before, `no baseline for "${state}" in ${file}: write it with ${COMMAND}`).toBeDefined()
    if (!before) continue
    expect.soft(describeChanges(before, lines), `"${state}" in ${project} is drawn differently`).toBe('')
  }
  expect(
    [...expected.keys()].filter((state) => !drawn.has(state)),
    `states in ${file} that are no longer visited: write it again with ${COMMAND}`,
  ).toEqual([])
})
