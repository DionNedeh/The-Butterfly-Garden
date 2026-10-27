import { expect, type Page } from '@playwright/test'

/**
 * The app's own navigation, whichever of the header or the dock is showing.
 * Scoped by label so it never picks up the shop's own <nav> of tabs.
 */
export function mainNav(page: Page) {
  return page.locator('nav[aria-label$="navigation" i]:visible').first()
}

/** The More sheet the dock opens on a phone. */
export function moreSheet(page: Page) {
  return page.getByRole('dialog', { name: 'More' })
}

/**
 * Open a page from the navigation by its label, on any screen. On a phone
 * Shop, Flight, Guide and Settings wait behind More, so when the page has no
 * tab of its own on screen, More's sheet is opened and the page chosen there.
 */
export async function goTo(page: Page, label: string) {
  const nav = mainNav(page)
  const tab = nav.getByRole('button', { name: label, exact: true })
  const more = nav.getByRole('button', { name: 'More', exact: true })
  await expect(tab.or(more).first()).toBeVisible()
  if (await tab.isVisible()) {
    await tab.click()
    return
  }
  await more.click()
  await moreSheet(page).getByRole('button', { name: label, exact: true }).click()
  await expect(moreSheet(page)).toHaveCount(0)
}
