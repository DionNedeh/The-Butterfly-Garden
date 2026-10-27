import { expect, test, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * My comfort plan (plan c.8): a private page for harder days, written in the
 * gardener's own words, kept through a reload with the words still being
 * typed, and swept with axe by day and by night.
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

/** A draft as the garden has written it to storage, once typing has paused. */
function storedDraft(page: Page, key: string) {
  return page.evaluate(
    (draftKey) =>
      new Promise<string | undefined>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const read = db.transaction('drafts').objectStore('drafts').get('current')
          read.onsuccess = () => {
            db.close()
            resolve((read.result as Record<string, string> | undefined)?.[draftKey])
          }
          read.onerror = () => reject(read.error)
        }
      }),
    key,
  )
}

/** Whether anything on the page is wider than the screen. */
function overflowsSideways(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

test('a comfort plan is written in the gardener’s own words and kept through a reload', async ({
  page,
}) => {
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByRole('link', { name: 'Write a comfort plan' }).click()
  await expect(page).toHaveURL(/#\/comfort$/)
  const heading = page.getByRole('heading', { level: 1, name: 'My comfort plan' })
  await expect(heading).toBeFocused()
  await expect(page.getByRole('link', { name: 'If you need support now' })).toBeVisible()
  await expect(page.getByText(/It is not a substitute for help/)).toBeVisible()
  expect(await seriousViolations(page, 'Comfort plan, empty')).toEqual([])

  // Someone to call, one tap away.
  const people = page.getByRole('region', { name: 'People I can reach' })
  await people.getByRole('textbox', { name: 'Name' }).fill('Sam')
  await people.getByRole('textbox', { name: 'Phone number (optional)' }).fill('+44 7700 900123')
  await people.getByRole('button', { name: 'Add to People I can reach' }).click()
  await expect(people.getByRole('link', { name: 'Call Sam' })).toHaveAttribute(
    'href',
    'tel:+447700900123',
  )
  await expect(people.getByRole('textbox', { name: 'Name' })).toBeFocused()

  // Two things that help, the second moved first.
  const helps = page.getByRole('region', { name: 'Things that help me feel a little better' })
  const helpField = helps.getByRole('textbox', { name: 'Something that helps' })
  await helpField.fill('A warm bath')
  await helpField.press('Enter')
  await helpField.fill('Music, loud')
  await helpField.press('Enter')
  await helps.getByRole('button', { name: 'Move up Music, loud' }).click()
  await expect(helps.getByRole('listitem')).toHaveText([/^Music, loud/, /^A warm bath/])
  await expect(helps.getByRole('button', { name: 'Move up Music, loud' })).toBeFocused()

  // Removed at once, and put back by Undo where it was.
  await helps.getByRole('button', { name: 'Remove A warm bath' }).click()
  await expect(helps.getByRole('listitem')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 2, name: /^Things that help/ })).toBeFocused()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(helps.getByRole('listitem')).toHaveText([/^Music, loud/, /^A warm bath/])
  await expect(helps.getByRole('button', { name: 'Edit A warm bath' })).toBeFocused()

  // Words still being typed, not yet added.
  const calm = page.getByRole('region', { name: 'Places that feel calm' })
  await calm.getByRole('textbox', { name: 'A calm place' }).fill('The window seat')
  expect(await seriousViolations(page, 'Comfort plan, written')).toEqual([])
  expect(await overflowsSideways(page)).toBe(false)

  // The plan is written at once; the words being typed once typing pauses.
  await expect.poll(() => storedDraft(page, 'comfort-new:places')).toBe('The window seat')
  await page.reload()
  await expect(heading).toBeVisible()
  await expect(people.getByRole('link', { name: 'Call Sam' })).toHaveAttribute(
    'href',
    'tel:+447700900123',
  )
  await expect(helps.getByRole('listitem')).toHaveText([/^Music, loud/, /^A warm bath/])
  await expect(calm.getByRole('textbox', { name: 'A calm place' })).toHaveValue('The window seat')

  // By night, with a number refused in the middle of a change.
  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-night/)
  expect(await seriousViolations(page, 'Comfort plan at night')).toEqual([])
  await people.getByRole('button', { name: 'Edit Sam' }).click()
  const phone = people.getByRole('textbox', { name: 'Phone number (optional)' })
  await expect(people.getByRole('textbox', { name: 'Their name' })).toBeFocused()
  await phone.fill('call me')
  await people.getByRole('button', { name: 'Save changes' }).click()
  await expect(people.getByRole('alert')).toHaveText(
    'A phone number can hold digits, a plus sign, spaces and dashes.',
  )
  await expect(phone).toBeFocused()
  expect(await seriousViolations(page, 'Comfort plan, a number refused, at night')).toEqual([])
  await people.getByRole('button', { name: 'Cancel' }).click()
  await expect(people.getByRole('button', { name: 'Edit Sam' })).toBeFocused()

  // Opened by its address, it has the garden to go back to.
  await page.getByRole('button', { name: 'Back to the garden' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible()
})

test('the comfort plan holds together at the largest text on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await enterGarden(page)
  await goTo(page, 'Settings')
  await page.getByRole('group', { name: 'Text size' }).getByRole('radio', { name: /^Largest/ }).check()
  await page.getByRole('link', { name: 'Write a comfort plan' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My comfort plan' })).toBeVisible()

  const people = page.getByRole('region', { name: 'People I can reach' })
  await people.getByRole('textbox', { name: 'Name' }).fill('Grandma Rosalind, who always picks up')
  await people.getByRole('textbox', { name: 'Phone number (optional)' }).fill('+1 (555) 010-0199')
  await people.getByRole('button', { name: 'Add to People I can reach' }).click()
  await people.getByRole('textbox', { name: 'Name' }).fill('Jo')
  await people.getByRole('button', { name: 'Add to People I can reach' }).click()
  await expect(people.getByRole('link', { name: /^Call Grandma Rosalind/ })).toHaveAttribute(
    'href',
    'tel:+15550100199',
  )
  expect(await overflowsSideways(page)).toBe(false)
  // Every control on a line is a full touch target.
  const heights = await people
    .getByRole('listitem')
    .first()
    .locator('a, button')
    .evaluateAll((controls) => controls.map((control) => control.getBoundingClientRect().height))
  expect(heights.length).toBe(5)
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44)
  expect(await seriousViolations(page, 'Comfort plan at the largest text')).toEqual([])
})

test('a gentle day offers the comfort plan, and the plan offers support first', async ({ page }) => {
  await enterGarden(page)
  await goTo(page, 'Today')
  await expect(page.getByRole('link', { name: 'Your comfort plan' })).toHaveCount(0)
  await page.getByRole('checkbox', { name: /gentle day/i }).check()
  await page.getByRole('link', { name: 'Your comfort plan' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My comfort plan' })).toBeVisible()
  await page.getByRole('link', { name: 'If you need support now' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'If you need support now' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to your comfort plan' }).click()
  await page.getByRole('button', { name: 'Back to Today' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
})
