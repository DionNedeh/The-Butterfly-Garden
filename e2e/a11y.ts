import AxeBuilder from '@axe-core/playwright'
import { test, type Page } from '@playwright/test'

/**
 * Run axe over the page as it stands, labelled for the report.
 *
 * Serious and critical violations are returned, and the calling test fails
 * on them. Moderate ones do not fail anything yet: each is recorded as a
 * warning on the test (in the HTML report) and, on GitHub Actions, as a
 * warning annotation on the run, so the backlog is visible before it is
 * enforced.
 */
export async function seriousViolations(page: Page, label: string): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const serious: string[] = []
  for (const violation of violations) {
    const line = `${label}: ${violation.id} (${violation.impact})`
    if (violation.impact === 'serious' || violation.impact === 'critical') {
      serious.push(line)
    } else if (violation.impact === 'moderate') {
      const description = `${line}: ${violation.help}, on ${violation.nodes.length} element(s)`
      test.info().annotations.push({ type: 'warning', description })
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::warning title=Accessibility (moderate)::${description}`)
      } else {
        console.warn(`Accessibility (moderate): ${description}`)
      }
    }
  }
  return serious
}
