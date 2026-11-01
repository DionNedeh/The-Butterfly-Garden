# Final run: execution plan

Started on 1 November 2026, on `main` at b3f7da1. That commit has 3.6 integrated as source only; the live app is 3.5.

This run finishes what [the final-PR plan](../final-pr-plan.md) left. Each item's full text is that plan's numbered step: this file says what the run builds, in what order, and records what each item did. The [decision plan](decision-plan.md) holds every item that waits on the owner, the questions raised during the run, and the checks only the owner's machine can make.

## The owner's directions

From the message that started the run, on 1 November 2026:

> We need to go over the last few PRs and complete the remaining bits of the plan. Be advised now that you are to follow the new method.

> Also be aware you may push, commit, and fully merge, as everything is verified.

The answers to the run's four opening questions:

- **Deploying:** "Deploy after checks". First finish 3.6's acceptance; then each round's PR runs full CI and deploys when it is merged.
- **Decisions:** "Park them". Build only what needs no decision, and write the rest into the decision plan, with each question and a recommendation.
- **Packages:** "No new dependencies". The lockfile stays as it is, and upgrades go to the decision plan.
- **Releases:** "One per merged round". Each merged PR that changes the app is its own release, with its own notes.

## How the run works

- **Rounds.** The run goes in rounds of two clusters. Each cluster is a few items in one area, built by an agent in its own git worktree.
- **Three stages per cluster:** implement, then an independent review that tries to refute the work, then a fix of every finding that holds.
- **Red first.** Every new test is first seen to fail on the unchanged code, and a few hand-made mutants check that it guards the item's claim.
- **The integrator** merges each pair and runs every check on the merge. It writes the records below, opens the round's PR and merges it once CI is green.
- **The baseline.** Every check was run first on b3f7da1. Later runs are compared with that baseline by test name.

## Where the last PRs left things

- **#69, release 3.5:** the night paintings, moonlight, moths, seasonal petals, leaves, frost and snow, and the seasons patch they build on. It also added drawings of the keepsakes, the outfits and a jar heart, but none of them is in the app yet: the owner chose art only, with their rules pending. Its own record is [docs/art/night-season-art.md](../art/night-season-art.md).
- **b3f7da1, release 3.6:** moving to a new device, kept copies and the damaged-snapshot recovery. It was merged as source only, with CI skipped and its acceptance unfinished; see [section-2-verification.md](../section-2-verification.md) and [section-2-follow-ups.md](../section-2-follow-ups.md).
- **Round 0** of this run finishes that acceptance, so 3.6 can deploy.

## Rounds

| Round | Release | Cluster | Items |
|---|---|---|---|
| R0 | 3.6.0 deploys | integrator | 3.6 acceptance: the full checks on b3f7da1, the two e2e failures it left, knip, Gradle |
| R1 | 3.7.0 | K1 lock-and-forms | 3.2, 3.4, 6.10, 3.3 |
| R1 | 3.7.0 | K2 data-safety | 4.1, 4.2, 4.3, 4.4, 4.5 |
| R2 | 3.8.0 | K3 guide-and-addresses | 6.4, 6.5, 6.6, 6.7, 5.11 |
| R2 | 3.8.0 | K4 seasons-and-today | 1.4, ART-8, 6.2, 6.3, 6.8, 6.9 |
| R3 | 3.9.0 | K5 guards | 5.3, 5.8, 5.4, 5.5, 5.2 |
| R3 | 3.9.0 | K6 hosting-and-android | 5.1, 6.11, 5.7 |
| R4 | as needed | K7 docs | 5.9, 5.10, 7.2 |

## Round R0 record

The checks on b3f7da1, run on 1 November 2026:

- **Static:** typecheck and lint pass. knip passes too: its one complaint in the first run was this run's own temporary Playwright config, and a rerun without it is clean. That settles the unused-code check 3.6 left unrun.
- **Unit:** 254 files and 3,005 tests pass, with 96.48% of lines and 91.86% of branches covered.
- **Budgets:** the web first load is 159.8 kB, entry 98.7 kB; the Android first load is 160.5 kB of 160.7, entry 98.2 kB.
- **Android:** `build:android`, `cap sync` and `lintRelease testReleaseUnitTest assembleDebug bundleRelease` pass.
- **e2e:** 169 tests pass and 1 is skipped. Three fail, and fail again when each is rerun alone three times:
  - **The offline relaunch** (`app.spec.ts:1379`). It fails on mobile already at #69's merge here, though #69's CI passed it. The test went offline before the service worker had installed the whole precache and taken the page. #69's larger precache made that likely on a slower machine, and 3.6 made desktop fail too. The test now waits for the worker to be ready and to control the page.
  - **The kept backup file, on desktop and mobile** (`keep.spec.ts:161`). Chromium 1243, the build this Playwright pins and CI installs, closes the whole browser when a handle from the origin's private file system is put into IndexedDB. A probe showed that every other step works. A real save screen hands over a file on disk, which IndexedDB keeps, so the test's stand-in handle now stays in the page, with a token in IndexedDB.
- **After the fixes:** both tests pass three times each in both projects, 24 runs in all.
- **The comfort-plan failure 3.6 noted** (`comfort.spec.ts:132`) passed in the baseline.
- **CI's first run of 3.6's tests** (on the R0 PR) found one more race, in `keep.spec.ts:36`: it counted the "Before a restore" rows before Settings had listed them. It now waits for the first row; the spec then passed three times in both projects.

## Round R1 record (release 3.7.0)

- **Clusters:** K1, lock and forms (3.2, 3.4, 6.10, 3.3), and K2, data safety (4.1–4.5). Each was implemented, then reviewed by an agent told to refute it, then fixed. The item records are below.
- **What review found:** K2's reviewer found that the new save retry could write a just-deleted garden back; a generation check now stops it. K1's reviewer found that the goal editor's auto-lock hold could come back on every visit; it now holds none, since its words are a draft. It also found two smaller faults (focus taken by a restored editor, and an edit lost to another tab called a sighting not saved) and two forms that lost words silently. All are fixed.
- **Merge:** both clusters were squash-merged on `main` b30676a, with no conflicts. The three files both clusters changed (`docs/ARCHITECTURE.md`, `SettingsView.tsx`, `usePersistence.ts`) were checked to hold each cluster's change exactly.
- **Full checks on the merged pair (4af30f8):** all pass.
  - Typecheck, lint and knip.
  - 272 unit files and 3,088 tests, with 96.59% of lines and 91.97% of branches covered.
  - 175 e2e tests, with 2 skipped.
  - Gradle.
  - Budgets: the web first load is 160,048 B and the Android first load 160,637 B, against a 160,713 B limit, so Android has 76 B to spare.
- **Questions for the owner and ideas** are in the decision plan, under Round R1.

The parked items, in the decision plan: 1.3, 1.5, ART-6, ART-7, ART-10, 2.2, 3.5, 3.6, 5.1 (the move), 5.2 (required job), 5.5 (baseline and caps), 5.6, 5.7 (Playwright bump), 5.12, 6.1, 6.12, 6.13, 6.14, 7.1, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6.

