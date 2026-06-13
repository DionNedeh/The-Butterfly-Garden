# The Butterfly Garden

A private, local-first self-care PWA where small acts of care cultivate a
North American butterfly sanctuary.

## What is included

- Five-level inner weather check-ins
- One-time, daily, and selected-weekday goals
- Optional daily reflections and an editable private journal
- Sunlight rewards capped at five per day
- Host and nectar plants with visible growth
- Caterpillar, chrysalis, and timed emergence stages
- Seven real butterfly species, including a blue morpho, and selectable companions
- IndexedDB persistence with no account, analytics, or cloud transfer
- Installable offline PWA and GitHub Pages deployment
- Reduced-motion and responsive mobile support

## Development

```bash
npm install
npm run dev
```

The production app is configured for:

`https://dionnedeh.github.io/The-Butterfly-Garden/`

## Checks

```bash
npm run lint
npm test
npm run build
npx playwright test
```

Playwright's browser binaries may need to be installed once with:

```bash
npx playwright install chromium
```

## Privacy

Goals, mood check-ins, reflections, and garden progress stay in the browser's
IndexedDB storage. Clearing site data removes the garden. This MVP has no
account, server synchronization, analytics, AI chat, or third-party ads.

## Deployment

Merges to `main` run `.github/workflows/deploy-pages.yml`. In the repository
settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.
