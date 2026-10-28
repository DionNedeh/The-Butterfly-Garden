# Paint the night garden and add seasonal artwork

Night mode now uses seven moonlit paintings instead of dimming the day scenes.
Day/night variants decode independently before theme swaps, with an available
painting as the offline fallback. The existing seasons patch supplies the visual
hooks, night/season lines, seasonal prompts and fireflies; new lazy CSS adds
seasonal petals, leaves, snow, frost and moonlight. Up to three decorative moths
visit fully grown nectar plants with full motion, outside winter.

Includes seven night thumbnails, four keepsake drawings, four outfit drawings,
a heart-symbol drawing, refreshed install/store screenshots, provenance, a local
art review page, and 3.5.0 metadata. Keepsake/outfit product rules and enabling the
heart as a stored jar remain pending at the owner's explicit request. No new
entitlements or ownership rules are enabled. Original day artwork, icons, feature
graphic, storage versions and bundle limits remain unchanged.

Validation: typecheck, lint, knip, web/Android web builds, both bundle budgets,
11 focused artwork tests, image sizes and SVG parsing passed. Local images and
selected app captures were visually reviewed. The owner stopped heavy testing:
the initial full unit run had five failures, and neither its rerun nor the full
browser suite completed. No complete-suite, native Android packaging, hardware,
per-scene contrast or performance acceptance is claimed. See
`docs/art/validation.md` for exact evidence and limitations.
