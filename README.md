# The Butterfly Garden

A private, local-first self-care PWA where small acts of care cultivate a
butterfly sanctuary. Everything you write stays in this browser: there is no
account, no server, no analytics, and no third-party request of any kind.

## What is included

- Five-level inner weather check-ins, with an editable private journal
- One-time, daily, and selected-weekday goals, plus skip, snooze and archive
- A month planner for scheduling one-time goals onto any upcoming day
- Optional daily reflections drawn from a rotating set of prompts
- Sunlight rewards capped at five per day, converting to Nectar
- Host and nectar plants with visible growth across four stages
- Egg, caterpillar, chrysalis and butterfly stages, advanced by days of care
- Per-stage care activities, a bond meter, and a shared cosmetics wardrobe
- A shop of supplies, outfits, lettered jars, and flight patterns
- 25 real butterfly species with field notes, and selectable companions
- Three soundscapes synthesised on device — no audio files are downloaded
- Backup and restore to a JSON file you keep
- IndexedDB persistence with no account, analytics, or cloud transfer
- Installable offline PWA and GitHub Pages deployment
- Reduced-motion, night mode, and responsive mobile support

## Development

```bash
npm install
npm run dev
```

The production app is configured for:

`https://dionnedeh.github.io/The-Butterfly-Garden/`

## Checks

```bash
npm run lint       # ESLint everywhere; type-aware rules over src/
npm run typecheck  # app, build config and end-to-end tests
npm test           # unit and component tests
npm run build
npm run test:e2e   # Playwright, desktop and mobile, with an axe sweep

npm audit --omit=dev --audit-level=high   # runtime dependencies only
```

Playwright's browser binaries may need to be installed once with:

```bash
npx playwright install chromium
```

The lint, typecheck, unit, end-to-end and audit checks run in CI on every push
and pull request, and a failure blocks the deploy. `npm run build` runs on
pushes to `main` rather than on pull requests, since only a push can deploy.

## Privacy

Goals, mood check-ins, reflections, and garden progress stay in the browser's
IndexedDB storage. Nothing is uploaded, and nothing is ever requested from a
third party — typefaces are bundled rather than fetched from a font CDN, so
opening the garden does not tell anyone that you did.

The few requests made after launch all go to the app's own origin. The two
backdrops that unlock later, and the extended-latin typefaces, are deliberately
left out of the install and fetched the first time they are actually needed, so
a new gardener does not download half a megabyte they cannot use yet.

Clearing site data removes the garden, so **Settings → Backup and restore**
writes a copy straight to your device. That file contains everything you have
written; keep it somewhere you would keep a diary.

If the app ever finds a saved garden it cannot read — one written by a newer
version, for instance — it will not overwrite it. Saving pauses, the record is
set aside untouched, and a banner explains what happened.

## Deployment

Merges to `main` run `.github/workflows/deploy-pages.yml`. In the repository
settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.

## Licence

**Proprietary — all rights reserved.** The source is visible here, but that is
not a grant of rights to it: no use, copying, modification or redistribution is
permitted without written permission. See `LICENSE`.

Third-party components that ship inside the built app (React, idb, Workbox,
and the Fraunces and Nunito Sans typefaces) keep their own permissive licences.
All of them allow commercial distribution through application stores, and all
of them require their notices to travel with the build — those are collected in
`THIRD-PARTY-NOTICES.md`, which must be included in any release.