## Done before this run

These steps are complete on `main`. What remains of them is acceptance on real devices, which is in the decision plan's notes for the owner's machine.

- **1.1 Land the seasons and night garden without art (`c4-seasons.patch`).** #69 applied the seasons patch (data-season, fireflies, night and season lines, seasonal prompts).
- **1.2 Night images per scene, and moths: the code.** #69: a night painting per scene in backdropAssets, chosen by the theme on screen; moths at nectar plants.
- **ART-1 A night painting of each built-in scene.** #69: seven night paintings in src/assets/garden-*-night.webp.
- **ART-2 Moonlight sheen in place of the sun shimmer at night.** #69: the moonlight in place of the sun shimmer at night.
- **ART-3 Moths visiting the nectar plants at night.** #69: two moth designs in src/components/garden/Moth.tsx.
- **ART-4 Season overlays for spring, summer and autumn: dressing the falling petals.** #69: seasonal petals, pollen and autumn leaves.
- **ART-5 Winter overlay: frost at the scene's edges and a few slow snowflakes.** #69: still frost and snow.
- **ART-9 Re-render the install and store screenshots after the art lands.** #69 refreshed the PWA and Play screenshots; final presentation on devices is a note for the owner's machine.
- **2.1 Review and merge “Move my garden to another device” (`c4-move.patch`).** 3.6 (b3f7da1): moving with a protected file and 12 typed words.
- **2.3 Offer “Arrive from another device” in safe mode.** 3.6: Arrive in safe mode.
- **2.4 Review and merge “keep a copy” (`c4-keep.patch`).** 3.6: daily copies and the kept-up-to-date backup file.
- **2.5 List the kept pre-restore copies in Settings after a reload.** 3.6: earlier copies listed in Settings after a reload.
- **3.1 A damaged pre-restore snapshot must not block every lock change.** 3.6: a damaged snapshot has its own message, with download and discard.

## Items

### 3.2 Nothing typed is lost when the garden locks

*R1 K1 · [final-pr-plan.md](../final-pr-plan.md), step 3.2*

