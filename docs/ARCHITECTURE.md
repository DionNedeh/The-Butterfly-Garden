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
IndexedDB      one store per collection, plus meta, quarantine, snapshots and
               drafts (layout: docs/handoff-p5-store-split.md §4)
               ⇄ backup file: { format, exportedAt, appVersion, garden }
```

A tap on "complete" calls `actions.completeGoal`. That runs
`gardenActions.completeGoal` on the current garden. The new garden renders. The
save effect in `usePersistence` hands it to `repository.save`. The repository
works out which parts changed and writes only those, in one transaction. It then
tells other tabs which parts it wrote.

## Where each concern lives

| Concern | Where |
| --- | --- |
| The app shell, pages, hash routes, error boundaries | `App.tsx`, `lib/routes.ts` |
| The navigation: header, dock, and on phones five tabs and More | `App.tsx` (the pages), `lib/navigation.ts` (dock order, badges) |
| What a purchase did, or why it did not | `lib/purchase.ts`, beside the shop's rules in `lib/wardrobe.ts`, `lib/jars.ts`, `lib/flightPatterns.ts` |
| Jars: the characters (each checked against the bundled fonts), recycling and its undo, alike jars stacked, a mark said by its name | `data/jars.ts` (with the marks' spoken names), `lib/jars.ts` (buy, place, recycle, undo; `jarName` shown, `jarSpokenName` said), `lib/jarStacks.ts`, `components/Spoken.tsx` (a glyph shown, its name said), `components/shop/JarShelf.tsx`, `components/garden/JarManager.tsx` (loaded with a plant's panel) |
| The header's tabs, the phone's five-tab dock and its More sheet | `components/Navigation.tsx`, `lib/navigation.ts` |
| Last-resort screens | `main.tsx` → `SafeMode` (nothing could draw); `RecoveryScreen` (stored garden unreadable); `ViewProblem` (one page failed) |
| Types of everything stored | `types.ts` |
| Reading, writing, conflicts, quarantine, snapshots | `repository/gardenRepository.ts` |
| What counts as a valid garden, and migrations | `repository/validateGarden.ts` |
| Asking the browser not to evict the garden | `lib/storage.ts` |
| Unsaved text that survives a reload | `lib/drafts.ts`, `hooks/useSyncedDraft.ts` |
| A check-in's feelings and energy, and the one next step offered after it | `data/feelings.ts`, `lib/feelings.ts` (what is stored, and in what words), `lib/nextStep.ts`, `components/checkin/` |
| Ideas for goals, their two-minute versions, a balanced mix | `data/goalSuggestions.ts` (loaded with Today and onboarding only), `lib/goalSuggestions.ts` |
| Restoring a chosen file | `lib/backupFile.ts` (size and read), `lib/backupPreview.ts` (what it holds) |
| Suggesting a fresh backup | `lib/backupReminder.ts` (when, and in what words); `lib/shareFile.ts` (*Share backup…* in a browser that can) |
| A gardener's own images, by day and by night | `lib/imageImport.ts` (the checks before decoding; resizing and quarter turns in one draw), `lib/customBackdrops.ts` (limits, crop, which image shows by day and which by night), `lib/backdropEdits.ts` (the editor's turns and brightness) |
| The Garden Pass: who may use what | `lib/gardenPass.ts`, the only access boundary; `lib/passEntitlement.ts`, `lib/playBilling.ts` behind it |
| Android: back gesture, files, billing | `lib/backNavigation.ts`, `lib/native.ts`, `android/app/src/main/java/…` |
| Moving the PWA to another address | `lib/hosting.ts`, `docs/moving-the-garden.md` |
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
| The Guide as a reference: its contents, its search, and a "What does this do?" link from each meter | `components/GuideView.tsx` (sections, `#/guide/{section}` in `lib/routes.ts`), `lib/searchText.ts` (the same search as the Journal's), `components/GuideLink.tsx`; the Guide's Back button and Android's back return to the page a link left, the same companion on Care, scrolled as it was with focus on the link (`returnFrom` in `lib/routes.ts`, `putBackAt` in `lib/backNavigation.ts`) |
| Each species' three facts, shared as a bond grows, and where they were checked | `data/speciesFacts.ts` (loaded with Care, the Journal and the Guide, not the garden), `lib/speciesFacts.ts` (bond levels 1, 3 and 5), `components/FieldFacts.tsx` |
| My region: native marks and planting tips, chosen by hand | `lib/region.ts` (the ids a stored garden may hold), `lib/regionMarks.ts` (the words), `data/regions.ts` (what is native where, with sources), `lib/regionGuide.ts`, `components/guide/RegionGuide.tsx`, `components/RegionSetting.tsx` |
| The soundscapes: what plays, how loud, and when it rests | `data/ambientTracks.ts` (the list), `lib/sound.ts` (volume, night's piano, the switches), `hooks/useAmbientSound.ts` (the audio context, its level, pauses and the fade-out), `lib/soundscapes.ts` (the synthesis, loaded when the sound first starts) |
| Breathing with a butterfly at `#/breathe` | `data/breathing.ts` (the patterns, gentle bounds), `lib/breathPacer.ts` (the phase at a time, one Web Animations timeline on the wings), `lib/breathTone.ts` (the optional tone, its own small audio context), `lib/breathing.ts` (once-a-day Sunlight, source `breath:<date>`), `components/BreathingView.tsx` (loaded when opened), `components/BreatheLink.tsx` (offered on the support page, a breathing goal's row, the next step and the recap); leaving returns to the way in, as the Guide does (`openBreathe` in `App.tsx`, `returnFrom`, `putBackAt`) |
| A companion grown alongside a goal | `lib/lifecycle.ts` (`careFromGoal`, `adoptGoal`, `releaseGoal`; the care day and stage rewards shared with care actions), `lib/companionDiary.ts` (`grownAlongside`), `lib/growAlongside.ts`, `components/care/GrowAlongside.tsx` |
| Calendar reminders, with no server | `lib/calendarReminder.ts` (the .ics text), `lib/reminderTime.ts`, `components/ReminderSetting.tsx`; `public/reminders/` (written by `scripts/reminder-files.mjs`, linked on iPhone and iPad at the real address only, never precached); the Android app saves the file through `saveTextFile` in `lib/download.ts` |
| Marigold's weekly letter, and the lines starred for it | `lib/letters.ts` (what is stored, first load), `lib/letterTiming.ts` (Sunday evening by the gardener's own hours), `lib/summaries.ts` (the week in words, never a score), `hooks/useLatestLetter.ts`, `components/garden/LetterCard.tsx`, `components/journal/Letters.tsx`, `components/journal/StarToggle.tsx`, `components/LetterSetting.tsx` |
| Noticed in Nature: the field book of real sightings, their photos, the month's line and nature projects | `lib/sightings.ts` (the rules, `fieldBookActions`, applied through `changeSightings` in `useGardenState`; nothing is earned), `lib/customBackdrops.ts` (the limits a stored garden is checked against), `lib/sightingPhotos.ts` (Blobs in storage, text in every file), `lib/imageImport.ts` (`prepareSightingPhoto`, `verifyGardenImages`), `lib/sightingChoices.ts`, `data/whatToLookFor.ts` and `lib/whatToLookFor.ts`, `data/natureProjects.ts`, `components/sightings/` (loaded with the Journal's field notes and the Guide) |
| "Your garden's year" at `#/year`, and its postcard | `lib/gardenYear.ts` (the year's facts and words, counted by the letter's rules in `lib/summaries.ts`), `components/YearView.tsx` (loaded when opened; back returns to the Journal), `components/year/YearLink.tsx` (the Journal's link, and its 1 December to 31 January line), `YearCalendar` in `components/WeatherCalendar.tsx` with `components/weatherCalendar.css`, `lib/postcard.ts` (drawn on the device from the sprites and the day's backdrop; nothing from the journal), `components/year/Postcard.tsx`, `lib/saveImage.ts` (a download, or `GardenFilesPlugin.saveBinaryDocument` in the app) |
| My comfort plan at `#/comfort`, a private page for harder days | `lib/comfortPlan.ts` (what is stored, in the profile, which an older build writes back whole; a number as it was written), `lib/comfortPlanEdits.ts` (loaded with the page; `telHref` leaves out a bracketed 0 after a country code), `components/ComfortPlanView.tsx`, `components/ComfortLink.tsx` (offered on the support page, Settings' About card, and Today only on a gentle day); never quoted anywhere else. Leaving returns to the way in, as breathing does, and the support page the plan opens returns to the plan's own link (`openComfort` and `openSupport` in `App.tsx`, `returnFrom`, `putBackAt`) |
| The garden lock: the journal sealed at rest, its lock screen, auto-lock and passkeys | `lib/sealing.ts` (WebCrypto PBKDF2-SHA-256 and AES-GCM, shared with protected backups), `lib/gardenLock.ts` (one random data key, wrapped by the passcode, the recovery code and a passkey; a new key whenever a secret changes), `lib/gardenLockActions.ts` (turn on and off, unlock, lock now, tell the other tabs), `lib/recoveryCode.ts` and `data/recoveryWords.ts`, `lib/passkey.ts` (WebAuthn PRF, only where it works), `repository/sealedStores.ts` (each part sealed under its own name), `repository/gardenSwitch.ts` (every lock change written into a fresh database, crash-safe, and the old one deleted), the gate in `main.tsx`, `components/lock/`; none of it loads for a garden with no lock |
| A protected backup: the plain backup file locked with a passphrase | `lib/sealedBackup.ts` (the `the-butterfly-garden-sealed` envelope; `formatVersion`, never `version`, so older builds refuse it cleanly), `lib/passphrase.ts`, `lib/backupFile.ts` (`isSealedBackup`, by the file's first field), `components/backup/` (`ProtectedBackupDialog` from Settings; `ProtectedRestore` and `SealedBackupPrompt` wherever a backup is restored); all loaded only when used |

## Invariants

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
   once, not retried in a loop.
5. **A restore can be undone.** The garden it replaces is kept in
   `snapshots` first. Images in a backup are checked before anything is
   replaced.
6. **The backup format does not change shape.** It is the gardener's only way
   to a new device. Import accepts every older shape.
7. **Paid access is decided in one place.** The PWA's free preview can never
   pass for a purchase, and a backup never carries paid access.
8. **Nothing leaves the device** except Google Play Billing in the Android app.
   The CSP in `index.html` allows only `'self'`.

The garden scene's sprite layout has two invariants of its own; `CLAUDE.md`
describes them.

## Tests

| Layer | Tool | Where |
| --- | --- | --- |
| Rules, reducers, repository, hooks, components | Vitest + jsdom + fake-indexeddb | `src/**/*.test.ts(x)`; `npm test` enforces coverage floors |
| Two tabs at once | Vitest, two repository instances | `repository/twoTabs.test.ts` |
| The app in a browser, with axe sweeps | Playwright | `e2e/app.spec.ts`: Chromium locally; Safari and Firefox in CI |
| The Android bundle | Playwright, phone-sized Chromium | `e2e/android.spec.ts` |
| Native code | Gradle unit tests and lint | `android/` |

`CLAUDE.md` lists the checks to run before pushing.
