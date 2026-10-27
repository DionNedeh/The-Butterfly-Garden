# The Butterfly Garden

A private, local-first self-care app where small acts of care cultivate a
butterfly sanctuary. It runs as a PWA on the web and as an Android app for
Google Play. Everything you write stays on your device: there is no account, no
server, no analytics, and no tracking. The only third-party code that ever
talks to the network is Google Play's billing library in the Android app, and
only for the optional Garden Pass (see [Privacy](#privacy)).

## What is included

- Five-level inner weather check-ins with nothing preselected, plus "Not sure
  today", optional feeling words and energy, one gentle next step after, and
  an editable private journal
- Entries written later for a day that was missed (marked so, and earning
  nothing), and "On this day" bringing back a month or a year ago
- A journal you can search (words, kinds of entry, weather, all on the
  device), a weather calendar by month or a year at a glance, and readable
  copies as Markdown, a printable page, or check-ins as a spreadsheet
- A gentle reminder in Settings when the last backup is a month old, and
  *Share backup…* where the browser can share a file
- Goal ideas in a balanced mix (the NHS five steps and rest), most with a
  two-minute version, and up to three starter goals offered when a garden
  begins
- One-time, daily, and selected-weekday goals in compact rows, with skip,
  snooze, full editing and archive behind a ⋯ menu (and swipes on a touch
  screen), each of them undoable for a few seconds
- A gentle day: one switch shows a few small goals and no counts, until midnight
- A month planner for scheduling one-time goals onto any upcoming day
- Optional daily reflections from sixty prompts in families, with "Another
  prompt" and "Write freely"
- Sunlight rewards capped at five per day, converting to Nectar, and a rhythm
  in the journal: days cared for in the last seven and this month, which a
  missed day never resets, and which Settings can hide
- Moonlight: from 6 pm (until 4 am on a late night, and both hours can be
  moved) a short evening recap closes the day, takes up to three notes for
  tomorrow that can each become a goal, is kept in the journal, and earns one
  Stardust, whether or not the day earned any Sunlight
- Stardust, the rarer currency, from bond levels, emergences and closing the
  day, spent in the Boutique's Stardust atelier and on the two most graceful
  flight patterns
- Host and nectar plants with visible growth across four stages
- Egg, caterpillar, chrysalis and butterfly stages, advanced by days of care
- Per-stage care activities, a bond meter, and a shared cosmetics wardrobe
- A searchable shop with outfit previews, coloured glass jars, and twelve flight
  patterns, which says plainly what each purchase did or why it did not
- New eggs arrive with a name of their own, and can be given another
- On phones, five tabs and a More sheet
- 25 real butterfly species with field notes, seed guidance, and selectable companions
- Seven illustrated backdrops and up to three personal images with crop, zoom,
  quarter turns and brightness, and a different image by night if you like
- The Garden Pass: a Google Play subscription in the Android app, and a free
  preview in the PWA (no payment is taken on the web)
- Five soundscapes synthesised on device — no audio files are downloaded —
  with a volume, an optional piano at night, a choice to pause in the
  background, and an optional fade-out after 15, 30 or 60 minutes
- "If you need support now": a short, dated list of crisis lines that hands
  off to the phone, reachable from Settings, the Guide and a stormy check-in
- Backup and restore to a JSON file including your personal backdrop images
- IndexedDB persistence with no account, analytics, or cloud transfer
- Installable offline PWA and GitHub Pages deployment
- An Android app for Google Play, built with Capacitor from the same code
- Reduced-motion, night mode (by hand, following the device, or following the
  evening), three text sizes, and responsive mobile support

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
npm run knip       # unused files and exports
npm test           # unit and component tests, failing below the coverage floors
npm run build
npm run test:e2e   # Playwright: desktop, mobile and the Android bundle, with axe sweeps
npm run budgets    # gzipped bundle sizes, after a build

E2E_ALL_BROWSERS=1 npm run test:e2e   # also Safari (desktop, iPhone) and Firefox

npm audit --omit=dev --audit-level=high   # runtime dependencies only
```

Playwright's browser binaries may need to be installed once with:

```bash
npx playwright install chromium
```

All of these run in CI on every push and pull request, and a failure blocks the
deploy. Safari and Firefox run in a job of their own, which installs those
engines. The axe sweeps fail on serious and critical violations and report
moderate ones as warnings on the run. `npm run build` runs on pushes to `main`
rather than on pull requests, since only a push can deploy.

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) maps how the code fits together.

## The Android app

The Google Play app is this React app bundled by Capacitor 8, with two small
native plugins: one saves backups through Android's own save screen, the other
sells and checks the Garden Pass with Google Play Billing. It needs Java 21,
Node 24 and the Android SDK (`scripts/setup-android-sdk.sh` installs it).

```bash
export ANDROID_HOME=~/android-sdk
npm run build:android          # web bundle into dist-android/
npx cap sync android           # copy it into android/
cd android && ./gradlew lintRelease testReleaseUnitTest assembleDebug bundleRelease
```

`.github/workflows/android.yml` runs those checks on every push and pull
request. Signed release builds come only from running that workflow by hand on
`main`, with the upload key held in the `play-release` environment's secrets;
no key is ever kept in this repository.

- [docs/android-play-plan.md](docs/android-play-plan.md): the decisions behind
  the app and the Garden Pass, and why each was made
- [docs/play-store/README.md](docs/play-store/README.md): store listing text,
  Play Console answers, release steps, and the checks that need a real phone

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

In the Android app the garden is kept in the app's private storage, and
Android's cloud backup is switched off for it; device-to-device transfer to a
new phone still works. Everything the app shows, including its typefaces and
images, is inside the app.

The Garden Pass is sold through Google Play, so the Android app includes
Google's Play Billing Library. That library can send Google diagnostics about
purchases and its own operation. The app only starts it when the gardener
opens the Garden Pass, subscribes, manages it in Google Play, or already has a
Pass; someone who does none of those never runs it. It is never given anything the gardener
has written. `public/privacy.html` is the full policy, and the app shows it
under Settings → About.

If the app ever finds a saved garden it cannot read — one written by a newer
version, for instance — it will not overwrite it. Saving pauses, the record is
set aside untouched, and a banner explains what happened.

## 3.0 review and the Garden Pass

[The 3.0 review](docs/3.0-LOCAL-REVIEW.md) is a historical record of how 3.0 was
built and checked; the code has moved on since. `src/lib/gardenPass.ts`
keeps the PWA's preview apart from the Android app's verified Google Play
subscription, so a preview can never pass for a purchase; backups do not confer
paid access. Purchases are checked on the device, against Google's signature,
with no server.

The garden is at schema 6, in IndexedDB version 6, and includes personal image
data. Builds from before schema 6 cannot read it; keep an exported backup
before updates.

## Deployment

Merges to `main` run `.github/workflows/deploy-pages.yml`. In the repository
settings, set **Pages > Build and deployment > Source** to **GitHub Actions**.

## Licence

**Proprietary — all rights reserved.** The source is visible here, but that is
not a grant of rights to it: no use, copying, modification or redistribution is
permitted without written permission. See `LICENSE`.

Third-party components that ship inside the built app (React, idb, Workbox,
and the Fraunces and Nunito Sans typefaces, plus Capacitor and Google's AndroidX
and Play Billing libraries in the Android app) keep their own licences. All of
them allow commercial distribution through application stores, and all of them
require their notices to travel with the build — those are collected in
`THIRD-PARTY-NOTICES.md`, which must be included in any release. The Android
build also gathers the notices Google ships inside its libraries, and the app
shows both under Settings → About → Open-source notices.
