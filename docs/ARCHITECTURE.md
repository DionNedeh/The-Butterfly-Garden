# How the garden fits together

A map of the code for someone opening it cold. The comments in each file
explain *why*; this page says *where*.

The PWA and the Android app are one React app. The build decides the platform
(`vite build --mode android` sets `VITE_PLATFORM`), never a runtime guess, and
the bundler drops the other platform's branches. Capacitor wraps the Android
bundle; see `docs/android-play-plan.md`.

## The flow of a change

```
data/          catalogue: species, plants, shop items, jars, flight patterns, releases
   │           (plain objects, no behaviour)
   ▼
lib/           pure domain rules: progression, lifecycle, plants, jars, wardrobe,
   │           flight, streak, dates. lib/gardenActions.ts holds one reducer per
   │           action: (garden, input, now) → garden, never mutating
   ▼
hooks/         useGardenState: the facade every view uses
   │             ├─ actions       call a reducer through update()
   │             ├─ usePersistence load, save, retry, cross-tab sync,
   │             │                restore, undo, delete
   │             └─ useMediaSaves image saves that answer once their bytes are on disk
   ▼
repository/    gardenRepository: the only code that touches IndexedDB
   │           validateGarden: migrates and checks every garden read or imported
   ▼
IndexedDB      one store per collection (sightings among them), plus meta,
               state, quarantine, snapshots, drafts and lock; DATABASE_VERSION 8
               (layout and versions: docs/handoff-p5-store-split.md §4)
               ⇄ backup file: { format, exportedAt, appVersion, revision, sha256, garden }
```

A tap on "complete" calls `actions.completeGoal`. That runs
`gardenActions.completeGoal` on the current garden. The new garden renders. The
save effect in `usePersistence` hands it to `repository.save`. The repository
works out which parts changed and writes only those, in one transaction. It then
tells other tabs which parts it wrote.

## Where each concern lives

