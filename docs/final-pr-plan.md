# The final PR: plan

*Written on 27 October 2026, after release 3.4.0 ([#66](https://github.com/DionNedeh/The-Butterfly-Garden/pull/66)). It replaces the shorter future-work note merged in [#67](https://github.com/DionNedeh/The-Butterfly-Garden/pull/67).*

The [Voyager plan](Voyager-2026-10-26_18-48-37-UTC.md) was carried out in fourteen PRs: A1 to A4, B1 to B7, and C1 to C3, which shipped releases 3.0 to 3.4. This plan holds everything it set out that is not done on `main`, plus the art that was always meant to come last.

To find it, every item of the Voyager plan and every PR log was swept, along with the review notes and the code itself, and each candidate was checked against `main` at 5d0a7ce. A second pass then looked for anything missed and for claims that were wrong. What was checked and found done is listed in the appendix, so the reader can see what the sweep covered.

**Who it is for.** The final PR is made by the owner's own drawing agent. It takes part 1, the art. When wrapping up, the owner chose to hand everything else to that work too. It can be one PR or several; the order below is a suggestion.

**How to read a step.**
- **Where it stands:** the evidence on `main`, as `file:line` at 5d0a7ce. Line numbers drift as the code changes.
- **What is left**, **How** and **Done when**.
- **Needs first:** other steps, by number.
- **Source:** where the work was planned or left.
- **Size:** small is a few hours, medium a day or two, and large several days.
- **Needs a decision:** put the question to the owner before building. Every such question is gathered in the table near the end.

## Before you start

- **Checks.** CLAUDE.md lists them: `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:e2e`.
  - Anything in `android/`, in `capacitor.config.ts` or behind `isAndroidApp()` also needs the Android checks.
  - Never run `npx playwright install`.
  - Never create, copy or commit a keystore.
- **Budgets.** After C3, the web first load is 159.9 kB of its 160.7 kB budget, and the Android first load is 160,652 B of 160,713 B, leaving 61 B.
  - New code has to load lazily.
  - Step 1.1 frees about 1.8 kB.
  - Step 5.5 gives each build its own baseline.
- **Releases.** Every merged PR that changes the app is a release of its own, with its own notes, starting at 3.5.0.
  - The notes go in `src/data/releases.ts`, and the version in `src/data/currentRelease.ts` and `package.json`.
  - Notes already released stay as they are; a test checks this.
- **Stored data.** Builds 3.0 to 3.4 will open what a newer build writes.
  - A new stored field must be optional, and checked in `validateGarden`.
  - Raising `DATABASE_VERSION` or `CURRENT_STATE_VERSION` makes older builds refuse the garden as "written by a newer version". Both are 8 now. Raise one only when it is needed, and say why in the log.
- **Patches.** The original plan used three patches. The seasons patch remains in [`docs/final-pr-plan/patches/`](final-pr-plan/patches/); the move and keep patches are replaced by their section 2 implementation in this change. The builders' notes remain as provenance.
  - Each applies cleanly at commit 48ad0f1, which is in `main`'s history through the C3 merge.
  - On `main`, `git am -3` stops on the conflicts each step lists.
  - The builders' own notes are kept beside them, in `builders-notes.txt`: what each built, what they left open, suggested ARCHITECTURE rows and budget figures.
  - Delete a patch once its work is merged.
- **The log.** Record each merged PR in the Voyager plan's implementation log, as before.

## Order of work

| Order | PR | Steps | Why in this order |
|---|---|---|---|
| 1 | The art | 1.1 to 1.5 | The owner's drawing agent. 1.1 first: it adds the hooks the art fills and frees first-load room. |
| 2 | Moving to a new device | 2.1 to 2.3 | Built. It needs a little web first-load room. |
| 3 | Lock follow-ups and data safety | 3.1 to 3.6, 4.1 to 4.5 | 3.1 comes before 2.4, because daily copies share the snapshots store. |
| 4 | Keeping copies | 2.4, 2.5 | Built. It needs 1.1's room and 3.1. |
| 5 | Tests and tooling | 5.2 to 5.8, 5.12 | The visual suite (5.4) before the CSS work (5.6). |
| 6 | Docs, privacy and the Play release | 5.9 to 5.11, 7.1 to 7.6 | Before any Play submission. |
| 7 | Smaller gaps | 6.1 to 6.14 | Any time, after their decisions. |
| When the owner picks a host | Moving the web app | 5.1 | It needs a domain and a host that can send headers. |
| First | Decisions only | 8.1 to 8.6, and the table near the end | Each answer unblocks the work it names. |

## 1. The art PR

**Artwork implementation in progress (27 October 2026).** See
[the artwork record](art/night-season-art.md) and [local art review](art/index.html).
The owner chose art only for keepsakes and outfits; their product rules remain
pending. The heart symbol is also an art asset only, without a jar schema change.
The seasons patch has been applied locally as the art prerequisite. Merge and
validation status must be read from the final handoff, not inferred from this note.

Made by the owner's drawing agent, as agreed when the plan began. Land the seasons patch first (1.1): it adds the hooks the art fills. The code for night images and moths (1.2) can come in the same PR as the art, or just before it. The full art brief, with every image to make, follows the steps.

### 1.1 Land the seasons and night garden without art (`c4-seasons.patch`)

*Plan: c.7, b.5 G5 · built, not merged · medium · web and Android*

- **Where it stands.** Exists only as docs/final-pr-plan/patches/c4-seasons.patch (30 files, +1985/-185). Main has no src/lib/seasons.ts, src/data/seasons.ts, src/data/nightLines.ts or src/components/garden/Fireflies.tsx, and no `data-season` in src. Season logic on main is only the month line in src/lib/whatToLookFor.ts:5-40. e2e/seasons.spec.ts and its android.spec.ts test were never run (docs/final-pr-plan/patches/builders-notes.txt:191).
- **What is left.** Apply on a branch from main and resolve the sealedBackup.test.ts conflict. Review it, then run e2e and Android checks for the first time. Add release notes, the ARCHITECTURE row (docs/final-pr-plan/patches/builders-notes.txt:256) and the Voyager log.
- **How.** 1) `git am -3 docs/final-pr-plan/patches/c4-seasons.patch`; the conflict is only in src/lib/sealedBackup.test.ts, so keep main's version. 2) Review GardenView.tsx's changes: the `data-season` hook, Fireflies, and GardenLine with the lazy `lib/gardenLines` chunk. The day line now appears after first paint behind a non-breaking space, so check layout shift and that the line's live region does not announce on load. 3) Check that Fireflies animate transform and opacity only, pause offscreen and in a hidden tab, and never show under reduced motion, Calm motion or on a winter night. 4) Check the sourced season lines in data/seasons.ts (at least two per region per season, each naming its place) against b.8 F1's accuracy rule. 5) The seasonal prompts in data/prompts.ts join the rotation only when a region makes the season known. 6) Run the full CLAUDE.md checks, including the Android set. This patch frees Android first-load room, so land it before 2.1 and 2.4.
- **Done when.** With a region, the garden's line under its name shows season lines one day in three, night lines when the night theme is on, and Marigold's autumn and spring words. Australia turns July to winter with no fireflies. Five fireflies show at night with motion allowed, and none under reduce or Calm. `.garden-hero[data-season]` is set. e2e/seasons.spec.ts passes, with pinned UTC dates and axe. The android-webview test passes. Both budgets show the first load lower than before. All four npm checks and Gradle pass.
- **Source.** Voyager c.7 (lines 952-984), b G5 (line 630); the future-work note from #67; docs/final-pr-plan/patches/builders-notes.txt:190-271

### 1.2 Night images per scene, and moths: the code

*Plan: b.5 G5 · not done · large · web and Android*

- **Where it stands.** On main, night is the day painting with a dark overlay. src/components/GardenView.tsx:303 sets backgroundImage from backdropAssets[displayedScene].image, and src/data/backdropAssets.ts:18-29 has one day image per scene: 7 WebPs in src/assets, 1280x720 (garden-background) to 1600x900 or 1536x1024, 185-345 kB each. Night adds only overlays: src/garden-3.css:1361 (.theme-night .garden-hero::before, two star dots and a dark gradient) and src/App.css:2035 (::after gradient). Petals fall at night too: GardenView.tsx:314-318 always renders 7 .hero-petal spans (App.css:3092-3121). The line under the garden name is day-only: GardenView.tsx:233-239 picks from src/data/content.ts:325-419, e.g. content.ts:326 'The milkweed leaves are warm in the morning light.' There is no moth anywhere: src/components/sprites holds ButterflySprite, CreatureSprite, FlowerSprite, JarSprite and SpriteFrame, and grep finds no moth component. GardenView already receives the theme on screen (GardenView.tsx:127-128) but only uses it for the personal night image (GardenView.tsx:481, from B7 B2). Built but not merged: docs/final-pr-plan/patches/c4-seasons.patch adds src/components/garden/Fireflies.tsx and fireflies.css (5 composited dots, none in winter and none with reduced or Calm motion), src/data/nightLines.ts (night lines per species), lib/gardenLines.ts with a lazy GardenLine.tsx, petals hidden at night, and a data-season hook on .garden-hero.
- **What is left.** The code half of G5 that no patch has: (1) show a scene's own night painting while the night theme is on screen, with the personal night image still first; (2) a few moths visiting the nectar plants at night. The paintings and the moth drawing are assets ART-1 and ART-3 below.
- **How.**
  1. Add the art as src/assets/garden-<scene>-night.webp. In src/data/backdropAssets.ts, extend each entry to { image, night, thumbnail }. Make loadBackdrop/isBackdropReady key on the image URL (or `${id}:night`), so a theme change decodes before swapping, the same way A2 P3 does for scenes.
  2. In GardenView.tsx, choose the hero image from theme === 'night'. That theme can be chosen by hand, followed, or held by the recap's fade. Order: the personal night image (profile.nightCustomBackdropId) first, then the scene's night image, then the day image. Keep the displayedScene swap-after-decode. Re-tune the .theme-night .garden-hero::before/::after overlays where the art is already dark, and check heading contrast.
  3. In vite.config.ts workbox (about lines 140-175), add the five optional scenes' -night files to globIgnores and to the runtimeCaching pattern. Precache the night images of the two free scenes (Sunlit Meadow and Cottage Bloom) so the garden still works offline at night.
  4. Add src/components/garden/Moths.tsx and moths.css, lazy-loaded like Fireflies. Render moths only when night && motion === 'full', at most one per nectar plant present (src/data/content.ts:279-281: aster, coneflower, zinnia) and three in all. Anchor each moth at left: 50% of the plant's slot, as the CLAUDE.md layout notes require, not offset by the sprite's own width. Animate transform and opacity only. Pause offscreen through an IntersectionObserver, as SpriteFrame does, and under .page-hidden. Use display:none under .reduce-motion, .calm-motion and prefers-reduced-motion, and set aria-hidden.
  5. Tests: GardenView.test.tsx (night shows the night image; the personal night image wins; day is unchanged), backdropAssets.test.ts (night decode and timeout), Moths.test.tsx (no moths without nectar plants, by day, or under reduced or Calm motion), a night case with an axe sweep in e2e/app.spec.ts, and a night check in e2e/android.spec.ts.
  6. Run `npm run budgets`; Moths and Fireflies must stay out of the first load. Android: there is no service worker in the APK, so every night WebP ships inside it, roughly 1.5-2.5 MB more. Run `npm run build:android`, `npx cap sync android`, and `./gradlew lintRelease testReleaseUnitTest assembleDebug bundleRelease`, and record the APK size in the PR.
