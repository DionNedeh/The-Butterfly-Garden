# Working in this repository

## Finishing a change

A change is not ready until there is a pull request to merge. Pushing the
branch is not the finish line — open the PR against `main` and hand back the
link. Do not stop at "pushed, standing by".

If the previous PR for the working branch has already been merged, that PR
cannot be reused. Restart the branch from `main`, push, and open a **new** PR.

## Verifying a change

Run all four before pushing:

```
npm run typecheck     # tsc -b, includes the e2e tsconfig
npm run lint          # eslint
npm test              # vitest, unit + component
npm run test:e2e      # playwright, both mobile and desktop projects
```

The e2e suite includes axe accessibility checks, so it catches focus and
contrast regressions that the unit tests do not.

A change that touches `android/`, `capacitor.config.ts`, the Android build
mode, or anything behind `isAndroidApp()` also needs the Android checks below.

## The Android app

The Google Play app is the same React app bundled by Capacitor; see
`docs/android-play-plan.md` for the decisions behind it. It needs Java 21,
Node 24 and the Android SDK. A fresh container has no SDK; install it with
`scripts/setup-android-sdk.sh` (needs `dl.google.com` reachable).

```
export ANDROID_HOME=~/android-sdk
npm run build:android          # web bundle into dist-android/, base path /
npx cap sync android           # copy it into android/ and regenerate plugin wiring
cd android && ./gradlew lintRelease testReleaseUnitTest assembleDebug bundleRelease
```

`npx cap sync` must run before Gradle on a fresh checkout: it writes the
gitignored `capacitor-cordova-android-plugins/` project that
`android/settings.gradle` includes.

Release signing happens only in the `android.yml` workflow's `release` job,
from the `play-release` environment's secrets. Never create, copy or commit a
keystore in this repository, and never put key material in a chat.

Launcher icons are generated: edit `public/icons/icon-512.webp`, then run
`python3 scripts/generate-android-icons.py` (needs Pillow).

## Playwright browsers

`playwright.config.ts` pins a Playwright version whose browser build may not be
the one installed in a given environment, which fails with "Executable doesn't
exist". Do not run `npx playwright install` — point the existing Chromium at
the run instead, via a throwaway config that extends the real one:

```ts
import baseConfig from './playwright.config'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    launchOptions: { executablePath: '<path to the installed chromium>' },
  },
})
```

Delete the throwaway config once the run is done; it must never be committed.

## Layout notes

The garden scene packs eight 84px plant sprites into a card far narrower than
they would need side by side, so they deliberately overlap. Two invariants hold
that together, and both are easy to break by adjusting one without the other:

- The sprite is centred on its slot, so anything positioned against a plant
  (the jar, for one) anchors at `left: 50%` of the slot, not off the sprite's
  own width.
- The row reserves half a sprite plus the selection ring's reach at each end,
  so the outer two plants are not clipped by the card. That reservation, not
  the slot width, is what sets the spacing.

In `FlowerSprite`, `y=130` is the ground line: it is where an ordinary stem
ends and where the sway animation pivots. A new archetype's trunk, stem, or
stalk must reach it, or the plant will visibly float above its soil mound.