| Concern | Where |
| --- | --- |
| The app shell, pages, hash routes (a Journal day, `#/journal/2026-10-26`, and a shop tab, `#/shop/jars`, among them), error boundaries | `App.tsx`, `lib/routes.ts` |
| The navigation: header, dock, and on phones five tabs and More | `App.tsx` (the pages), `lib/navigation.ts` (dock order, badges) |
| What a purchase did, or why it did not | `lib/purchase.ts`, beside the shop's rules in `lib/wardrobe.ts`, `lib/jars.ts`, `lib/flightPatterns.ts` |
| Jars: the characters (each checked against the bundled fonts), recycling and its undo, alike jars stacked, a mark said by its name | `data/jars.ts` (with the marks' spoken names), `lib/jars.ts` (buy, place, recycle, undo; `jarName` shown, `jarSpokenName` said), `lib/jarStacks.ts`, `components/Spoken.tsx` (a glyph shown, its name said), `components/shop/JarShelf.tsx`, `components/garden/JarManager.tsx` (loaded with a plant's panel) |
| The header's tabs, the phone's five-tab dock and its More sheet | `components/Navigation.tsx`, `lib/navigation.ts` |
| Last-resort screens | `main.tsx` → `SafeMode` (nothing could draw); `RecoveryScreen` (stored garden unreadable); `ViewProblem` (one page failed) |
| Types of everything stored | `types.ts` |
| Reading, writing, conflicts, quarantine, snapshots | `repository/gardenRepository.ts` |
| What counts as a valid garden, and migrations | `repository/validateGarden.ts` |
| Asking the browser not to evict the garden | `lib/storage.ts` |
| Unsaved text that survives a reload | `lib/drafts.ts` (and `useDraftKept` in `lib/draftKept.ts`: a draft is kept only once a write of it resolved true from `writeDrafts`, or it was read back, and no longer once another tab says on the `butterfly-garden-drafts` channel that it wrote its own drafts over the shared record), `hooks/useSyncedDraft.ts`, `lib/goalEditDraft.ts` (Today's goal editor, open and as typed), `components/DraftKept.tsx` (the "Draft kept" hint under the check-in note, the reflection, each recap answer and an earlier day's note and reflection) |
| A check-in's feelings and energy, and the one next step offered after it | `data/feelings.ts`, `lib/feelings.ts` (what is stored, and in what words), `lib/nextStep.ts`, `components/checkin/` |
| Ideas for goals, their two-minute versions, a balanced mix | `data/goalSuggestions.ts` (loaded with Today and onboarding only), `lib/goalSuggestions.ts` |
| Restoring a chosen file | `lib/backupFile.ts` (size and read, and `sealedKind`: a protected backup or a locked garden's copy, each opened first in `components/backup/`), `lib/backupPreview.ts` (what it holds, read once for the preview and the restore), `lib/backupIntegrity.ts` (a plain backup's revision and SHA-256 of its garden, written with every backup and read by the preview, which warns of a changed file and never refuses one), `lib/lockedCopy.ts` (safe mode's copy of a locked garden, opened with the lock's own passcode or recovery code) |
| Suggesting a fresh backup | `lib/backupReminder.ts` (when, and in what words); `lib/shareFile.ts` (*Share backup…* in a browser that can) |
| Moving a garden with a protected file and twelve words | `lib/moveCode.ts`, `lib/sealedBackup.ts`, `components/move/` (Settings, welcome, recovery and safe mode); `SealedBackupPrompt` routes a move file chosen through ordinary Restore. No QR generation, scanning or camera access. |
| Daily and pre-restore copies, including after reload | `repository/dailyCopies.ts`, `gardenRepository.ts`, `components/backup/EarlierCopies.tsx`, `usePersistence` (preview, put back, Undo); daily copies omit sighting photos and retain current ones on put-back. Two pre-restore copies remain separate and keep their photos. Download reads raw bytes and matching lock wraps in one transaction. Discard checks the loaded revision and lock. |
| A desktop backup file kept up to date | `lib/autoBackup.ts`, `lib/autoBackupFile.ts`, `backup/AutoBackupKeeper.tsx`, `backup/AutoBackupSetting.tsx`; a chosen FileSystemFileHandle lives in drafts at `backup-file`, outside backups. `gardenSwitch` preserves it unsealed while sealing every journal copy; writes pause under the garden lock or read-only state. File writes share the switch Web Lock so a lock cannot turn on during a plain-file commit. Excluded from Android. |
| A gardener's own images, by day and by night | `lib/imageImport.ts` (the checks before decoding; resizing and quarter turns in one draw), `lib/customBackdrops.ts` (limits, crop, which image shows by day and which by night), `lib/backdropEdits.ts` (the editor's turns and brightness) |
| The Garden Pass: who may use what | `lib/gardenPass.ts`, the only access boundary; `lib/passEntitlement.ts`, `lib/playBilling.ts` behind it |
| Android: back gesture, files, billing | `lib/backNavigation.ts`, `lib/native.ts`, `android/app/src/main/java/…` |
| Moving the PWA to another address | `lib/hosting.ts`, `docs/moving-the-garden.md`; `components/MovedBanner.tsx` (the old address's final build: a plain backup, or with the lock on the garden's own stores sealed with it, in `lib/storedCopy.ts`'s form, opened at the new address with the passcode or recovery code, and refused while the latest change is not stored); the address in `pwaAddress.json` (read by `lib/calendarReminder.ts` and `scripts/reminder-files.mjs`); the base path in `buildBase.ts` (`VITE_BASE`, GitHub Pages' path when unset; `/` for Android); `no-referrer` in `index.html` |
| The installed PWA: icons, shortcuts, screenshots | `pwaManifest.ts`; `scripts/pwa-assets.mjs` renders the shortcut icons and screenshots |
| A new version of the PWA: the hourly look, *Update now* in every tab at once, *What's new* once after | `components/UpdatePrompt.tsx` (loaded after the garden), `hooks/useUpdateCheck.ts`, `lib/appUpdate.ts` (the tabs' own channel, whose message names the build it leaves, `__BUILD_ID__` from `vite.config.ts`, and a reload that puts drafts and writes on disk first), `hooks/useWhatsNewOnce.ts`; `data/currentRelease.ts` (which release this is, in the first load), `data/releases.ts` (its notes, read on *What's new* alone) |
| Adding the garden to an iPhone's or iPad's Home Screen | `lib/install.ts` (who is advised, and in which words), `components/garden/HomeScreenGuide.tsx` (the garden's one-time card), put away in this browser's own storage by `lib/install.ts`, apart from the garden and its drafts, and a line in Settings' storage note |
| Moments worth saying aloud | `lib/gardenEvents.ts` → `lib/announcer.ts` → `Celebrations` |
| The garden pace: Classic, or Keep giving (a host in bloom blooms again) | `lib/gardenPace.ts` (the rule), `awardSunlight` in `lib/progression.ts` (the bloom), `lib/plantManagement.ts` (what the plant's panel says) |
| The last visit, and a small welcome back after a few days away | `lib/visits.ts` (noted at most once a day by `useGardenState`), `lib/welcomeBack.ts` (the line), `components/garden/WelcomeBack.tsx` (loaded only on such a day) |
| A companion's story and the closet's saved looks | `lib/companionDiary.ts` (what is written down as it happens, and the limits storage checks), `lib/companionStory.ts` (the story told from it), `lib/outfitPresets.ts` and `lib/wardrobe.ts` (saving and wearing looks, who wears what; the looks are kept in the profile, which an older build writes back whole, not beside it in `meta`, which it writes field by field), `components/care/` |
| Motion preferences and animation | `lib/motion.ts`, `hooks/useFlightMotion.ts`, `components/sprites/` |
| Where each butterfly flies, and meeting one | `lib/flightMotion.ts` (a lane of sky each), `lib/flightPatterns.ts` (`flightPatternFor`: a companion's own pattern or the garden's), `components/ButterflyCard.tsx` (the card a tap opens, with Pet and *Care for {name}*) |
| The theme, chosen or followed (device, evening), and text size | `lib/theme.ts` (the rule), `hooks/useEffectiveTheme.ts` (when it turns), `lib/textSize.ts`; the shell applies them in `App.tsx` |
| The Guide as a reference: its contents, its search, and a "What does this do?" link from each meter, the shop's wallet, the garden's seeds and a plant's panel | `components/GuideView.tsx` (sections, `#/guide/{section}` in `lib/routes.ts`), `lib/searchText.ts` (the same search as the Journal's), `components/GuideLink.tsx`; the Guide's Back button, Android's back and the browser's own Back return to the page a link left, the same companion on Care, the same shop tab or open plant, scrolled as it was with focus on the link (`returnFrom` in `lib/routes.ts`; `putBackAt` in `lib/backNavigation.ts`, loaded when first needed; each history entry keeps its route in `history.state`, in `App.tsx`'s `navigate`) |
| Each species' three facts, shared as a bond grows, and where they were checked | `data/speciesFacts.ts` (loaded with Care, the Journal and the Guide, not the garden), `lib/speciesFacts.ts` (bond levels 1, 3 and 5), `components/FieldFacts.tsx` |
| My region: native marks and planting tips, chosen by hand | `lib/region.ts` (the ids a stored garden may hold), `lib/regionMarks.ts` (the words), `data/regions.ts` (what is native where, with sources), `lib/regionGuide.ts`, `components/guide/RegionGuide.tsx`, `components/RegionSetting.tsx` (and, for Elsewhere or no region, which half of the world: `Profile.hemisphere`, for the seasons only) |
| The soundscapes: what plays, how loud, and when it rests | `data/ambientTracks.ts` (the list), `lib/sound.ts` (volume, night's piano, the switches), `hooks/useAmbientSound.ts` (the audio context, its level, pauses and the fade-out), `lib/soundscapes.ts` (the synthesis, loaded when the sound first starts) |
| Breathing with a butterfly at `#/breathe` | `data/breathing.ts` (the patterns, gentle bounds), `lib/breathPacer.ts` (the phase at a time, one Web Animations timeline on the wings), `lib/breathTone.ts` (the optional tone, its own small audio context), `lib/breathing.ts` (once-a-day Sunlight, source `breath:<date>`), `components/BreathingView.tsx` (loaded when opened), `components/BreatheLink.tsx` (offered on the support page, a breathing goal's row, the next step and the recap); leaving returns to the way in, as the Guide does (`openBreathe` in `App.tsx`, `returnFrom`, `putBackAt`) |
| A companion grown alongside a goal | `lib/lifecycle.ts` (`careFromGoal`, `adoptGoal`, `releaseGoal`; the care day and stage rewards shared with care actions), `lib/companionDiary.ts` (`grownAlongside`), `lib/growAlongside.ts`, `components/care/GrowAlongside.tsx` |
| Calendar reminders, with no server | `lib/calendarReminder.ts` (the .ics text), `lib/reminderTime.ts`, `components/ReminderSetting.tsx`; `public/reminders/` (written by `scripts/reminder-files.mjs`, linked on iPhone and iPad at the real address only, never precached); the Android app opens the calendar's own new-event screen, filled in, through `lib/calendarEvent.ts` and `GardenFilesPlugin.addDailyEvent` (extras in `DailyEvent.java`; no calendar permission), and where no app on the phone has one saves the file through `saveTextFile` in `lib/download.ts` |
| Marigold's weekly letter, and the lines starred for it | `lib/letters.ts` (what is stored, first load), `lib/letterTiming.ts` (Sunday evening by the gardener's own hours), `lib/summaries.ts` (the week in words, never a score), `hooks/useLatestLetter.ts`, `components/garden/LetterCard.tsx`, `components/journal/Letters.tsx`, `components/journal/StarToggle.tsx`, `components/LetterSetting.tsx` |
| Noticed in Nature: the field book of real sightings, their photos, the month's line and nature projects | `lib/sightings.ts` (the rules, `fieldBookActions`, applied through `changeSightings` in `useGardenState`; nothing is earned), `lib/customBackdrops.ts` (the limits a stored garden is checked against), `lib/sightingPhotos.ts` (Blobs in storage, text in every file), `lib/photoCheck.ts` (a new photo tried first in a database of its own, and left out where the browser refuses it, as Safari's Private Browsing does), `lib/imageImport.ts` (`prepareSightingPhoto`, `verifyGardenImages`), `lib/sightingChoices.ts`, `data/whatToLookFor.ts` and `lib/whatToLookFor.ts`, `data/natureProjects.ts`, `components/sightings/` (loaded with the Journal's field notes and the Guide) |
| "Your garden's year" at `#/year`, and its postcard | `lib/gardenYear.ts` (the year's facts and words, counted by the letter's rules in `lib/summaries.ts`; the longest run of days cared for by `longestRunIn` in `lib/rhythm.ts`, said only with day counts shown), `components/YearView.tsx` (loaded when opened; back returns to the Journal), `components/year/YearLink.tsx` (the Journal's link, and its 1 December to 31 January line), `YearCalendar` in `components/WeatherCalendar.tsx` with `components/weatherCalendar.css`, `lib/postcard.ts` (drawn on the device from the sprites and the day's backdrop; nothing from the journal), `components/year/Postcard.tsx`, `lib/saveImage.ts` (a download, or `GardenFilesPlugin.saveBinaryDocument` in the app) |
| My comfort plan at `#/comfort`, a private page for harder days | `lib/comfortPlan.ts` (what is stored, in the profile, which an older build writes back whole; a number as it was written), `lib/comfortPlanEdits.ts` (loaded with the page; `telHref` takes `00` for `+` and leaves out a bracketed 0 after a country code, and the 0 opening a bracketed area code where the country writes one, never Italy's), `components/ComfortPlanView.tsx`, `components/ComfortLink.tsx` (offered on the support page, Settings' About card, and Today only on a gentle day); never quoted anywhere else. Leaving returns to the way in, as breathing does, and the support page the plan opens returns to the plan's own link; a plan the support page opened goes back to it, at its link to the plan, from its own way to support (`openComfort` and `openSupport` in `App.tsx`, `returnFrom`, `putBackAt`) |
| The garden lock: the journal sealed at rest, its lock screen, auto-lock and passkeys | `lib/sealing.ts` (WebCrypto PBKDF2-SHA-256 and AES-GCM, shared with protected backups), `lib/gardenLock.ts` (one random data key, sealed to a key pair for each way in: the passcode, the recovery code and a passkey; a new key whenever a secret changes), `lib/gardenLockActions.ts` (turn on and off, unlock, lock now, tell the other tabs, and what a lock could not keep: forms that are no draft mark themselves `data-lock-loses`), `lib/recoveryCode.ts` and `data/recoveryWords.ts`, `lib/passkey.ts` (WebAuthn PRF, only where it works: never in the Android app or on a site at an IP address), `repository/sealedStores.ts` (each part sealed under its own name), `repository/gardenSwitch.ts` (every lock change written into a fresh database, crash-safe, and the old one deleted), `repository/setAside.ts` (an unreadable garden set aside, checked against the lock), the gate in `main.tsx`, `components/lock/`; none of it loads for a garden with no lock |
| A protected backup: the plain backup file locked with a passphrase | `lib/sealedBackup.ts` (the `the-butterfly-garden-sealed` envelope; `formatVersion`, never `version`, so older builds refuse it cleanly), `lib/passphrase.ts`, `lib/backupFile.ts` (`sealedKind`, by the file's first field), `components/backup/` (`ProtectedBackupDialog` from Settings; `ProtectedRestore` and `SealedBackupPrompt` wherever a backup is restored); all loaded only when used |

## Invariants

Night and season artwork is loaded by `GardenView`: `data/backdropAssets.ts`
caches decoded day/night URLs separately; `garden/SeasonArt` loads the seasonal
CSS, and `garden/Moth` and `garden/Fireflies` load only where motion is allowed.
The scene gallery's thumbnails, by day and by night, are in
`data/backdropThumbnails.ts`, loaded with the gallery (the night ones are left
out of the precache); `backdrops.css`, which also styles the gallery, shows the
one for the theme on screen. `lib/seasons.ts` supplies the region's hemisphere,
or the one chosen for Elsewhere (`Profile.hemisphere`); `garden/GardenLine` loads the
day/night/season words separately. Pending keepsake/outfit art and provenance:
`docs/art/night-season-art.md` (no ownership or gift rules are enabled).

Each is pinned by tests, and each guards against a way to lose or corrupt a
journal. If a change makes one awkward, the change is wrong.

1. **A garden this build cannot read is never written over.** It is set aside
   in `quarantine`, saving stops, and `RecoveryScreen` explains.
2. **A tab never overwrites a newer write from another tab.** `meta.revision`
   orders writes. A stale tab gets `GardenConflictError`, reads the garden back
   and says its change was not kept. A tab that cannot adopt another's change
   stops writing.
3. **Updates replace, never mutate.** The repository compares collections by
   identity to find what changed (`sameCollection`). An in-place mutation
   would be read as "unchanged" and never saved.
4. **Every change is written straight away.** Nothing is debounced: a closed
   tab must not lose the reflection just written. A failed write is reported
   once, not retried in a loop. The one exception is a connection the browser
   closed under the garden: a write whose transaction will not open on it
   (InvalidStateError) is made once more on a fresh one, in the same turn of
   the queue (`writing` in `gardenRepository.ts`), unless this tab has
   deleted or forgotten the garden since the write began.
5. **A restore can be undone.** The garden it replaces is kept in
   `snapshots` first. Images in a backup are checked before anything is
   replaced.
6. **The backup format does not change shape.** It is the gardener's only way
   to a new device. Import accepts every older shape. The envelope only gains
   optional fields that older builds read past (`appVersion`, `revision`,
   `sha256`); the garden inside it is the same.
7. **Paid access is decided in one place.** The PWA's free preview can never
   pass for a purchase, and a backup never carries paid access.
8. **Nothing leaves the device** except Google Play Billing in the Android app.
   The CSP in `index.html` allows only `'self'`.
9. **A deleted garden is not written back.** A delete warns the other tabs
   first (`garden-clearing`), and a tab whose connection is told of it
   (`blocking`, with no new version) never writes again
   (`GardenDeletedElsewhereError`). A tab whose connection the browser had
   already dropped (`terminated`) is not told: its next save opens the new,
   empty database, and the revision check refuses it, because every garden a
   tab holds was read or written at revision 1 or more (an older garden's
   first read writes one) and an empty one reads as 0. Its drafts are refused
   there too: a tab that held a garden writes none where no garden is stored.
   A write the delete cut off, in the deleting tab or in one that has since
   forgotten the deleted garden, is not made again on a fresh connection
   (`writing`). A Web Lock around the delete would add nothing to these, so
   none is taken; the orderings are pinned in `repository/twoTabs.test.ts`
   ("4.2 a delete while another tab's connection is dropped") and
   `repository/gardenRepository.reconnect.test.ts` ("4.1 a write the delete
   cut off"). Two are not covered: a dropped tab that hears nothing until the
   deleting tab has begun a new garden and saved it, at revision 1 again; and
   in the deleting tab, a save still waiting behind one under way when the
   delete began, which runs once the delete is done and writes its garden
   into the new database.

The garden scene's sprite layout has two invariants of its own; `CLAUDE.md`
describes them.

## Toolchain

The dev toolchain moves within its current major versions; Dependabot
proposes those updates weekly, grouped. These are held on purpose, each
recorded as an `ignore` entry in `.github/dependabot.yml` with its reason:

| Held at | Not yet | Why |
| --- | --- | --- |
| TypeScript 6 (6.0.3) | TypeScript 7 | Its native compiler has no public API yet, so the type-aware lint (`typescript-eslint`) cannot run on it. |
| Vitest 4 (4.1.12), with `@vitest/coverage-v8` | Vitest 5 and its `@vitest/*` packages | The changelog is to be read first, against the coverage floors in `vite.config.ts` and the jsdom and fake-indexeddb setup. |
| vite-plugin-pwa 1 (1.3.0) | vite-plugin-pwa 2 | It writes the service worker and the web manifest, which decide what every installed copy updates to; the changelog is to be read first. |
| `@types/node` 24 | `@types/node` 25 and later | The app, CI and the docs run Node 24, and the types follow the runtime: newer ones would allow calls Node 24 does not have. They move with `node-version` in the workflows. |
| Playwright 1.63 (`@playwright/test` and `playwright`) | 1.64 and later | It brings a newer browser build; held by the owner on 1 November 2026 (`docs/final-run/decision-plan.md`, 5.7). The two packages move together. |
| The Gradle wrapper 8 (8.14.6) | Gradle 9 | The Android Gradle Plugin in use (8.13) relies on an internal Gradle API that 9.6 removed. The wrapper moves to 9 with AGP 9, once Capacitor supports it. |
| `@axe-core/playwright` 4.13 | 4.14 and later | 4.14 enforces `label-content-name-mismatch` (serious), which finds controls whose name leaves out their visible words across the app, the header's pills among them. 55 e2e sweeps fail on it. Fix the labels first. |
| jsdom 30.0 | 30.1 and later | 30.1 fires `<details>`' toggle event itself and computes some backgrounds differently. Nine unit tests were written around 30.0 (the notices' toggle, the danger buttons' colours, a field-book photo's address) and are to be adapted first. |

Vite is at 8.3.5, within its major. The `android-webview` e2e project
runs on the same Playwright as the rest, so a Playwright bump runs the whole
e2e suite.

**Next review: January 2027**, then every quarter: read each held major's
changelog, lift its `ignore` entry or move its review date on, and update
this table.

## Tests

| Layer | Tool | Where |
| --- | --- | --- |
| Rules, reducers, repository, hooks, components | Vitest + jsdom + fake-indexeddb | `src/**/*.test.ts(x)`; `npm test` enforces coverage floors |
| Two tabs at once | Vitest, two repository instances | `repository/twoTabs.test.ts` |
| The app in a browser, with axe sweeps that fail on moderate violations and worse | Playwright | `e2e/app.spec.ts`, `e2e/breathe.spec.ts`, `e2e/comfort.spec.ts`, `e2e/keep.spec.ts`, `e2e/lock.spec.ts`, `e2e/move.spec.ts`, `e2e/nature.spec.ts`, `e2e/nature.photoRefused.spec.ts`, `e2e/protected.spec.ts`, `e2e/reminders.spec.ts`, `e2e/seasons.spec.ts`, `e2e/shell.spec.ts`, `e2e/year.spec.ts`: Chromium locally; Safari and Firefox in CI |
| What every page is drawn with | Playwright, Chromium only | `e2e/visual.spec.ts`: computed styles against `e2e/style-baselines/`, written again with `UPDATE_STYLE_BASELINES=1 npx playwright test e2e/visual.spec.ts` |
| No layout every frame while the garden moves | Playwright, Chromium's DevTools protocol | `e2e/perf.spec.ts` |
| The Android bundle | Playwright, phone-sized Chromium | `e2e/android.spec.ts`, and a short set of `e2e/visual.spec.ts` |
| Native code | Gradle unit tests and lint | `android/` |

`CLAUDE.md` lists the checks to run before pushing.
