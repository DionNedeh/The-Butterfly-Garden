# v2 "Full Bloom" — UI overhaul review notes

A CSS-first visual overhaul: storybook botanical field guide. Zero behavior
changes; every user-visible string, aria attribute, and class name is
untouched.

## What changed

| File | Change |
|---|---|
| `src/index.css` | Full rewrite: semantic design tokens (`:root` + one `.theme-night` swap), Fraunces/Nunito type system, base elements, focus rules |
| `src/App.css` | Full rewrite in five sections: shell/chrome, splash/onboarding, living diorama + garden, care/today/calendar, shop/journal/guide/settings/dock/responsive/motion |
| `src/main.tsx` | +2 font imports (`@fontsource-variable/fraunces/full.css`, `@fontsource-variable/nunito/index.css`) |
| `index.html` | `viewport-fit=cover`; media-aware `theme-color` (light `#f6f1e4`, dark `#0b1622`) |
| `src/components/GardenView.tsx` | One additive, `aria-hidden` decorative block: `hero-scenery` (sun/rays, 3 clouds, stars, 3 hills, glow, 6 fireflies) |
| `src/assets/garden-*.jpg` (3 files) | **Deleted** — all three backdrops are now fully painted CSS dioramas; Settings previews are live mini-dioramas from the same scene variables |
| `package.json` | +`@fontsource-variable/fraunces`, +`@fontsource-variable/nunito` (static assets, no runtime JS) |
| Everything else | Untouched (`lib/`, `data/`, `hooks/`, `repository/`, tests, PWA config semantics) |

Note on fonts: Fraunces imports `full.css` rather than the default `wght`-only
build because the display face uses the `SOFT`/`WONK` variation axes — the
default build silently drops them.

## Dead CSS deleted (verified unreferenced)

- The entire legacy div-based butterfly system: `.profile-wing*`,
  `.butterfly-body`, `.antenna*`, `@keyframes profile-flap-front/back`, and
  all 24 species `.pattern-<name>` classes (species markings live in
  `ButterflySprite.tsx` as SVG). The flight `.pattern-*` classes
  (petal-hop … garden-waltz) are product features and were kept verbatim.
- Legacy CSS-art plant: `.stem`, `.leaf`, `.leaf-one/two`, `.flower`
  (`FlowerSprite` replaced them). `.chrysalis`, `.caterpillar`,
  `.lesson-seed` kept — Onboarding still renders them.
- `.loading-screen`, `.guide-list`, `.guide-seed-balance` (no component
  references them).
- All `.theme-night .splash-screen` rules (the splash renders outside
  `.app-shell`, so they never matched). Replaced with a
  `prefers-color-scheme: dark` splash variant.

## Bundle

PWA precache (from `vite build` output):

- **Before:** 12 entries, **2386.97 KiB** (three background JPGs)
- **After:** 17 entries, **1483.38 KiB** (zero photos; self-hosted variable
  fonts for full offline)

Net: **−903 KiB (−38%)** while adding two typefaces.

## Functional CSS contracts confirmed intact

1. Flight machinery: `.flying-butterfly` inline vars (`--flight-*`,
   `--flip-*`, `--route-x0..y4`), `.garden-flight-space`
   `container-type: size`, all six flight keyframes and
   `.pattern-*` classes — verbatim.
2. Pattern shop previews: `.pattern-preview`, `.preview-flight-dot`, all six
   `preview-*` keyframes — verbatim.
3. Jars: `.decorative-jar` (+`.large/.small/.plant-jar`) consuming `--jar-*`
   vars; growth-counter-scaling rules — verbatim.
4. Sprite hooks: `.butterfly-sprite .wing` origins, `.egg-wobble`,
   `.caterpillar-inch`, `.chrysalis-sway`, `.plant-sway` (honors
   `--sway-delay`), aura spins — verbatim.
5. Plant growth scale steps `.growth-0..3` — verbatim.
6. Weather glyph class API (`.weather`, `.weather-1..5`, `.small`) — kept;
   sunny levels lightly repainted.
7. `theme-night`/`theme-sunlight` on `.app-shell`; `.reduce-motion` kills all
   animation (plus the `prefers-reduced-motion` media query); heart-burst
   stays visible so petting still answers.
8. Backdrop classes (`backdrop-*`, `backdrop-preview-*`) — same API, now
   painted scenes.
9. `.hero-petals` / `.hero-petal.petal-1..7` — verbatim.

## Performance budget (all verified by grep/script against the final CSS)

- Every animation moves only `transform`/`opacity` (audited every
  `@keyframes` block). The one legacy exception kept: `.bond-bar span` width
  transition.
- `backdrop-filter` on exactly 2 elements (header, mobile dock), both inside
  `@supports` with solid fallbacks; removed from the onboarding card.
- No `blur()` anywhere; clouds/glows are gradients. No canvas, no images.
- `will-change: transform` only on `.flying-butterfly`.
- Scenery = 14 decorative spans + 7 petals + ≤12 flyers (existing cap).
- Hover effects gated behind `@media (hover: hover)`.
- `content-visibility: auto` on `.guide-card` and `.timeline-entry`.
- Touch targets ≥40px in chrome; dock buttons ≥52px.

## Gate results

- `npm run lint` — clean.
- `npm test` — 63/63 vitest tests green.
- `npm run build` — tsc + vite + PWA green; dist CSS greps clean of
  `garden-background`/`assets/*.jpg` (zero dangling image URLs).
- Class-coverage audit (plan §9.4 script) — no missing classes; remaining
  diff is the known no-rule set (`flight-route-N`, view names, sprite
  internals, prose false-positives).
- `npx playwright test` (desktop + mobile projects) — **identical results to
  the pre-overhaul baseline**: the same 6 tests pass (night-mode CSS
  assertions, field-notes collapse, axe + offline relaunch) and the same 14
  fail. Those 14 baseline failures predate this work: they assert app copy
  that does not exist in the current components (e.g. onboarding headings
  "Chrysalises"/"Emerging butterflies", a "How everything works" section in
  Settings, a "Flight Patterns" nav label). They are content/test drift, not
  CSS regressions, and were left alone per the plan ("fix the CSS, not the
  test" — no CSS can add missing copy).
- Axe (`@axe-core/playwright`) on every view, every shop tab, and
  onboarding, in **both themes**: zero serious/critical violations, except
  one **pre-existing markup issue** — `MonthPlanner.tsx` uses `role="grid"`
  with direct `button` children (`aria-required-children`). Present before
  the overhaul; fixing it requires a DOM change, which this plan forbids.
- Reduced motion: both the in-app toggle and OS `prefers-reduced-motion`
  verified by computed style — all animation durations collapse to ~0,
  fireflies/stars hidden, heart-burst feedback preserved.
- Keyboard focus: 3px `--focus-ring` outline verified on header nav pills,
  mood grid, calendar days, and the mobile dock.

## Known pre-existing issues (not introduced, not addressed — out of scope)

1. 14 stale e2e tests asserting copy the app no longer contains (see above).
2. `MonthPlanner` `role="grid"` ARIA children violation.

## Reviewing locally

```bash
npm install
npm run build
npm run preview   # → http://localhost:4173/The-Butterfly-Garden/
```

Screenshots (96: every view × light/night × 380×740, 768×1024, 1366×860)
were generated with Playwright and shared alongside this branch.
