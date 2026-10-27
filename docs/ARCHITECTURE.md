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
| A gardener's own images | `lib/imageImport.ts` (header check before decode, resize), `lib/customBackdrops.ts` (limits, crop) |
| The Garden Pass: who may use what | `lib/gardenPass.ts`, the only access boundary; `lib/passEntitlement.ts`, `lib/playBilling.ts` behind it |
| Android: back gesture, files, billing | `lib/backNavigation.ts`, `lib/native.ts`, `android/app/src/main/java/…` |
| Moving the PWA to another address | `lib/hosting.ts`, `docs/moving-the-garden.md` |
| The installed PWA: icons, shortcuts, screenshots | `pwaManifest.ts`; `scripts/pwa-assets.mjs` renders the shortcut icons and screenshots |
| Moments worth saying aloud | `lib/gardenEvents.ts` → `lib/announcer.ts` → `Celebrations` |
| The garden pace: Classic, or Keep giving (a host in bloom blooms again) | `lib/gardenPace.ts` (the rule), `awardSunlight` in `lib/progression.ts` (the bloom), `lib/plantManagement.ts` (what the plant's panel says) |
| The last visit, and a small welcome back after a few days away | `lib/visits.ts` (noted at most once a day by `useGardenState`), `lib/welcomeBack.ts` (the line), `components/garden/WelcomeBack.tsx` (loaded only on such a day) |
| A companion's story and the closet's saved looks | `lib/companionDiary.ts` (what is written down as it happens, and the limits storage checks), `lib/companionStory.ts` (the story told from it), `lib/outfitPresets.ts` and `lib/wardrobe.ts` (saving and wearing looks, who wears what; the looks are kept in the profile, which an older build writes back whole, not beside it in `meta`, which it writes field by field), `components/care/` |
| Motion preferences and animation | `lib/motion.ts`, `hooks/useFlightMotion.ts`, `components/sprites/` |
| Where each butterfly flies, and meeting one | `lib/flightMotion.ts` (a lane of sky each), `lib/flightPatterns.ts` (`flightPatternFor`: a companion's own pattern or the garden's), `components/ButterflyCard.tsx` (the card a tap opens, with Pet and *Care for {name}*) |
| The theme, chosen or followed (device, evening), and text size | `lib/theme.ts` (the rule), `hooks/useEffectiveTheme.ts` (when it turns), `lib/textSize.ts`; the shell applies them in `App.tsx` |
| The soundscapes: what plays, how loud, and when it rests | `data/ambientTracks.ts` (the list), `lib/sound.ts` (volume, night's piano, the switches), `hooks/useAmbientSound.ts` (the audio context, its level, pauses and the fade-out), `lib/soundscapes.ts` (the synthesis, loaded when the sound first starts) |

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
