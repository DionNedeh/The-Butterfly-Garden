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
- A searchable shop with outfit previews, coloured glass jars, and twelve flight patterns
- 25 real butterfly species with field notes, seed guidance, and selectable companions
- Seven illustrated backdrops and up to three personal images with crop and zoom
- A free Garden Pass PWA preview; no payment or subscription is active
- Three soundscapes synthesised on device — no audio files are downloaded
- Backup and restore to a JSON file including your personal backdrop images
- IndexedDB persistence with no account, analytics, or cloud transfer
- Installable offline PWA and GitHub Pages deployment
- Reduced-motion, night mode, and responsive mobile support

## Development

Use Node 24 and npm 11, matching CI.

```bash
npm ci
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

The few requests made after launch all go to the app's own origin. Optional
full-size backdrops and extended-latin typefaces are left out of the initial
install and cached when needed. Scene thumbnails are available offline.
Personal images are resized and re-encoded locally; the original file is unchanged.

Clearing site data removes the garden, so **Settings → Backup and restore**
writes a copy straight to your device. That file contains everything you have
written; keep it somewhere you would keep a diary.

If the app ever finds a saved garden it cannot read — one written by a newer
version, for instance — it will not overwrite it. Saving pauses, the record is
set aside untouched, and a banner explains what happened.

## 3.0 review and future app work

See [the local 3.0 review](docs/3.0-LOCAL-REVIEW.md) for implementation coverage,
verification, and remaining physical-device checks. Version 3.0 remains a PWA.
`src/lib/gardenPass.ts` separates release preview access from a future verified
provider; backups do not confer paid access. Native packaging, billing,
server-side purchase verification, and Google Play submission remain later work.

Schema 6 / IndexedDB version 5 includes personal image data. Older app builds
cannot read a garden after this upgrade; keep an exported backup before updates.

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
