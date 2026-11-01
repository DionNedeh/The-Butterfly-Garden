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

**Record.** To come.

### 3.4 A cancelled photo picker must not close the form

*R1 K1 · [final-pr-plan.md](../final-pr-plan.md), step 3.4*

**Record.** To come.

### 6.10 Sightings: a future-dated sighting, and a conflict’s message

*R1 K1 · [final-pr-plan.md](../final-pr-plan.md), step 6.10*

**Record.** To come.

### 3.3 Test passkey unlock beyond a mocked authenticator

*R1 K1 · [final-pr-plan.md](../final-pr-plan.md), step 3.3*

**Scope in this run.** The Chromium virtual-authenticator e2e. Real-device trials are notes for the owner's machine.

**Record.** To come.

### 4.1 Retry a save once when the cached database connection has closed

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.1*

**Record.** To come.

### 4.2 Delete under a Web Lock, or prove the revision check covers it

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.2*

**Record.** To come.

### 4.3 Add the planned revision and sha256 fields to the plain backup file

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.3*

**Record.** To come.

### 4.4 Test the per-page error boundary with a throw in every view

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.4*

**Record.** To come.

### 4.5 Validate and decode each restored photo once, not twice

*R1 K2 · [final-pr-plan.md](../final-pr-plan.md), step 4.5*

**Record.** To come.

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

**Scope in this run.** Fix the one WebKit failure (the photo sighting, e2e/nature.spec.ts:61) and the stale workflow comment. Making the job required stays in the decision plan.

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