**Record (R1 K1, 272a1fa).** Status: partial.
- **What changed.** "Lock now" in another tab unmounted the app at once and lost what was being typed. Today's new-goal form was neither a draft nor held the auto-lock, so auto-lock lost it too. Today's new-goal title and two-minute version are now drafts (`goal-new:title`, `goal-new:tiny-title`). The goal editor is a draft under one JSON key, `goal-edit`, and reopens as it was after any lock, reload or page change. Review fixes: the goal editor no longer holds the auto-lock when its words are a draft (onEdit given, as on Today), so a left-open editor no longer keeps the garden from locking. The Settings copy now names only a sighting or a garden image. An editor put back from a draft no longer takes focus: only an explicit Edit (focusRequest > 0) does, so focus stays where the gardener or the unlock left it. The audit gaps are closed with `data-lock-loses`: MonthPlanner's plan title says "the goal you were planning" (on its section, so folded or on a past day it still counts), and Settings' name and garden-name fields say "the new name you were typing" whenever Save would change a name. The sighting form and the garden-image editor still hold the auto-lock and say what was lost to a lock that does not wait. lockGarden reads every `[data-lock-loses]` before the app goes, and the lock screen says, for example, "The sighting you were writing was not saved when the garden locked."
- **Where.** src/components/TodayView.tsx (new-goal drafts; editingId from the `goal-edit` draft; effect that clears a draft whose goal is gone); src/components/GoalEditor.tsx (`kept`, `onEdit`; `data-auto-lock-waits={onEdit ? undefined : ''}`; focus effect `if (focusRequest > 0 || !drafted.current)`); new src/lib/goalEditDraft.ts; src/lib/gardenLockActions.ts (notKept, notKeptOnLock(), forgetNotKept(), lockGarden reads [data-lock-loses]; comment revised); src/components/lock/LockScreen.tsx (notKeptSentence, line under the heading, aria-describedby); src/components/sightings/SightingForm.tsx and src/components/CustomBackdropEditor.tsx (data-lock-loses); src/components/MonthPlanner.tsx (section data-lock-loses while planTitle.trim()); src/components/SettingsView.tsx (`changes`/`renaming` near nameNote, data-lock-loses on the profile form); src/components/lock/LockSettings.tsx (auto-lock hint copy); src/components/lock/LockWatch.tsx (doc comment); docs/ARCHITECTURE.md; e2e/lock.spec.ts (describe '3.2 …').
- **Contracts.** Draft keys (in the existing drafts store, sealed under the lock): `goal-new:title`, `goal-new:tiny-title`, and `goal-edit`, which holds JSON {id, title?, tinyTitle?, schedule?, weekdays?, plannedFor?}. goalEditFrom validates it on read. No AppState, DATABASE_VERSION or CURRENT_STATE_VERSION change. DOM attribute `data-lock-loses="<phrase>"`, now also on MonthPlanner's section ("the goal you were planning") and on Settings' profile form ("the new name you were typing"). GoalEditor: `data-auto-lock-waits` is set only when no `onEdit` is given. An editor given `kept` takes focus only when `focusRequest > 0`. Exports: notKeptOnLock(), forgetNotKept() (lib/gardenLockActions); GOAL_EDIT_DRAFT, GoalEditFields, goalEditFrom (lib/goalEditDraft). Settings copy changed to: "It waits while you are choosing a photo or a file, or have a sighting or a garden image open to edit, so nothing you are part-way through is lost."
- **Tests (20).** src/components/TodayView.drafts.test.tsx: 3.2 a goal being added on Today > is kept as a draft, so it is still there when Today is drawn again; src/components/TodayView.drafts.test.tsx: 3.2 a goal being added on Today > lets the draft go once the goal is added; src/components/TodayView.drafts.test.tsx: 3.2 a goal being edited on Today > is kept as a draft, open, with what was typed in it; src/components/TodayView.drafts.test.tsx: 3.2 a goal being edited on Today > lets the draft go once the editor is put away; src/components/TodayView.drafts.test.tsx: 3.2 a goal being edited on Today > opens nothing for a goal that is no longer there, and lets that draft go; src/components/TodayView.drafts.test.tsx: 3.2 a goal being edited on Today > opens on the goal itself where a draft cannot be read; src/components/TodayView.drafts.test.tsx: 3.2 a goal being edited on Today, as a draft, and the auto-lock and focus > holds no auto-lock, open or put back from its draft, its words being kept (review fix); src/components/TodayView.drafts.test.tsx: 3.2 a goal being edited on Today, as a draft, and the auto-lock and focus > put back from its draft, leaves focus where it was, and takes it once Edit is chosen (review fix); src/components/lock/LockWatch.forms.test.tsx: 3.2 the auto-lock with a goal being added on Today > goes ahead in its time, and the goal comes back once the garden is opened; src/components/lock/LockWatch.forms.test.tsx: 3.2 the auto-lock with a goal being edited on Today > goes ahead in its time, though Today was left with the editor open, and the editor comes back as it was (review fix); src/components/lock/LockWatch.forms.test.tsx: 3.2 what a lock could not keep > is said on the lock screen, beside the passcode, and only after the lock that lost it; src/components/lock/LockWatch.forms.test.tsx: 3.2 what a lock could not keep > names one thing on its own; src/components/lock/LockWatch.forms.test.tsx: 3.2 what a lock could not keep, from the forms that are no draft > is a goal being planned on the month, and nothing once it is planned (review fix); src/components/lock/LockWatch.forms.test.tsx: 3.2 what a lock could not keep, from the forms that are no draft > is a new name being typed in Settings, and nothing once it is saved, or as it was (review fix); src/App.lock.forms.test.tsx: 3.2 Lock now in another tab, part-way through a form > keeps a new goal being typed on Today, and puts it back in its form; src/App.lock.forms.test.tsx: 3.2 Lock now in another tab, part-way through a form > keeps a goal being edited, open, with what was typed in it; src/App.lock.forms.test.tsx: 3.2 Lock now in another tab, part-way through a form > says a sighting being written was not kept; src/App.lock.forms.test.tsx: 3.2 a goal editor put back after an unlock > leaves focus on the page’s heading, where the unlock puts it, not in the editor (review fix); src/components/lock/LockSettings.test.tsx: while the lock is on and open > chooses when it locks by itself, off by default (revised: expected copy no longer names a goal); e2e/lock.spec.ts: 3.2 Lock now in another tab, part-way through > a goal being added comes back in its form, and a sighting being written is said not to be kept
- **Red first.** Implement stage: 11 of 13 new tests failed on base b9db1e6 (the two 'lets the draft go' guards passed by design); the e2e failed at lock.spec.ts:497. Review fixes: all 7 new tests and the revised copy assertion ran on unchanged HEAD 34bb8c4 product code, and all 8 failed (SP/k/K1/fix/red.txt). The failures were: TodayView.drafts:127 `expected <form …> to be null` (the hold is present); TodayView.drafts:143 `toHaveFocus` expected the 'Somewhere else' button but got the INPUT with value 'Alpha by the window'; LockWatch.forms:173 `expected 'unlocked' to be 'locked'`; LockWatch.forms:207 `Unable to find … The goal you were planning was not saved when the garden locked.`; LockWatch.forms:248 `Unable to find … The new name you were typing was not saved…`; App.lock.forms:136 `toHaveFocus` expected the h1 'Today' but got the editor's INPUT; LockSettings.test:335 `toHaveAccessibleDescription` (old copy).
- **Mutation.** Implement stage: 3 run / 3 killed (new-goal title back to useState; kept dropped; notKept assignment dropped). Review fixes: 3 run / 3 killed. (1) GoalEditor hold back to `data-auto-lock-waits=""`: killed by TodayView.drafts 'holds no auto-lock…' and LockWatch.forms 'goes ahead in its time, though Today was left…'. In that run, 'is a goal being planned on the month' also failed, as a knock-on of the failing test before it; it passes alone under the same mutant and 3 of 3 times on the fixed code. (2) Focus effect back to an unconditional focus: killed by TodayView.drafts 'put back from its draft, leaves focus…' and App.lock.forms 'leaves focus on the page’s heading…'. (3) Settings `data-lock-loses` never set: killed by LockWatch.forms 'is a new name being typed in Settings…'. The MonthPlanner attribute was not mutated separately (a cap of three per item); its red-first failure covers it.
- **Departures from the plan.** The plan says to keep every form's text as drafts. The sighting form and the garden-image editor are not drafted: their open state lives in JournalView, FieldBook and GuideView, and a photo or image cannot be a draft. Instead they say what was not kept. MonthPlanner's plan title and Settings' names are told-not-kept rather than drafted: the planner's day is plain state too, so drafting the title alone would bring it back under another day. The add-goal form's Repeat choice and days stay plain state. Revised test (rule 4, item text: the hold "can get a time limit or go"): one expected string in LockSettings.test.tsx 'chooses when it locks by itself, off by default' now reads "…a sighting or a garden image…", because the copy has to stay honest once the goal editor stops holding. GoalEditor keeps its hold when no onEdit is passed, so GoalEditor.test.tsx 'holds the auto-lock while it is open…' and LockGate.test.tsx 'waits while a goal is open to edit…' are unchanged and still true. The requested usePersistence test is src/App.lock.forms.test.tsx, which drives that handler through the sync channel.
- **Not verified here.** Firefox and WebKit (CI only). The Android app on a device: auto-lock with the goal editor open while the app is in the background was covered only by jsdom and the Chromium android-webview e2e project. The screen-reader announcement of the not-kept line through aria-describedby: only the accessible description was asserted. No screen reader was run.
- **Hands-on.** **Lock now from another tab, part-way through.** Turn the lock on and open the garden in two tabs. In tab B, type a goal in Today's "Add a goal", then open Guide, choose "Log a sighting of Monarch" and type a few words. In tab A, choose Settings → Lock now. Tab B shows "The sighting you were writing was not saved when the garden locked." Unlock and go to Today: the goal is still in "Add a goal". **A goal editor left open.** With auto-lock at 1 minute, choose Edit on a goal on Today and change its title. Go to Garden, then back to Today: the editor is open with your change, and focus has stayed where it was (the page does not jump down to it). Hide the tab for over a minute: the garden locks. Unlock: the editor is back as it was, and focus is on the page heading. **Short text a lock loses.** In Settings, type a new garden name without saving, then Lock now: the lock screen says "The new name you were typing was not saved when the garden locked." The same happens with Today's "Plan a goal for this day", which says "The goal you were planning…".
- **Question for the owner.** Should the holds that remain (an open sighting form, the garden-image editor, an open file chooser) get a time limit, after which the garden locks anyway and the lock screen says what was lost? The data-lock-loses line already does the telling. Not built, per cluster note (b). The goal editor's hold is gone, because its draft made it unnecessary. (in the decision plan)
- **For neighbours.** SettingsView.tsx: my only edits are a 4-line `changes`/`renaming` block after `const nameNote = noteForName(name)` (~line 712) and one attribute on the profile `<form>` (~line 734). K2's SettingsView hunks do not overlap them. usePersistence.ts: only 6.10's two `reason: 'conflict'` lines (~105 and ~288). GoalEditor still holds the auto-lock when it is rendered without onEdit; the LockGate and GoalEditor tests rely on that. Every other caller should pass onEdit only if it drafts the words. Remaining plain-state notes (ReminderSetting, JournalExport, EarlierCopies, AutoBackupSetting) are status lines, not typed text. Passcode, recovery and passphrase fields are never drafts. The `goal-new:*` and `goal-edit` keys carry no day, so 7-day pruning never drops them; they clear on add, Save, Cancel, Archive, Delete or when the goal goes away.

### 3.4 A cancelled photo picker must not close the form

*R1 K1 · [final-pr-plan.md](../final-pr-plan.md), step 3.4*

