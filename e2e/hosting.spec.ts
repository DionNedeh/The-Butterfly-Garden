import { expect, test, type Request } from '@playwright/test'

/*
 * Where the PWA is served from (docs/moving-the-garden.md). GitHub Pages
 * sends no Referrer-Policy header, so the page asks for no-referrer itself:
 * nothing it fetches, and no site it links to, is told which page asked.
 *
 * A stylesheet's own fonts and images are fetched under the stylesheet's
 * policy, not the page's, and a browser names the stylesheet for them: only
 * a header could change that, and it tells nothing of the page.
 */

test('5.1 the garden fetches its files without saying which page asked', async ({
  page,
}) => {
  const requests: Request[] = []
  page.on('request', (request) => requests.push(request))
  await page.goto('/The-Butterfly-Garden/')
  await page.getByRole('button', { name: /enter the garden/i }).click()
  await expect(page.getByRole('button', { name: /meet your garden guide/i })).toBeVisible()
  await page.waitForLoadState('networkidle')

  // The page itself, then its scripts, styles, fonts and images.
  const fetched = requests.filter((request) => request.resourceType() !== 'document')
  expect(fetched.length).toBeGreaterThan(3)
  const told = []
  for (const request of fetched) {
    const referer = (await request.allHeaders())['referer']
    if (referer === undefined) continue
    const named = new URL(referer)
    const byStylesheet =
      named.origin === new URL(page.url()).origin &&
      /^\/The-Butterfly-Garden\/assets\/[^/]+\.css$/.test(named.pathname)
    if (!byStylesheet) told.push(`${request.url()} ← ${referer}`)
  }
  expect(told).toEqual([])
})
