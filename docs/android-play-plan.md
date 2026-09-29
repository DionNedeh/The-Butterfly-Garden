# The Butterfly Garden on Google Play

**Status:** in progress. Agreed with the owner on 28–29 September 2026.

**Audience:** anyone continuing this work cold. It records what was decided,
why, and what was checked, so the reasoning does not have to be re-derived.

---

## 1. Decisions

| Decision | Choice |
| --- | --- |
| Packaging | **Capacitor.** The built web app is bundled inside the APK and runs in the Android WebView. Not a Trusted Web Activity: that would depend on GitHub Pages hosting, Chrome, and a Digital Asset Links file at the origin root. |
| Application ID | `io.github.dionnedeh.butterflygarden` — permanent once uploaded. |
| Paying for the Garden Pass | **Google Play Billing**, one auto-renewing subscription (`garden_pass`, monthly and yearly base plans). |
| Checking entitlement | **On the device.** No server, no account. Accepted trade-off: a modified APK can bypass it. |
| Stripe | Not in the Android app. A possible later, separate project for the web PWA only (section 6). |
| Builds | **GitHub Actions** on standard `ubuntu-latest` runners — free and unlimited for public repositories (verified against GitHub's billing docs and this repo's own usage records, 28 Sep 2026). Builds can also run in a Claude Code container with `dl.google.com` allowed. |
| Android cloud backup | Off. Device-to-device transfer stays on. |

Decisions still open are listed in section 7.

## 2. Verified facts (28–29 Sep 2026)

- Capacitor 8.5.2: minSdk 24, compile/target SDK 36, Android Gradle Plugin
  8.13.0, Gradle 8.14.3, Java 21.
- Google Play: since 31 Aug 2026 new apps and updates must target API 36, and
  must use Play Billing Library 8 or newer. Latest is 9.1.0.
- Play Billing Library 9.1.0 pulls in mismatched Kotlin standard libraries; a
  `kotlin-bom` platform constraint resolves the duplicate classes.
- Maven Central answers `429 Too Many Requests` when Gradle downloads in
  wide parallel from the Claude container; fewer workers plus retries fixes it.
- License testers can buy with test payment methods on **sideloaded debug
  builds**, provided the package name matches an app configured in Play
  Console. Google's Play Billing Lab app can push a test subscription into
  grace period or account hold.
- Google's billing-choice program (own billing, e.g. Stripe, inside the app)
  requires enrolment, eligible countries, a side-by-side choice with Play
  Billing, Play Billing Library 9.1+, and reporting every outside sale to
  Google from a server. Google still charges a service fee on those sales.
- Google's billing security guidance recommends verifying purchases on a
  backend. This app deliberately does not (section 1).

## 3. Architecture

```
Same React app, two builds
├── npm run build          → the PWA on GitHub Pages (unchanged)
└── npm run build:android  → dist-android/, bundled into the APK
        │
        Capacitor bridge
        ├── @capacitor/app   back button, pause/resume        (official plugin)
        ├── GardenBilling    in this repo → Play Billing Library → Play Store
        └── GardenFiles      in this repo → Android "Save to…" for backups
```

- `src/lib/platform.ts` is the only place that knows which build this is. It
  reads `VITE_PLATFORM`, which `.env.android` sets for `--mode android`.
- The Android build has base path `/`, no service worker, no web manifest,
  and no install or update prompt. Every backdrop ships inside the APK.
- Native code lives in this repository as small plugins rather than
  third-party billing SDKs, which run their own servers and would break the
  "no third party" promise.

## 4. The Garden Pass on Play Billing

The boundary in `src/lib/gardenPass.ts` was built for this: every access check
goes through `gardenPassAccess`, and `verified-provider` is the reserved
source for a real purchase.

Native (`GardenBilling`, Java):

- loads the `garden_pass` offers with Play's localised prices and trial terms;
- launches the purchase flow; re-checks on every launch and resume;
- verifies each purchase signature against the app's Play licence public key
  (not a secret);
- acknowledges new purchases (Play refunds anything unacknowledged after
  three days); treats `PENDING` as no access yet;
- opens Play's subscription centre for manage/cancel;
- keeps the last verified result in app-private storage, excluded from
  backups, honoured for up to 7 days when Play cannot be reached, never for
  someone who was never verified.

Web side: a Play provider with source `verified-provider`, and a small store
so the tree re-renders when entitlement changes. Entitlement is never read
from `AppState` or a backup file.

When the Pass lapses nothing is deleted: pass outfits, scenes and personal
images stop rendering and free defaults show, until access returns.

## 5. Phases

Each phase is verified with the four checks in `CLAUDE.md`; from phase 1 on
also Android lint, JVM unit tests and a debug build.

0. **Groundwork.** Platform switch, `build:android`, base-relative icons, this
   document. The web build output is byte-for-byte unchanged.
1. **Android shell.** Capacitor at pinned versions, committed `android/`
   project, manifest and WebView hardening, R8, icons and splash, SDK setup
   script, `android.yml` workflow.
2. **Native feel.** Back button, backups through Android's save dialog,
   lifecycle pausing, edge-to-edge insets, Android wording, About section,
   release signing through a GitHub environment.
3. **Garden Pass.** Section 4.
4. **Store readiness.** Privacy policy page, listing drafts, screenshots,
   form answers, third-party notices.
5. **Release candidate.** Signed bundle, device-test fixes.

## 6. Stripe (not scheduled)

Stripe on the web PWA would need a small server holding the Stripe secret
key, a licence key or account to recognise the buyer, periodic renewal
checks from the app, new privacy wording, and the owner acting as merchant of
record for sales tax. It would slot in as a second Pass provider without
touching the Play work. Whether the Android app may honour a web-bought Pass
needs a Play policy check before it is built.

## 7. Open items owned by the developer

- Play Console account (personal accounts must run a closed test before
  production access), payments profile, and the EU trader contact details
  that Play displays publicly for monetised apps.
- Upload key, created locally with `keytool`, stored as GitHub environment
  secrets — never in the repository or a chat.
- Subscription price, plans and any free trial.
- Whether the web PWA keeps the free Pass preview after launch
  (recommendation: turn it off).
- Target audience age (recommendation: 13 and over, to stay outside the
  Families policy).
