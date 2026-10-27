import { expect, test, type Locator, type Page } from '@playwright/test'
import { seriousViolations } from './a11y'
import { goTo } from './navigation'

/*
 * The garden lock (plan c.5) in a real browser, with the real key
 * derivation (PBKDF2, 600,000 iterations): lock a garden from Settings,
 * reload into the lock screen, open it with the passcode and with the
 * recovery code, find none of the gardener's words in storage while it is
 * locked, and turn it off. Swept with axe by day and by night.
 */

/** Each unlock derives a key the slow way on purpose; give it room. */
const DERIVING = { timeout: 30_000 }
const PASSCODE = 'kingfisher at the old mill'
const WORDS_OF_MINE = 'Lavender tea at the window'

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

/** Something the gardener wrote, in the comfort plan. */
async function writeSomething(page: Page) {
  await goTo(page, 'Settings')
  await page.getByRole('link', { name: 'Write a comfort plan' }).click()
  const helps = page.getByRole('region', { name: 'Things that help me feel a little better' })
  const field = helps.getByRole('textbox', { name: 'Something that helps' })
  await field.fill(WORDS_OF_MINE)
  await field.press('Enter')
  await expect(helps.getByRole('listitem')).toHaveText([new RegExp(`^${WORDS_OF_MINE}`)])
}

/**
 * Every value in every store of the garden's database, as text, the way
 * someone holding the device could read it. A string the gardener wrote
 * shows up here as itself; sealed bytes show up as numbers.
 */
function everythingStored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open('butterfly-garden')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const db = request.result
          const names = Array.from(db.objectStoreNames)
          const tx = db.transaction(names)
          const found: unknown[] = []
          for (const name of names) {
            const read = tx.objectStore(name).getAll()
            read.onsuccess = () => found.push(name, read.result)
          }
          tx.oncomplete = () => {
            db.close()
            resolve(JSON.stringify(found))
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
}

/** The two words a confirmation asks for, typed from the words shown. */
async function confirmTwoWords(dialog: Locator, words: string[]) {
  const fields = dialog.getByRole('textbox', { name: /^Word \d+$/ })
  await expect(fields).toHaveCount(2)
  for (const field of await fields.all()) {
    const label = (await field.evaluate((element) => element.closest('label')?.textContent)) ?? ''
    const position = Number(/\d+/.exec(label)?.[0])
    await field.fill(words[position - 1])
  }
}

/** Lock the garden from Settings, returning the recovery code shown. */
async function lockFromSettings(page: Page): Promise<string[]> {
  await goTo(page, 'Settings')
  const lockSection = page.getByRole('region', { name: 'The garden lock' })
  await expect(lockSection.getByText(/other code running at the same web address/)).toBeVisible()
  await lockSection.getByRole('button', { name: 'Lock my garden…' }).click()

  const dialog = page.getByRole('dialog', { name: 'Choose a passcode' })
  await expect(dialog.getByRole('heading', { name: 'Choose a passcode' })).toBeFocused()
  await expect(dialog.getByText(/nobody can open your garden: not you, not anyone else, and not the people who made this app/)).toBeVisible()
  await dialog.getByLabel('Passcode', { exact: true }).fill(PASSCODE)
  await dialog.getByLabel('The same passcode again').fill(PASSCODE)
  expect(await seriousViolations(page, 'Lock setup, the passcode')).toEqual([])
  await dialog.getByRole('button', { name: 'Next: your recovery code' }).click()

  const sheet = page.getByRole('dialog', { name: 'Save your recovery code' })
  const words = await sheet
    .getByRole('list', { name: 'Your recovery code, 24 words' })
    .getByRole('listitem')
    .allTextContents()
  expect(words).toHaveLength(24)
  await expect(sheet.getByText(/There is no other way in\./)).toBeVisible()
  expect(await seriousViolations(page, 'Lock setup, the recovery code')).toEqual([])
  const download = page.waitForEvent('download')
  await sheet.getByRole('button', { name: 'Download the sheet' }).click()
  expect((await download).suggestedFilename()).toMatch(/^butterfly-garden-recovery-code-.*\.txt$/)
  await sheet.getByRole('button', { name: 'I have kept the words' }).click()

  const check = page.getByRole('dialog', { name: 'Check two words' })
  await confirmTwoWords(check, words)
  await check.getByRole('button', { name: 'Lock my garden' }).click()
  const done = page.getByRole('dialog', { name: 'Your garden is locked' })
  await expect(done).toBeVisible(DERIVING)
  await done.getByRole('button', { name: 'Done' }).click()
  await expect(lockSection.getByRole('heading', { name: 'The garden lock' })).toBeFocused()
  return words
}