**Record (R1 K1, 272a1fa).** Status: done.
- **What changed.** SightingForm and CustomBackdropEditor closed whenever any `cancel` event reached their dialog. Chromium, and so Android's WebView, fires a bubbling `cancel` at a file input whose chooser is dismissed, so backing out of the photo picker closed the form and lost what was typed. Both onCancel handlers now return early when `event.target !== event.currentTarget`, the same guard ArriveDialog has. Escape and Android's Back, which cancel the dialog itself, still close them. Every other file input was checked: RecoveryScreen, Onboarding, SafeMode and SettingsView are not inside a <dialog>, and ArriveDialog was already guarded. The Play device checklist gains the case. No review findings; unchanged in the fix round.
- **Where.** src/components/sightings/SightingForm.tsx (onCancel guard); src/components/CustomBackdropEditor.tsx (onCancel guard); docs/play-store/README.md (one checklist line).
- **Tests (4).** src/components/sightings/SightingForm.cancel.test.tsx: 3.4 a photo chooser put away without a photo > leaves the form open, with the words typed in it; src/components/sightings/SightingForm.cancel.test.tsx: 3.4 a photo chooser put away without a photo > is still put away by Escape, the dialog’s own cancel; src/components/CustomBackdropEditor.cancel.test.tsx: 3.4 an image chooser put away without an image > leaves the editor open, with the image as it was being framed; src/components/CustomBackdropEditor.cancel.test.tsx: 3.4 an image chooser put away without an image > is still put away by Escape, the dialog’s own cancel
- **Red first.** On unchanged code, both 'leaves … open' tests failed with `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times`. The two Escape guards passed on base by design.
- **Mutation.** 3 run / 3 killed: comparison flipped in SightingForm (both SightingForm.cancel tests fail); comparison flipped in CustomBackdropEditor (both editor tests fail); guard removed in CustomBackdropEditor ('leaves the editor open…' fails).
- **Not verified here.** A real chooser dismissed in desktop Chrome or the Android app. Playwright cannot dismiss a native file chooser, so the browser's cancel was simulated in jsdom. Firefox and WebKit are CI only.
- **Hands-on.** **Back out of the photo picker.** In desktop Chrome and in the Android app: Journal → Seen in the wild → Log a sighting. Type a few words, tap "Add a photo, if you like", then close the picker without choosing. The form stays open with the words in it. Do the same with "Choose a garden image" in Add your own backdrop. Escape, or Android's Back, still closes each form.

### 6.10 Sightings: a future-dated sighting, and a conflict’s message

*R1 K1 · [final-pr-plan.md](../final-pr-plan.md), step 6.10*

