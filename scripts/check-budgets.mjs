#!/usr/bin/env node
// Fails when the first load grows past its budget. Run after `npm run build`.
//
// What a gardener downloads before the garden appears is what index.html
// asks for: the entry script, the chunks it preloads, and the stylesheet.
// Sizes are gzip at level 9, which is close to what GitHub Pages serves.
//
// Two kinds of limit:
// - caps, never to be crossed without changing this file;
// - a baseline in scripts/bundle-baseline.json. A change that grows the
//   first load by more than 10% fails, so growth is always a deliberate,
//   reviewed edit to that file rather than drift.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = process.argv.includes('--dist')
  ? process.argv[process.argv.indexOf('--dist') + 1]
  : 'dist'
const BASELINE_FILE = new URL('./bundle-baseline.json', import.meta.url)

const CAPS = {
  /** The entry chunk alone, React DOM included. */
  entryJs: 100_000,
  /** The one stylesheet. */
  css: 25_000,
}
const GROWTH_ALLOWED = 0.1

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const assets = [...html.matchAll(/(?:src|href)="[^"]*?\/(assets\/[^"]+\.(?:js|css))"/g)].map(
  (match) => match[1],
)
if (assets.length === 0) {
  console.error(`No scripts or stylesheets found in ${DIST}/index.html. Build first.`)
  process.exit(1)
}

const gz = (file) => gzipSync(readFileSync(join(DIST, file)), { level: 9 }).length
const entry = html.match(/<script[^>]+src="[^"]*?\/(assets\/[^"]+\.js)"/)?.[1]
const sizes = {
  entryJs: entry ? gz(entry) : 0,
  css: assets.filter((file) => file.endsWith('.css')).reduce((sum, file) => sum + gz(file), 0),
  initial: assets.reduce((sum, file) => sum + gz(file), 0),
}

const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`
const failures = []
for (const [key, cap] of Object.entries(CAPS)) {
  if (sizes[key] > cap) failures.push(`${key} is ${kb(sizes[key])}, over its ${kb(cap)} cap`)
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_FILE, `${JSON.stringify({ initial: sizes.initial }, null, 2)}\n`)
  console.log(`Baseline set: first load ${kb(sizes.initial)}.`)
} else {
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
  const limit = Math.round(baseline.initial * (1 + GROWTH_ALLOWED))
  if (sizes.initial > limit) {
    failures.push(
      `the first load is ${kb(sizes.initial)}, more than 10% over its ${kb(baseline.initial)} baseline. ` +
        'If the growth is worth it, run `npm run budgets -- --update` and commit the new baseline.',
    )
  }
}

console.log(
  `First load: entry ${kb(sizes.entryJs)}, CSS ${kb(sizes.css)}, everything ${kb(sizes.initial)} (gzip).`,
)
if (failures.length) {
  for (const failure of failures) console.error(`Over budget: ${failure}`)
  process.exit(1)
}
