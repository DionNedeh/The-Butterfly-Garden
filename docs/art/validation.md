# Artwork validation — 27 October 2026

Branch: `codex/night-season-art`, based on merged PR #68 (`01fa95b`).
Work performed by Codex alone; no subagents.

## Passed

- Final `npm run typecheck`, `npm run lint`, `npm run knip`, `git diff --check`.
- `npm run build` and `npm run build:android` (web bundles only).
- Existing bundle budgets: web approximately 158.7 kB gzip; Android web bundle
  approximately 159.5 kB gzip, both below the 160,713-byte limit. The limit and
  baseline were not raised.
- Three focused files, one worker, no coverage: 11/11 tests in
  `backdropAssets.test.ts`, `GardenView.night.test.tsx`, and `garden/Moth.test.tsx`.
  They cover separate decode caches, timeout, deferred theme swap, stale result,
  fallback, decorative sprite layers and device reduced motion.
- All seven night paintings match their day counterparts' dimensions and are
  under 300,000 bytes; thumbnails are 400×225 or 375×250. All nine standalone
  SVGs parse as XML.
- Local asset-review page rendered in one Chromium session. SVG preview, all
  generated painting outputs, refreshed night phone screenshot, and day desktop
  screenshot inspected visually. This is limited visual review, not exhaustive
  screen-size, crop, contrast or device acceptance.
- Three PWA screenshots and seven Play-listing screenshots re-rendered locally.
  PWA images palette-compressed. Launcher/shortcut icons and feature graphic
  retained byte-for-byte from the base. Nothing uploaded.

## Incomplete / not passed

- Full unit suite: initial completed run had 228 passing files and 3 failing
  files, 2,834 passing tests and 5 failing tests. Failures were in App navigation
  and theme/sound behavior, the garden letter, and locked-copy recovery; some
  timed out. Their relationship to this change is unresolved. A reduced-worker
  rerun was stopped when the owner said **No heavy test**.
- Full browser suite: initial six-worker run had timeouts and was stopped; a
  two-worker retry was also stopped at the owner's request. No complete browser
  pass is claimed. The pre-existing WebKit CI failures were not investigated
  or fixed as part of this artwork change.
- No full coverage pass, Firefox/WebKit run, performance trace, FPS acceptance,
  manual per-scene contrast measurements, offline-device check or native plugin
  test is claimed.
- No Capacitor sync, Gradle tasks, APK/AAB packaging, signing, hardware tests,
  Play billing verification, store submission or deployment was performed.

## Still pending by design

The keepsakes/outfits and heart are standalone drawings only. The owner's
product decisions, jar compatibility work, life-stage outfit fitting, and gallery
use of the prepared night thumbnails remain pending. The seasons patch supplies
the north/south mapping from existing regions; the separate explicit hemisphere
setting is not part of this artwork change. The original deferred patch remains
preserved until the artwork PR is actually merged.

Publishing a PR and merging to main will invoke the repository's existing CI;
main's workflow can deploy GitHub Pages. This file records local evidence only.