**Record (R1 K1, 272a1fa).** Status: done.
- **What changed.** sightingProblem refused any date after today, even the unchanged date of a stored sighting written while the clock ran ahead, so such a sighting could not be edited at all. It now refuses a future date only when it differs from the date the sighting being changed already has. A conflict reload also settled every photo wait as plain failure, so the field book blamed the photo when the whole change had been dropped. applyLoadResult and persist's conflict branch now settle waits with `reason: 'conflict'`, and FieldBookActions.photoSaved answers true, false or 'conflict'. Review fix: the conflict message now depends on what was lost. A new sighting says "The garden changed in another tab, so this sighting was not saved." An edit that brought a new photo says "The garden changed in another tab, so your changes were not saved.", because that sighting is still there, as it was.
- **Where.** src/lib/sightings.ts (sightingProblem; SIGHTING_NOT_SAVED; internal CHANGES_NOT_SAVED; photoNotSaved(kept, edited = false); ChangeSightings.photoSaved result `reason?`; FieldBookActions.photoSaved `Promise<boolean | 'conflict'>`); src/hooks/useMediaSaves.ts (MediaResult `reason?`); src/hooks/usePersistence.ts (two `reason: 'conflict'` lines); src/components/sightings/FieldBook.tsx (sayWhenSaved(words, photo, edited = false), with edits passing true); src/components/GuideView.tsx (new sightings only).
- **Contracts.** Exports SIGHTING_NOT_SAVED and photoNotSaved(kept: false | 'conflict', edited?: boolean) from lib/sightings. FieldBookActions.photoSaved resolves `true | false | 'conflict'`; callers must compare with `=== true`. MediaResult and ChangeSightings.photoSaved results carry an optional `reason`. Nothing is stored differently.
- **Tests (12).** src/lib/sightings.future.test.ts: 6.10 a sighting dated ahead of the clock > can have its note changed, keeping its own day; src/lib/sightings.future.test.ts: 6.10 a sighting dated ahead of the clock > still cannot be moved to another day after today; src/lib/sightings.future.test.ts: 6.10 a sighting dated ahead of the clock > is not a day a new sighting can take, nor another sighting’s; src/lib/sightings.future.test.ts: 6.10 a sighting lost to another tab’s change > is told apart from a photo that would not go in; src/lib/sightings.future.test.ts: 6.10 a sighting lost to another tab’s change > says the whole sighting was not saved, rather than only its photo; src/hooks/useGardenState.conflict.test.tsx: 6.10 why a new photo was not kept > is the garden changing in another tab, when a conflict throws the whole change away; src/hooks/useGardenState.conflict.test.tsx: 6.10 why a new photo was not kept > is the garden changing in another tab, when that tab’s change arrives first; src/hooks/useGardenState.conflict.test.tsx: 6.10 why a new photo was not kept > is no conflict, when the photo would not go in; src/components/sightings/FieldBook.conflict.test.tsx: 6.10 a sighting dated ahead of the clock, in the field book > has its note changed and saved, keeping its day; src/components/sightings/FieldBook.conflict.test.tsx: 6.10 a new sighting lost to another tab’s change > says the sighting was not saved, not that its photo was not kept; src/components/sightings/FieldBook.conflict.test.tsx: 6.10 a change to a sighting lost to another tab’s change > says the changes were not saved, not that the sighting was not, nor its photo (review fix); src/components/GuideView.conflict.test.tsx: 6.10 a sighting logged from the Guide, lost to another tab’s change > says the sighting was not saved, not that its photo was not kept
- **Red first.** Implement stage: the failures were recorded on base b9db1e6 (for example `expected 'Choose today or an earlier day: the f…' to be undefined`, `expected false to be 'conflict'`, and FieldBook/Guide `Unable to find … this sighting was not saved.`); three guards passed by design. Review fix: the new edit-conflict test failed on HEAD 34bb8c4 product code at FieldBook.conflict.test.tsx:124 with `Unable to find an element with the text: The garden changed in another tab, so your changes were not saved.` (HEAD said "…this sighting was not saved.").
- **Mutation.** Implement stage: 3 run / 3 killed (date check back to `input.date > today`; persist's conflict reason dropped; FieldBook back to a truthy check). Review fix: 3 run / 3 killed. (1) FieldBook's edit no longer passes `true`: killed by 'says the changes were not saved…'. (2) photoNotSaved ignores `edited`: killed by the same test. (3) sayWhenSaved defaults `edited` to true: killed by 'a new sighting lost to another tab’s change > says the sighting was not saved…'.
- **Departures from the plan.** Only 'conflict' is set explicitly; 'storage' is the absence of it. An explicit `reason: 'storage'` broke three existing `toEqual({ ok: false, message })` assertions, which rule 4 protects. A sighting without a photo waits on nothing, so a conflict there still shows the app-wide conflict notice, as before.
- **Not verified here.** A real two-tab conflict in a browser: it was reproduced only with a harness whose photoSaved answers 'conflict', and with repository mocks and a fake BroadcastChannel. Firefox and WebKit are CI only.
- **Hands-on.** **A sighting dated ahead.** Set the device clock three days ahead and log a sighting, then set the clock back. In Journal → Seen in the wild, choose Edit on it, change its words and Save changes. The field book says "Your changes are saved." and the day is unchanged. Choosing a different later day is still refused. **A change lost to another tab.** In tab B, choose Edit on a sighting and add a photo. Before saving, change something in tab A. Then Save changes in tab B: it says "The garden changed in another tab, so your changes were not saved." and the sighting is still there as it was.
- **For neighbours.** usePersistence.ts lines ~105 and ~288 changed by one property each (for K2). MediaResult.reason is a union that includes the existing CustomBackdropRejection values.

### 3.3 Test passkey unlock beyond a mocked authenticator

*R1 K1 · [final-pr-plan.md](../final-pr-plan.md), step 3.3*

**Scope in this run.** The Chromium virtual-authenticator e2e. Real-device trials are notes for the owner's machine.

**Record (R1 K1, 272a1fa).** Status: partial.
- **What changed.** Added the desktop-chromium e2e the plan asks for, using a CDP virtual authenticator (ctap2, internal, resident key, user verification, PRF). It adds a passkey in Settings, locks, opens with "Unlock with a passkey", removes the passkey and checks the passcode still opens the garden. On `127.0.0.1`, WebAuthn refuses with "SecurityError: This is an invalid domain.", although getClientCapabilities reports PRF. So lib/passkey.ts no longer offers a passkey on a site at an IP address, and the e2e reaches the preview server as `localhost`. Real-device trials and the device matrix are left for the owner's machine (cluster note d). No review findings; unchanged in the fix round.
- **Where.** e2e/lock.spec.ts (describe '3.3 a passkey, with a virtual authenticator', desktop-chromium only); src/lib/passkey.ts (passkeysOffered false on IPv4 or bracketed IPv6 hosts); new src/lib/passkey.host.test.ts and src/lib/passkey.named-host.test.ts; docs/ARCHITECTURE.md lock row.
- **Contracts.** passkeysOffered() returns false on IP-address hosts. Test group: describe '3.3 …' in e2e/lock.spec.ts, desktop-chromium only.
- **Tests (3).** e2e/lock.spec.ts: 3.3 a passkey, with a virtual authenticator > is added in Settings, opens the locked garden, and once removed leaves the passcode working; src/lib/passkey.host.test.ts: 3.3 a passkey on a garden served from an IP address > is not offered, though the browser says it has PRF: WebAuthn refuses such a site; src/lib/passkey.named-host.test.ts: 3.3 a passkey on a garden served by name > is offered, digits, dots and all, where the browser has PRF
- **Red first.** passkey.host.test.ts failed on unchanged code: `AssertionError: expected true to be false`. The e2e passed on base, as it should, because it exercises the existing flow on localhost. The named-host test passed on base by design.
- **Mutation.** 3 run / 3 killed: IP check removed; regex narrowed to IPv6 only; regex widened to any digit or dot. The widened regex survived at first, and passkey.named-host.test.ts was added, which kills it.
- **Departures from the plan.** The device matrix the plan asks for is not written, because those trials are not mine to run (cluster note d). Feature detection covers the one failing platform found here: IP-address hosts.
- **Not verified here.** Real-device trials (no hardware here; they are the owner's). The device matrix in docs/ is not written, because there are no results yet. WebKit and Firefox passkey behaviour is unverified, and the e2e skips outside desktop-chromium.
- **Hands-on.** **A passkey on a real device.** At the deployed address: Settings → The garden lock → Add a passkey… → type the passcode, and let the device make one. Lock now → Unlock with a passkey opens the garden. Remove the passkey, Lock now, and the passcode still opens it. Record the device, OS, browser and result for Chrome on Android with Google Password Manager, and for Safari with Touch ID or Face ID on macOS and iOS.
- **For neighbours.** Any future e2e that needs WebAuthn must open the preview server by the name `localhost`, not 127.0.0.1.

### 4.1 Retry a save once when the cached database connection has closed

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.1*

**Record (R1 K2, 4af30f8).** Status: done.
- **What changed.** save(), replace() and writeDrafts() had no retry. When the browser closed the cached IndexedDB connection before `terminated` arrived, opening a transaction threw InvalidStateError and the change went into the writeError banner. A `begin()` wrapper now marks an InvalidStateError thrown while a write's transaction opens. `writing()` then runs the write once more on a fresh connection, inside the same enqueue, and only for that marked error. It covers save, replace (writeAllParts), writeDrafts, discardSnapshot and writeBackupFile. Review fix: the retry could write a garden back after 'Delete everything' (finding 1). `writing()` now records a `generation` that clear() moves on, both as the delete begins and once it succeeds, and that forget() moves on too. The write is not made again if the generation has changed, checked once before reopening and once after the fresh connection opens.
- **Where.** src/repository/gardenRepository.ts: closedOnOpen WeakSet, begin(), generation, writing(); writeAllParts, copyBeforeToday, save, replace, discardSnapshot, writeBackupFile, writeDrafts, forget, clear. docs/ARCHITECTURE.md invariant 4. src/repository/gardenRepository.reconnect.test.ts: vi.mock passthroughs with hold points (dailyCopies.prepareDaily, sealedStores.sealValue, gardenSwitch.removeStaging), holdAt(), and a new describe block.
- **Contracts.** none (internal helpers and state only; no new export, stored field or event).
- **Tests (13).** src/repository/gardenRepository.reconnect.test.ts: 4.1 a write after the browser closed the connection › saves once more on a fresh connection, moving the revision by exactly one; … keeps the day’s copy that goes in with the change; … replaces once more, keeping a single copy of the garden it replaced; … writes the drafts once more; … discards a kept copy once more; … forgets the backup file once more; … tries once more for a closed connection, and for nothing else; … tries only once more, and then says why; src/repository/gardenRepository.reconnect.test.ts: 4.1 a write the delete cut off › makes no write again over a garden this tab has deleted since it began (review); … nor while the delete is still under way (review); … makes no write again once the tab has forgotten a garden deleted elsewhere (review); … makes no write again when the delete finishes as the fresh connection opens (review); src/hooks/usePersistence.reconnect.test.tsx: 4.1 saving after the connection closed › keeps the change, and shows no write error
- **Red first.** First round: all 9 original cases failed on b9db1e6 (SP/k/K2/red-4.1-repo.txt, red-4.1-hook.txt). Review cases, run against 83a66ac's gardenRepository.ts (SP/k/K2/red-fix-4.1.txt, red-fix-4.1b.txt), 4 failed. 'deleted since it began': 'expected undefined to match object { name: InvalidStateError }', because the save resolved and wrote the garden back. 'still under way': 'expected GardenConflictError … to match object { name: InvalidStateError }'. 'forgotten … elsewhere': 'expected undefined to match …', the old garden written back. 'finishes as the fresh connection opens': drafts 'expected 1 to be +0', unsealed words stored after the delete.
- **Mutation.** First round: 3 run / 3 killed (retry removed; every error treated as closed; daily copy swallowing a closed connection). Review fix: 3 run / 3 killed. M1, both generation checks removed: all 4 'write the delete cut off' cases failed. M2, no bump when the delete succeeds: 'finishes as the fresh connection opens' failed. M3, forget() not bumping: 'forgotten a garden deleted elsewhere' failed. Three single-line probes beyond the cap, reported for completeness. Dropping the bump at clear's start was killed by 'still under way'. Dropping the after-open check was killed by 'finishes as the fresh connection opens'. Dropping the before-reopen check alone first survived (the after-open check still refused the write). I closed that gap by asserting in 'deleted since it began' that the database is not made again (indexedDB.databases()), and the mutant was then killed. Logs: SP/k/K2/mut-fix-*.txt.
- **Departures from the plan.** Tests are in new files (gardenRepository.reconnect.test.ts, usePersistence.reconnect.test.tsx), not in gardenRepository.test.ts, per brief rule 5. discardSnapshot and writeBackupFile are covered too, per cluster note (b). Review fix: besides the generation guard the reviewer proposed, clear() also moves the generation once the delete succeeds, and writing() checks it again after the fresh connection opens. Without that, a write that began while this tab's own delete was under way, under a lock, could be made again on a connection opened after the delete and put the drafts in unsealed (case 'finishes as the fresh connection opens').
- **Not verified here.** Safari's real 'connection to IndexedDB server lost' and Android WebView's connection drops were not reproduced. In the unit tests the closure was simulated with fake-indexeddb (a plain db.close(), forceCloseDatabase, an injected InvalidStateError). In Chromium it was simulated by the console patch. The hands-on step was not run against a base build. Not touched: writeLock (in sealedStores), relock (gardenSwitch) and clearQuarantine; none of them is a 3.6 path.
- **Hands-on.** **A save after the connection is closed under the app**: in Chromium, open the garden on Today. In DevTools > Console run `const t = IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction = function (...a) { if (a[1] === 'readwrite') { IDBDatabase.prototype.transaction = t; this.close() } return t.apply(this, a) }`. It closes the app's storage connection on its next write without telling the app, as Safari does when it loses its IndexedDB server. Then tick 'gentle day' (or make any change). Expect no 'Your last change could not be saved.' banner, and the change still there after a reload. Do not use DevTools 'Clear site data' for this check: it deletes the garden, and the revision check then rightly refuses the save. I ran this step in the installed Chromium (1243) against the built app (SP/k/K2/handson-4.1.mjs, output in handson-4.1.txt): one closing gave {banner: 0, keptAfterReload: true}. As a control, three closings, more than the one retry covers, gave {banner: 1, keptAfterReload: false}.
- **For neighbours.** The review fixes add 67 bytes gzip (web) and 53 bytes (Android) to the first-load repository chunk. After this cluster the Android first load is 160,629 of 160,713 bytes (84 spare), and the web first load is 160,035 (678 spare). K1's additions must fit in what is left. usePersistence.ts is not touched for 4.1. The reconnect test file now mocks ./dailyCopies, ./sealedStores and ./gardenSwitch as passthroughs; they hold only when a test calls holdAt().

### 4.2 Delete under a Web Lock, or prove the revision check covers it

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.2*

**Record (R1 K2, 4af30f8).** Status: done.
- **What changed.** I wrote the twoTabs case first. B's connection is force-closed, A deletes the garden, and B saves before any broadcast arrives. It passed on unchanged code: B's save opens the new, empty database, and the revision check refuses it with GardenConflictError. Per note (c), no Web Lock was added. ARCHITECTURE.md invariant 9 records that the deletion marker and the revision check cover this, and cites the tests. Review fix (finding 3): the revision check guards save() only, so a dropped tab's writeDrafts after the delete put its unsaved words into the new database. writeDrafts now reads meta in its own transaction. It writes nothing when this instance holds a revision of 1 or more and no meta is stored, which is the case only when the database was deleted (or is mid-rewrite by a lock change). After forget() it writes again. partsStored now counts 'drafts', and invariant 9 says what is and is not covered.
- **Where.** src/repository/twoTabs.test.ts (imports, and the appended '4.2 …' describe block: partsStored counts drafts, one new case). src/repository/gardenRepository.ts writeDrafts (review fix: 'meta' joins the drafts transaction; refuse when persistedRevision > 0 and meta is absent). docs/ARCHITECTURE.md invariant 9.
- **Contracts.** none (no export, stored field or event changes; writeDrafts stays best effort and silent).
- **Tests (5).** src/repository/twoTabs.test.ts: 4.2 a delete while another tab’s connection is dropped › refuses the save of a tab whose connection the browser dropped, and writes no part of it; … keeps none of its drafts either (review); … refuses it too for a garden stored before revisions, which its first read brings up to date; … refuses it once the dropped tab has opened again before the delete; … leaves nothing of a save already under way when the delete came
- **Red first.** The four original cases passed on b9db1e6 (SP/k/K2/base-4.2-twoTabs.txt, 17/17). That is the outcome note (c) asks to test for, so no lock was added; their force was shown by mutation. The review case 'keeps none of its drafts either' failed on 83a66ac (SP/k/K2/red-fix-4.2.txt): 'expected [ [ drafts, 1 ] ] to deeply equal []'.
- **Mutation.** First round: 3 run / 3 killed (revision check removed from save; blocking not setting deletedElsewhere; no catch-up rewrite of an older garden). Review fix: 1 run / 1 killed. With the meta-absent condition removed from writeDrafts, 'keeps none of its drafts either' failed (SP/k/K2/mut-fix-R2-M.txt).
- **Departures from the plan.** Review fix: the item expected no product code once the twoTabs case passed. The dropped-tab drafts ordering showed that 'no partial garden after a delete in every ordering' did not hold for drafts, so writeDrafts gained the meta-absent refusal.
- **Not verified here.** The real browser `terminated` event and Web Locks behaviour were not exercised; fake-indexeddb's forceCloseDatabase stood in for the drop. Two orderings are not covered, and I recorded both in ARCHITECTURE.md invariant 9 and in concerns. First, a dropped tab that hears nothing until the deleting tab has started a new garden and saved it at revision 1 (probe SP/k/K2/probe/residual.probe.test.ts). Second, in the deleting tab, a save still queued behind one under way when the delete began. It runs after the delete and writes its garden into the new database. The probe SP/k/K2/probe/queued.probe.test.ts gives the same result on b9db1e6 and on this commit.
- **For neighbours.** writeDrafts' transaction now spans drafts, lock and meta. It was already serialised with saves through 'lock', so it adds no new contention.

### 4.3 Add the planned revision and sha256 fields to the plain backup file

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.3*

**Record (R1 K2, 4af30f8).** Status: done.
- **What changed.** Plain backups carried only format, exportedAt, appVersion and garden. A new lazy module, lib/backupIntegrity.ts, writes the backup text. Photos are inlined via sightingPhotos.withPhotosAsText, then it adds `revision` (from the new repository.revision() accessor) and `sha256`, taken over the compact JSON of the garden exactly as written. lib/backupPreview gains previewBackupFile(text), which adds an integrity result ('ok' | 'changed' | 'absent'). Settings shows 'Unchanged since it was saved', or a warning that the file was changed and can still be restored, and never refuses. Both fields are optional, and older files import as before. The 3.6 kept-up-to-date backup file (autoBackupFile) writes copy.text from the same exportGarden, so it gains both fields too. Protected backups and move files seal that same plain text; their sealed envelopes are unchanged. No change in the review round.
- **Where.** src/lib/backupIntegrity.ts (new: gardenDigest, backupCopy, integrityOf, PlainBackup, BackupIntegrity); src/lib/backupPreview.ts (previewBackupFile, BackupPreview.integrity); src/hooks/useGardenState.ts exportGarden; src/repository/gardenRepository.ts repository.revision(); src/components/SettingsView.tsx describeBackup (now async, drops a stale result) and the preview line; docs/ARCHITECTURE.md (backup envelope diagram, 'Restoring a chosen file' row, invariant 6).
- **Contracts.** New exports: lib/backupIntegrity {gardenDigest, backupCopy, integrityOf, PlainBackup, BackupIntegrity}; lib/backupPreview previewBackupFile and BackupPreview.integrity; repository.revision(): number. The backup envelope gains optional `revision` (number) and `sha256` (64-char lowercase hex), in key order format, exportedAt, appVersion, revision, sha256, garden. No stored-format change; DATABASE_VERSION and CURRENT_STATE_VERSION unchanged.
- **Tests (11).** src/lib/backupIntegrity.test.ts: 4.3 a plain backup’s check on itself › carries its revision and the SHA-256 of its garden as written, photos and all; … reads a file made here as unchanged, however it is laid out; … flags a file changed by one character, and still describes it to restore; … accepts a file without the fields, as every earlier one is; … reads as any backup to a build that knows nothing of the fields; … is written without a check, and read as having none, where the browser cannot make one; … makes a file for no garden at all without a check; src/components/SettingsView.integrity.test.tsx: 4.3 the restore preview and a backup’s own check › says a backup is unchanged since it was saved; … warns of a file changed since it was saved, and still restores it; … says nothing of a check an older backup does not have; src/hooks/useGardenState.backupCheck.test.tsx: 4.3 a backup made from the garden › carries the revision it was made at and a check of its garden
- **Red first.** On b9db1e6 all three files failed with 'Failed to resolve import ./backupIntegrity' (SP/k/K2/red-4.3-base.txt). With the new module present but the base wiring, 6 failed (SP/k/K2/red-4.3-wiring.txt): the three preview/integrity cases, both Settings preview-line cases, and the export case. The other 5 exercise only the new module, or are the 'absent' guard.
- **Mutation.** 3 run / 3 killed. M1, integrityOf always 'ok': the two 'changed' cases failed. M2, digest taken before photos are inlined: 'photos and all' and 'unchanged' failed. M3, the preview refusing a changed file: both 'still restores' cases failed.
- **Departures from the plan.** inspectImportedState is unchanged and synchronous, because crypto.subtle is async and its callers are synchronous. The integrity result is computed in the preview (previewBackupFile) instead. The preview shows no line for 'absent'.
- **Not verified here.** Older packaged builds (3.0 to 3.6) were not run against a new file. Compatibility rests on reading the source (every build takes `.garden` from the envelope) and on a unit test that emulates that reading. crypto.subtle in WebKit and Firefox was not run here. SafeMode's and RecoveryScreen's restores have no preview, so they show no integrity line.
- **Hands-on.** **A changed backup is flagged, not refused**: Settings > Download a backup; open the .json in a text editor and change one letter of the garden name; then Settings > Restore from a backup and choose it. The preview shows 'Changed since it was saved, by hand or by damage…', and 'Restore this backup' still works. An untouched file shows 'Unchanged since it was saved'; a backup from 3.6 or earlier shows neither line.
- **For neighbours.** exportGarden now always loads the lazy backupIntegrity chunk (sightingPhotos only when there are photos) and computes a SHA-256 digest. backupIntegrity is imported only dynamically.

### 4.4 Test the per-page error boundary with a throw in every view

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.4*

**Record (R1 K2, 4af30f8).** Status: done.
- **What changed.** The per-page error boundary was tested only with a generic child. A new App-level test mocks every lazily loaded page module that an address in lib/routes reaches, so that each throws on demand. For each one it asserts four things: 'This page could not be shown' appears, the address stays on that page, the primary navigation still works, and moving to the garden draws it afresh (resetKey). Extra cases cover GardenView and MoonlightRecap. Tests only; no change in the review round.
- **Where.** src/App.viewProblem.test.tsx (new). No product code.
- **Contracts.** New test group '4.4 a page that cannot be drawn' (16 cases).
- **Tests (3).** src/App.viewProblem.test.tsx: 4.4 a page that cannot be drawn › shows the problem in place of %s, keeps the navigation, and recovers on another page (CareView, TodayView, JournalView, ShopView, FlightPatternsView, GuideView, SettingsView, WhatsNewView, PrivacyPolicyView, NoticesView, SupportView, BreathingView, YearView, ComfortPlanView); … shows the problem in place of the garden itself, and recovers on another page; … shows the problem in place of the evening recap, and its way back to the garden works
- **Red first.** Not applicable: the item adds tests for behaviour that already worked, so all 16 pass on b9db1e6. Their force is shown by mutating App.tsx.
- **Mutation.** 3 run / 3 killed. M1, per-page ErrorBoundary removed: 16/16 failed. M2, resetKey fixed: 16/16 failed. M3, ViewProblem's onHome doing nothing: the recap case failed.
- **Departures from the plan.** GardenView (eager) and MoonlightRecap (reached from Today) are covered in addition to the 14 hash-routed lazy pages.
- **For neighbours.** The file takes about 23 s locally, roughly 1.1–1.6 s per case; each case has a 20 s timeout.

### 4.5 Validate and decode each restored photo once, not twice

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.5*

**Record (R1 K2, 4af30f8).** Status: done.
- **What changed.** Settings' preview ran inspectImportedState and the restore ran it again, so each photo was base64-decoded twice. The preview now keeps its reading (BackupPreview.inspection). confirmRestore passes it to importGarden as an optional second argument, and importGarden then skips the second parse and validation. Callers without a preview keep the text-only path. The pictures are still verified once before anything is replaced. No change in the review round.
- **Where.** src/lib/backupPreview.ts (internal read(), BackupPreview.inspection); src/components/SettingsView.tsx (onImportGarden prop type, confirmRestore); src/hooks/usePersistence.ts importGarden only; src/components/SettingsView.move.test.tsx and SettingsView.protected.test.tsx (one assertion each, revised).
- **Contracts.** usePersistence/useGardenState importGarden(text, checked?: ReturnType<typeof inspectImportedState>); the SettingsView prop onImportGarden(text, inspection?) changes to match; BackupPreview.inspection?: GardenValidation.
- **Tests (2).** src/components/SettingsView.restoreOnce.test.tsx: 4.5 restoring a field book full of photos › decodes each photo once, for the preview, and restores every one; … still reads the text itself when no preview came first
- **Red first.** With base usePersistence, SettingsView and backupPreview, the 50-photo case failed: 'expected [2, 2, 2, …(40)] to deeply equal [1, 1, 1, …(40)]' (SP/k/K2/red-4.5.txt). The text-path case passes on base by design.
- **Mutation.** 3 run / 3 killed. M1, Settings passing no reading: the 50-photo case failed. M2, importGarden reading the text again: the 50-photo case failed. M3, text-only path dropped: 'still reads the text itself' failed.
- **Departures from the plan.** One existing assertion each in SettingsView.move.test.tsx and SettingsView.protected.test.tsx was revised to toHaveBeenCalledWith(PLAIN, expect.objectContaining({ state: … })), which is stricter, because importGarden now receives the preview's reading. No test was deleted or renamed.
- **Not verified here.** No timing on a real slow phone; the decode count was checked with an atob spy in jsdom.
- **Hands-on.** **A big field book restores once**: with 50 sightings that have photos, download a backup, then restore it from Settings on a slow phone or in a CPU-throttled browser. The preview appears, and 'Restore this backup' completes without a second long pause.
- **For neighbours.** importGarden's signature gained an optional second parameter. K1 edits usePersistence.ts near line 206; this change stays inside importGarden.

### 6.4 “What does this do?” links from Nectar, Stardust, seeds and plant growth

*R2 K3 · [final-pr-plan.md](../final-pr-plan.md), step 6.4*

**Record.** To come.

### 6.5 Guide search says when nothing matches

*R2 K3 · [final-pr-plan.md](../final-pr-plan.md), step 6.5*

**Record.** To come.

### 6.6 The browser’s own Back returns to the same place

*R2 K3 · [final-pr-plan.md](../final-pr-plan.md), step 6.6*

**Record.** To come.

### 6.7 Deeper addresses: a journal day and a shop tab

*R2 K3 · [final-pr-plan.md](../final-pr-plan.md), step 6.7*

**Record.** To come.

### 5.11 Guide sections for what (c) added

*R2 K3 · [final-pr-plan.md](../final-pr-plan.md), step 5.11*

**Record.** To come.

### 1.4 Let gardeners outside the three named regions choose their hemisphere

*R2 K4 · [final-pr-plan.md](../final-pr-plan.md), step 1.4*

**Record.** To come.

### ART-8 Night thumbnails for the scene gallery

*R2 K4 · [final-pr-plan.md](../final-pr-plan.md), step ART-8*

**Record.** To come.

### 6.2 A small “Draft kept” hint beside writing kept as a draft

*R2 K4 · [final-pr-plan.md](../final-pr-plan.md), step 6.2*

**Record.** To come.

### 6.3 A gentle day also hides the header’s Sunlight count and the backup badge

*R2 K4 · [final-pr-plan.md](../final-pr-plan.md), step 6.3*

**Record.** To come.

### 6.8 The year’s longest run of cared-for days

*R2 K4 · [final-pr-plan.md](../final-pr-plan.md), step 6.8*

**Record.** To come.

### 6.9 Comfort plan: phone help text, more trunk prefixes, and focus

*R2 K4 · [final-pr-plan.md](../final-pr-plan.md), step 6.9*

**Record.** To come.

### 5.3 Fail the e2e run on moderate axe violations

*R3 K5 · [final-pr-plan.md](../final-pr-plan.md), step 5.3*

**Record.** To come.

### 5.8 Make “check the support lines before each release” a failing check

*R3 K5 · [final-pr-plan.md](../final-pr-plan.md), step 5.8*

**Record.** To come.

### 5.4 Commit a visual regression suite

*R3 K5 · [final-pr-plan.md](../final-pr-plan.md), step 5.4*

**Record.** To come.

### 5.5 Budgets: a baseline per build, the planned caps, and a frame-time guard

*R3 K5 · [final-pr-plan.md](../final-pr-plan.md), step 5.5*

**Scope in this run.** The frame-time guard only. The per-build baseline and lower caps loosen or move a guard, so they stay in the decision plan.

**Record.** To come.

### 5.2 Make the Safari and Firefox job pass, then make it required

*R3 K5 · [final-pr-plan.md](../final-pr-plan.md), step 5.2*

**Scope in this run.** Fix the WebKit and Firefox failures, and the stale workflow comment. The R0 PR's `browsers` run (#71) failed six tests: the photo sighting (`e2e/nature.spec.ts:61`) and safe mode's move file (`e2e/move.spec.ts:223`) in WebKit, and the comfort-plan link at the largest text (`e2e/comfort.spec.ts:132`) in mobile WebKit and Firefox. Making the job required stays in the decision plan.

**Record.** To come.

### 5.1 Move the PWA to an origin of its own, with real security headers

*R3 K6 · [final-pr-plan.md](../final-pr-plan.md), step 5.1*

**Scope in this run.** Code-only part (the owner's standing direction, "code-only for now"): a locked garden's carry-over goes through a protected file; one address constant for the reminder files and links; the base path behind an env var; `no-referrer`. Choosing a host and moving stays in the decision plan.

**Record.** To come.

### 6.11 Android: add the reminder through the calendar’s own screen

*R3 K6 · [final-pr-plan.md](../final-pr-plan.md), step 6.11*

**Record.** To come.

### 5.7 Catch up the toolchain, and record the held major versions

*R3 K6 · [final-pr-plan.md](../final-pr-plan.md), step 5.7*

**Scope in this run.** Record the held major versions (Dependabot ignore entries with reasons and a review date, and a Toolchain section in ARCHITECTURE). The Playwright bump changes packages, which the owner ruled out for this run, so it stays in the decision plan.

**Record.** To come.

### 5.9 Bring the privacy policy and SECURITY.md up to 3.4

*R4 K7 · [final-pr-plan.md](../final-pr-plan.md), step 5.9*

**Scope in this run.** Write the policy and SECURITY.md text, covering 3.5 and 3.6 as well. The owner approves the wording before any Play submission.

**Record.** To come.

### 5.10 Correct the docs that have drifted from the code

*R4 K7 · [final-pr-plan.md](../final-pr-plan.md), step 5.10*

**Record.** To come.

### 7.2 Real-device checks for 3.1–3.4, on Android and iPhone

*R4 K7 · [final-pr-plan.md](../final-pr-plan.md), step 7.2*

**Scope in this run.** Write the checklist entries. Running them on real phones is for the owner's machine.

**Record.** To come.

