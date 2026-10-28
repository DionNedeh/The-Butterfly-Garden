# Section 2: moving the garden and keeping copies

Implementation against merged PR #69 (`5d1f3f5`), 28 October 2026.
Release candidate: 3.6.0. No subagents.

## Scope and owner decision

| Plan step | Implementation |
|---|---|
| 2.1 | Integrate the move patch with C3's lock-copy routing, per-screen restore promises, focus return and closed-dialog handling. A fresh 128-bit secret is shown as twelve words with a four-bit error check. The protected file uses PBKDF2-SHA-256 at 600,000 rounds and AES-GCM. The code and plain export stay in memory, and the move does not count as a durable backup. |
| 2.2 | Deferred by the owner's explicit instruction: “Lets drop all QR scanning for now”. No camera, scanner, QR encoder or display ships. Every platform uses typed words. |
| 2.3 | Safe mode lazily loads Arrive, reports a failed chunk load, and retains ordinary Restore. It restores through the existing snapshot-preserving path. |
| 2.4 | Daily copies are taken with the day's first non-quiet change, up to seven within an approximate 24 MiB budget, keeping at least two. Pre-restore copies are pruned separately. Daily copies omit field-book photos; putting one back preserves current photos and the newest backup timestamp. On supported desktop browsers a chosen plain backup file is refreshed when due, with permission checked, writes serialized and paused while locked or read-only. No file keeper in Android. |
| 2.5 | Settings lists pre-restore and daily copies after reload, with garden name/counts where readable. A preview confirms replacement; the current garden is kept for Undo. Each copy can be downloaded as stored or explicitly discarded. Pre-restore copies retain their original photos. |
| 3.1 prerequisite | A damaged sealed snapshot refuses a lock switch with a specific error. The change dialog exposes its download/discard actions; nothing is discarded automatically. After explicit discard the lock change can be retried. |

## Integration details

- Restore snapshots remain in the same lock-checked transaction as the restore.
  The old patch's separate `takeSnapshot` call was not reintroduced.
- Restore IDs and pruning also use the stored revision, so two restores at the
  same wall-clock time stay distinct and a reset clock does not select the
  wrong Undo copy. The additional snapshot field is optional.
- Daily copies follow C3's fresh-database lock-switch path. The backup-file handle
  is carried intact without sealing it; previously sealed handle records can be
  opened, although an older build's destroyed handle must be chosen again.
- Backup-file metadata writes check the lock and carry a fresh stamp. The switch
  compares that stamp as well as drafts, revision and store keys before freezing.
- File writes take a shared lock against database switches and recheck the lock,
  active writer and chosen-file record before closing the writable stream.
- Snapshot download reads the stored snapshot and corresponding lock record in
  one transaction. Binary bytes and Blobs are serialized through the existing
  stored-copy helpers. A damaged snapshot download is a recovery record; it is
  not promised to be directly restorable or repairable.
- No database/state-version change, new store, network call, dependency, camera
  permission, billing rule, entitlement or bundle-limit increase.
- Source comparison shows a move file is compatible with 3.4/3.5's existing
  protected-backup envelope: those readers are expected to open it by entering
  the exact twelve words as the passphrase. No older packaged build was run.
  The original plan's statement that every build through 3.4 refuses it was too
  broad. Builds without protected-backup support refuse it as an unknown format.
- The move/keep patch files are retired in the same change that integrates
  their code. Their originals remain in Git history; the builders' notes stay
  in `docs/final-pr-plan/patches/`.

## Verification and stop boundary

The owner instructed **“No more heavy testing”** on 28 October 2026. The full
browser run was interrupted immediately. No further heavy tests or CI runs are
authorized by this record. The owner subsequently authorized a source-only PR
and merge, keeping the live app unchanged and saving the 3.6 build. The branch
and merge commits use `[skip ci]` for this merge only; workflow files are unchanged.
This accepts the incomplete verification below for merging source, not for release.

Completed local evidence:

- `npm test -- --maxWorkers=2 --reporter=dot`: **254 files, 3,004 tests passed**.
  Coverage: statements 95.07%, branches 91.89%, functions 93.52%, lines 96.44%.
- The last focused checks of the arrival read guard, snapshot recovery and
  lock-change recovery: **3 files, 21 tests passed**.
- `e2e/move.spec.ts` and `e2e/keep.spec.ts` in desktop/mobile layouts:
  **14 passed** in installed Google Chrome.
- Typecheck passed. The last lint invocation passed. The last knip invocation
  reported only the temporary Playwright config as unused; that config was
  subsequently removed, without another test/check run after the stop.
- Both final-source web builds completed after the last snapshot-ordering change.
  Their budget checks passed: web first load about 159.8 kB gzip and Android web
  bundle about 160.5 kB, under the unchanged 160,713-byte limit. The Android web
  bundle is not a native APK or AAB.
- Phone-width captures were inspected by day; actual night captures were also
  taken with a theme-class assertion. Largest text keeps all twelve words and
  Done reachable by scrolling. This is limited browser visual evidence.

Incomplete acceptance:

- The full desktop/mobile/Android-bundle browser run was stopped before all
  173 scheduled cases completed: **86 passed, 2 failed and 1 skipped** were
  logged before interruption. Its log is `section2-e2e-full.log` (local,
  ignored by Git). A partial run is not a complete-suite pass. The unresolved
  failures are `comfort.spec.ts:132` (comfort-plan link outside the viewport)
  and `app.spec.ts:1379` (offline reload: `ERR_INTERNET_DISCONNECTED`). Their
  cause and relationship to this change have not been established.
- No final-head native Android sync, Gradle check, APK/AAB acceptance or
  Firefox/WebKit run has been completed for this branch. Java/Android SDK are
  unavailable locally; no CI was started.
- No physical-device test, signed Play release, store submission or live
  deployment was performed.
- Full acceptance remains unmet. The owner's later source-only merge instruction
  supersedes the original fully-verified-before-merge condition. A future release
  must address the open checks in `section-2-follow-ups.md`; merging does not
  turn interrupted or unrun checks into passes.

### Local environment finding

The installed pinned Chromium build 1243 on Windows exited during a minimal
OPFS file-handle IndexedDB round trip, even on an empty page without the app.
The same round trip passed in installed Google Chrome and Chromium build 1234.
Local browser verification therefore uses installed Google Chrome through a
temporary Playwright config; no browser was downloaded and no test was skipped
to mask the failure. CI retains the repository's pinned browser configuration.

The retained-file test uses a real OPFS handle as a stand-in for the user-chosen
desktop file. It verifies persistence, read-back and writes, while the native
file-picker UI itself remains a user-controlled browser surface.
