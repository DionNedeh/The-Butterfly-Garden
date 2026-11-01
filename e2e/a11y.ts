import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Run axe over the page as it stands, labelled for the report.
 *
 * Moderate, serious and critical violations are returned, and the calling
 * test fails on them: every caller expects the list to be empty. (The name is
 * older than that: it once returned serious and critical ones only, and is
 * kept so that the sweeps in every spec read as they did.) Minor ones do not
 * fail anything: each is recorded as a warning on the test (in the HTML
 * report) and, on GitHub Actions, as a warning annotation on the run.
 *
 * A page whose code is still arriving shows only the app's "Opening…"
 * status, so the sweep waits for that to go first: it is of the page it
 * names, not of the moment before it.
 */
export async function seriousViolations(page: Page, label: string): Promise<string[]> {
  await expect(page.locator('.view-loading')).toHaveCount(0, { timeout: 15_000 })
  const { violations } = await new AxeBuilder({ page }).analyze()
  const blocking: string[] = []
  for (const violation of violations) {
    const line = `${label}: ${violation.id} (${violation.impact})`
    if (
      violation.impact === 'moderate' ||
      violation.impact === 'serious' ||
      violation.impact === 'critical'
    ) {
      blocking.push(line)
    } else if (violation.impact === 'minor') {
      const description = `${line}: ${violation.help}, on ${violation.nodes.length} element(s)`
      test.info().annotations.push({ type: 'warning', description })
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::warning title=Accessibility (minor)::${description}`)
      } else {
        console.warn(`Accessibility (minor): ${description}`)
      }
    }
  }
  return blocking
}
