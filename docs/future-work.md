# Future work

What the Voyager plan (`docs/Voyager-2026-10-26_18-48-37-UTC.md`) set out and
3.0–3.4 did not ship, in the order it is worth doing. Everything here is
planned, not built into the app: nothing below is in the release notes.

All of it goes to the final PR agreed when the plan began, made by the
gardener's own agent: the art in item 1, and with it, as the plan's owner
chose when wrapping up, the parts in item 2 that were built but not
reviewed. Item 3 lists what is known and left open, for that PR or later.

## 1. The art PR (the plan's G5 and c.7 visuals)

Made separately, by an agent that can draw, as agreed when the plan began.
It adds pictures only; the words and rules it needs are item 2's third part,
which should land first so the art has hooks to fill.

- **G5, a real night garden.** A dusk or night variant of each built-in scene,
  and a few moths visiting the nectar plants at night. (Night today dims the
  day painting.)
- **c.7, the seasons.** A scene overlay per season (petals in spring, full
  bloom in summer, falling leaves in autumn, frost in winter), one free
  keepsake per season, and one Garden Pass outfit per season.
- **Where it plugs in** (once item 2c lands): `.garden-hero[data-season]` for
  overlays drawn by CSS and images alone, the unused `.hero-petals::before`,
  and `seasonArt` in `src/data/seasons.ts`, a typed list of the overlay,
  keepsake and outfit ids each season wants, with no images yet.
- **Rules it must keep:** art is composited (transform and opacity only,
  paused offscreen; see the A2 log), nothing shows with reduced or Calm
  motion, every colour has a night counterpart with AA contrast, new images
  are WebP and lazily loaded, and the first load stays under its budget
  (`scripts/check-budgets.mjs`). In `FlowerSprite`, `y=130` is the ground line.

## 2. Built, not yet reviewed or merged

Three parts of section (c) were built on the C3 head and pass typecheck,
lint, knip and the unit suite, but were never put through review, the e2e
suite or the Android checks. Each is kept as a patch in
`docs/future-work/patches/`, to apply on a branch from `main`
(`git am -3 docs/future-work/patches/<name>.patch`), then review, run every
check in CLAUDE.md, and fix what is found, as each PR before them did.

a. **c.6, move to a new device** (`c4-move.patch`). *Move my garden to
   another device* makes a protected backup locked with a one-time code: 12
   words (128 random bits and a 4-bit check, from the lock's word list),
   also shown as a QR code drawn on the device by a QR encoder written for
   it (byte mode, level M, checked against Project Nayuki's encoder). *Arrive
   from another device* (welcome, Settings, recovery screen) takes the file
   and the words, or scans the QR where `BarcodeDetector` exists. Nothing is
   stored. Open: no QR scanning in Safari and Firefox without a pure-JS
   decoder (the words work everywhere); safe mode has no Arrive button.
b. **c.6, keep a copy** (`c4-keep.patch`). Up to seven daily copies on every
   device, taken before a day's first change, kept apart from the
   pre-restore snapshots, sealed under the lock, listed in Settings with the
   restore preview and Undo; photos are left out of daily copies. On
   Chromium desktop, a backup file chosen once is rewritten after a day's
   changes and when the page is hidden, never while locked. Open: it puts
   the Android first load about 0.5 kB over budget; apply after 2c, which
   frees about 1.8 kB, or find room.
c. **c.7 and G5 without art** (`c4-seasons.patch`). The season by
   hemisphere (`lib/seasons.ts`), sourced season lines per region, two
   seasonal reflection prompts per season, Marigold's autumn and spring words,
   night lines for every species, fireflies at night (none in winter, none
   with reduced or Calm motion), and the art hooks above. The garden's day
   lines move to a lazy chunk, which frees first-load room.

The patches were made against the C3 integration head before its review fixes
merged (commit 48ad0f1, in `main`'s history through the C3 merge). Each
applies cleanly there; on C3 as merged, `git am -3` will stop on conflicts in
`src/lib/sealedBackup.test.ts` (all three), `SettingsView.tsx` (2a, 2b),
`components/backup/ProtectedRestore.tsx` and `SealedBackupPrompt.tsx` (2a),
and `repository/gardenRepository.ts` and `sealedStores.ts` (2b). Two C3
changes matter most: every lock switch now writes a fresh database
(`repository/gardenSwitch.ts`), so c.6's daily copies must be taken and sealed
through that path; and the Android first load had only a few dozen bytes to
spare when C3 merged (see the C3 log), so 2c, which moves the day lines to a
lazy chunk, should land first.

## 3. Known gaps and follow-ups

- **The garden lock.** Passkey unlock (WebAuthn PRF) is tested only with a
  mocked authenticator: try it on Chrome on Android and Safari with Touch ID
  before calling it supported. The lock does not protect against code on
  the same web address: the move to an origin of the garden's own (a.5 WP3,
  agreed "code-only for now") is what closes that.
- **The cross-browser e2e job** (`browsers`: WebKit and Firefox) is advisory
  and has been red in WebKit on recent PRs. On C3's run, WebKit timed out in
  the breathing, onboarding, comfort-plan, jar and two sighting tests, mostly
  on a click that waited out its 30 seconds on an element already visible and
  stable; the protected-backup tests passed there. The Chromium suite and the
  Android bundle are green. The WebKit timeouts need their own look before
  that job can be required.
- **The rest of M4.** Settings' evening hours move when the recap opens,
  but Sunlight's and goals' day still turns at midnight: every completion,
  check-in and Sunlight row is keyed by its calendar date, so moving the
  boundary needs a migration of what is stored and its own review (see the
  B2 log).
- **Languages (c.10)** were skipped by choice.
- **A damaged snapshot blocks a lock change.** Every lock change re-seals
  the snapshots kept before a restore, all or nothing, so one that will not
  open stops a passcode change with an unhelpful message. Opening them part
  by part, like set-aside copies, needs a way to discard a snapshot first.
- **A file chooser's cancel may close a form.** The sighting form and the
  custom backdrop editor close on their dialog's `cancel` event, and
  Chromium's file-input `cancel` bubbles, so cancelling the photo chooser
  may close the form and lose what was typed. Not yet checked in a real
  browser.
- **Low findings left as they are**, each judged not worth its code now: a
  sighting dated ahead of a reset clock can be kept but not edited until the
  clock is right; a conflict that discards a whole new sighting says only
  that the photo was not kept.