const lockScreen = (page: Page) => page.getByRole('heading', { level: 1, name: 'Your garden is resting' })

test('a garden is locked, opened by passcode and by recovery code, and unlocked again', async ({
  page,
}) => {
  test.slow()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await enterGarden(page)
  await writeSomething(page)
  expect(await everythingStored(page)).toContain(WORDS_OF_MINE)

  const words = await lockFromSettings(page)
  // Locked at rest: none of the gardener's words in any store.
  await expect.poll(() => everythingStored(page)).not.toContain(WORDS_OF_MINE)
  expect(await everythingStored(page)).not.toContain('Sunlit Sanctuary')
  // A backup is still the garden in the clear, and says so.
  await expect(
    page.getByText('This copy is not locked; keep it somewhere private, or use a protected backup.'),
  ).toBeVisible()

  // A reload finds the lock, never onboarding or the recovery screen.
  await page.reload()
  await expect(lockScreen(page)).toBeVisible()
  await expect(page.getByRole('button', { name: /enter the garden/i })).toHaveCount(0)
  const passcode = page.getByLabel('Passcode', { exact: true })
  await expect(passcode).toBeFocused()
  expect(await seriousViolations(page, 'Lock screen by day')).toEqual([])
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.getByRole('main')).toHaveClass(/theme-night/)
  expect(await seriousViolations(page, 'Lock screen by night')).toEqual([])
  await page.emulateMedia({ colorScheme: 'light' })

  await passcode.fill('kingfisher at the old mil')
  await page.getByRole('button', { name: 'Open my garden' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'That passcode didn’t open your garden. Please try again.',
    DERIVING,
  )
  await expect(passcode).toBeFocused()
  await passcode.fill(PASSCODE)
  await page.getByRole('button', { name: 'Open my garden' }).click()
  // Opens where it was, on Settings, with focus on the page rather than nowhere.
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeFocused(DERIVING)

  // Lock now, then the recovery code.
  await page.getByRole('region', { name: 'The garden lock' }).getByRole('button', { name: 'Lock now' }).click()
  await expect(lockScreen(page)).toBeVisible()
  await page.getByRole('button', { name: 'Use my recovery code' }).click()
  await page.getByLabel('Recovery code').fill(words.join(' '))
  await page.getByRole('button', { name: 'Open with my recovery code' }).click()
  await expect(page.getByRole('heading', { name: 'Choose a new passcode' })).toBeVisible(DERIVING)
  expect(await seriousViolations(page, 'Lock screen, a new passcode')).toEqual([])
  await page.getByRole('button', { name: 'Not now, just open my garden' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeFocused()

  // By night, the lock's part of Settings and one of its dialogs.
  await page.getByRole('button', { name: 'Switch to night mode' }).click()
  await expect(page.locator('.app-shell')).toHaveClass(/theme-night/)
  const lockSection = page.getByRole('region', { name: 'The garden lock' })
  await lockSection.scrollIntoViewIfNeeded()
  expect(await seriousViolations(page, 'Settings, the lock on, at night')).toEqual([])
  await lockSection.getByRole('button', { name: 'Change my passcode…' }).click()
  const change = page.getByRole('dialog', { name: 'Change my passcode' })
  await expect(change.getByRole('heading', { name: 'Change my passcode' })).toBeFocused()
  expect(await seriousViolations(page, 'Change my passcode, at night')).toEqual([])
  await change.getByRole('button', { name: 'Cancel' }).click()
  await expect(change).toHaveCount(0)

  // Off again, everything opened back up, and the garden opens on a reload.
  await lockSection.getByRole('button', { name: 'Turn the lock off…' }).click()
  const off = page.getByRole('dialog', { name: 'Turn the lock off' })
  await off.getByLabel('Your passcode').fill(PASSCODE)
  await off.getByRole('button', { name: 'Turn the lock off' }).click()
  const offDone = page.getByRole('dialog', { name: 'The lock is off' })
  await expect(offDone).toBeVisible(DERIVING)
  await offDone.getByRole('button', { name: 'Done' }).click()
  await expect(lockSection.getByRole('button', { name: 'Lock my garden…' })).toBeVisible()
  expect(await everythingStored(page)).toContain(WORDS_OF_MINE)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(lockScreen(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a second tab follows the lock: locked there too, and opened on its own', async ({
  page,
  context,
}) => {
  test.slow()
  await enterGarden(page)
  await lockFromSettings(page)
  const other = await context.newPage()
  await other.goto('/The-Butterfly-Garden/')
  // The other tab holds no key: it opens to the lock screen.
  await expect(lockScreen(other)).toBeVisible()

  // Lock now in the first tab locks every tab.
  await other.getByLabel('Passcode', { exact: true }).fill(PASSCODE)
  await other.getByRole('button', { name: 'Open my garden' }).click()
  await expect(other.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible(DERIVING)
  await page.getByRole('region', { name: 'The garden lock' }).getByRole('button', { name: 'Lock now' }).click()
  await expect(lockScreen(page)).toBeVisible()
  await expect(lockScreen(other)).toBeVisible()
})

test('a second tab keeps up: a new time to lock by itself at once, and its next change kept once the lock is off', async ({
  page,
  context,
}) => {
  test.slow()
  await enterGarden(page)
  await lockFromSettings(page)
  const other = await context.newPage()
  await other.goto('/The-Butterfly-Garden/')
  await other.getByLabel('Passcode', { exact: true }).fill(PASSCODE)
  await other.getByRole('button', { name: 'Open my garden' }).click()
  await expect(other.getByRole('heading', { level: 1, name: 'Sunlit Sanctuary' })).toBeVisible(DERIVING)

  // A time chosen in the first tab is the second's at once, with its
  // Settings already open; it says what the auto-lock waits for.
  await goTo(other, 'Settings')
  const otherLock = other.getByRole('region', { name: 'The garden lock' })
  const otherChoice = otherLock.getByRole('combobox', { name: 'Lock by itself' })
  await expect(otherChoice).toHaveValue('')
  await expect(otherChoice).toHaveAccessibleDescription(/^It waits while you are choosing a photo or a file/)
  const lockSection = page.getByRole('region', { name: 'The garden lock' })
  await lockSection
    .getByRole('combobox', { name: 'Lock by itself' })
    .selectOption({ label: 'After 15 minutes out of sight' })
  await expect(lockSection.getByRole('status')).toHaveText(
    'Saved. The garden will lock itself after that long out of sight.',
  )
  await expect(otherChoice).toHaveValue('15')

  // The lock turned off in the first tab. The second reads the garden again,
  // so the next change made there is kept, not refused as a conflict.
  await lockSection.getByRole('button', { name: 'Turn the lock off…' }).click()
  const off = page.getByRole('dialog', { name: 'Turn the lock off' })
  await off.getByLabel('Your passcode').fill(PASSCODE)
  await off.getByRole('button', { name: 'Turn the lock off' }).click()
  const offDone = page.getByRole('dialog', { name: 'The lock is off' })
  await expect(offDone).toBeVisible(DERIVING)
  await offDone.getByRole('button', { name: 'Done' }).click()
  await expect(otherLock.getByRole('button', { name: 'Lock my garden…' })).toBeVisible()
  await writeSomething(other)
  // The first tab picks it up from storage, and keeps it through a reload.
  await expect(page.getByRole('link', { name: 'Your comfort plan' })).toBeVisible()
  await expect(other.getByText(/so your last change was not saved/)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('link', { name: 'Your comfort plan' })).toBeVisible()
})