- **Done when.** With night on screen (chosen, Follow device, Follow evening, or held by the recap's fade), every built-in scene shows its night painting, with no blank or half-drawn frame when the theme changes. Day theme looks exactly as on main. A personal night image still takes precedence. Up to three moths visit nectar plants, only at night with full motion: none with reduced or Calm motion, and none animating in a hidden tab or offscreen. A trace of the 12-butterfly garden at 4x CPU shows no per-frame layout, and fps does not fall below A2's figure (about 51). With 1.1 landed, fireflies replace petals at night and the garden line is a night line. The axe night sweep has no serious or critical issues, and heading text meets AA over every night scene. Offline, the two free scenes' night images load. typecheck, lint, test (coverage floors), test:e2e (desktop, mobile, android-webview) and the Gradle checks all pass.
- **Needs first.** 1.1
- **Source.** Voyager line 630 (b.5 G5) and b.11 'Later' line 693; B6 log line 1811 and B7 log lines 1897-1899 ('left for the art PR'); the future-work note from #67 (art) and 1.1 (code without art)

### 1.3 Seasonal keepsakes and outfits: the rules, not the art

*Plan: c.7 · not done · medium · web and Android · **needs a decision***

- **Where it stands.** c4-seasons.patch only names the pieces in `seasonArt` (patch lines 1762-1866: keepsake-spring-nest, season-spring-blossom-crown and so on), and says 'nothing in the app reads this list'. Main has no item kind for a keepsake: ShopItemDefinition (src/types.ts:751-765) has supply and cosmetic with `premium?`. Owned cosmetics are `ownedItemIds` (src/types.ts:633), and validateGarden keeps unknown string ids (src/repository/validateGarden.ts:1356-1360). The future-work art section expects 'item 2's third part' to supply the rules, but 1.1 does not.
- **What is left.** Decide what a keepsake is: a free cosmetic, a garden decoration, or something on a shelf. Then build the rule that gives each season's keepsake once, the four seasonal Pass outfits, and how they are shown and announced.
- **How.** Add the 4 keepsakes and 4 outfits to src/data/shopItems.ts using seasonArt's stable ids. Outfits are `premium: true`, gated by lib/passEntitlement.ts. Keepsakes are free and never paywalled. Add a pure `seasonalGift(state, localDate, hemisphere)` in lib/seasons.ts that adds the current season's keepsake to `ownedItemIds` once, ever, idempotent and offline. Run it from the visit path in useGardenState as a quiet write (lib/quietWrites.ts). Add a gentle one-time notice, and Guide or shop copy. Off-season, keepsakes stay owned. Test unit, validateGarden, and e2e with page.clock across a season boundary. The images come from the art PR.
- **Done when.** On the first visit in a new season, the season's keepsake is owned once and stays owned. Pass holders can equip that season's outfit, and non-holders see it as a Pass item. Nothing is lost across seasons or in a backup. An older build keeps the ids. The Android build behaves the same, and Play billing gating is unchanged for free items.
- **Needs first.** 1.1, and the keepsake and outfit drawings (ART-6, ART-7)
- **Source.** Voyager c.7 'A free seasonal keepsake each season. Pass holders also get a seasonal outfit.' (lines 960-961, 970); the future-work note from #67

### 1.4 Let gardeners outside the three named regions choose their hemisphere

*Plan: c.7 · not done · small · web and Android*

- **Where it stands.** Regions on main are only 'north-america' | 'europe' | 'australasia' | 'elsewhere' (src/types.ts:72), and the HEMISPHERES map covers only the three named ones (src/lib/whatToLookFor.ts:8-12). In c4-seasons.patch, hemisphereOf('elsewhere') and hemisphereOf(undefined) return 'north' (patch lines 2485-2492, 2549). A gardener in South America or southern Africa therefore gets northern seasons in the scene and in Marigold's travels.
- **What is left.** Add an explicit hemisphere choice for gardeners whose region is 'Elsewhere' or unset, and have the season code use it.
- **How.** Add an optional `Profile.hemisphere?: 'north' | 'south'`. validateGarden drops any other value without calling it damage, as it does for reminderTime; no DATABASE_VERSION change, and older builds carry the profile field through. In Settings' region section, when the region is 'elsewhere' or unset, ask 'Which half of the world are you in?' (North / South / Not say). Change `hemisphereOf(region)` in the patch's lib/seasons.ts to `hemisphereOf(region, hemisphere)`, and let `knownSeason` return a season when the hemisphere is chosen. Leave the regional month line in lib/whatToLookFor.ts as it is: its facts are per region. Add unit tests in lib/seasons.test.ts and validateGarden tests.
- **Done when.** With region Elsewhere and hemisphere South, July shows winter: no fireflies, and the winter overlay hook is set. Seasonal prompts join the rotation. A garden without the field behaves as the patch does today. A backup round-trips the field, and the Android build shows the same setting.
- **Needs first.** 1.1
- **Source.** Voyager c.7 'A hemisphere switch' (lines 962-963)

### 1.5 Draw the jar symbols, ♥ included, as shapes, not font glyphs

*Plan: b.7 H3 · partly done · medium · web and Android*

- **Where it stands.** Stacks, recycling with Undo, accented capitals, six marks and spoken names are all done (src/data/jars.ts:12-37; src/lib/jarStacks.ts; src/components/shop/JarShelf.tsx; src/components/Spoken.tsx:23-25). ♥ is not: src/data/jars.ts:14-18 says ♥, ★, ☀, ☾ and ✿ are left out 'until a font carries them', because the offline latin subsets of Fraunces and Nunito Sans do not draw them (src/data/jarGlyphs.test.ts:15-24 checks every character against those fonts). JarSprite draws the character as SVG <text> in Fraunces (src/components/sprites/JarSprite.tsx:99-108). validateGarden keeps only jars whose character is in jarCharacters (src/repository/validateGarden.ts:1248). Every garden is written at version 8 (validateGarden.ts:59-77), so a version-8 build that did not know ♥ would read a ♥ garden as its own and silently drop the jar and the Nectar spent on it. That is the same path as the B7 review's finding 0.
- **What is left.** Draw ♥ (the plan's one named symbol; ★ ☀ ☾ ✿ only if the owner wants them) as SVG paths, offer them in the shop, and keep older builds from stripping them.
- **How.** Art: one SVG path per symbol, fitted to the jar label's area in JarSprite's viewBox and drawn in each jar colour's existing ink, which already passes 4.5:1 on JAR_LABEL #fff9e8. Code: add JAR_SYMBOLS to src/data/jars.ts, append them to jarCharacters, and give each a spoken name in JAR_MARK_NAMES ('heart'). JarSprite draws a <path> for a symbol instead of <text>. Add a JarGlyph component and use it in JarCharacterPicker, JarShelf, JarManager and Spoken.tsx's JarCharacter, so shop buttons never fall back to an emoji font. jarGlyphs.test.ts skips the symbols, and a new test checks every symbol has a path. Version: bring back B7's conditional rule. storedVersionOf(state) returns 9 only when state.jars holds a symbol, otherwise 8. Raise CURRENT_STATE_VERSION to 9; READABLE_STATE_VERSIONS is derived from it. Builds 3.2 to 3.4, and a Play build that lags the PWA, then still read ordinary gardens and set a ♥ garden aside untouched instead of stripping it. Add a test that runs the version-8 rule against a ♥ garden, as B7 did for 3.0. Add a release note line in src/data/releases.ts. Android: run the Android checks, because restoring a PWA backup into an older Play build is exactly the case the version guard exists for.
- **Done when.** A ♥ jar can be bought, shown, placed, stacked and recycled. The heart looks the same on every device and offline, with no font fallback, and keeps 4.5:1 on the label for every jar colour. A screen reader hears 'Blue heart jar'. A garden holding a ♥ jar is stored at 9, and one without stays at 8. A test shows a version-8 build sets a ♥ garden aside rather than stripping it. All checks pass, the Android ones included.
- **Source.** Voyager line 651 (b.7 H3: 'widen the glyph set (punctuation, ♥, accented letters)'); B7 log lines 1901-1908


### The art brief

Every image or drawing the art PR makes. Sizes match the existing assets; “where it plugs in” names the file or hook, on `main` or added by step 1.1.

| | What | How many | Format | Priority |
|---|---|---|---|---|
| ART-1 | A night painting of each built-in scene | 7 | WebP painting | must |
| ART-2 | Moonlight sheen in place of the sun shimmer at night | 1 rule set | CSS | must |
| ART-3 | Moths visiting the nectar plants at night | 2 designs | SVG component | must |
| ART-4 | Season overlays for spring, summer and autumn: dressing the falling petals | 3 | CSS, or small SVGs | must |
| ART-5 | Winter overlay: frost at the scene's edges and a few slow snowflakes | 1 frost layer, day and night, plus snow | WebP with alpha or CSS; CSS snow | must |
| ART-6 | Four free seasonal keepsakes | 4 | SVG component | must |
| ART-7 | Four seasonal Garden Pass outfits | 4 | SVG in OutfitOverlay | must |
| ART-8 | Night thumbnails for the scene gallery | 7 | WebP | could |
| ART-9 | Re-render the install and store screenshots after the art lands | 3 PWA, 7 Play | made by script | should |
| ART-10 | Provenance and licence notice for every new image | 1 section | Markdown | must |

#### ART-1. A night painting of each built-in scene

*b.5 G5; the future-work note from #67 (G5) · must*

- **Why.** Give the garden a real night. Today night mode lays a navy wash and two dot-star gradients over the day painting (garden-3.css:1361-1376), so the scene still shows a sunlit garden.
- **How many.** 7, one per scene in lib/appearance.ts:34-77: sunlit-meadow, woodland-brook, secret-conservatory, cottage-bloom, rain-kissed-pond, twilight-orchard, cloud-garden
- **Format.** Lossy WebP (VP8, no alpha, like the day files), a painted botanical watercolour/gouache image. No animated WebP and no text in the image. Encode at about q80, method 6 (cwebp or Pillow).
- **Size.** Each matches its day file in pixel size and composition (same horizon, path, arch and plant masses), so swapping day for night never jumps. Sunlit Meadow 1280×720 (src/assets/garden-background.webp). Cloud Garden, Cottage Bloom, Rain-kissed Pond and Twilight Orchard 1600×900. Woodland Brook and Secret Conservatory 1536×1024. Target ≤300 kB each; the day files are 185–345 kB.
- **Variants.** One night (moonlit blue-hour) version per scene; seasons are handled by overlays, not repaints. Twilight Orchard is already dusk, so its variant is the same orchard later in the night: lanterns lit, no sunset band. A personal image still wins at night (lib/customBackdrops.ts:391-402).
- **Where it plugs in.** New files: src/assets/garden-{scene-id}-night.webp. Sunlit Meadow's is garden-sunlit-meadow-night.webp, not garden-background-night, because scripts/play-store-assets.mjs:266 picks the feature-graphic backdrop by the prefix 'garden-background-'. Code to add: a `night` URL on each entry of `backdropAssets` (src/data/backdropAssets.ts:18-29); GardenView picks it when `theme === 'night'` in the inline `backgroundImage` (GardenView.tsx:303). A stylesheet rule cannot override that inline style without !important. `loadBackdrop` (backdropAssets.ts:49-99) must decode the night file before the swap, and its decoded/loading caches need a key per variant, not per scene id. The theme reaches GardenView as the `theme` prop (GardenView.tsx:127-128). Precache: with this naming, the five optional scenes' night files already match vite.config.ts globIgnores (:145-150) and the CacheFirst regex (:174-176). 'garden-backdrops' maxEntries 12 (:179) fits 5 day + 5 night. The night files for Sunlit Meadow and Cottage Bloom would be precached by globPatterns (:140) unless they are ignored (see open questions).
- **Match.** src/assets/garden-background.webp (Sunlit Meadow: milkweed, coneflower, aster, partridge pea, stone path and arch, soft gold light); src/assets/garden-twilight-orchard.webp (the existing dusk palette: deep blue sky, warm lantern points, painted fireflies). Night UI tokens: App.css:1927-1939 (--cream #07131f, --paper #102332, --ink #e8f2ed) and garden-3.css:9-15 (surfaces #122d36/#193740). Star colours #fff and #fff8d0 (garden-3.css:1361-1369).
- **Constraints.** Text contrast: the heading box is the top ~40% of the scene (left ~55% on desktop, full width on phones). It must stay dark enough that the #e1e8d5 observation line keeps ≥4.5:1 and the #f2efd9 h1 keeps ≥3:1 (garden-3.css:232-238). That means painted relative luminance ≤ ~0.13 there, before any wash: no moon, lanterns or bright sky in that box. Crop: phones crop a 16:9 scene to about the central 37% of its width (390px wide, ~460px tall hero), and desktop crops to the central 60–80% of its height (hero ~1120-1256×510). Keep the subject in the central ~35% width × 60% height. Plants: the bottom 180px (150px under 620px) sits under the plant row (z-index 7), so paint ground and soil there. Provenance: record it in THIRD-PARTY-NOTICES.md (ART-10).

#### ART-2. Moonlight sheen in place of the sun shimmer at night

*b.5 G5 · must*

- **Why.** `.garden-hero .hero-petals::after` (theme-aurora.css:484-497) sweeps a warm sun glow (radial at 78% 10%, rgba(255,244,214,.34)) day and night. No night rule exists, so the sun shimmers over the night garden.
- **How many.** 1 night rule set
- **Format.** CSS on the existing pseudo-element: a cool, faint radial (e.g. rgba(200,220,255,.12-.18)) whose opacity/translate animation reuses `hero-glow` (theme-aurora.css:495-498). Or `display:none` at night if the painting carries its own moonlight.
- **Size.** Same box as today (inset 0 of .hero-petals)
- **Variants.** Night only. It is paused or stopped by the existing .page-hidden, .reduce-motion and prefers-reduced-motion rules (theme-aurora.css:873-897).
- **Where it plugs in.** `.theme-night .garden-hero .hero-petals::after`. Put it in a stylesheet loaded with the night chunk (as the patch's fireflies.css is), or in theme-aurora.css only after the seasons patch frees first-load room.
- **Match.** theme-aurora.css:484-498 (the day shimmer); the patch's firefly colours #fbf7c6 and rgba(212,236,116,.6)
- **Constraints.** Animate transform and opacity only. No mix-blend-mode (theme-aurora.css:487-490). Keep the glow out of the heading box.

#### ART-3. Moths visiting the nectar plants at night

*b.5 G5 ('a few moths visiting nectar plants'); the future-work note from #67 · must*

- **Why.** G5's night visitors. Neither main nor the seasons patch draws any moth.
- **How many.** 2 designs: a pale hawk-moth hovering at a bloom, and a small owlet-type moth resting with wings tented. Show one per growth-3 nectar plant (aster, coneflower, zinnia: kind 'nectar' in src/data/content.ts:280-282), at most 3 at once.
- **Format.** An inline SVG React component, e.g. src/components/sprites/MothSprite.tsx, built on SpriteFrame/SpriteLayer with wing-left, wing-right and body layers, decorative (no label, so aria-hidden). Its CSS goes in a lazily loaded stylesheet. No image files.
- **Size.** viewBox 0 0 120 110, as ButterflySprite.tsx:455, so the wing pivots at (59,52)/(61,52) and their transform-origins (App.css:2464-2470) can be reused. Rendered about 36px wide; plant sprites are 84px wide and bloom heads about 30px across.
- **Variants.** Night only and full motion only. Probably none in winter, as with the patch's fireflies (open question). One drawing serves both designs' night palette.
- **Where it plugs in.** GardenView's plant loop (GardenView.tsx:362-405), inside the `.garden-plant` button next to `.plant-jar`. Position it absolutely at `left: 50%` with translateX(-50%), the slot-centre anchor (App.css:818-827; CLAUDE.md layout notes). Put its centre about 70px above the slot's bottom edge: daisy, coneflower and zinnia blooms are drawn at translate(0 26) scale(1.05) (FlowerSprite.tsx:612-617), which puts the head centre near y≈57 of 140. Render it only when `theme === 'night'`, `motion === 'full'` and the device does not prefer reduced motion (hooks/useMediaQuery, as the patch's Fireflies.tsx does). Load it lazily behind Suspense so the first load is unchanged.
- **Match.** ButterflySprite wing shapes 'small' and 'rounded' (ButterflySprite.tsx:24-55); the 'firefly-glow' aura (OutfitOverlay.tsx:492-501); the patch's fireflies.css. Use muted dusty colours (about #d9d2c0, #a89a80, #6e6455) with a light rim so they read against a dark painting.
- **Constraints.** Animate transform and opacity only, on layers. Flutter like wing-flap (App.css:2472-2490) but shallower, with a hover drift ≤6px. Pause when offscreen through SpriteFrame's observer; any frame-level animation needs its own `[data-offscreen]` and `.page-hidden` pause rules. The plant's accessible name must not change, and pointer events stay off (App.css:750-752). Name no species: moths are not in the catalogue and carry no facts. Tests: extend sprites.test.tsx:104-130 (motion only on layers), and add a GardenView test that no moth appears by day, with reduce or Calm, or on a non-nectar or not-yet-bloomed plant.

#### ART-4. Season overlays for spring, summer and autumn: dressing the falling petals

*c.7; seasonArt overlay ids overlay-spring-blossom, overlay-summer-petals, overlay-autumn-leaves (c4-seasons.patch, src/data/seasons.ts) · must*

- **Why.** Spring blossom, summer petals with a little pollen, and autumn leaves turning as they fall, drawn over the scene through the patch's season hook.
- **How many.** 3: spring (pale fruit-blossom petals; may equal today's pink petal), summer (warm petals plus pollen specks), autumn (amber and red leaves)
- **Format.** CSS restyling the seven existing `.hero-petal` spans (App.css:3102-3124), with gradients and border-radius, or one small SVG per season as a background-image. Keep each SVG ≤2 kB: Vite inlines assets under 4 kB as data: URIs, which the CSP allows (index.html:22). The CSS goes in a stylesheet imported by a lazily loaded component, not in App.css.
- **Size.** Petals are 12×9px today (9×7 and 10×8 for some). Leaves may be up to ~16×14px. Keep the same seven positions and durations (.petal-1 to .petal-7, App.css:3112-3118).
- **Variants.** Day only: the patch draws no petals at night and fireflies instead. Calm keeps three, as today (`.calm-motion .hero-petal:nth-child(n+4)`, App.css:2567), unless the owner chooses none (open question). Reduced motion: none, since `.reduce-motion .hero-petal` stops them (App.css:3616-3620).
- **Where it plugs in.** `.garden-hero[data-season="spring|summer|autumn"] .hero-petal`. The data-season attribute is added by the c4-seasons.patch GardenView hunk and is not on main. A leaf may use its own keyframes in place of petal-fall (App.css:3126-3132).
- **Match.** The current petal: linear-gradient(130deg, rgba(255,231,240,.95), rgba(240,178,205,.85)) with a soft shadow (App.css:3102-3111). The day scene palettes in src/assets/garden-*.webp.
- **Constraints.** Animate transform and opacity only. Add no extra elements (seven spans, as today). Keep particles small and soft: they fall under the heading (z-index 4 below 6) and must not hurt its readability. The e2e in the patch expects 7 petals by day and 0 at night (e2e/seasons.spec.ts).

#### ART-5. Winter overlay: frost at the scene's edges and a few slow snowflakes

*c.7; seasonArt overlay id overlay-winter-frost · must*

- **Why.** Winter's overlay, 'frost at the scene's edges and a few slow snowflakes' (patch seasonArt brief).
- **How many.** 1 still frost layer in 2 colourways (day, night), plus snowflakes as the winter restyle of the seven petals
- **Format.** Frost: WebP with alpha (VP8L/VP8X), ≤60 kB, crystals at the edges and a transparent centre; or pure CSS gradients. Set as the background of the free `.hero-petals::before`. Snow: CSS, white 5-8px dots on the petal spans.
- **Size.** Frost 1600×900 at background-size: cover and centre, matching the 16:9 scenes; the 3:2 scenes crop it slightly.
- **Variants.** Frost shows day and night: `.garden-hero[data-season="winter"] .hero-petals::before`, plus a bluer, lower-alpha colourway under `.theme-night`. Snow is day only, with motion (the patch draws no petals or fireflies on winter nights). Whether the still frost also shows with reduced or Calm motion is an open question; it does not move.
- **Where it plugs in.** `.hero-petals::before`, unused on main and named by the patch as free for a still layer. It sits at z-index 4: above the scene and a personal image (z 0), under the butterflies (5), the heading (6) and the plants (7) (garden-3.css:196-261, 300-306; App.css:3093-3100).
- **Match.** The night star gradients (garden-3.css:1361-1376); the cool night tokens (App.css:1927-1939)
- **Constraints.** Keep frost out of the heading box (top-left), or below ~10% alpha there: frost lightens the background under the light night text and breaks 4.5:1. The frost layer is not animated. No mix-blend-mode. The image is fetched only when the rule matches, so it costs nothing outside winter.

#### ART-6. Four free seasonal keepsakes

*c.7 ('a free seasonal keepsake each season'); seasonArt keepsake ids · must*

- **Why.** One free keepsake per season for every gardener. The patch names them, but neither it nor main draws or shows them.
- **How many.** 4: keepsake-spring-nest (Spring Nest: a small woven nest with a sprig of new leaves), keepsake-summer-seed-head (a round seed head, ready to blow), keepsake-autumn-acorn (a polished acorn with its cap), keepsake-winter-holly (a holly sprig with two berries)
- **Format.** An inline SVG React component, e.g. src/components/sprites/KeepsakeSprite.tsx, that switches on the id as OutfitOverlay does. No image files.
- **Size.** viewBox 0 0 80 88 with a ground-shadow ellipse at cy 81, as JarSprite.tsx:27-40, so a keepsake sits where a jar does. Drawn at 52px (plant bed, `.plant-jar`), 32px (`.jar-display.small`, garden-3.css:293-296) and 128px (large, as ShopView.tsx:514).
- **Variants.** One drawing for both themes. It must read on cream #fffdf7 and on the night surface #122d36 (garden-3.css:2-15), so give it a dark outline and a light highlight. No motion.
- **Where it plugs in.** `seasonArt[season].keepsake` in src/data/seasons.ts (patch only; its doc says nothing reads the list yet). Where a keepsake shows and how it is given (a shelf like components/shop/JarShelf.tsx, a plant spot anchored at left:50% like `.plant-jar`, or the Journal) still has to be decided and coded.
- **Match.** JarSprite.tsx (glass, label, shadow, stroke weights 1.5-1.6). The acorn motifs already in OutfitOverlay.tsx: 'acorn-beret' (:129) and 'acorn-locket' (:228). The keepsake acorn must look different: a whole acorn, not a cap or a locket.
- **Constraints.** Free, never premium ('wellbeing and seasons are never paywalled', patch seasons.ts). Still, with no animation. Unique SVG ids per instance via useId (sprites.test.tsx:17-53). Add a test that each id draws something, as OutfitOverlay.test.tsx:41-47 does.

#### ART-7. Four seasonal Garden Pass outfits

*c.7 ('Pass holders also get a seasonal outfit'); seasonArt passOutfit ids · must*

- **Why.** Seasonal Pass cosmetics. The Play listing already promises 'seasonal outfits' (docs/play-store/README.md:56), but the Pass has only the four 2.0 regalia (shopItems.ts:376-422).
- **How many.** 4: season-spring-blossom-crown (headwear, 'Blossom Crown'), season-summer-sun-hat (headwear, 'Meadow Sun Hat'), season-autumn-leaf-scarf (accessory; the name 'Leaf Scarf' is already taken), season-winter-knit-cap (headwear, 'Knitted Cap')
- **Format.** SVG fragments added as cases in headwear() and accessory() in src/components/sprites/OutfitOverlay.tsx (:14-198 and :200-390), drawn about the anchor origin. Catalogue entries go in src/data/shopItems.ts: kind 'cosmetic', slot, stages, an existing icon (flower, hat, leaf, hat), cost 0, currency 'stardust', premium: true.
- **Size.** Headwear stays within x −12…12 and y −22…2 units at scale 1 (as mushroom-cap and royal-crown), drawn at translate(headX, headY−4). Accessories stay within x −9…9 and y −1…18 (as celestial-cape), at the body anchor. All in viewBox 0 0 120 110. Anchors: butterfly head (60,31), body (60,52) (ButterflySprite.tsx:457-463); egg (60,30)/(60,50), caterpillar (99,51)/(87,65), chrysalis (60,24)/(60,56) (CreatureSprite.tsx:21-41). Check at 96px in the garden, 120px on the shop card (ShopItemCard.tsx:49-54) and 220px in the preview (ItemPreview.tsx:40-45).
- **Variants.** One drawing per item, correct for every stage in its `stages`. No night variant, since sprites are not themed.
- **Where it plugs in.** The Pass panel lists premium items itself (GardenPassPanel.tsx:15-16, :103 'Seasonal regalia'). GuideView.tsx:159-160 names the four current regalia by hand and must be updated. Wearing goes through canWearItem and passFeatureForItem (lib/gardenPass.ts:155-180), unchanged.
- **Match.** flower-crown (OutfitOverlay.tsx:87-112), acorn-beret (:129), royal-crown (:183-195), leaf-scarf (:261-275), celestial-cape (:364-390): flat fills, 0.6-0.9 strokes, a two-tone highlight
- **Constraints.** No animation: only auras move. Name clash: 'Leaf Scarf' already exists as `leaf-scarf` (shopItems.ts:148-157), so rename the Pass one (e.g. 'Russet Leaf Scarf') and draw it clearly differently. Blossom Crown must differ from Flower Crown: five-petal fruit blossom, not daisies. OutfitOverlay.test.tsx:41-47 fails if a cosmetic draws nothing. catalog.test.ts:89 requires Pass content to be unpriced. Pass items are never written into ownedItemIds (lib/gardenPass.ts:162-180).

#### ART-8. Night thumbnails for the scene gallery

*b.5 G5 (follows ART-1) · could*

- **Why.** At night the gallery still shows the day thumbnails. Night thumbnails would show each scene as it will look.
- **How many.** 7, one per ART-1 painting
- **Format.** Lossy WebP (VP8), downscaled from the night painting
- **Size.** 400×225, or 375×250 for woodland-brook and secret-conservatory, matching the day thumbs. ≤26 kB each (day thumbs are 19-26 kB).
- **Variants.** Night only
- **Where it plugs in.** src/assets/thumb-{scene-id}-night.webp; a `nightThumbnail` on the backdropAssets entries; BackdropGallery.tsx:98-104 (img with loading="lazy", width 400, height 225) picks it when the theme is night
- **Match.** src/assets/thumb-*.webp
- **Constraints.** Thumbnails are precached (vite.config.ts:140), so this adds about 160 kB to the PWA install unless they are added to globIgnores

#### ART-9. Re-render the install and store screenshots after the art lands

*b.10 P3 (install screenshots), Play listing; G5 · should*

- **Why.** Neither set shows the current app. The PWA phone screenshot shows the old 8-tab dock that B4 P1 replaced. The Play screenshots date from 25 Oct (commit baa5031), before B1-C3, and 06-night-garden.jpg shows the dimmed day painting with day petals.
- **How many.** PWA: 3 (public/screenshots/garden-narrow.png, today-narrow.png, garden-wide.png). Play: 7 (docs/play-store/screenshots/01-garden.jpg to 07-guide.jpg). The feature graphic stays.
- **Format.** Generated by script, not drawn: scripts/pwa-assets.mjs, then the Pillow 256-colour quantize in its header (~300 kB each), and scripts/play-store-assets.mjs (JPEG q92)
- **Size.** PWA 780×1688 narrow and 1280×800 wide, checked by src/pwaManifest.test.ts:80-100. Play 1080×1920.
- **Variants.** Day for the PWA (pwa-assets.mjs pins 10:30 via morning()). The Play set keeps its 06 night shot.
- **Where it plugs in.** src/pwaManifest.ts:113-133 (screenshot list and labels; the comment at :111 names a nonexistent scripts/pwa-screenshots.mjs, which should read pwa-assets.mjs); docs/play-store/README.md asset table
- **Match.** The existing screenshots
- **Constraints.** Use the existing Chromium through a throwaway config or CHROMIUM_PATH (CLAUDE.md, Playwright browsers). Screenshots stay out of the precache and the Android bundle (vite.config.ts:99-123, 155-160).

#### ART-10. Provenance and licence notice for every new image

*the future-work note from #67 (rules); LICENSE · must*

- **Why.** THIRD-PARTY-NOTICES.md records how the scene art was made and is shown in the app in both builds (NoticesView.tsx:20 imports it raw).
- **How many.** 1 Markdown section, listing every new file
- **Format.** Markdown, after 'Garden 3.0 original scene illustrations' (THIRD-PARTY-NOTICES.md:359-366)
- **Size.** n/a
- **Variants.** n/a
- **Where it plugs in.** THIRD-PARTY-NOTICES.md. Also update the feature lines in README.md:81-82 and docs/play-store/README.md ('a starry night mode', 'seasonal outfits') to match what ships.
- **Match.** THIRD-PARTY-NOTICES.md:359-366: tool, date, 'no external source images were supplied', AI-generated, not photographs
- **Constraints.** State the tool or model and the date for each file. List the licence of any third-party texture, brush or source image, or say that none was used. LICENSE claims the artwork as proprietary, so nothing with incompatible terms may be used.

#### Rules every new image keeps

- Animate only transform and opacity, on an HTML-level layer (SpriteFrame's stacked <svg> layers), never on elements inside an SVG. Source: SpriteFrame.tsx:26-41; A2 log P1 (Voyager plan lines 1158-1170); enforced by sprites.test.tsx:104-130 ('animates … only through its layers').
- Pause motion when nobody can see it. Sprites are marked data-offscreen by one shared IntersectionObserver (SpriteFrame.tsx:9-24) and paused by `.sprite-frame[data-offscreen] .sprite-layer` and `.page-hidden …` (App.css:3608-3614). `.page-hidden` is set on <html> by App.tsx:347-355. The patch's fireflies use their own observer and the same pauses (fireflies.css).
- Reduced and Calm motion. New moving art (moths, fireflies, extra particles) is not drawn with the shell's `.reduce-motion` or `.calm-motion` class (App.tsx:644, lib/motion.ts:26-32), nor with the device's prefers-reduced-motion. The component checks the device setting itself with hooks/useMediaQuery, because motionPreference ignores it (lib/motion.ts:18-24). Sources: the future-work note from #67; the patch's Fireflies.tsx and fireflies.css. Today's petals: Calm shows three (App.css:2567); reduced motion stops them (App.css:3616-3620).
- No mix-blend-mode inside the clipped, image-backed scene: it corrupts on scroll in Android WebView (theme-aurora.css:487-490). No backdrop-filter in the scene either: the build dropped unprefixed backdrop-filter after a -webkit- line (A2 log, Voyager plan lines 1195-1198).
- Every colour has a night counterpart with AA contrast (the future-work note from #67). Text over the scene: by day #244a36 and #304c38, at night #f2efd9 and #e1e8d5 (garden-3.css:213-238). The 0.94rem observation line needs 4.5:1; the h1 needs 3:1. The axe sweeps (e2e/a11y.ts) cannot measure text over an image, so measure it by sampling the composited pixels with lib/contrast.ts contrastRatio. Precedent for night fixes: the night danger button, raised from 2.3:1 to 5.3:1 (App.css:1941-1944; C3 log).
- Raster art is WebP in src/assets/, hashed by Vite, and loaded only when needed. Scenes go through loadBackdrop's decode-before-swap with an 8 s timeout (backdropAssets.ts:31-99); gallery thumbnails use loading="lazy" with width and height (BackdropGallery.tsx:98-104). Do not add url() images to the first-load stylesheets, and do not put art in public/, which is unhashed and precached by the glob.
- First-load budget: scripts/check-budgets.mjs caps the entry chunk at 100 kB, CSS at 25 kB gzip, and the whole first load at baseline 146,103 B + 10% = 160,713 B (scripts/bundle-baseline.json). Android runs the same check on dist-android (.github/workflows/android.yml:60-63) and had 61 B to spare after C3 (C3 log, Budgets); the seasons patch frees ~1.8 kB. New CSS and components therefore go in lazy chunks, following the patch's Fireflies.tsx + fireflies.css.
- In FlowerSprite, y=130 is the ground line of the 0 0 100 140 viewBox. Any plant drawing must reach it, and the sway pivots there (FlowerSprite.tsx:556-563, App.css:2532-2541, CLAUDE.md Layout notes).
- Anything positioned against a plant anchors at left: 50% of its slot, not off the sprite's own width. The row's end reservation (App.css:2248-2271) sets the spacing and must not change (CLAUDE.md Layout notes; App.css:818-827).
- Scene stacking: custom image z0, the hero's ::before wash z1, .hero-petals z4 (petals, a free ::before, the ::after shimmer; the patch's fireflies also sit at z4), flight space z5, heading z6, plants z7 (garden-3.css:196-261 and 300-306, App.css:3093-3100). Overlays go at z4.
- SVG ids are unique per instance through useId (sprites.test.tsx:17-53). Every catalogue cosmetic must draw something (OutfitOverlay.test.tsx:41-47). Ids are unique across catalogues (catalog.test.ts:16). Pass content is unpriced (catalog.test.ts:89).
- Pass cosmetics are never written into ownedItemIds (lib/gardenPass.ts:162-180). Keepsakes and seasons are free ('wellbeing and seasons are never paywalled', patch src/data/seasons.ts).
- The CSP allows images only from 'self', data: and blob: (index.html:22): no external image URLs, everything bundled.
- Licence: LICENSE claims all artwork as proprietary. THIRD-PARTY-NOTICES.md must record each new image's provenance and any third-party material (:359-366), and the app shows it in both builds (NoticesView.tsx:20).
- Android: backdropAssets.ts imports isAndroidApp (line 16), so changing it needs CLAUDE.md's Android checks (build:android, cap sync, gradlew lintRelease testReleaseUnitTest assembleDebug bundleRelease) plus the android-webview e2e. Android has no service worker, and every image ships inside the APK (vite.config.ts:55-56, 99-123).
- No text is baked into images: the words live in code, for screen readers and any future languages (c.10 was skipped by choice).
- The seasons patch (docs/final-pr-plan/patches/c4-seasons.patch) lands first, so the art has its hooks (step 1.1). It is applied with `git am -3` and conflicts on current main in src/lib/sealedBackup.test.ts (the future-work note from #67).

#### How images get into the app today

- Scene art lives in src/assets/: garden-{scene}.webp, with Sunlit Meadow under its older name garden-background.webp, and thumb-{scene}.webp. All are lossy VP8 WebP. The full scenes are 1280×720 (Sunlit Meadow), 1600×900 (Cloud, Cottage, Rain-kissed Pond, Twilight Orchard) and 1536×1024 (Woodland Brook, Secret Conservatory), 185–345 kB each. The thumbnails are 400×225, or 375×250 for the two 3:2 scenes, 19–26 kB each. They are imported as ES modules in src/data/backdropAssets.ts:1-29, and Vite hashes them into dist/assets. No script makes or encodes scenes or thumbnails: they were optimised by hand, and an art PR could add one (Pillow WebP q≈80, method 6).
- Loading: GardenView sets the scene as an inline background-image (GardenView.tsx:303) only after loadBackdrop has fetched and decoded it, with an 8 s timeout and shared caches (backdropAssets.ts:31-99). BackdropGallery shows thumbnails as <img loading="lazy" width=400 height=225> (BackdropGallery.tsx:98-104). The onboarding background is Sunlit Meadow through CSS (App.css:463-472). App.css:1861-1875 holds `.backdrop-preview-*` rules that point at three full scenes but match nothing in the source (dead CSS; do not copy the pattern).
- PWA precache (vite.config.ts:126-191): globPatterns precaches every js/css/html/png/jpg/webp/svg/woff2 file except the five optional full scenes, extended-latin fonts, screenshots, the maskable and shortcut icons, and reminders. Those five scenes are cached at runtime (CacheFirst 'garden-backdrops', maxEntries 12). Sunlit Meadow, Cottage Bloom and every thumbnail are precached. Vite's default assetsInlineLimit is 4096 B, so smaller images become data: URIs inside JS or CSS.
- Android: the plugin is disabled (no service worker). dist-android is copied into the APK by `npx cap sync android` (android/app/src/main/assets/public), with screenshots and the maskable and shortcut icons removed (vite.config.ts:99-123).
- Vector art has no files. FlowerSprite (viewBox 0 0 100 140, drawn at 84px), ButterflySprite and CreatureSprite (0 0 120 110, 96px by default) and JarSprite (0 0 80 88) are React SVG components on SpriteFrame layers, animated by CSS in App.css:2440-2569. Outfits are SVG cases keyed by item id in OutfitOverlay.tsx (headwear, accessory, auraArt), and auraMotion.ts maps each aura to its motion class. Shop items are data in src/data/shopItems.ts (id, kind, slot, stages, name, description, icon from the IconName union in types.ts, cost, currency, premium). A cosmetic's picture is the monarch CreatureSprite wearing it (ShopItemCard.tsx:45-55, ItemPreview.tsx:40-45). UI icons are 24×24 stroke paths in src/components/Icons.tsx.
- Scripts: scripts/generate-android-icons.py (Pillow) turns public/icons/icon-512.webp into the Android launcher icons and public/icons/icon-maskable-512.webp; it is untouched unless the icon changes. scripts/pwa-assets.mjs renders public/icons/shortcut-*.png (192×192) and public/screenshots/*.png (780×1688, 1280×800) from `vite preview` with Playwright; its header gives a Pillow 256-colour quantize to ~300 kB. scripts/play-store-assets.mjs renders docs/play-store/icon-512.png, feature-graphic.jpg (1024×500, built on Sunlit Meadow, found by the 'garden-background-' prefix at :266) and screenshots/01-07 (1080×1920 JPEG q92, including 06-night-garden.jpg) from the Android preview.
- Budgets: scripts/check-budgets.mjs gzips what index.html loads (JS and CSS only, not images): entry ≤100 kB, CSS ≤25 kB, first load ≤160,713 B. It runs in deploy-pages.yml and, on dist-android, in android.yml.
- Licence: THIRD-PARTY-NOTICES.md:359-366 records Cottage Bloom, Rain-kissed Pond, Twilight Orchard and Cloud Garden as made with OpenAI image generation on 8 September 2026, with no external source images. Sunlit Meadow, Woodland Brook and Secret Conservatory (added 2026-09-05, commit 2e40138) have no provenance line. LICENSE reserves all artwork as proprietary.

#### Hooks for night and season art

**On `main`.** the app shell carries `theme-${theme}` and the motion class (`reduce-motion` or `calm-motion`) on .app-shell (App.tsx:644, lib/motion.ts:26-32), and `page-hidden` on <html> (App.tsx:347-355). GardenView gets the theme on screen as its `theme` prop (GardenView.tsx:127-128), but uses it only to pick the gardener's own night image (activeCustomBackdrop, GardenView.tsx:251-255; lib/customBackdrops.ts:391-402). How night is drawn now: `.theme-night .garden-hero::before` lays two dot-star radial-gradients and a navy wash (rgba(11,30,39,.88) fading to .3 by 36%) over the day painting (garden-3.css:1361-1376). `.theme-night .garden-hero::after` darkens the foot (App.css:2035-2037), and the heading turns cream (garden-3.css:232-238). The seven pink `.hero-petal`s fall day and night (GardenView.tsx:314-318), and the sun-shimmer `.garden-hero .hero-petals::after` (theme-aurora.css:484-497) runs at night with no night rule. e2e/app.spec.ts:790-803 asserts a radial-gradient on the hero's ::before at night. The scene image is an inline style from `backdropAssets[displayedScene].image` (GardenView.tsx:303), and backdropAssets has only {image, thumbnail} (backdropAssets.ts:18-29). So no night image per built-in scene exists, and CSS alone cannot swap one in. The section's `backdrop-${selectedBackdropId}` class names the chosen scene, not the one actually displayed after a fallback (GardenView.tsx:302). `.hero-petals::before` is unused. There is no season anything on main: no data-season attribute, no lib/seasons.ts, no data/seasons.ts. data/whatToLookFor.ts:13 has a separate Season type for sighting lines. Existing firefly-like art: the 'firefly-glow' aura (OutfitOverlay.tsx:492-501) and `.aura-motion-fireflies` (App.css:2544).

**Only in `c4-seasons.patch` (step 1.1).** `data-season={season}` on .garden-hero, set from currentSeason(today, hemisphereOf(region)) with the north as default (src/lib/seasons.ts: seasonOf, currentSeason, hemisphereOf, knownSeason). Petals rendered only by day (`!night &&`). A lazy <Fireflies/>: 5 CSS dots in fireflies.css, z-index 4, transform and opacity only, paused when offscreen or the page is hidden, drawn only at night, with full motion, not in winter, and not under the device's reduced motion. A lazy <GardenLine/> with night lines per species (data/nightLines.ts) and season lines per region (data/seasons.ts seasonLines). Marigold's autumn and spring words on ButterflyCard (words only; she wears nothing, GardenView.tsx:165). `seasonArt` in src/data/seasons.ts, a typed list per season of an overlay id (overlay-spring-blossom, overlay-summer-petals, overlay-autumn-leaves, overlay-winter-frost), a keepsake id (keepsake-spring-nest, keepsake-summer-seed-head, keepsake-autumn-acorn, keepsake-winter-holly) and a Pass outfit with its slot (season-spring-blossom-crown, season-summer-sun-hat, season-autumn-leaf-scarf, season-winter-knit-cap), each with a one-line brief. Its own doc says nothing in the app reads seasonArt and none of it has an image. Tests: e2e/seasons.spec.ts and an android.spec.ts block expect data-season, 7 petals by day, 0 at night, and 5 fireflies only with full motion. The patch does not add a night image per scene, moths, any seasonal CSS, catalogue entries or drawings for keepsakes or outfits, or a place where keepsakes are shown or given.

#### Questions for the owner about the art

- Night is one variant per scene (moonlit blue hour) or two (dusk and night, 14 paintings)? The theme can turn at the gardener's evening hour ('Follow evening', B5 P6), so one blue-hour painting may suit 18:00-06:00.
- Should the night versions of the two free scenes (Sunlit Meadow, Cottage Bloom) be precached like their day images, adding roughly 0.4-0.6 MB to the PWA install so night works offline from the first day? Or fetched on the first night, like the optional scenes?
- Keep the navy wash and dot stars of `.theme-night .garden-hero::before` (garden-3.css:1361-1376) over the new paintings, keep only the stars, or drop both? e2e/app.spec.ts:790-803 asserts a radial-gradient there at night.
- Seasonal keepsakes: where do they live (a shelf beside the jars, placeable on a plant spot like a jar, or a Journal or Year page)? Are they given automatically at the season's start, and kept after it? Do they need a new ShopItemKind ('supply' | 'cosmetic' today, types.ts:120)? The answer decides whether the sprite must fit the jar's 80×88 box.
- Seasonal Pass outfits: on offer all year once added, or only in their season? Which life stages does each fit (the art must be drawn for each)?
- Rename the autumn Pass outfit: 'Leaf Scarf' is already the name of the Nectar item `leaf-scarf` (shopItems.ts:148-157).
- Calm motion and the seasonal petals: keep three falling in Calm as today (App.css:2567), or follow the rule that nothing new shows with reduced or Calm motion, for every seasonal particle? Does the still winter frost layer show with reduced or Calm motion, given that it does not move?
- Moths: none in winter, as with the patch's fireflies? With Calm motion, none, or a still resting moth?
- Butterflies keep flying in the night scene while the patch's night lines say butterflies rest at night. Should they settle at night (as in Calm's settled state)? That is a code change, not art.
- Should the season overlays also show over a gardener's personal backdrop image? They sit at z-index 4, above the custom layer at z 0.
- Night thumbnails in the gallery: worth ~160 kB of extra precache?
- Backfill the provenance of Sunlit Meadow, Woodland Brook and Secret Conservatory (added 2026-09-05, commit 2e40138), which THIRD-PARTY-NOTICES.md does not cover, in the same PR?
- Marigold's travels are words only by design (patch marigoldLines), and she wears nothing (GardenView.tsx:165). Is any visual cue wanted, or none?
- Should onboarding's background (App.css:463-472, the day meadow) use the night meadow on a dark device? The postcard draws the day scene only (year/Postcard.tsx:37-52). Is that still right?
- Builds 3.1-3.4 drop cosmetic ids they do not know from saved looks and the companion story (validateGarden.ts:725-755). A seasonal outfit in a saved look is lost if an older build rewrites the profile. Is that acceptable?
- Should a night screenshot join the PWA manifest's install screenshots (src/pwaManifest.ts:113-133) once the night art exists?


## 2. Moving to a new device, and keeping copies (c.6)

**Section 2 implementation record (28 October 2026, release 3.6 candidate).**
Steps 2.1, 2.3, 2.4 and 2.5 are integrated on the implementation branch;
verification and acceptance are recorded in [section-2-verification.md](section-2-verification.md).
The owner explicitly deferred **all QR scanning** on 28 October: step 2.2 is
out of this release. Moving uses twelve typed words on every platform; the
unused QR display/encoder and camera code are omitted too. The damaged-snapshot
prerequisite from 3.1 is included: a specific error and download/discard actions
let a lock change proceed after an explicit discard. No other section 3 work is included.

The paragraphs below describe the original baseline and remain as provenance;
use the implementation record for current completion and verification evidence.

Both parts are built and kept as patches in `docs/final-pr-plan/patches/`. Neither has been reviewed, run end to end or checked on Android. Apply each on a branch from `main` with `git am -3`, resolve the conflicts listed, review it as every earlier PR was reviewed, and run every check in CLAUDE.md. Each one is a release of its own, with release notes, an ARCHITECTURE row (the builders' suggested rows are in `builders-notes.txt` beside the patches) and a Voyager log entry. Remove its patch file once it is merged.

### 2.1 Review and merge “Move my garden to another device” (`c4-move.patch`)

*Plan: c.6 part 1 · built, not merged · large · web and Android*

- **Where it stands.** Built and kept only as docs/final-pr-plan/patches/c4-move.patch (31 files, +4806/-16; commit 4b513d9 on the pre-fix C3 head 48ad0f1). Nothing of it is on main: src/lib/moveCode.ts, src/lib/qrCode.ts, src/lib/qrScan.ts and src/components/move/ do not exist. Builder report docs/final-pr-plan/patches/builders-notes.txt:2 and :56-63: e2e/move.spec.ts and the android.spec.ts addition were written but never run, and no Gradle or Android checks were run. On `main`, `git am -3` stops on conflicts in src/lib/sealedBackup.test.ts, SettingsView.tsx, components/backup/ProtectedRestore.tsx and SealedBackupPrompt.tsx.
- **What is left.** Apply the patch on a branch from main and resolve the conflicts. Main's C3 review fixes win: SealedBackupPrompt now says per screen what follows a correct passphrase, returns focus, and handles a dialog the browser closes; sealedBackup.test.ts already has main's withPhotosAsText `{ value, unreadable }` shape and FileReader stub. Then do the review the patch never had and fix what it finds. Run the e2e and Android checks for the first time. Add release notes, an ARCHITECTURE row and a Voyager log entry. Remove the patch file.
- **How.** 1) `git switch -c <branch> main && git am -3 docs/final-pr-plan/patches/c4-move.patch`, then resolve the conflicts by hand and keep main's C3 behaviour in SealedBackupPrompt and ProtectedRestore. 2) Re-read lib/sealedBackup.ts: the patch adds an optional `opensWith: 'move-code'` hint to the envelope; check it against main's `sealedKind` in lib/backupFile.ts and against lib/lockedCopy.ts, which C3 added after the patch was cut. 3) Check MoveDialog with the lock on. It exports the plain backup and then seals it with the 12 words, and the dialog must say the lock stays on the old device (docs/final-pr-plan/patches/builders-notes.txt:10). 4) Review moveCode.ts (128 random bits plus a 4-bit SHA-256 check, 12 words from data/recoveryWords.ts, PBKDF2 600k via lib/sealing.ts) and qrCode.ts (byte mode, level M, matched to Nayuki qrcodegen 1.8.0 fixtures in src/test/qrFixtures.json). 5) Bump to the next version in src/data/releases.ts, src/data/currentRelease.ts and package.json; releases.test checks the version. 6) Add the suggested ARCHITECTURE row from docs/final-pr-plan/patches/builders-notes.txt:88. 7) Android: the patch offers 'Save the move file' through GardenFilesPlugin, with no Share and no scan button. Run `npm run build:android`, `npx cap sync android` and `cd android && ./gradlew lintRelease testReleaseUnitTest assembleDebug bundleRelease`.
- **Done when.** On one browser context, a move file is made and shown as 12 words and a QR code. A fresh context then arrives from the welcome screen by typing the words: a misspelt word is named with suggestions, a wrong-but-valid word is refused by the checksum, and the journal note arrives. The move file also opens through Settings' restore preview. Nothing new is stored, DATABASE_VERSION is unchanged, and builds 3.0-3.4 refuse the file without replacing anything. e2e/move.spec.ts passes in the desktop and mobile projects (axe by day and night, Largest text at 360px), and the android.spec.ts test passes in android-webview. `npm run typecheck`, `npm run lint`, `npm test` (coverage floors) and `npm run test:e2e` pass. `node scripts/check-budgets.mjs` passes for the web build, and `--dist dist-android` passes for Android. Gradle lintRelease, testReleaseUnitTest, assembleDebug and bundleRelease pass.
- **Needs first.** c.7/G5 code (1.1) first, for Android first-load room
- **Source.** Voyager c.6 point 1 (lines 931-938, build 945-950); C3 log line 2150-2151; the future-work note from #67; docs/final-pr-plan/patches/builders-notes.txt:1-88

### 2.2 QR scanning where `BarcodeDetector` is missing

*Plan: c.6 part 1 · not done · medium · web and Android · **needs a decision***

- **Where it stands.** c4-move.patch adds src/lib/qrScan.ts (80 lines), which only uses `BarcodeDetector` with `qr_code` support plus getUserMedia. The scan button is hidden everywhere else (docs/final-pr-plan/patches/builders-notes.txt:31). The Android WebView has no BarcodeDetector, so the app has no scan button (docs/final-pr-plan/patches/builders-notes.txt:31). android/app/src/main/AndroidManifest.xml has no CAMERA permission. Typing the 12 words works everywhere.
- **What is left.** Write or vendor a small QR decoder, loaded lazily only in the scan dialog, and use it when `BarcodeDetector` is absent: iOS Safari, Firefox, and possibly the Android WebView. Decide whether the Android app should scan at all.
- **How.** Add src/lib/qrDecode.ts: a pure TS decoder (binarise, find patterns, sample grid, read format/version, Reed-Solomon correct, byte mode only), or a vendored MIT decoder. Load it only from components/move/CodeScanner.tsx. Feed it frames drawn from the getUserMedia video to a canvas, about 4 per second, and release the camera on every path the patch already releases it on. No CSP change is needed (index.html:22 is script-src 'self', with no WASM). Unit-test by decoding every QR in src/test/qrFixtures.json as rendered by lib/qrCode.ts. For Android there are two options. (a) Use the same JS decoder in the WebView: add `<uses-permission android:name="android.permission.CAMERA"/>` and a runtime prompt (Capacitor's BridgeWebChromeClient asks for it on getUserMedia), and update the Play Data safety form. (b) Keep words-only on Android. Either way, update e2e/android.spec.ts and run the Gradle checks if android/ changes.
- **Done when.** In WebKit and Firefox (CI `browsers` job, E2E_ALL_BROWSERS=1), the scan button appears where getUserMedia exists and decodes a fake-camera QR into the 12 words. The camera is released on read, Stop, Cancel, Escape and hide. The decoder chunk stays out of the first load (check-budgets). On Android, the scan behaviour matches the owner's choice, android.spec.ts covers it, and Gradle passes.
- **Needs first.** 2.1
- **Source.** Voyager c.6 build line 946-949 ('a small pure-JS decoder fallback for iOS Safari'); docs/final-pr-plan/patches/builders-notes.txt:65-66 'Not finished'; the future-work note from #67

### 2.3 Offer “Arrive from another device” in safe mode

*Plan: c.6 part 1 · not done · small · web and Android*

- **Where it stands.** c4-move.patch adds Arrive to Onboarding.tsx, RecoveryScreen.tsx and SettingsView.tsx only; src/components/SafeMode.tsx is not in the patch's diffstat. A move file chosen through safe mode's ordinary restore (SafeMode.tsx:68, inspectImportedState) reaches the code prompt only through SealedBackupPrompt's routing.
- **What is left.** Give safe mode an explicit 'Arrive from another device' button, so a gardener whose garden will not draw can bring one in from another device.
- **How.** In src/components/SafeMode.tsx, lazy-load components/move/ArriveRestore and wire it to safe mode's existing restore path. Safe mode runs after a render failure, so a chunk that fails to load must leave the plain restore working and say so. Add SafeMode.move.test.tsx and one e2e case beside the existing safe-mode test.
- **Done when.** In safe mode, Arrive takes a move file and its words and restores the garden. If the chunk fails, the plain restore still works. Unit, e2e and axe checks pass.
- **Needs first.** 2.1
- **Source.** docs/final-pr-plan/patches/builders-notes.txt:67 'Not finished'; the future-work note from #67

### 2.4 Review and merge “keep a copy” (`c4-keep.patch`)

*Plan: c.6 parts 2 and 3 · built, not merged · large · web and Android*

- **Where it stands.** Exists only as docs/final-pr-plan/patches/c4-keep.patch (27 files, +3367/-50). Main has no src/repository/dailyCopies.ts, src/lib/autoBackup.ts or src/lib/autoBackupFile.ts, and no showSaveFilePicker anywhere in src. Main keeps pre-restore snapshots only (src/repository/gardenRepository.ts:433-434 SNAPSHOT_LIMIT = 2; :956-987). The builder reports the Android first load at 161.2 kB, over the 160.7 kB limit (docs/final-pr-plan/patches/builders-notes.txt:91, :139). Main's Android first load was 160,652 B of 160,713 at C3 merge (Voyager C3 log). Expected conflicts are in gardenRepository.ts, sealedStores.ts, SettingsView.tsx and sealedBackup.test.ts (the future-work note from #67).
- **What is left.** Rebase onto main's C3. Every lock change now writes a fresh database through src/repository/gardenSwitch.ts, so daily copies must be carried and sealed through that path, not the in-place switch the patch was built against. Find Android first-load room. Run review, e2e and Android checks for the first time. Add notes, docs and the log. Its conflicts on main also include `vite.config.ts`: the patch expects the code-splitting test `(?!sealedStores)`, but main has `(?!sealedStores|gardenSwitch|setAside)`, so the merged test must read `(?!sealedStores|gardenSwitch|setAside|dailyCopies)`.
- **How.** 1) Land the seasons patch first: its lazy day-lines chunk frees about 1.8 kB (docs/final-pr-plan/patches/builders-notes.txt:193-205). 2) `git am -3 c4-keep.patch` and resolve conflicts. In sealedStores.ts, main's restoreValue (sealedStores.ts:431-470) seals 'snapshots' via sealGarden/openGarden and every 'drafts' value by name. The patch's backup-file handle (drafts key `backup-file`) must stay unsealed: a FileSystemFileHandle cannot be sealed. Check that gardenSwitch copies it into the new database intact. 3) Daily copies use `reason: 'daily'` with `day` and `bytes` on SnapshotRecord. Keep `snapshots()` returning pre-restore copies only, and check main's after-restore Undo still finds the newest 'restore' snapshot. 4) Check the 24 MB / 7-copy budget, that photos are left out of daily copies, and that a copy can never make a change fail (docs/final-pr-plan/patches/builders-notes.txt:125-129). 5) AutoBackupKeeper must never write while locked or read-only, and must stay out of the Android bundle. 6) Measure both budgets. If Android is still over, move the daily-copy hook in save/replace behind a lazy import or run `npm run budgets -- --update` with a note. 7) Write release notes, the ARCHITECTURE row (docs/final-pr-plan/patches/builders-notes.txt:169) and the Voyager log. Run the Android checks.
- **Done when.** Before the first change of a local day, that day's copy is taken in the same transaction. At most 7 are kept within 24 MB, apart from pre-restore snapshots. Settings → 'Earlier copies on this device' lists them with counts, and look / put back / Undo work. Under the lock, copies are sealed: extend e2e/lock.spec.ts's no-plaintext-at-rest check to the snapshots store. A lock change carries them through gardenSwitch. On Chromium desktop, a chosen file is rewritten after an earlier day's changes and on hide, at most every 10 minutes, and never while locked. The section is absent in WebKit, Firefox and the Android build. e2e/keep.spec.ts and the android.spec.ts addition pass. All four npm checks, both budgets and the Gradle tasks pass.
- **Needs first.** c.7/G5 code (1.1)
- **Source.** Voyager c.6 points 2-3 (lines 939-950); C3 log 2150-2151; the future-work note from #67; docs/final-pr-plan/patches/builders-notes.txt:90-169

### 2.5 List the kept pre-restore copies in Settings after a reload

*Plan: a.5 WP2-6 (D8) · partly done · small · web and Android*

- **Where it stands.** Two snapshots are kept (src/repository/gardenRepository.ts:434 SNAPSHOT_LIMIT = 2, written by replace at 1323), but the Undo offer comes only from in-memory persistence.lastRestoreSnapshotId (src/hooks/usePersistence.ts:461-466; src/components/SettingsView.tsx:628-631 and 1250-1260). repository.snapshots() is called only at usePersistence.ts:461, so after a reload the copies exist but nothing can reach them. The c4-keep patch lists daily copies and filters restore snapshots out (docs/final-pr-plan/patches/c4-keep.patch around line 3740).
- **What is left.** By the plan's own words this is nearly done: Settings offers Undo restore until a reload. But the two kept copies cannot be reached after a reload, so it is still worth finishing. A Settings list of pre-restore copies (when taken, garden name, counts) with 'Put this garden back' behind a confirmation, plus a per-copy discard.
- **How.** Add a lifecycle method that lists repository.snapshots() with reason 'restore' and builds a preview with src/lib/backupPreview.ts; render it under Settings, Backup and restore; reuse undoRestore(snapshotId). Snapshots are sealed under the lock (repository/sealedStores.ts), so read them through the opened path. A discard button per copy also lets the gardener clear a damaged snapshot that blocks a lock change (the future-work note from #67). If c4-keep lands first, put both kinds in its list. Tests: a SettingsView test that lists two snapshots after remount; a usePersistence test that undoes from a fresh hook; an e2e restore, reload, undo.
- **Done when.** After a restore and a reload, Settings shows the copy and putting it back restores the earlier garden; discard removes it; works with the lock on; tests added.
- **Needs first.** 2.4, if it lands first
- **Source.** Voyager a.4 D8 (line 180); a.5 WP2-6 (317-321: 'offer Undo restore for the rest of the session and in Settings'); A1 log D8 (1137-1140).


## 3. The garden lock and protected backups: follow-ups (c.5)

### 3.1 A damaged pre-restore snapshot must not block every lock change

*Plan: c.5, C3 follow-up · not done · medium · web and Android*

- **Where it stands.** src/repository/sealedStores.ts:461-465 reopens every snapshot with openGarden during a switch, and any failure rejects the whole switch. Set-aside copies have a specific error and a way out (SetAsideSealedError, :412-418 and :447-457); snapshots have neither. src/repository/gardenRepository.ts:1401-1413 can list and read snapshots but has no discard. The gardener sees only the generic 'Your passcode could not be changed...' (src/components/lock/LockChange.tsx:123). c4-keep.patch would store up to seven daily copies in the same 'snapshots' store, which makes this more likely.
- **What is left.** Give the gardener a specific, plain message and a way to download or discard the snapshot that will not open, then let the lock change succeed.
- **How.** In restoreValue's 'snapshots' branch, catch the openGarden failure and throw a new SnapshotSealedError naming the snapshot. Add `discardSnapshot(id)` to gardenRepository: one transaction that checks the lock and revision like other writes. In LockChange (and the lock on/off flows), show the error with 'Download it as it is' (raw sealed record, as the set-aside download does) and 'Discard it', then retry. Tests: sealedStores (a corrupt snapshot gives the new error and changes nothing), the repository discard, and the LockChange component.
- **Done when.** With one corrupt snapshot, changing the passcode shows the specific message and both actions, and after a discard the change succeeds. Undoing the last restore still works when snapshots are sound. Android: the lock exists in the app (android.spec.ts:465), so run `npm run test:e2e`. No native changes.
- **Source.** the future-work note from #67, 'A damaged snapshot blocks a lock change'

### 3.2 Nothing typed is lost when the garden locks

*Plan: c.5, C3 follow-up · partly done · small · web*

- **Where it stands.** Auto-lock waits while `[data-auto-lock-waits]` is on the page (src/components/lock/LockWatch.tsx:30-35, :73). That marker is set by the sighting form (SightingForm.tsx:177-179), the backdrop editor (CustomBackdropEditor.tsx:134-136) and the goal editor. But 'Lock now' with `everywhere` (src/lib/gardenLockActions.ts:162-167) makes other tabs call lockGarden at once (src/hooks/usePersistence.ts:206-209). That ignores the marker and unmounts the App, losing a typed sighting note, a goal being edited or a framed image. Also: TodayView.tsx:198-199 keeps goalTitle and goalTinyTitle in useState, and its add form (:766-790) has no `data-auto-lock-waits`; LockWatch.tsx:73 waits while any marker exists, with no cap.
- **What is left.** Two gaps. “Lock now” in another tab locks this one at once and unmounts the app, so a sighting note, a goal being edited or a framed image is lost. Auto-lock also loses the new-goal form on Today, which is neither a draft nor marked to hold the lock. And the forms that are marked hold auto-lock back with no time limit, so a garden left with a sighting form open never locks. Every plain-state text field needs the same audit.
- **How.** Keep these forms' text as drafts (lib/drafts.ts, hooks/useSyncedDraft.ts): drafts are already sealed under the lock and flushed before locking (src/lib/gardenLockActions.ts:161-166, flushDrafts). Then Lock now and auto-lock can both go ahead without losing anything, and the `data-auto-lock-waits` hold can get a time limit or go. A photo or framed image cannot be kept as a draft, so the lock screen should say what was not kept. Audit every text field held in plain state (TodayView's goalTitle and goalTinyTitle at :198-199, SightingForm, GoalEditor, CustomBackdropEditor). Tests: a twoTabs-style test for Lock now, LockWatch tests for auto-lock with each form open, and a usePersistence test.
- **Done when.** Tab A presses Lock now while tab B has a sighting note and a new goal typed. After tab B is unlocked, both are back in their forms, or the gardener was told what could not be kept. Auto-lock goes ahead within its time with a form open, and nothing typed is lost. Lock unit tests, lock.spec.ts and android.spec.ts pass.
- **Source.** the C3 builder's report 'Not finished: on lock, unsaved text outside the draft-backed fields is lost'; C3 review finding 11 (fixed for auto-lock only)

### 3.3 Test passkey unlock beyond a mocked authenticator

*Plan: c.5 · partly done · small · web*

- **Where it stands.** src/lib/passkey.ts implements PRF, and it is hidden in the Android build (passkey.ts:36). Passkey tests are component tests with mocks only (src/components/lock/LockScreen.test.tsx, LockSettings.test.tsx). No e2e/*.spec.ts uses a virtual authenticator; e2e/android.spec.ts only checks that it is absent. Release 3.4 notes (src/data/releases.ts:50) already say 'or a passkey where your device offers one'.
- **What is left.** Try add, unlock and remove a passkey on Chrome on Android with Google Password Manager and on Safari with Touch ID or Face ID. Record the results. If PRF fails there, hide the option. Add an automated Chromium e2e with a CDP virtual authenticator.
- **How.** e2e: in e2e/lock.spec.ts (Chromium only), open a CDP session and call `WebAuthn.enable` and `WebAuthn.addVirtualAuthenticator` with `{ protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true }`. Then add a passkey in Settings, lock, unlock with it, remove it, and check the passcode still opens. Manual: a short device matrix recorded in docs/ (device, OS, browser, result). Adjust lib/passkey.ts feature detection if a platform reports PRF but fails.
- **Done when.** The Chromium e2e passes add, unlock and remove with a virtual PRF authenticator. The device results are written down. The passkey option shows only where it works.
- **Source.** Voyager c.5 Experience (lines 878-883); the C3 builder's report 'Tested only with mocked WebAuthn'; the future-work note from #67

### 3.4 A cancelled photo picker must not close the form

*Plan: C3 review follow-up · not done · small · web and Android*

- **Where it stands.** src/components/sightings/SightingForm.tsx:180-183 and src/components/CustomBackdropEditor.tsx:137-140 run `onCancel={(event) => { event.preventDefault(); close() }}` without checking event.target. Both dialogs hold an <input type=file> (SightingForm.tsx:317, CustomBackdropEditor.tsx:162). Browsers fire a bubbling `cancel` at a file input when its picker is dismissed (Chromium 113+, and therefore the Android WebView). src/components/lock/LockWatch.tsx:147 already relies on that event reaching the document.
- **What is left.** Ignore a cancel event that did not start on the dialog itself, add tests, and check in a real browser and in the app.
- **How.** At the top of both handlers add `if (event.target !== event.currentTarget) return`. Add component tests that dispatch `new Event('cancel', { bubbles: true })` on the file input and expect the dialog to stay open with the typed note kept, plus a test that Escape (the dialog's own cancel) still closes it. Apply the same guard to ArriveDialog when the c4-move patch lands, since it also takes a file.
- **Done when.** The new tests fail without the guard and pass with it, and the existing Escape-closes tests still pass. Cancelling the picker in desktop Chrome and in the Android app leaves the form open with its text. Android: there is no native change, but the app's WebView fires this event; run `npm run test:e2e` (android.spec.ts:401 opens the sighting form) and add the case to the device checklist.
- **Source.** the future-work note from #67, 'A file chooser's cancel may close a form'

### 3.5 Catch a mistyped recovery word before the slow unlock

*Plan: c.5 · not done · medium · web and Android · **needs a decision***

- **Where it stands.** src/lib/recoveryCode.ts:16-41: newRecoveryCode turns 33 random bytes into 24 words (264 bits) and adds no check bits. readRecoveryCode (recoveryCode.ts:53-76) refuses only an unknown word or the wrong count. A word swapped for another word from the list goes on to PBKDF2 at 600,000 iterations (src/lib/sealing.ts:20-24), and the lock screen then says only that it did not open, with no hint which word is wrong. The move code in c4-move.patch does carry a 4-bit check (the future-work note from #67), so the two codes behave differently.
- **What is left.** The C3 review judged the missing check not a defect (its finding 6 was refuted: a checksum changes the message, not whether the garden opens). The move code in 2.1 does carry a check, so the two codes behave differently. Owner decision: should new recovery codes carry check bits? If yes, new codes carry them and the lock record says so. A typed code that fails the check is then refused at once, naming the likely word, before any key is derived. Codes made before the change must keep opening exactly as they do now.
- **How.** lib/recoveryCode.ts: make new codes 256 random bits plus an 8-bit SHA-256 check, still 24 words (the BIP-39 layout), and add a check function. Record the scheme in the non-secret lock record (lib/gardenLock.ts, e.g. a recoveryCheck field written by turnLockOn and by 'new recovery code' in lib/gardenLockActions.ts). readRecoveryCode takes that flag and checks only when it is set. Use it in LockSetup's two-word confirmation, in LockScreen's 'Use my recovery code', and in lib/lockedCopy.ts (safe mode's sealed copy). Tests: recoveryCode.test.ts (a swapped word is caught; an unflagged old code still reads), gardenLock tests, and the recovery path in e2e/lock.spec.ts. The lock also runs in the Android app (only passkeys are hidden there), so run e2e/android.spec.ts and the Android checks from CLAUDE.md.
- **Done when.** A new code with one word changed to another list word is refused immediately, with a message naming that position, and no PBKDF2 derivation runs. A lock set up before the change still opens with its old code. recoveryCode/gardenLock unit tests, lock.spec.ts and android.spec.ts pass.
- **Source.** The C3 builder's report ('Not finished: The recovery code has no checksum; mistakes are caught only by unknown words or the wrong count'). Relates to Voyager c.5 Experience (lines 878-881). Not in the future-work note from #67.

### 3.6 Argon2id or PBKDF2 for the lock and protected backups

*Plan: c.5 · partly done · medium · web and Android · **needs a decision***

- **Where it stands.** src/lib/sealing.ts:10-24: PASSPHRASE_KDF is PBKDF2-SHA-256 at 600,000 iterations, with the comment 'this app will not ship a WebAssembly module or a dependency to get it'. index.html:22 CSP script-src 'self' has no 'wasm-unsafe-eval'. The count is stored with each wrap, so it can be raised later.
- **What is left.** The plan's preferred, GPU-resistant KDF was not built. Either accept PBKDF2 and record that decision in the plan, or add Argon2id with a migration.
- **How.** If adopted: vendor a small audited Argon2id WASM (or hash-wasm's argon2id), lazily loaded with lib/sealing.ts. Add 'wasm-unsafe-eval' to script-src in index.html. Add a `kdf: 'argon2id'` variant to the lock wrap records (lib/gardenLock.ts) and to the sealed backup envelope (lib/sealedBackup.ts; older builds refuse an unknown kdf as 'newer version'). Re-wrap the data key under Argon2id at the next unlock, which C3 already supports by making a new key on secret change. Keep PBKDF2 when WASM fails. Measure unlock time on a low-end Android phone, since the Android WebView runs WASM.
- **Done when.** Owner's decision recorded. If built: new wraps and protected backups use Argon2id at 19 MiB, t=2; old PBKDF2 wraps still open and are upgraded; the Android build unlocks under ~2 s on a mid phone; CSP passes axe/e2e; budgets unchanged (lazy chunk).
- **Source.** Voyager c.5 Build 'Key hierarchy' (lines 896-902): Argon2id at 19 MiB, t = 2 via a small WASM module, PBKDF2 at 600k only if WASM is unavailable


## 4. Data safety leftovers (a.5 WP1 and WP2)

Small fixes in shared code. They fit in one PR.

### 4.1 Retry a save once when the cached database connection has closed

*Plan: a.5 WP2-7 (D10) · partly done · small · web and Android*

- **Where it stands.** src/repository/gardenRepository.ts:858-860 forgets the cached handle on terminated, and 1107 maps VersionError to 'incompatible'. But save() (1241-1288) has no retry and 'InvalidStateError' appears nowhere in src/. A save that hits a closing connection fails into the writeError banner (src/hooks/usePersistence.ts:294-334, src/App.tsx:775-784), and the change is not written again until the next edit, because the save effect (usePersistence.ts:356-360) only runs when state changes.
- **What is left.** The plan's 'retry once on InvalidStateError', for save(), replace() and writeDrafts().
- **How.** In gardenRepository, when opening the transaction throws a DOMException named InvalidStateError, set databasePromise = undefined, await database() and run the same write once more inside the same enqueue. Do not retry GardenConflictError, QuotaExceededError or ConstraintError. Test in src/repository/gardenRepository.test.ts with fake-indexeddb: save, close the cached IDBDatabase (or make transaction throw InvalidStateError once), save again, and assert it resolves with the stored revision moved by exactly one. Add a usePersistence hook test that no writeError appears. Shared code; no Android-only path.
- **Done when.** The new tests fail on main and pass after the change; no double write; typecheck, lint, test and test:e2e green.
- **Source.** Voyager a.4 D10 (line 182); a.5 WP2-7 (322-327); A1 log D9/D10/D13 (1141-1144).

### 4.2 Delete under a Web Lock, or prove the revision check covers it

*Plan: a.5 WP2-5 (D7) · partly done · small · web and Android*

- **Where it stands.** The plan asked for navigator.locks.request('butterfly-garden-write', ...) around the delete. The only Web Lock in src/ is the lock-change staging lock (src/repository/gardenSwitch.ts:111-115). deleteAll (src/hooks/usePersistence.ts:526-554) relies on the garden-clearing/garden-cleared broadcasts, and the repository marks deletedElsewhere from blocking with blockedVersion null (src/repository/gardenRepository.ts:848-857). A tab whose handle was already dropped by terminated (858-860) never sees blocking and relies on the broadcast and the revision check (1265-1268).
- **What is left.** Either take an exclusive 'butterfly-garden-write' lock in clear() and around save()/replace(), or record in docs/ARCHITECTURE.md that the deletion marker and revision check are enough, backed by a test of the case the lock was meant for.
- **How.** Add a case to src/repository/twoTabs.test.ts: instance B's connection is terminated, A deletes, and B saves before any broadcast arrives. Assert B's save is refused (GardenConflictError or GardenDeletedElsewhereError) and no partial garden is created. If it fails, wrap clear(), save() and replace() in navigator.locks.request when the API exists (Safari 15.4+, Android WebView has it), falling back to today's path.
- **Done when.** A test shows no partial garden after a delete in every ordering; either lock code or an ARCHITECTURE.md note explains the choice.
- **Source.** Voyager a.4 D7 (line 179); a.5 WP2-5 (310-316); A1 log D7 (1133-1136).

### 4.3 Add the planned revision and sha256 fields to the plain backup file

*Plan: a.5 WP2 · partly done · small · web and Android*

- **Where it stands.** exportGarden writes only format, exportedAt, appVersion and garden (src/hooks/useGardenState.ts:573-578; the photo path in src/lib/sightingPhotos.ts:151-152 does the same). src/lib/backupPreview.ts:68-71 reads only exportedAt and appVersion. appVersion is done; revision and sha256 are not.
- **What is left.** Write revision and a SHA-256 of the garden on export; on import, check it and say in the restore preview when the file was changed or damaged.
- **How.** Compute sha256 with crypto.subtle over the exact serialised garden text (define once, after photos are inlined by sightingPhotos.fileCopy). Keep both fields optional so older builds ignore them and older files still import. In inspectImportedState and backupPreview, add an integrity result (ok, changed, absent) and show one line in the preview; warn, do not refuse, because hand-edited files are allowed and repaired. Protected backups already have authenticated encryption; leave them as they are. Tests: round trip ok, a one-character edit flagged, a file without the fields accepted.
- **Done when.** Exported files carry revision and sha256; an edited file is flagged in the preview; older backups still restore; tests added; all four repo checks green.
- **Source.** Voyager a.5 WP2 zero-loss guard (lines 334-336): 'The backup envelope gains optional appVersion, revision and sha256 fields'.

### 4.4 Test the per-page error boundary with a throw in every view

*Plan: a.5 WP1 · partly done · small · web and Android*

- **Where it stands.** The boundary exists (src/App.tsx:862-864 with ViewProblem) and safe mode is covered (src/components/SafeMode.test.tsx; e2e/lock.spec.ts:401-470). But the tests only throw from a generic child (src/components/DataSafety.test.tsx:59-100) or render ViewProblem alone (src/components/ViewProblem.test.tsx); no App test mentions 'This page could not be shown' (grep over src/App*.test.tsx).
- **What is left.** An App-level test that injects a throw into each view in turn.
- **How.** New src/App.viewProblem.test.tsx: vi.mock each lazy view module (GardenView, TodayView, JournalView, ShopView, CareView, GuideView, SettingsView, YearView and the rest reachable from src/lib/routes.ts) to throw for one route at a time; assert the 'This page could not be shown' heading, that Navigation still works, and that moving to another page recovers (resetKey).
- **Done when.** One passing case per route; coverage floors in vite.config.ts:214 still met.
- **Source.** Voyager a.5 WP1-3 (259-263) and its done-when (267-268): 'the boundary renders on an injected throw in every view'.

### 4.5 Validate and decode each restored photo once, not twice

*Plan: c.2, C2 follow-up · partly done · small · web and Android*

- **Where it stands.** The fast decode loop is in (src/repository/validateGarden.ts:1097-1099, src/lib/imageImport.ts:350-353). But Settings' preview runs inspectImportedState (src/lib/backupPreview.ts:52 via SettingsView.tsx:570), and the restore runs it again (src/hooks/usePersistence.ts:431). Every photo in a backup is decoded on both passes. The fixer left this out to save first-load bytes, measured at about 0.3 s total on desktop.
- **What is left.** Decode the photos once per restore, or yield between photos, so a full field book does not freeze a slow phone twice.
- **How.** Let confirmRestore pass the preview's already-validated state into importGarden (an optional second argument), keeping the text path for other callers. Or make sightingPhotoOf lazy: count photos in the preview without decoding. Keep the change in a lazy chunk if first-load bytes are tight. Add a test that decode runs once per restore.
- **Done when.** A restore with 50 photos decodes each photo once, verified by a spy in the test. The preview and the restore both still work, and the first-load budget passes.
- **Source.** C2 review finding 16 (REAL, partly fixed); the C2 fixers' report


## 5. Hosting, tests, tooling and docs

### 5.1 Move the PWA to an origin of its own, with real security headers

*Plan: a.5 WP3-1 (S1, S2) · partly done · large · web · **needs a decision***

- **Where it stands.** Code-only parts are in: frame guard src/lib/hosting.ts + src/components/FramedNotice.tsx (wired at src/main.tsx:25-26); dormant carry-over src/components/MovedBanner.tsx, woken by VITE_MOVED_TO (src/lib/hosting.ts:22); cross-database restore test in src/repository/twoTabs.test.ts. Missing: the web build still targets the shared origin (vite.config.ts:12 WEB_BASE = '/The-Butterfly-Garden/'); the CSP is meta-only with no frame-ancestors (index.html:18-23); public/ holds no _headers or CNAME (only icons, privacy.html, reminders, screenshots); deploy is GitHub Pages (.github/workflows/deploy-pages.yml build job). The old address is hard-coded in src/lib/calendarReminder.ts:176 (REMINDER_FILES_ADDRESS), public/reminders/*.ics (DESCRIPTION/URL lines, generated by scripts/reminder-files.mjs), public/privacy.html:85 and docs/play-store/README.md:72 (Play privacy policy URL). Passkey creation sets no rp.id (src/lib/passkey.ts:106), so passkeys are bound to dionnedeh.github.io. docs/moving-the-garden.md (53 lines) never mentions the garden lock or passkeys, which C3 added after the carry-over flow was written.
- **What is left.** The owner chooses a domain and a host that can send headers (Cloudflare Pages or Netlify). Then: serve the app at '/' there with a _headers file (CSP including frame-ancestors 'none', X-Content-Type-Options: nosniff, Referrer-Policy: no-referrer, Permissions-Policy); add a deploy job for it; point every hard-coded address at the new one; plan the PWA id and scope so installed copies are not silently re-pointed to an empty origin; handle the garden lock across the move (passkeys must be added again; a locked garden's carry-over file must open at the new address with the passcode or recovery code); deploy the old address's final build with VITE_MOVED_TO and keep it up until old-origin visits are near zero. Code that can be done before the move: the dormant carry-over banner saves a plain backup even for a locked garden (src/components/MovedBanner.tsx:23-55 saves what exportGarden returns), so a locked garden's carry-over must go through a protected file, or the move code once 2.1 lands.
- **How.** 1) Put the base path behind an env var in vite.config.ts (e.g. VITE_BASE, default '/The-Butterfly-Garden/') so the GitHub Pages final build and the new-host build come from one config; add public/_headers (or host config) and a deploy job. 2) Make scripts/reminder-files.mjs and src/lib/calendarReminder.ts read one address constant, regenerate public/reminders/*.ics, update public/privacy.html and docs/play-store/README.md, and change the privacy URL in the Play Console. 3) Extend docs/moving-the-garden.md with lock and passkey steps; in MovedBanner, when a lock is on, say the copy opens with the passcode or recovery code and a passkey must be added again; consider an explicit rp.id in src/lib/passkey.ts. 4) Interim hardening before the move: add <meta name="referrer" content="no-referrer"> to index.html. 5) An e2e test that serves two builds on two ports (old with VITE_MOVED_TO, new with base '/'), makes a garden (one plain, one locked) on the old one, follows the banner and restores on the new one. Android: the Android build already leaves the move out and its storage is per-app, but privacy.html ships in dist-android and the Play listing URL changes, so run the Android checks.
- **Done when.** curl -I on the live new address shows CSP with frame-ancestors 'none', nosniff, Referrer-Policy and Permissions-Policy; a cross-origin frame of the new address is refused by the browser; the two-origin e2e test passes for a plain and a locked garden; reminder files and the privacy policy name the new address; the old address serves the VITE_MOVED_TO build; typecheck, lint, test, test:e2e and the Android Gradle checks are green.
- **Source.** Voyager a.4 S1/S2 (lines 191-192), a.5 WP3-1 (344-355, done-when 369-370), A2 log WP3 (1202-1213), the future-work note from #67, docs/moving-the-garden.md. Owner decision: code-only for now.

### 5.2 Make the Safari and Firefox job pass, then make it required

*Plan: a.5 WP7-1 (T2) · partly done · medium · web*

- **Where it stands.** .github/workflows/deploy-pages.yml:81 `continue-on-error: true`, and its comment at :73-77 still blames 'one shop test', which is out of date. On main (5d0a7ce, run 40581321758) the browsers job is red with 197 passed and 2 failed. Both failures are e2e/nature.spec.ts:61 (desktop-webkit and mobile-webkit), at nature.spec.ts:98, where getByText(/Saved to your field book/) never appears after a sighting is saved with a photo. Firefox passes in full. The status waits on the photo-save promise (src/components/GuideView.tsx:461-476), and when the photo is not stored the app shows PHOTO_NOT_KEPT instead (src/lib/sightings.ts:56). The C3-era timeouts listed in the future-work note from #67 (breathing, onboarding, comfort plan, jar) no longer fail on main.
- **What is left.** 1) Find out why WebKit never shows 'Saved to your field book' after a photo sighting: either the photo-save promise never settles, or the photo is refused. The leading suspect is WebKit's ephemeral context refusing Blobs in IndexedDB, which is also how Safari Private Browsing behaves. 2) Fix the app if real Safari is affected; otherwise fix the test. 3) Get three green browsers runs in a row. 4) Remove `continue-on-error`, rewrite the workflow comment, and have the owner add `browsers` to the required checks on main. 5) Update README.md:139-143 and this plan
- **How.** Download the failing run's report (`gh run download 40581321758 -n playwright-report-browsers` into a scratch dir) and open the nature.spec.ts:61 trace to see which text appeared. Then trace the save path: SightingForm → fieldBookActions(changeSightings).photoSaved → hooks/useMediaSaves.ts → the sightings put in repository/gardenRepository.ts. If WebKit rejects a Blob put, fall back to storing the photo's bytes (ArrayBuffer plus its type) and turn them back into a Blob on read. That fallback must go through validateGarden.ts and lib/sightingPhotos.ts, with backup invariant 6 unchanged. Add a unit test that uses a fake IndexedDB which rejects Blobs. Do not paper over it with a webkit-only skip.
- **Done when.** The browsers job is green on main three runs in a row with no continue-on-error, and it is required for merges. On a real iPhone, Safari (including Private Browsing) either keeps the sighting photo or says plainly that it could not. Android: the app is Chromium, so this job does not run its project. If photo storage changes, run the Android checks in CLAUDE.md, because e2e/android.spec.ts:401 logs a photo sighting in the app.
- **Source.** .github/workflows/deploy-pages.yml:72-81 (job marked advisory); the future-work note from #67 'The cross-browser e2e job'; Voyager A4 log lines 1362-1368

### 5.3 Fail the e2e run on moderate axe violations

*Plan: a.5 WP7-3 (A3) · partly done · small · web and Android*

- **Where it stands.** e2e/a11y.ts:7-11 and :20-27: moderate violations are only logged (test annotation plus ::warning); only serious and critical ones are returned. README.md:141-142 describes this as the current policy. On main's run 40581321758 the logs hold zero 'Accessibility (moderate)' warnings across the verify job (Chromium and android-webview) and the browsers job (WebKit and Firefox), so the backlog is clear.
- **What is left.** Return moderate violations as failures too (keep 'minor' as a warning), rename or re-document the helper, and update README.md:141-142 and the e2e row of docs/ARCHITECTURE.md.
- **How.** In e2e/a11y.ts, push `moderate` into the returned list next to serious and critical. Rename seriousViolations to blockingViolations across e2e/*.spec.ts (callers already do `expect(...).toEqual([])`), or keep the name and fix the doc comment. Check once by adding a duplicate unlabelled <main> locally and confirming a sweep fails.
- **Done when.** `npm run test:e2e` is green in desktop-chromium, mobile-chromium and android-webview, and a planted moderate violation fails a sweep. Android: e2e/android.spec.ts:261 uses the same helper, so the android-webview project must pass. No Gradle checks are needed.
- **Source.** Voyager a.5 WP7 step 3 (line 475); A4 log lines 1369-1374 ('Promoting moderate issues to failures waits for the Safari and Firefox runs to come back clean'); README.md:141-142

### 5.4 Commit a visual regression suite

*Plan: a.5 WP4 · not done · medium · web and Android*

- **Where it stands.** No toHaveScreenshot or toMatchSnapshot anywhere in e2e/ (grep). scripts/ holds only bundle-baseline.json, check-budgets.mjs, generate-android-icons.py, play-store-assets.mjs, pwa-assets.mjs, reminder-files.mjs and setup-android-sdk.sh, so the A2 computed-style differ is not in the repository.
- **What is left.** A repeatable check that every view in both themes, at desktop and Pixel 7 sizes, plus onboarding, renders the same before and after a CSS or sprite change. Needed before the CSS consolidation and useful to the art PR.
- **How.** Add e2e/visual.spec.ts: seed a fixed garden (reuse the fixtures in e2e/app.spec.ts), freeze the clock and Math.random, use reducedMotion 'reduce', visit each route from src/lib/routes.ts in light and dark, and call expect(page).toHaveScreenshot with a small maxDiffPixelRatio. Generate baselines on Linux Chromium in CI (snapshotPathTemplate per platform) and skip elsewhere. Alternative or complement: commit the computed-style differ as scripts/style-diff.mjs that dumps getComputedStyle for every element per state and compares with a stored JSON. Include a short set in the android-webview project; leave it out of the WebKit and Firefox projects.
- **Done when.** npm run test:e2e runs the suite on Chromium desktop, mobile and android-webview; a deliberate 1px change to a shared rule fails it; baselines are committed; CI green.
- **Source.** Voyager a.5 WP4 zero-loss guard (lines 402-405); A2 log (1177-1183), where a computed-style differ was used once across 34 states and not kept.

### 5.5 Budgets: a baseline per build, the planned caps, and a frame-time guard

*Plan: a.5 WP6-4 (T3) · partly done · medium · web and Android*

- **Where it stands.** scripts/check-budgets.mjs:22-28 caps entryJs at 100_000 and css at 25_000 bytes gzip (plan: entry 95 kB, and the CSS cap 'lowering it after WP4'). scripts/bundle-baseline.json still holds initial 146103 from A3, so the 10% growth limit is 160.7 kB; the C3 log records web first load 159.9 of 160.7 kB with the entry at 97.4 kB, and Android 160,652 of 160,713 B. Nothing measures frame time: no CDP, fps or Performance metrics in e2e/ (grep). The Android job runs the same caps (.github/workflows/android.yml:60-63).
- **What is left.** The entry chunk is above the plan's 95 kB; the CSS cap was never lowered after WP4; T3's frame-time regression guard does not exist; first-load headroom is under 1 kB on web and 61 B on Android, which the art PR and the three patches in docs/final-pr-plan/patches/ will need.
- **How.** 1) Find what the entry pulls in eagerly in both builds (inspect the build output or a source-map explorer) and lazy-load more, then set entryJs to 95_000. 2) Lower CAPS.css to the measured size plus about 10% once the CSS work lands. 3) Add e2e/perf.spec.ts for Chromium projects only: open the 12-butterfly garden fixture, set CDP Emulation.setCPUThrottlingRate 4, sample Performance.getMetrics LayoutCount over 4 s and assert it does not grow with frames (deterministic), with an optional loose fps floor from requestAnimationFrame sampling. 4) Decide with the owner whether to re-baseline scripts/bundle-baseline.json (npm run budgets -- --update) now that later PRs grew the first load on purpose. Check both dist and dist-android. For the baseline, keep one per build: `bundle-baseline.json` becomes `{ "web": n, "android": n }`, keyed by the `--dist` directory, and `--update` writes only the key it measured. Today one shared baseline makes the 10% growth cap cumulative and leaves Android 61 B. Re-baseline deliberately, with the reason in the commit, and add the budgets and knip to CLAUDE.md's list of checks.
- **Done when.** npm run budgets passes with a 95 kB entry cap and a lowered CSS cap for web and for check-budgets.mjs --dist dist-android; the perf spec fails if SpriteFrame layering is reverted (per-frame layouts return); CI and Android checks green.
- **Needs first.** 5.6 (for the CSS cap only)
- **Source.** Voyager a.4 T3 (line 233); a.5 WP6-4 (457-459); A3 log T3 (1297-1307); later budget figures in the C3 log (2240-2241).

### 5.6 Finish the CSS consolidation

*Plan: a.5 WP4-3 (P2, R3) · partly done · large · web and Android · **needs a decision***

- **Where it stands.** No @layer in any stylesheet (grep -c '@layer' src/*.css gives 0 for every file); order still comes from import order (src/App.tsx:2-5) and src/theme-aurora.css:11 says it is 'Imported AFTER App.css so the cascade lets these rules win'. !important count: App.css 9, theme-aurora.css 5, garden-3.css 1 (15; the plan counted 13). The three sheets are 4,254 + 930 + 1,450 = 6,634 lines (6,518 when planned). A2 cut built CSS 112.8 to 92.2 kB (-18%) against a 40% target; only 56 of 294 view-only rules moved, so about 238 remain global. Ten backdrop-filter declarations remain (theme-aurora.css x8, garden-3.css x1, components/lock/lock.css x1). C3's lock stylesheet adds four more `!important` (src/components/lock/lock.css), 19 in all under src/.
- **What is left.** Resolve the 1,953 computed-value conflicts A2 measured when the sheets were put into layers, so the order can be declared with @layer without visual change; remove the !important declarations; move the remaining view-only rules into per-view sheets loaded with each lazy view; delete dead rules found by a full coverage tour; reach at least 40% smaller CSS than the 110.8 kB baseline (about 66 kB raw), or the owner accepts the 18% reached.
- **How.** Land the visual regression suite first. Then view by view: create src/components/<view>/<view>.css imported by the lazy view module (Vite splits CSS with the chunk), move rules whose selectors only match inside that view, and re-run the suite. For layers: declare `@layer base, components, theme-aurora, garden-3, android;` once in src/index.css, wrap each sheet, and for every diff the suite reports rewrite or raise the losing rule rather than adding !important. Keep the CLAUDE.md layout invariants (sprite centred on its slot, row end reservation, FlowerSprite y=130 ground line). Coordinate with the art PR, which adds .garden-hero[data-season] and .hero-petals rules (the future-work note from #67): do this after it lands, or give it a layer of its own. Android: android.css and the WebView share the cascade, so run the android-webview e2e project and the Gradle checks.
- **Done when.** The visual suite shows no diffs at desktop and Pixel 7, both themes, every view and onboarding; no !important left in App.css, theme-aurora.css, garden-3.css; the layer order is declared once; built CSS is at least 40% under 110.8 kB raw or the owner records a lower target; npm run budgets passes for dist and dist-android; the existing 'gradient headings', 'guide glow' and 'flight stays full-sized' e2e tests pass.
- **Needs first.** 5.4
- **Source.** Voyager a.4 P2 (line 202) and R3 (223); a.5 WP4-3 (393-400), done-when (406-407); A2 log 'Not done, with reasons' (1186-1194); a.1 Performance and Architecture rows (90, 93).

### 5.7 Catch up the toolchain, and record the held major versions

*Plan: a.5 WP3-2 (S4) · partly done · small · web and Android*

- **Where it stands.** package-lock.json has vite 8.3.5 and vitest 4.1.12 (done) but @playwright/test and playwright at 1.63.0 (package.json ^1.63.0). typescript 6.0.3 (~6.0.2) and vite-plugin-pwa 1.3.0 are held as planned. Nothing in docs/ or .github/workflows/ schedules or records the quarterly review.
- **What is left.** Bump Playwright within 1.x to 1.64.1 or later; record the held majors and do the first quarterly review (about January 2027).
- **How.** npm i -D @playwright/test@^1.64 playwright@^1.64 (and @axe-core/playwright if needed). CI installs browsers itself; local containers follow the CLAUDE.md throwaway-config rule rather than npx playwright install. Add a 'Toolchain' section to docs/ARCHITECTURE.md listing the held majors and the reason for each (TypeScript 7's native compiler breaks type-aware lint; read Vitest 5 and vite-plugin-pwa 2 changelogs), or a scheduled workflow that opens an issue each quarter. The android-webview e2e project runs on the same Playwright, so run the full suite. Record the holds in `.github/dependabot.yml` as `ignore` entries for the semver-major updates of typescript, vitest and vite-plugin-pwa, each with its reason and a review date. The Gradle 9 deprecations are part of 7.6.
- **Done when.** Lock file at Playwright 1.64.1 or later; e2e green locally and in the browsers job; the review is written down with its next date.
- **Source.** Voyager a.5 WP3-2 (356-363): bump to Vite 8.3.5, Vitest 4.1.12, Playwright 1.64.1; hold TypeScript 7, Vitest 5, vite-plugin-pwa 2 and 'revisit each quarter'. A2 log S4 (1214-1222).

### 5.8 Make “check the support lines before each release” a failing check

*Plan: b.10 P10 · partly done · small · web and Android*

- **Where it stands.** The support page is done (src/components/SupportView.tsx; src/data/support.ts). src/data/support.ts:4-10 says each line 'must be checked again before each release' and records SUPPORT_CHECKED_ON = '2026-10-26', which the page shows (SupportView.tsx:111). Nothing enforces the re-check: no test or CI step compares that date with a release. Releases carry an optional releasedOn (src/data/releases.ts:28), and release-3-4 has none yet (releases.ts:41-55).
- **What is left.** A check that fails when a release is dated without a recent re-check of the numbers, plus a written release step.
- **How.** In src/data/releases.test.ts, find the newest release that has a releasedOn and expect SUPPORT_CHECKED_ON >= addDaysToLocalDate(releasedOn, -30). Dating a release then needs a fresh check. Also assert that every tel: and sms: href in supportLines matches the digits in its label. Add one line to the release steps in docs/play-store/README.md and in README.md: check each number on the service's own site, then update SUPPORT_CHECKED_ON.
- **Done when.** npm test fails when the newest dated release is more than 30 days after SUPPORT_CHECKED_ON, and passes once the date is updated. The release steps say so.
- **Source.** Voyager line 685 (b.10 P10: 'Re-verify every release'); B1 log lines 1434-1441

### 5.9 Bring the privacy policy and SECURITY.md up to 3.4

*Plan: docs · not done · small · web and Android*

- **Where it stands.** public/privacy.html:60 'Last updated 25 October 2026', which predates 3.1-3.4. :88-94 lists what is kept without sightings and their photos, the comfort plan (names and phone numbers of people the gardener may call), letters and starred lines, or the garden lock. :154-159 says the backup file 'is not encrypted', though protected backups (src/lib/sealedBackup.ts) and the sealed lock now exist. It also does not say that helpline, comfort-plan and nature-count links hand off to the dialer or another site, or that a calendar reminder hands an .ics file to the calendar app. SECURITY.md:5-23 and :39-46 say nothing about the lock or protected backups, nor that on the web every page under dionnedeh.github.io shares the garden's origin (docs/moving-the-garden.md:3-7).
- **What is left.** Update the policy text and re-date it. Add the lock, protected backups and the known same-origin limit to SECURITY.md. Re-check the Data safety answers in docs/play-store/README.md:101-116.
- **How.** Edit the 'What the app keeps', 'Backups' and 'What the developer collects' sections of public/privacy.html, keeping the 'Changes to this policy' promise. In SECURITY.md add a 'Garden lock and protected backups' paragraph and a scope note that the lock does not protect against code on the same web address until the origin move. The owner approves the wording before any Play submission.
- **Done when.** Every statement in the policy matches the code. e2e/android.spec.ts:244 (the policy opens in the app) and the axe sweeps pass. Android: privacy.html ships in dist-android, so run `npm run build:android && npx cap sync android` and the android-webview e2e; no Gradle change.
- **Source.** public/privacy.html (shown in both builds by src/components/PrivacyPolicyView.tsx:1-8); SECURITY.md; required by Google Play (docs/play-store/README.md:72-75)

### 5.10 Correct the docs that have drifted from the code

*Plan: docs · not done · small · web and Android*

- **Where it stands.** README.md:213-215 says 'schema 6, in IndexedDB version 6', but the code is at CURRENT_STATE_VERSION = 8 (src/repository/validateGarden.ts:59) and DATABASE_VERSION = 8 (src/repository/gardenRepository.ts:431). docs/handoff-p5-store-split.md:6 claims it was 'last checked 2026-10-26', yet :104 shows `DATABASE_VERSION = 6`, the :141-160 version table stops at 6/6, and the layout lacks the `sightings` store (DB 7, state 8) and the `lock` store (DB 8; see gardenRepository.ts:401-410 and :416-430). docs/ARCHITECTURE.md:30-31 points readers to that layout, and :124 names only e2e/app.spec.ts, though e2e/ also has breathe, comfort, lock, nature, protected, reminders, shell and year specs. deploy-pages.yml:73-77 blames 'one shop test'. docs/android-play-plan.md:3 still reads 'Status: in progress' and does not record phase 5.
- **What is left.** Update each passage to match the code.
- **How.** Edit docs only. Add the sightings and lock rows to the handoff's version table, plus SEALED_META_VERSION (src/repository/sealedStores.ts:50). In the README, say which builds cannot open what: before 3.3 a garden with the field book, before 3.4 a locked one, per the gardenRepository.ts:416-430 comment. List all e2e specs in the ARCHITECTURE tests table.
- **Done when.** A reader following any of these docs finds the numbers, stores and files the code has. No code changes.
- **Source.** README.md, docs/handoff-p5-store-split.md, docs/ARCHITECTURE.md, docs/android-play-plan.md, .github/workflows/deploy-pages.yml comment

### 5.11 Guide sections for what (c) added

*Plan: b.8 F3 and (c) · partly done · small · web and Android*

- **Where it stands.** src/components/GuideView.tsx:56-262 has sections for Sunlight (with one sentence on breathing), Moonlight, seeds, the life cycle (which covers growing alongside a goal), care, bond, currency, boutique, Pass, goals, companions, journal, calendar, jars, flight, sound, offline and privacy. None covers Marigold's letter, the garden's year and postcard, the field book, the comfort plan, calendar reminders, the garden lock or protected backups. The privacy section (:250-262) does not mention the lock.
- **What is left.** Add short, plain Guide sections, or extend existing ones, for these features. Add sections for c.6 and c.7 when those patches land.
- **How.** Add entries to guideSections in GuideView.tsx: 'Letters and your year' (letter timing, stars, the quote setting, the postcard leaving only by a tap), 'Seen in the wild' (the field book, photos and limits, no location read), 'Your comfort plan' (private, never quoted, not a clinical plan), 'Reminders in your calendar', and 'Locking your garden and protected backups' (the recovery code, what the lock does not do, Android differences via isAndroidApp()). Keep the copy free of claims. Update GuideView tests and the contents list.
- **Done when.** Each feature has a Guide section reachable from the contents. The Android build shows the Android wording. The axe and GuideView tests pass.
- **Source.** the C1 builder's report 'No Guide section about letters'; the same gap for the other C features

### 5.12 Raise the coverage floors (optional)

*Plan: a.5 WP7-2, optional · partly done · small · web and Android*

- **Where it stands.** vite.config.ts:214 `thresholds: { lines: 85, statements: 84, functions: 80, branches: 78 }`. Main's CI (run 40581321758, Unit tests step) reports Statements 95.2%, Branches 91.88%, Functions 93.63%, Lines 96.42%. The floors are now 11-14 points below, so they no longer make new code arrive with its tests.
- **What is left.** Not a plan leftover: WP7-2 asked for lines ≥ 80% and branches ≥ 70%, which are met and exceeded. Optional: Raise the four thresholds to about 2 points under the current figures.
- **How.** Set `thresholds: { lines: 94, statements: 93, functions: 91, branches: 89 }` in vite.config.ts and keep the comment. Do this before applying the three patches in docs/final-pr-plan/patches/, so they are held to the new floor; they arrive with their own tests.
- **Done when.** `npm test` passes on main with the new floors and the CI verify job is green. A change that adds untested code drops a figure under its floor and fails.
- **Source.** vite.config.ts:205-214 (comment: floors 'sit a little under what the suite reaches'); Voyager A4 log lines 1323-1326


## 6. Smaller gaps in shipped features

Each is small and self-contained. The ones marked as needing a decision should be put to the owner first.

### 6.1 One day boundary: Sunlight and goals turn at the gardener’s late-night hour

*Plan: b.3 M4 · partly done · large · web and Android · **needs a decision***

- **Where it stands.** Done: Settings → Your rhythm sets Profile.recapOpensHour and recapGraceEndsHour (src/components/SettingsView.tsx:856-901; src/types.ts:205-210), and the recap window reads them (src/lib/date.ts:130-181, recapHoursOf and recapWindow). Not done: everything else still turns at midnight. src/lib/date.ts:3-8 (toLocalDate) is the calendar day. It keys Sunlight and its daily cap of 5 (src/lib/progression.ts:303-305, awardSunlight), goal completions (src/lib/gardenActions.ts:263, completeGoal), check-ins (:304, saveMood), reflections (:342, saveReflection), breathing Sunlight (:385) and the earlier-day bound (:409, :436). It also keys lifecycle care days (src/lib/lifecycle.ts:216, 290), Today's date (src/hooks/useLocalDate.ts:12-16), the header count (src/App.tsx:547) and the gentle day, which ends at midnight (src/components/TodayView.tsx:292-293). So at 01:30 the recap is still closing yesterday while a check-in or Sunlight is written to today.
- **What is left.** Decide between (A) forward-only, where 'today' becomes the garden day and stored rows keep the date they were written under, with no migration, and (B) re-dating stored rows with a migration. Then apply one boundary to Sunlight (5 a day), goals and completions, the gentle day, care days, breathing once a day (`breath:<date>`), written-later entries, rhythm counts and the Guide/Settings wording.
- **How.** For (A), add `gardenDay(now, profile)` in lib/date.ts, returning the previous calendar date before recapGraceEndsHour. Use it in hooks/useLocalDate.ts and its midnight tick, and wherever useGardenState/App derive `today`. Leave validateGarden and the backup format unchanged (invariant 6). Add DST-aware tests under the pinned TZ America/New_York: at 01:00 with grace at 04:00 a completion counts for yesterday; a grace of 00:00 leaves behaviour as today; changing the hour mid-night re-dates nothing.
- **Done when.** With grace at 04:00, a goal done at 01:00 shows on the previous day in Today, the Journal, the Sunlight cap and the rhythm. All existing tests pass with grace at midnight, and backup files keep the same shape. Android: no native change; the e2e suite covers both builds.
- **Source.** Voyager b.3 M4 (line 607); B2 log lines 1504-1514 ('Not done'); the future-work note from #67 'The rest of M4'

### 6.2 A small “Draft kept” hint beside writing kept as a draft

*Plan: b.2 T10 · partly done · small · web and Android*

- **Where it stands.** Drafts survive page changes and reloads: src/lib/drafts.ts:1-149. They are used for the check-in note and the reflection (src/components/TodayView.tsx:179-206), the recap answers (src/components/MoonlightRecap.tsx:107-118) and earlier-day entries (src/components/journal/EarlierEntry.tsx:64-66). No hint exists: grep for 'Draft kept' in src finds nothing. useDraft (drafts.ts:132-149) returns only [value, set], so a view cannot tell a kept draft from saved text.
- **What is left.** The visible 'Draft kept' hint, shown only when the draft has actually reached storage.
- **How.** In src/lib/drafts.ts, keep a `written` snapshot. Update it when gardenRepository.writeDrafts resolves (in scheduleWrite and in flushDrafts) and when loadDrafts reads. Add useDraftKept(key): boolean, true when drafts[key] exists and equals the written value. That way the hint never claims a draft that a failed write or the garden lock kept from storage. Add a small DraftKept component: <small className="draft-kept">Draft kept</small>, linked to its field with aria-describedby. Do not make it a live region, so it does not chatter while the gardener types. Show it under the mood note, the reflection, each recap answer and the earlier-day note and body whenever the field differs from the saved entry. Style it in both themes with AA contrast. Tests: drafts.test.ts (kept only after the write resolves; cleared by clearDraft and resetDrafts), TodayView.test.tsx and MoonlightRecap.test.tsx (the hint appears after typing and the 600 ms delay, and goes after saving), and an e2e step in e2e/app.spec.ts: type a reflection, reload, and see the words and the hint. Android: nothing platform-specific.
- **Done when.** After typing in any of those fields and pausing, 'Draft kept' shows under the field. After a reload, the words and the hint are both back. Saving the entry removes the hint. A rejected draft write shows no hint. Nothing is announced while typing. The axe sweeps are clean in both themes.
- **Source.** Voyager line 593 (b.2 T10: '...Show a small "Draft kept" hint'); B1 log line 1400 says T10 was done in A1, but A1's log (line 1145, D12) covers only the drafts

### 6.3 A gentle day also hides the header’s Sunlight count and the backup badge

*Plan: b.2 T7 · partly done · small · web and Android*

- **Where it stands.** Today hides its own counts on a gentle day: src/components/TodayView.tsx:292-293 (gentle), :406-410 (the meter says 'Rest counts too') and :579-583 (the goal count badge). The app header does not. src/App.tsx:667-671 always renders '{sunlight} / {DAILY_SUNLIGHT_CAP}', which P2 keeps visible on phones. The backup badge on Settings and More is added whatever the day (src/App.tsx:218-247; src/components/Navigation.tsx:19-45, 74-95). There is no gentle-day rule in any stylesheet (grep for 'gentle' in the CSS finds only .gentle-toggle and .gentle-note).
- **What is left.** While profile.gentleDay === today: show the header's Sunlight pill without its number, and hold back the navigation badge until the next day.
- **How.** In App.tsx, compute gentle = state.profile?.gentleDay === today, using the date App already keeps fresh. Header: render the sun icon with an sr-only 'Sunlight' and without 'x / 5' while gentle. Keep the element, so the header does not jump on a 360 px phone; check it against the P2 narrow-header CSS and the Larger/Largest text sizes. Badge: build navItems from backupDue && !gentle (App.tsx:218-247). The note inside Settings can stay, since the gardener chose to go there. Tests: App.test.tsx (on a gentle day the header has no '/ 5' and Settings has no badge; an ordinary day is unchanged), plus one step in the e2e mobile project. Android: the Android build uses the same header, so the android-webview e2e run covers it.
- **Done when.** On a gentle day no Sunlight number shows anywhere on screen, and Settings and More carry no backup mark. Both return the next day. Ordinary days are unchanged, and the existing header layout e2e checks still pass.
- **Source.** Voyager line 590 (b.2 T7: a gentle day 'hides counts and badges'); B2 log lines 1473-1481

### 6.4 “What does this do?” links from Nectar, Stardust, seeds and plant growth

*Plan: b.8 F3 · partly done · small · web and Android*

- **Where it stands.** Guide contents, search and return are done (src/components/GuideView.tsx:405-433; src/components/GuideLink.tsx; src/App.tsx:584-589 openGuideAt). GuideLinks exist only at src/components/TodayView.tsx:420 (Sunlight), src/components/CareView.tsx:360 (bond), src/components/MoonlightRecap.tsx:235, src/components/SettingsView.tsx:899 and :943, and src/components/RegionSetting.tsx:49. These have none: the Shop's Nectar and Stardust wallet (src/components/ShopView.tsx:335-345), the garden's seeds count (src/components/GardenView.tsx:499-504), and a plant's growth and care remaining (src/components/garden/PlantPanel.tsx:60-76). The Guide sections they need already exist: 'seeds' (GuideView.tsx:84) and 'nectar-and-stardust' (GuideView.tsx:132). GardenView only has a plain onOpenGuide with no section (GardenView.tsx:493-497).
- **What is left.** Links for Nectar and Stardust, seeds and plant growth, with Back returning to the same Shop tab or the same open plant.
- **How.** Add <GuideLink section="nectar-and-stardust"> beside the Shop wallet, and <GuideLink section="seeds"> under the garden's resources and in PlantPanel's growth rows. Pass openGuideAt to ShopView, GardenView and PlantPanel. For the way back (routes.ts returnFrom, then PutBack at App.tsx:1117), extend LinkPlace in src/lib/routes.ts with shopTab?: ShopTab and plantId?: string. ShopView then reopens on that tab through initialTab, and GardenView reopens that plant's panel. Leave the header pills (App.tsx:667-679) without links: there is no room on a 360 px phone (P2). Tests: ShopView.test.tsx and GardenView.test.tsx (the links render), App.guideReturn.test.tsx (Shop and garden returns, focus back on the link, tab or plant restored), and one Back trip in e2e/app.spec.ts. Android: the back gesture uses the same returnFrom path (src/lib/backNavigation.ts:23), so add an e2e/android.spec.ts step: Shop → Guide → back lands on the same tab.
- **Done when.** The Shop wallet, the garden's seeds and the plant panel each link to the right Guide section. 'Back to …' and Android's back gesture return to the same Shop tab or the same open plant, with focus on the link that was pressed. The existing Guide-return tests still pass.
- **Source.** Voyager line 660 (b.8 F3: 'a "what does this do?" link from every currency and meter'); B7 log lines 1921-1925 (links only from the Sunlight meter, bond meter, recap and Settings)

### 6.5 Guide search says when nothing matches

*Plan: b.8 F3 · partly done · small · web and Android*

- **Where it stands.** Fixed: the status line stays in the accessibility tree while empty (src/components/guide/guide.css:70-72 sets margin: 0 instead of display: none). Left: src/components/GuideView.tsx:427-433 says 'No section matches. The butterflies below may.' whenever no section matches, even when SpeciesDirectory's own status says '0 species shown' (src/components/SpeciesDirectory.tsx:105).
- **What is left.** Word the line from both counts.
- **How.** Compute the species match count in GuideView with the filter SpeciesDirectory uses, or have SpeciesDirectory report it through a callback. Then say 'N sections match.', 'No section matches; N butterflies below do.', or 'Nothing in the Guide matches.' Keep it to the one role=status line. Add tests for all three cases in GuideView.test.tsx.
- **Done when.** A word that matches nothing says 'Nothing in the Guide matches.' A word that matches only species says so, with the count. There is still exactly one polite status line.
- **Source.** B7 review, finding 8 (judged real); the live-region half was fixed in B7 (log line 1975)

### 6.6 The browser’s own Back returns to the same place

*Plan: b.8 F3 · partly done · medium · web*

- **Where it stands.** The in-page Back and Android back use returnFrom (src/lib/routes.ts:146-150) and navigate forward with `restore`. The browser's Back does not. navigate (src/App.tsx:257-266) pushes every address with pushState(null, ...). The popstate handler (App.tsx:295-301) scrolls to the top and rebuilds the route from the hash alone. companionId, fromPlace and restore are documented as 'Not part of the address' (routes.ts:73-100). So browser Back from a Guide link opened on Care shows the first companion, at the top of the page, with focus nowhere, and #/recap is read as Today (routes.ts:130-131).
- **What is left.** Make the browser's Back and Forward restore what the in-page Back already restores: the page that was left, the same companion on Care, the scroll position, focus on the link that was pressed, and the recap for the same evening.
- **How.** In App.tsx navigate, keep the parts of the route that are not in the address in history.state: from, fromPlace, companionId, the restore target, and the recap's target evening (recapOpenedFor). In the popstate handler, use event.state when it is present, fall back to routeFromHash only without it, and skip the scroll to the top when restoring. Leave Android's back ladder alone: it replaces the address (App.tsx:310, 391). Tests: an App-level test that calls history.back() after a Guide link from Care and from Settings, and an e2e test in e2e/app.spec.ts using page.goBack(). Run e2e/android.spec.ts as well, because App.tsx is shared. This can be done together with b.10 P3 (deeper routes), which touches the same code.
- **Done when.** After the Guide is opened from Care's bond-meter link, page.goBack() shows the same companion, scrolled where it was, with focus on that link. After the recap's Moonlight link, it returns to the recap for that evening. A reload behaves as it does now. The back-gesture tests in android.spec.ts pass.
- **Source.** The B7 Guide builder's report ('Not finished ... Web browser Back from the Guide to the recap lands on Today'). The B7 log F3 (Voyager 1919-1925) and the C1/C2 logs say Back returns 'scrolled where it was and with focus on that link'. That holds only for the in-page Back button and Android's back gesture.

### 6.7 Deeper addresses: a journal day and a shop tab

*Plan: b.10 P3 · partly done · medium · web and Android*

- **Where it stands.** Done: page routes (A3) and the manifest's id, categories, shortcuts, screenshots and separate icons (src/pwaManifest.ts:16-130). Not done: routeFromHash (src/lib/routes.ts:127-137) parses only shop/pass, today/check-in, guide/<section> and year/<yyyy>. The plan's examples, #/journal/2026-10-26 and #/shop/boutique, are unknown hashes and open the garden. The parts to hook into exist: JournalView's openDay (src/components/JournalView.tsx:181-193) and ShopView's initialTab (src/components/ShopView.tsx:49-56, 68, 84). App passes only 'pass' to initialTab (src/App.tsx:256, 922).
- **What is left.** Read and write #/journal/YYYY-MM-DD and #/shop/<tab>, open that day or tab, and keep the address in step with what is shown.
- **How.** In src/lib/routes.ts, Route gains journalDay?: string and shopTab?: ShopTab. routeFromHash matches /^journal\/(\d{4}-\d{2}-\d{2})$/ (checked with isLocalDate, src/lib/date.ts:66) and /^shop\/(supplies|boutique|jars|flight|backdrops|pass)$/. Keep 'shop/pass' working for old links and the shortcut. hashForRoute writes both forms. App.tsx passes route.journalDay to JournalView, which calls openDay once on mount; a day with no entry opens the Journal at the top. It passes route.shopTab to ShopView as initialTab. Changing tab, or opening a day from the calendar, updates the address with history.replaceState, so Back still walks pages, not tabs. Android: A3's back ladder replaces the address rather than walking history, so backAction (src/lib/backNavigation.ts:23) treats these as their page and goes to the garden. Tests: routes.test.ts (round trips; 2026-02-30 and unknown tabs rejected), App.test.tsx (deep links), e2e/app.spec.ts (reload on #/journal/<a day with an entry> and #/shop/jars), and e2e/android.spec.ts (back from #/shop/jars).
- **Done when.** #/journal/<a day with an entry> opens the Journal with that day in the timeline and focus on its date. #/shop/boutique opens the Boutique. Both survive a reload. A bad date or tab falls back the way unknown hashes do today and is tidied from the address. Changing tabs adds no history entries. Android back from either page goes to the garden. The manifest is unchanged.
- **Source.** Voyager line 678 (b.10 P3: 'Real URLs (#/today, #/journal/2026-10-26, #/shop/boutique)'); A3 log lines 1256-1267; B4 log lines 1660-1667

### 6.8 The year’s longest run of cared-for days

*Plan: c.4 · partly done · small · web and Android*

- **Where it stands.** The GardenYear facts and yearInWords in src/lib/gardenYear.ts:59-80 and :171-213 have checkIns, reflections, evenings, daysCaredFor, speciesWelcomed and emerged, but no longest run. careRhythm already computes `longestRun` (src/lib/rhythm.ts:20, :34-44), which the Journal shows (src/components/JournalView.tsx:367-368). grep finds no 'longest' in YearView, components/year or gardenYear.
- **What is left.** Add the longest run of cared-for days within the year to the year page. Say it in words, and hide it when Settings hides day counts.
- **How.** In lib/gardenYear.ts, compute the longest run over Sunlight award dates inside yearRange(year, today), reusing the run logic from lib/rhythm.ts (export a `longestRunIn(days)` helper). Add `longestRun` to GardenYear and a sentence in yearInWords, such as 'Your longest run of days cared for was N days', only when numbers are shown and the run is more than 1. Never phrase it as a broken streak. Add tests in gardenYear.test.ts and a YearView test.
- **Done when.** For a year with a 5-day run, the page says so. With day counts hidden, it says nothing about runs. A quiet year is unchanged. The unit tests and the existing year e2e pass.
- **Source.** Voyager c.4 'Your garden's year' lists 'the weather calendar, species welcomed, favourite prompt answers, longest rhythm' (lines 836-838)

### 6.9 Comfort plan: phone help text, more trunk prefixes, and focus

*Plan: c.8 · not done · small · web and Android*

- **Where it stands.** src/lib/comfortPlanEdits.ts:132 still says 'A phone number can hold digits, a plus sign, spaces and dashes.' But brackets and dots are accepted and kept (comfortPlan.ts:43). telHref (comfortPlanEdits.ts:145-148) only removes a bracketed 0 directly after '+cc', so '0044 (0)7700 900123' dials tel:004407700900123 and '+44 (020) 7946 0018' dials tel:+4402079460018. In src/App.tsx:279-293, openSupport from a plan that support opened calls setView('support'), so the support page opens at the top with focus on <body>.
- **What is left.** Fix the help text. Decide and handle the '00cc (0)' and '+cc (0nn)' forms without breaking Italy's '+39 (06)…'. Return to the support page with its place and focus.
- **How.** Update the message at comfortPlanEdits.ts:132 to list brackets and dots. In telHref, also accept a leading '00' as the international prefix, and strip a leading 0 inside brackets right after the country code only for codes known to use a trunk 0 (e.g. 44, 49, 33, 61, 64, 353), keeping 39. In App.tsx's openSupport loop case, navigate with `returnFrom` / `restore` so putBackAt focuses the plan link (lib/backNavigation.ts:97-98). Add tests in comfortPlanEdits.test.ts and App.comfort.test.tsx.
- **Done when.** The help text matches what is accepted. The listed forms dial correctly and the Italian form is unchanged. Going support → plan → 'If you need support now' returns to the support page at the plan link with focus on it.
- **Source.** The C2 fixers' report (low gaps left after review findings 4/5/6/12/21)

### 6.10 Sightings: a future-dated sighting, and a conflict’s message

*Plan: c.2 · not done · small · web and Android*

- **Where it stands.** src/lib/sightings.ts:107 refuses any edit whose date is after today, so a sighting kept from a reset clock cannot be edited until the clock is right, and nothing says why. When a cross-tab conflict reloads, applyLoadResult in src/hooks/usePersistence.ts:99-105 settles every photo wait as failed. FieldBook then shows PHOTO_NOT_KEPT (src/lib/sightings.ts:56; FieldBook.tsx:79), although the whole sighting was discarded.
- **What is left.** Allow editing the note of a stored future-dated sighting, or explain why it cannot be edited. Say 'The garden changed in another tab, so this sighting was not saved' when a conflict drops the whole sighting.
- **How.** In sightingProblem, allow an unchanged stored date when editing; refuse only a new date after today. Give photoSaved a reason ('conflict' or 'storage') so FieldBook and GuideView can choose the message. Add unit and component tests.
- **Done when.** Editing the note of a sighting dated ahead of the clock saves without changing its date. A conflict that drops a new sighting shows the conflict message, not the photo one.
- **Source.** the future-work note from #67; the C2 fixers' report

### 6.11 Android: add the reminder through the calendar’s own screen

*Plan: c.9 · partly done · medium · Android app*

- **Where it stands.** src/components/ReminderSetting.tsx:62 and :98 (`link: android ? undefined : appAddress()`): the Android app saves the .ics through its save screen, and the event has no link back. android/app/src/main has no CalendarContract or ACTION_INSERT; the only ACTION_VIEW is in billing/GardenBillingPlugin.java:245. The builder notes Google Calendar may not import an .ics opened from Files.
- **What is left.** In the Android app, open the device calendar's new-event screen with the daily recurring event filled in, and keep saving the .ics as a fallback.
- **How.** Add a `addDailyEvent({ title, hour, minute })` method to the app's native files plugin (android/app/src/main/java/io/github/dionnedeh/butterflygarden/), or a small new plugin. It starts `Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI)` with EXTRA_EVENT_BEGIN_TIME (next occurrence), EXTRA_EVENT_END_TIME, Events.TITLE 'Garden time 🦋', Events.RRULE 'FREQ=DAILY' and Events.DESCRIPTION, with no calendar permission. Fall back to the .ics save if no activity resolves. Wire it in src/lib/native.ts and ReminderSetting.tsx behind VITE_PLATFORM === 'android'. Add a JVM unit test of the intent extras. Update e2e/android.spec.ts (web fallback path) and run `npm run build:android`, `npx cap sync android`, and Gradle lintRelease, testReleaseUnitTest, assembleDebug and bundleRelease.
- **Done when.** On an Android phone with Google Calendar, tapping the button opens a filled daily event at the chosen time. With no calendar app, the .ics is saved as now. Nothing from the journal is in the event. Gradle and android-webview e2e pass.
- **Source.** Voyager c.9 (lines 1018-1048); the C1 builder's report 'Not finished: Android calendars'

### 6.12 Sightings in search, exports, the letter and the year

*Plan: c.2 · not done · medium · web and Android · **needs a decision***

- **Where it stands.** lib/journalSearch.ts, lib/journalExport.ts, lib/summaries.ts (letter) and lib/gardenYear.ts do not mention sightings; the only lib files that do are sightings/photos/backup helpers. Nectar plants can be logged (src/lib/sightingChoices.ts:66 lists all `plants`), but the Guide's SpeciesDirectory stamps butterflies and their host plants only (src/components/SpeciesDirectory.tsx:20-45).
- **What is left.** Decide which of these the gardener should get. Then let the journal search find sightings by name and note, put sightings in the Markdown and printable exports, mention the week's sightings in the letter and the year's in the year page (descriptive only), and give nectar plants a card that can carry the stamp.
- **How.** Add 'sightings' to lib/journalSearch.ts's kinds (components/JournalSearch.tsx filter). Add a 'Seen in the wild' section in lib/journalExport.ts (photos left out of text exports). In lib/summaries.ts add `sightingsIn(range)` for the letter and gardenYear, with words only and no counts where Settings hides numbers. Add a nectar-plant list in the Guide with the SeenInTheWild stamp. Write tests for each module.
- **Done when.** The owner's choice is recorded. If built, a sighting note can be found by search and appears in the exports. The letter and the year name what was seen without scoring it. A logged nectar plant shows its stamp in the Guide.
- **Source.** the C2 builder's report 'Not done' (C2 nature builder)

### 6.13 An optional once-a-day nature prompt

*Plan: c.2 · partly done · small · web and Android · **needs a decision***

- **Where it stands.** The question exists only as one of 64 reflection prompts (src/data/prompts.ts:85-86, nature-three and nature-noticed). The day's prompt is chosen by rotation (src/lib/prompts.ts:20-23), so it comes up about 2 days in 64, or by pressing 'Another prompt'. There is no setting or daily offer for it.
- **What is left.** Decide whether the reflection-family rotation is enough. If not, add an opt-in daily nature prompt.
- **How.** Add an optional `Profile.natureDaily?: true`, kept through validateGarden with no version change. Add a Settings switch near the region and field book settings: 'Ask me each day what I noticed in nature'. When it is on, Today's reflection card offers the 'nature-noticed' prompt as the day's prompt, or a small line under it, once per day and dismissable. It also links to 'Log a sighting'. No streaks and no reminders. Add tests in lib/prompts.test.ts and TodayView.
- **Done when.** Owner's decision recorded. If built: with the switch on, the nature question is offered every day and answering it saves a normal reflection. With it off, nothing changes. A backup round-trips the setting.
- **Source.** Voyager c.2 What: 'Once a day, an optional prompt asks: What did you notice in nature today?' (lines 764-766)

### 6.14 Choose who paces the breath

*Plan: c.1 · partly done · small · web and Android · **needs a decision***

- **Where it stands.** src/lib/breathing.ts:24-30: pacerFor picks automatically. It is the active companion if it is a butterfly, otherwise Marigold. BreathingView has no choice of pacer.
- **What is left.** If the owner reads the plan as a choice, add a small choice on the breathing page's settings card between the active butterfly and Marigold.
- **How.** In components/BreathingView.tsx's settings card, add a two-option radio, shown only when the active companion is a butterfly. Keep it in the existing on-device choices draft (nothing new is stored, as the C1 log promises). pacerFor takes the choice. Add tests in breathing.test.ts and BreathingView tests.
- **Done when.** With a butterfly companion, the gardener can choose Marigold, and the wings and heading follow the choice. Without one, Marigold is used as now.
- **Source.** Voyager c.1 Experience 'The gardener picks their active companion, or Marigold, as the pacer' (lines 739-740)


## 7. Android and the Google Play release

### 7.1 The Google Play release

*Plan: Android plan, phases 4-7 · partly done · large · Android app · **needs a decision***

- **Where it stands.** android/app/src/main/res/values/garden_pass.xml:10 holds an empty licence key, so the Pass is never granted. docs/android-play-plan.md:3 says 'in progress'; :131-133 has phase 5 'Release candidate' with nothing recorded; :144-155 lists open owner items (Play Console account and closed test, upload key secrets, price/plans/trial, whether the PWA keeps the free Pass preview, audience 13+). The listing text in docs/play-store/README.md:27-63 omits breathing, the weekly letter, the year and postcard, the comfort plan, the field book, the lock and protected backups, and calendar reminders. docs/play-store/screenshots/*.jpg were last made in baa5031 (2026-10-25), before the five-tab dock and every C feature. The preview switch exists (src/lib/gardenPass.ts:90-94, VITE_GARDEN_PASS_PREVIEW=off), but the build step in deploy-pages.yml does not set it.
- **What is left.** Owner: Play Console steps 1-8 in docs/play-store/README.md:141-182, paste the licence key, create `garden_pass` (monthly and yearly), run the closed test, and decide the PWA preview and audience. Engineer: refresh the listing text, regenerate the Play screenshots (and the PWA install screenshots), set the preview flag if it is turned off, and update android-play-plan.md's status.
- **How.** Regenerate the assets with `npm run build:android`, then `npx vite preview --mode android --host 127.0.0.1 --port 4174 &`, then `node scripts/play-store-assets.mjs` (with CHROMIUM_PATH set), and `node scripts/pwa-assets.mjs` for public/screenshots. If the preview goes off, add `env: VITE_GARDEN_PASS_PREVIEW: 'off'` to the deploy-pages.yml 'Build' step. The licence key is public and may be committed; never commit a keystore.
- **Done when.** A signed AAB from android.yml's release job is in internal testing, a licence tester can subscribe, cancel and see the account-hold path, and the listing and screenshots match the app. Android: any change to garden_pass.xml needs the full Android checks (`./gradlew lintRelease testReleaseUnitTest assembleDebug bundleRelease`).
- **Needs first.** 5.9, 7.2
- **Source.** docs/android-play-plan.md sections 4, 5 and 7; docs/play-store/README.md 'Release steps' and listing

### 7.2 Real-device checks for 3.1–3.4, on Android and iPhone

*Plan: Play device checklist · partly done · small · web and Android*

- **Where it stands.** Every box in docs/play-store/README.md:189-219 is unchecked, and the list covers only 3.0-era behaviour (launch, edges, back, keyboard, backup/restore, backdrop, sound, airplane mode, notices, Pass). e2e/android.spec.ts:328-622 tests breathing, the comfort plan, calendar reminders, photo sightings, the postcard, the lock screen, auto-lock and protected backups, but only in a phone-sized Chromium where Capacitor's plugins fall back to their web versions (CLAUDE.md). There is no iPhone PWA checklist anywhere.
- **What is left.** Add entries for the new features, run the list on a recent and an older Android phone, and add and run a short iPhone PWA list. The checks the logs and reports left open must be on it. On iPhone: offline relaunch from the Home Screen and full motion; Share backup with many photos within the tap's time limit; the static `.ics` reminder link opening Calendar; passkey unlock with Face ID or Touch ID; the Home Screen card. On Android: cancelling the photo picker keeps the sighting form and the backdrop editor open; the calendar reminder in Google Calendar (c.9 asked for real-device tests before announcing reminders).
- **How.** Android entries: the lock (turn on, lock now, auto-lock after backgrounding, unlock by passcode and recovery code, status-bar colours on the lock screen, back gesture leaves the app); protected backup save and restore through Android's save screen; the reminder .ics opening in Google Calendar; sighting photo from camera and gallery with location stripped; cancelling the photo picker keeps the form; the postcard saved through GardenFilesPlugin.saveBinaryDocument appearing in Files or Photos; tel: links on the support page and comfort plan opening the dialer; nature-count links opening the browser; the breathing tone. iPhone PWA entries: the Home Screen guide, public/reminders/*.ics opening Calendar, passkey with Face ID, and a photo sighting.
- **Done when.** The checklist is updated and the owner's run is recorded with device models and OS versions; each failure becomes its own fix.
- **Source.** docs/play-store/README.md:184-219 'Device test checklist'; the future-work note from #67 (file chooser 'not yet checked in a real browser'; passkey on real devices)

### 7.3 Describe a suspended Garden Pass as on hold or paused

*Plan: a.9 · not done · small · Android app · **needs a decision***

- **Where it stands.** Native code includes suspended subscriptions (android/app/src/main/java/io/github/dionnedeh/butterflygarden/billing/GardenBillingPlugin.java:299-302, 319) and maps them to SUSPENDED (PassEntitlement.java:94, 101). Play reports both account hold and a pause chosen by the gardener this way. The web copy always blames payment: src/components/SettingsView.tsx:77-78 and src/components/shop/GardenPassPanel.tsx:115-116 and 153-158.
- **What is left.** Copy that is true for both cases, with a way to fix either.
- **How.** The app has no server, so Play's per-state detail (subscriptionsv2) is not available on the device. Change both places to neutral copy, for example 'Your Garden Pass is on hold or paused in Google Play. Open your Google Play subscriptions to resume it or update your payment.', with a button calling manage() from src/lib/playBilling.ts. Update the expectations in SettingsView.android.test.tsx, ShopView.pass.test.tsx, CareView.pass.test.tsx and e2e/android.spec.ts if they assert the text. This sits behind isAndroidApp(), so run the Android checks.
- **Done when.** Both places show the neutral copy and the manage button; tests updated; npm checks and Android Gradle checks green.
- **Source.** Voyager a.9 first bullet (lines 521-522), parked as Android-only.

### 7.4 Keep Pass outfits and scenes on screen while a subscriber’s app starts

*Plan: a.9 · not done · medium · Android app · **needs a decision***

- **Where it stands.** src/lib/passEntitlement.ts:19-21 starts every launch at 'checking', and access needs state 'active' (src/lib/gardenPass.ts:81). trackPassStatus (passEntitlement.ts:56-60) asks native, whose getStatus waits for checkStatus to connect to Play and query purchases (GardenBillingPlugin.java:146-158, 291 onward). Native already keeps verifiedActiveAt and an offline allowance (PassEntitlement.java:60-77 and the offline/trustedNow logic after it), but nothing hands that to the web layer before Play answers.
- **What is left.** A provisional answer from the last verified state at launch, replaced as soon as Play answers.
- **How.** Native: add getCachedStatus, or let getStatus({ask:false}) resolve at once with the offline-allowance decision (fromCache true) and then emit statusChanged when Play answers. Web: trackPassStatus seeds from that first. Never seed from AppState, localStorage or a backup (a.7: a backup can never grant paid access). Add a JVM test in the PassEntitlement tests for the provisional decision (expiry, clock turned back through trustedNow) and a web unit test that outfits stay while Play is slow and go if Play says inactive. Run the Android checks.
- **Done when.** On a cold start with a verified Pass and Play slow or unreachable, outfits and scenes show from the first frame; an ended Pass still closes once Play answers; JVM and unit tests added; Gradle lint, tests and builds green.
- **Source.** Voyager a.9 second bullet (lines 523-524), parked as Android-only.

### 7.5 Set Capacitor’s `minWebViewVersion` and add an error page

*Plan: a.9 · not done · small · Android app · **needs a decision***

- **Where it stands.** capacitor.config.ts:18-21 sets only allowMixedContent under android and has no server.errorPath, so Capacitor's default minimum (60) applies. The bundle uses Vite 8's default target (baseline widely available, Chrome 111); vite.config.ts:69-90 does not override it.
- **What is left.** The two config values and a small static page.
- **How.** In capacitor.config.ts add android.minWebViewVersion: 111 and server.errorPath: 'webview-update.html'. Add the page as plain HTML with no scripts (CSP-safe, light and dark via prefers-color-scheme), telling the gardener to update Android System WebView or Chrome from Google Play. Emit it only in the Android build (vite.config.ts android mode) so the PWA does not precache it. Run npx cap sync android; e2e/android.spec.ts can check that /webview-update.html is served. Run every Android check.
- **Done when.** dist-android contains the page; after cap sync, android/app/src/main/assets/capacitor.config.json has minWebViewVersion 111 and errorPath; a test asserts the config; Gradle checks green.
- **Source.** Voyager a.9 third bullet (lines 525-526), parked as Android-only.

### 7.6 Replace the deprecated Gradle syntax

*Plan: a.9 · not done · small · Android app · **needs a decision***

- **Where it stands.** android/app/build.gradle:22-26 (applicationId, minSdkVersion, targetSdkVersion, versionCode, versionName), 36-39 (storeFile, storePassword, keyAlias, keyPassword), 45-46 (minifyEnabled, shrinkResources), 49 (signingConfig) and 54-55 (abortOnError, checkReleaseBuilds) all use space-assignment. android/build.gradle:25-26 uses the eager task API and rootProject.buildDir, also deprecated. The Capacitor-generated android/app/capacitor.build.gradle:5-6 has the same pattern but is regenerated by cap sync. Wrapper: Gradle 8.14.6.
- **What is left.** Rewrite both hand-kept files to `prop = value` and the lazy task API.
- **How.** Use applicationId = ..., minSdk = rootProject.ext.minSdkVersion, targetSdk = ..., versionCode = playVersionCode, versionName = packageJson.version, storeFile = file(uploadKeystore), minifyEnabled = true, signingConfig = signingConfigs.release, abortOnError = true, and tasks.register('clean', Delete) { delete rootProject.layout.buildDirectory }. Keep signing environment-only (CLAUDE.md: never add a keystore). Leave capacitor.build.gradle to Capacitor upstream. Run npm run build:android, npx cap sync android, then ./gradlew --warning-mode all lintRelease testReleaseUnitTest assembleDebug bundleRelease.
- **Done when.** --warning-mode all shows no space-assignment or buildDir deprecations from app/build.gradle or build.gradle; versionCode and versionName handling unchanged; android.yml green.
- **Source.** Voyager a.9 fourth bullet (lines 527-528), parked as Android-only.


## 8. Decisions only

These need the owner's answer before any code. Other steps that need a decision are marked where they stand and listed in the table at the end.

### 8.1 Store custom backdrop images as Blobs?

*Plan: a.5 WP5-2 (P4) · not done · medium · web and Android · **needs a decision***

- **Where it stands.** The adopt cost was fixed by identity caching instead (A2 log 1233-1236). Custom backdrops still store base64 text (src/types.ts:351-354, imageData: string), while sighting photos are already Blobs (src/types.ts:664-668), so the code now holds both patterns.
- **What is left.** Owner decision: close P4 as solved by identity caching, or move CustomBackdrop.imageData to Blobs.
- **How.** If taken: raise DATABASE_VERSION to add an id-keyed images store, migrate lazily on first load (base64 to Blob) with a 'loads a garden from before' test, revoke object URLs on unmount (CustomBackdropImage.tsx), keep the backup envelope as base64 through the same path sightingPhotos uses, and update validateGarden, sealedStores and the quota checks (Blob.size). Run the Android checks too.
- **Done when.** Either a recorded decision in the plan or docs/ARCHITECTURE.md, or the migration with tests and old backups still restoring.
- **Source.** Voyager a.4 P4 (line 204); a.5 WP5-2 (417-421); A2 log P4 (1233-1237): weighed and not taken.

### 8.2 A garden context with selector hooks?

*Plan: a.5 WP6-2 (R2) · not done · large · web and Android · **needs a decision***

- **Where it stands.** The hook split is done (src/hooks/usePersistence.ts, src/hooks/useMediaSaves.ts, src/lib/gardenActions.ts), but views still receive the whole garden: state={state} at src/App.tsx:875, 894, 914, 932, 938, 972, 986, 1013, 1029, 1038.
- **What is left.** Owner decision: accept A3's reasoning and close it, or build a GardenContext with selector hooks.
- **How.** If taken: a context provider in App with useSyncExternalStore-based selector hooks. Convert one view at a time and measure re-render counts with the React Profiler before and after. Keep the useGardenState API. Behaviour-preserving, under the full e2e suite and the visual suite.
- **Done when.** A recorded decision, or views reading through selectors with no state prop and fewer measured renders.
- **Source.** Voyager a.4 R1/R2 (lines 221-222: 'Every view receives the whole state object'); a.5 WP6-2 (450-451); A3 log (1275-1278): weighed and not taken.

### 8.3 The old streak can no longer be switched back on

*Plan: b.4 J1 · partly done · small · web and Android · **needs a decision***

- **Where it stands.** B1 replaced lib/streak.ts with src/lib/rhythm.ts (rhythm.ts:7-44: last seven days, this month, longest run). No streak function is left in src (grep for calculateSunlightStreak finds nothing). Settings only shows or hides day counts (src/components/SettingsView.tsx:903-918; Profile.hideDayCounts at src/types.ts:190). Everything needed to compute a streak is still stored (Sunlight rows by localDate), so no data was lost; only the switch is missing.
- **What is left.** The owner chooses: (a) record that the reset-to-zero streak is retired on purpose (b.1 principle 1) and correct the zero-loss line; or (b) add an opt-in 'current run' that is worded so a gap never reads as a loss.
- **How.** (a) A one-line note in the future-work note from #67 and in the Voyager log under B1. (b) Add currentRun to careRhythm in src/lib/rhythm.ts: days in a row ending today or yesterday. Add an optional Profile.showCurrentRun?: true, checked by validateGarden; a toggle next to 'Show day counts' (SettingsView.tsx:903-918); and a line in the rhythm card (src/components/JournalView.tsx:349-374) shown only while the toggle is on and hidden with day counts. Tests in rhythm.test.ts and JournalView.test.tsx. knip flags unused exports, so add the function only together with its UI.
- **Done when.** (a) The docs say the reset streak was retired on purpose. Or (b) the current run shows only when switched on, never shows a zero or 'broken' wording, and is hidden whenever day counts are hidden.
- **Source.** Voyager line 614 (J1: 'calculateSunlightStreak stays for compatibility') and line 698 (zero-loss: 'Every removed number (the streak) remains computable and can be switched back on'); B1 log lines 1403-1409

### 8.4 Older recaps with a multi-line tomorrow note

*Plan: b.3 M1 · partly done · small · web and Android · **needs a decision***

- **Where it stands.** New recaps store up to three notes joined with '\n' in forTomorrow (src/lib/gardenActions.ts:498). Every reader splits on line breaks: the journal (src/components/JournalView.tsx:441-443), the exports (src/lib/journalExport.ts:95) and the recap draft (src/components/MoonlightRecap.tsx:18-30). A recap from before B2 with a multi-line note reads back as separate notes. Every word is kept, in order.
- **What is left.** The owner decides whether to leave this as it is (the log judged it rare and harmless) or to mark new recaps so the two can be told apart.
- **How.** Recommended: leave it, and list it in the future-work note from #67 as accepted. If fixing: add an optional RecapEntry.tomorrowNotes?: string[], written by every new recap alongside forTomorrow (older builds keep reading forTomorrow). Readers prefer tomorrowNotes; a recap without it is read as one note that keeps its line breaks. validateGarden checks the array (strings, at most 3). Tests in journalExport.test.ts, JournalView.test.tsx and the validateGarden tests.
- **Done when.** Either it is documented as accepted, or a pre-B2 multi-line note shows as one note in the journal and the exports while new recaps show their up to three notes, and older builds still read forTomorrow.
- **Source.** B2 log lines 1500-1503 ('Left as is: a recap written before this change, whose one note had line breaks in it, now shows those lines as separate notes')

### 8.5 When to remove the frozen pre-split garden record

*Plan: store split (P5) · not done · small · web and Android · **needs a decision***

- **Where it stands.** src/repository/gardenRepository.ts:1023-1036 deliberately keeps the legacy 'state' record after the store split. It is frozen as it was in September 2026, so an entry deleted since still sits in it. It is sealed under the lock (src/repository/sealedStores.ts:348) and carried into every new database a lock switch writes.
- **What is left.** The owner decides when the split has soaked long enough (the doc argues for waiting on Play adoption). Then make the change that deletes the 'state' record after a successful split read, and stop sealing and carrying it.
- **How.** Once decided, delete it in a separate transaction after `load()` succeeds from split parts. Keep the store, so older builds still open the database, or bump DATABASE_VERSION with a reason. Add a repository test that a migrated garden has no legacy record afterwards and that a never-migrated garden still migrates. Update handoff section 6.
- **Done when.** After an ordinary load of a split garden, no 'state' record remains; migration from a pre-split database still works; 'Delete all local data' is unchanged. Android: no native change; e2e covers both builds.
- **Source.** docs/handoff-p5-store-split.md:259-260 and section 11 question 2 ('Not decided')

### 8.6 The garden in other languages (skipped by choice)

*Plan: c.10 · not done · large · web and Android · **needs a decision***

- **Where it stands.** There is no message catalogue or locale code: grep finds no i18n or navigator.language in src. src/lib/plural.ts:1 hard-codes `new Intl.PluralRules('en')`, and index.html:2 is `lang="en"`. Copy is inline in components and src/data/*.
- **What is left.** Everything in c.10. The owner skipped it, so it waits for a new decision.
- **How.** If taken up: move user-facing copy into per-locale catalogues using ICU MessageFormat for plurals (replacing lib/plural.ts), loaded lazily as separate chunks so the English first load does not grow. Pick the language from navigator.language with a Settings override. Add per-locale species and plant common names in data/content.ts (scientific names stay). Translate release notes and the Android res/values strings plus the Play listing. Get a native-speaker review of the wellbeing copy, and verify helplines per country for data/support.ts.
- **Done when.** The owner's decision is recorded. If built: the app follows the device language with a Settings override, the English first load is unchanged, every locale passes the axe/e2e suite, and the Android build ships the translated strings.
- **Source.** Voyager c.10 (lines 1050-1072); owner decision 'skipped' (line 1100-1101); the future-work note from #67

## Decisions the owner is asked for

| Step | Question |
|---|---|
| 1.3 | What is a seasonal keepsake (a free cosmetic, a garden decoration or a shelf item), and how is it given? Are seasonal Pass outfits offered all year, or only in their season? |
| Art brief | The 16 questions about the art listed above: one or two night paintings per scene, which night images are precached, where keepsakes live, what Calm motion shows, and the rest. |
| 2.2 | Should the Android app scan QR codes, which needs the camera permission and a Data safety update, or take the 12 words only? |
| 3.5 | Should new recovery codes carry check bits, so a mistyped word is caught before the slow unlock? |
| 3.6 | Keep PBKDF2 at 600,000 iterations, or ship Argon2id in WebAssembly as the plan first preferred? |
| 5.1 | Which domain and host (one that can send security headers), and when to move? |
| 5.6 | Hold the CSS work to the plan’s 40% cut, or accept the 18% reached? |
| 6.1 | A forward-only day boundary with no migration, or re-dating what is stored? |
| 6.12 | Which of journal search, readable exports, the letter and the year should include sightings? |
| 6.13 | Is the reflection-prompt rotation enough, or add an optional once-a-day nature prompt? |
| 6.14 | Should the gardener choose who paces the breath: their companion or Marigold? |
| 7.1 | The Play Console steps, the Pass price and plans, whether the PWA keeps its free Pass preview, and the audience. |
| 7.3 | Unpark it now? The plan parked it as Android-only (a.9). |
| 7.4 | Unpark it now? The plan parked it as Android-only (a.9). |
| 7.5 | Unpark it now? The plan parked it as Android-only (a.9). |
| 7.6 | Unpark it now? The plan parked it as Android-only (a.9). |
| 8.1 | Close P4 as solved by caching, or store custom backdrop images as Blobs? |
| 8.2 | Close the garden-context idea as A3 argued, or build a GardenContext with selector hooks? |
| 8.3 | Retire the reset-to-zero streak for good, or add an opt-in “current run” worded so a gap never reads as a loss? |
| 8.4 | Leave old multi-line tomorrow notes as they show, or mark new recaps so the two can be told apart? |
| 8.5 | When has the store split been in use long enough to delete the frozen legacy record? |
| 8.6 | Add other languages after all, and which first? |

## Appendix: what was checked and found done

The sweep checked every item in the Voyager plan against the code on `main`. These were found done and are not listed above.

<details><summary>Section (a): 30 checked</summary>

- a.5 WP1-1 repository factory: createGardenRepository at src/repository/gardenRepository.ts:661; default instance kept
- a.5 WP1-2 failing-first tests for D1/D2/D4-D7: src/repository/twoTabs.test.ts, validateGarden.test.ts, src/components/DataSafety.test.tsx:22-57
- a.5 WP1-3 root boundary + safe mode: src/main.tsx:30 with SafeMode; per-page boundary src/App.tsx:862-864 (only the every-view test is missing, listed separately)
- a.5 WP2-1 D1 adopt outcomes + revision: src/hooks/usePersistence.ts:239-251, retry with backoff 47 and 140-159; revision check gardenRepository.ts:1265-1268; save refused while withheld 1247
- a.5 WP2-2 D2/D11 deep validation on load and import: src/repository/validateGarden.ts (1,387 lines, outfits at 605-628)
- a.5 WP2-3 D3 persist(): src/lib/storage.ts:38, launch request usePersistence.ts:189, Safari Home Screen copy SettingsView.tsx:1342
- a.5 WP2-4 D4-D6 recovery screen, export refused when read-only (useGardenState.ts:566-567), SHA-256 set-aside capped at 3 (repository/setAside.ts:13, 22), download/discard in usePersistence.ts:411-422
- a.5 WP2-5 D7 broadcast + deletion marker + pending copy: usePersistence.ts:526-554, gardenRepository.ts:848-857, 497-500 (Web Lock part listed separately)
- a.5 WP2-6 D8 restore preview, two snapshots, 64 MB cap, in-session undo: src/lib/backupPreview.ts, gardenRepository.ts:434, src/lib/backupFile.ts:2,16 (after-reload undo listed separately)
- a.5 WP2-7 D9 30 s ceiling (src/hooks/useMediaSaves.ts:18), D10 terminated + VersionError (gardenRepository.ts:858-860, 1107), D13 strict durability (556, 956; used by migration 1071, catch-up 1194, replace 1323)
- a.5 WP2-8 D12 drafts store with timed writes and flush: src/lib/drafts.ts
- a.5 WP3-1 frame guard (S2 interim): src/lib/hosting.ts, FramedNotice.tsx, main.tsx:25-26; meta CSP no longer lists frame-ancestors (index.html:18-19)
- a.5 WP3-2 S4: persist-credentials false on every checkout (2/3/2 matches the checkout count in android.yml, deploy-pages.yml, security.yml), CodeQL + zizmor in security.yml:21-55, npm audit signatures deploy-pages.yml:44, Vite 8.3.5 / Vitest 4.1.12 locked, uuid override in package.json
- a.5 WP3-3 S5 easter egg documented: SettingsView.tsx:88-96 and e2e/app.spec.ts:12-13
- a.5 WP4-1 P1 composited sprites + offscreen pause: src/components/sprites/SpriteFrame.tsx; A2 log measured 51.2 fps at 4x CPU (target 50)
- a.5 WP4-2 Calm motion: optional calmMotion at src/types.ts:135
- a.5 WP4-3 dock: solid --dock-fill, no blur (theme-aurora.css:40, garden-3.css:1273), also fixes A5 bleed-through
- a.5 WP5-1 P3: src/data/backdropAssets.ts:32-68 (decoded cache, 8 s timeout); Cottage Bloom precached
- a.5 WP5-3 P5: awardSunlight keeps the plants array when nothing grows (src/lib/progression.ts:384)
- a.5 WP5-4 A1: per-jar text inks in src/data/jars.ts:48-80 with src/lib/contrast.ts test
- a.5 WP5-5 A2/A4: src/lib/gardenEvents.ts + Celebrations.tsx live region; src/lib/plural.ts:1 Intl.PluralRules; species count and first-unused egg name per A2 log
- a.5 WP6-1 R1 hash routes: src/lib/routes.ts; manifest shortcuts in src/pwaManifest.ts:90
- a.5 WP6-2 hook split: hooks/usePersistence.ts, hooks/useMediaSaves.ts, lib/gardenActions.ts (context part listed separately as a decision)
- a.5 WP6-3 R4/R5 single sources and knip in CI: deploy-pages.yml:50-52
- a.5 WP7-2 T1/T4 coverage gate: vite.config.ts:214 (lines 85, statements 84, functions 80, branches 78); SpeciesDirectory covered via GuideView.test.tsx:113-124
- a.5 WP7-4 O1/O2 docs: docs/ARCHITECTURE.md, refreshed handoff doc, README Development/Checks sections (README.md:104-145), 3.0-LOCAL-REVIEW marked historical
- a.4 S3 plaintext backups and journal: covered by c.5 protected backups and garden lock (src/lib/sealedBackup.ts, components/lock/)
- a.4 A5: dock solid (A2), header keeps Sunlight (B1 P2), five tabs + More (B4 P1), compact goal rows (B2 T4) - (b) scope
- a.9-5 measurements (lint 0, JVM 23/23, 4.4 MB APK, no native libs): informational, no work
- WP2 forced-crash e2e lands on safe mode with a working download: e2e/lock.spec.ts:401-470

</details>

<details><summary>Section (b): 63 checked</summary>

- b.2 T1 done: the check-in starts unchosen and 'Not sure today' is an answer of its own (src/components/TodayView.tsx:176-178, 497-501; MoodEntry.unsure at src/types.ts:400)
- b.2 T2 done: optional feeling words and energy (src/types.ts:403-410; src/components/checkin/CheckInExtras.tsx; data/feelings.ts)
- b.2 T3 done: one gentle next step after a check-in (src/lib/nextStep.ts:16-41; src/components/checkin/NextStepOffer.tsx)
- b.2 T4 done: one row per goal with a ⋯ menu, swipe to complete or skip (src/components/GoalRow.tsx; src/hooks/useSwipe.ts)
- b.2 T5 done: Undo for Care, Skip, Archive and Delete (src/components/UndoToast.tsx; TodayView.tsx:742)
- b.2 T6 done: the editor changes schedule, days and date, refuses empty days, and offers snooze lengths (src/components/GoalEditor.tsx)
- b.2 T7 mostly done on Today (TodayView.tsx:292-302, 406-410, 579-583); the header count and nav badge are a separate item
- b.2 T8 done: 24 ideas, 4 per NHS step plus rest, 20 with a two-minute version, 4 deliberately without (src/data/goalSuggestions.ts:1-83; Goal.tinyTitle at src/types.ts:382)
- b.2 T9 done: 64 prompts in families, with Another prompt and Write freely (src/data/prompts.ts; TodayView.tsx:213-216)
- b.2 T10 drafts done in A1 (src/lib/drafts.ts); the 'Draft kept' hint is a separate item
- b.2 T11 done: Profile.tendFirstPlantId and the select under the meter (src/types.ts:200; src/lib/progression.ts nextPlantToTend)
- b.2 T12 done: the month planner is folded on phones and routines are summed up (src/components/MonthPlanner.tsx:55, 155-158, 298-306)
- b.3 M1 done: up to 3 notes, each with Add to tomorrow's goals (MoonlightRecap.tsx:18-30, 115; gardenActions.ts:498); the left-as-is display of old notes is a separate decision item
- b.3 M2 done: Fade the garden to night and close (src/App.tsx:184, 413-445)
- b.3 M3 done: the day in words (src/lib/daySummary.ts:17)
- b.3 M4 hours done (SettingsView.tsx:856-901; date.ts:130-181); the shared day boundary is a separate item
- b.3 M5 done: a recap already opened stays open for its day until collected (src/App.tsx:559-579)
- b.4 J1 rhythm done (src/lib/rhythm.ts:23-44; JournalView.tsx:349-374; Show day counts at SettingsView.tsx:903-918); the streak switch is a separate decision item
- b.4 J2 done: search plus type and weather filters (src/components/JournalSearch.tsx; src/lib/journalSearch.ts; src/lib/searchText.ts)
- b.4 J3 done: month grid and year in pixels (src/components/WeatherCalendar.tsx; src/lib/weatherCalendar.ts)
- b.4 J4 done: On this day (src/lib/onThisDay.ts:60-127; src/components/journal/OnThisDayCard.tsx)
- b.4 J5 done: earlier-day entries marked writtenLater, earning nothing (src/lib/earlierDay.ts:33-44; src/components/journal/EarlierEntry.tsx; src/types.ts:417)
- b.4 J6 done: Markdown, printable page and CSV (src/lib/journalExport.ts; src/components/JournalExport.tsx)
- b.4 J7 done: species counted, and first-welcomed dates on field notes (src/lib/fieldNotes.ts; GardenView.tsx:506-510)
- b.5 G1 done in A2: composited SpriteFrame layers and Calm motion (src/components/sprites/SpriteFrame.tsx; Profile.calmMotion at src/types.ts:135; src/lib/motion.ts)
- b.5 G2 done: lanes across the sky band (src/lib/flightMotion.ts:198-252). B6 notes that on a phone there is not enough width and butterflies still overlap; that is a physical limit, not a missing part
- b.5 G3 done: CreatureInstance.flightPatternId (src/types.ts:536; src/components/CompanionFlight.tsx)
- b.5 G4 done: the tap-to-meet card (src/components/ButterflyCard.tsx)
- b.5 G6 done: Plant a seed says why it is off, and plant panels give egg and bloom notes (src/components/garden/PlantPanel.tsx:49-51; GardenView plantingBlocker)
- b.5 G7 done: Keep giving pace (src/lib/gardenPace.ts:32-47; Profile.gardenPace at src/types.ts:229)
- b.5 G8 done: While you were away (src/lib/welcomeBack.ts:77; src/components/garden/WelcomeBack.tsx; src/types.ts:235-241)
- b.6 C1 done in A2: flourish and polite announcement for bloom, egg, stage and bond (src/lib/gardenEvents.ts:13-16; src/components/Celebrations.tsx)
- b.6 C2 done: naming offer for a new egg (src/components/NameArrival.tsx; awaitingName at src/types.ts:529)
- b.6 C3 done: companion story (src/components/care/CompanionStory.tsx; src/lib/companionStory.ts:90; src/types.ts:542-553)
- b.6 C4 done: saved looks and the Fits {name} now filter (src/lib/outfitPresets.ts:48-121; src/components/care/OutfitLooks.tsx; profile.outfitPresets at src/types.ts:252-258)
- b.6 C5 done: Next bond level line (src/components/CareView.tsx:336-353)
- b.7 H1 done: filter sheet on phones (src/components/shop/FilterSheet.tsx)
- b.7 H2 done: honest outcomes, and supplies x1, x3, x5 (src/lib/purchase.ts:33-43; src/components/shop/PurchaseToast.tsx; ShopItemCard.tsx:12)
- b.7 H3 done except ♥: stacks, recycling with Undo, accents and marks, spoken names (src/lib/jarStacks.ts; src/components/shop/JarShelf.tsx; src/data/jars.ts:20-37)
- b.7 H4 done: Pass items count as owned while the Pass is open (src/components/ShopView.tsx:154-157)
- b.8 F1 done: sourced facts, 3 per species unlocked by bond (src/data/speciesFacts.ts; src/components/FieldFacts.tsx)
- b.8 F2 done: My region with native marks and tips (src/data/regions.ts; src/components/RegionSetting.tsx; src/components/guide/RegionGuide.tsx; Profile.region)
- b.8 F3 contents, search and return done (GuideView.tsx:405-433; App.tsx:584-589); the currency and meter links and the no-match wording are separate items
- b.9 B1 done: local-day ripeness ring and decode before swap (src/components/BackdropGallery.tsx:150-157; src/data/backdropAssets.ts:41-60)
- b.9 B2 done: quarter turns, brightness and a night image (src/lib/backdropEdits.ts:13-28; CustomBackdrop.brightness at src/types.ts:361; nightCustomBackdropId at src/types.ts:183)
- b.9 S1 done: volume, night brings the piano, and background play (src/types.ts:140-157; src/components/SoundControls.tsx); the Android app rests sound in the background by design
- b.9 S2 done: fade-out of 15, 30 or 60 minutes (src/hooks/useFadeOut.ts:4)
- b.9 S3 done: Soft Rain and Dawn Birdsong synthesised on device (src/data/ambientTracks.ts:29-33; src/lib/soundscapes.ts)
- b.10 P1 done: five tabs and a More sheet on phones (src/components/Navigation.tsx:63-95)
- b.10 P2 done: Sunlight stays in the header on phones, and all three currencies are named (src/App.tsx:667-679)
- b.10 P3 manifest part done (src/pwaManifest.ts:16-130); deeper routes are a separate item
- b.10 P4 done: Home Screen help on iPhone and iPad (src/components/garden/HomeScreenGuide.tsx; src/lib/install.ts:32-97)
- b.10 P5 done: lastBackupAt, the reminder note and badge, Share backup (src/lib/backupReminder.ts:105-123; src/types.ts:223; src/lib/shareFile.ts)
- b.10 P6 done: Sunlight, Night, Follow device and Follow evening (src/lib/theme.ts:30-128; Profile.themeFollows)
- b.10 P7 done: three text sizes (src/lib/textSize.ts:15-28)
- b.10 P8 done: hourly update check, build-id-checked reload of every tab, What's new once (src/hooks/useUpdateCheck.ts:35; src/lib/appUpdate.ts:87-102; src/hooks/useWhatsNewOnce.ts)
- b.10 P9 done: starter goals step and the backup sentence (src/components/Onboarding.tsx:13-52)
- b.10 P10 page done (src/components/SupportView.tsx; src/data/support.ts; links at TodayView.tsx:561-565 and GuideView.tsx:498-502); the per-release re-check guard is a separate item
- b.11 ordering: every Now, Next and Later item is built except G5 and M4's day boundary; the partial items are listed above
- b zero-loss check: every new field is optional and checked by validateGarden; Profile.rhythm was implemented as recapOpensHour and recapGraceEndsHour (src/types.ts:205-210)
- B6 review findings judged real are all fixed on main: looks moved into the profile (src/types.ts:252-258), the Care undo toast moved out of the card (CareView.tsx:533), the status line keeps its place (care.css:130), Guide tap copy (GuideView.tsx:181), the companion filter keeps name case (shop/shop.css:145), visit-only writes are quiet (src/lib/quietWrites.ts; usePersistence.ts:284-286), and the e2e checks read storage (e2e/app.spec.ts:741, 1901). The old-build soundscape reset is moot now that every garden is written at version 8 (validateGarden.ts:59-77)
- B7 review findings judged real are fixed on main: the version guard (now 8 for every garden), the Home Screen card's own key (src/lib/install.ts:32-43), the 3.1 notes for Shop, Guide and images and the Android What's new line (src/data/releases.ts:135-170), the stale night id dropped (validateGarden.ts:1332-1335), the cleared fallback and build-id check (UpdatePrompt.tsx:49, 69; appUpdate.ts:89, 102), Guide return to place and companion (App.tsx:584-589; routes.ts returnFrom), spoken jar names (data/jars.ts:28-35; jarSpokenName in GardenView.tsx:368 and JarManager.tsx:169, 191), the guide status live region (guide.css:70-72), and 44px folds (shop.css:166, 172; jarManager.css:8). Only finding 8's no-match wording is left, listed as an item
- the B7 review (findings 4, 15, 6, 7) is all fixed on main, as above

</details>

<details><summary>Section (c): 13 checked</summary>

- c.1 Breathe: #/breathe page with a pacer on the wing layers, In/Out count, cyclic sigh, 1/3/5 min, reduced-motion count, optional tone, Stop, once-a-day Sunlight `breath:<date>`; offered on the goal row, next step, support page and recap (ARCHITECTURE.md:78; src/lib/breathing.ts; data/breathing.ts). Only the pacer choice is open (item above).
- c.3 Raise it with a goal: adoptedGoalId and grownAlongside, careFromGoal/careDay in lib/lifecycle.ts, Today badge, release on archive or delete (ARCHITECTURE.md:79; GuideView.tsx:103). Fully done.
- c.4 weekly letter: Sunday-evening letter, starred quotes only with a 'never' setting (src/types.ts:283, lib/letters.ts:41-53), last four weeks in the Journal (ARCHITECTURE.md:81). The plan's 'or the longest' line was dropped per its own Risks.
- c.4 year and postcard: #/year with weather calendar, counts in words, species welcomed, starred lines, and a postcard drawn on device with the custom or day backdrop, shared or saved (lib/gardenYear.ts, lib/postcard.ts:50-64, components/year/Postcard.tsx:84,228). Only 'longest rhythm' is missing (item above).
- c.2 Noticed in Nature core: sightings collection (DB 7 / state 8), photos as Blobs at a 1024px edge, a 50-photo cap with storage use shown in Settings (SettingsView.tsx:1307-1312), stamps in the Guide and Journal (SpeciesDirectory.tsx, SeenInTheWild.tsx), nature prompt family (data/prompts.ts:82-86), month line and nature-project links (data/natureProjects.ts).
- c.5 lock and protected backups: passcode, 24-word recovery sheet with two-word confirm, passkey PRF, auto-lock, lock off, fresh-database switches (repository/gardenSwitch.ts), sealed parts (sealedStores.ts), protected backup envelope with formatVersion (lib/sealedBackup.ts; ARCHITECTURE.md:85-86). Argon2id, real-device passkey tests and the origin move are open (items above).
- c.8 comfort plan: #/comfort, five lists, tel links, reached from support, Settings and gentle day, stored in the profile and sealed under the lock (ARCHITECTURE.md:84; lib/comfortPlan.ts). Only small leftovers are open.
- c.9 web reminders: .ics with floating time, RRULE:FREQ=DAILY, VALARM, URL and escaping (lib/calendarReminder.ts:71-92); static files in public/reminders (8 times), never precached; Profile.reminderTime. The Android path and device testing are open.
- c.12 zero-loss: CSP keeps connect-src 'self' (index.html:22); new data is optional fields or new stores; encryption has a recovery path and an off switch.
- c.11: nothing promised beyond c.4/c.6/c.9, which are covered above.
- C1 review REAL findings 1-8, 10 and 12 are fixed on main: care select width:100% (care/care.css:24-28), wrapping companion badge (goals/goals.css:81-94), overflow-anchor and overflow-wrap (breathe/breathe.css:16,24), non-sticky Stop (breathe.css:142), letter re-mark after a quiet conflict (useGardenState.ts:183-187), LAZY_PAGE_MS at App.test.tsx:649, release 3.2 (releases.ts:74).
- C2 review REAL findings are fixed on main except finding 16's second decode (item above): fast decode loop (validateGarden.ts:1097-1099), storedCopy marks photos it left out (lib/storedCopy.ts), share cancel clears the note (SettingsView.tsx:532-534), Undo photo wait (FieldBook.tsx:115-118), chosen row scrolled to the top (SightingForm.tsx:36-48,116), radio reset (sightings.css:260), 20 s test timeouts (GuideView.sightings.test.tsx:15-17), +44 (0) handling (comfortPlanEdits.ts:145-148).
- C3 review REAL findings (27) are fixed on main per the C3 log; spot-checked: strength meter's own-word list (lib/passphrase.ts:57-61), LockScreen sets system bars (LockScreen.tsx:66), snapshot written in the lock-checking transaction (gardenRepository.ts:956-987), set-aside parts opened one by one (sealedStores.ts:362-392), useModal close-event handling (backup/useModal.ts:36-41).

</details>

<details><summary>The code and docs: 17 checked</summary>

- No TODO/FIXME/XXX/HACK comments in src/, e2e/, scripts/ or android/app/src (grep returned nothing)
- No it.todo, it.skip, test.fixme or .only. The two test.skip calls are deliberate platform conditions: e2e/reminders.spec.ts:110 (Chromium-only download) and e2e/app.spec.ts:1434 (phone-only dock)
- No eslint-disable comments in src/, e2e/ or scripts/; the only @ts-expect-error is a justified jsdom stub in src/hooks/useFlightMotion.test.tsx:89
- knip.json has no ignore entries (only an entry glob and ignoreExportsUsedInFile), and CI runs knip (deploy-pages.yml 'Unused files and exports')
- No lint-baseline.xml in this repository's android/. The '6 errors filtered by baseline' in Android CI come from upstream node_modules/@capacitor/android/capacitor/lint-baseline.xml. android/app/lint.xml ignores only Capacitor's generated config.xml, and android/app/build.gradle sets abortOnError true
- The only continue-on-error in .github/workflows is the browsers job, listed above; android.yml and security.yml have none
- a.5 WP7-1 WebKit and Firefox projects exist (playwright.config.ts:15-33) and run in CI; a.5 WP7-2 coverage gate exists (vite.config.ts:214)
- a.5 WP3 S4 CI hardening is in place: persist-credentials false on every checkout, SHA-pinned actions, npm audit signatures, CodeQL plus zizmor in security.yml; the uuid advisory is handled by package.json overrides
- Android CI checks the budgets for dist-android (android.yml 'Bundle budgets')
- docs/moving-the-garden.md 'What is already in the code' is all present: src/lib/hosting.ts, src/components/FramedNotice.tsx, src/components/MovedBanner.tsx, onboarding #/arrive, and the cross-database restore test
- docs/3.0-LOCAL-REVIEW.md is marked historical (lines 3-7); its remaining release checks have been overtaken: Safari and Firefox run in CI, Android packaging and billing are built
- docs/handoff-p5-store-split.md section 11 Q3 (granular cross-tab sync) is done (usePersistence posts parts; adopt(parts))
- docs/android-play-plan.md section 4 Garden Pass is built: GardenBillingPlugin, PassEntitlement and PurchaseSignature with JVM tests, src/lib/playBilling.ts, passEntitlement.ts and GardenPassPanel
- THIRD-PARTY-NOTICES.md versions match package-lock (react 19.2.8, idb 8.0.3, workbox-window 7.4.1, Capacitor 8.5.2, @capacitor/app 8.1.1); the recovery word list is original (src/data/recoveryWords.ts:5-9), so it needs no notice
- README.md 'What is included' and docs/ARCHITECTURE.md concern table cover the 3.1-3.4 features (breathing, letters, year, comfort plan, field book, lock, protected backups)
- The release metadata agrees: package.json 3.4.0, src/data/currentRelease.ts release-3-4, and data/releases.ts newest entry 3.4.0
- The legacy 'state' record is sealed under the lock (sealedStores.ts:348), so the frozen copy holds no plaintext in a locked garden

</details>
