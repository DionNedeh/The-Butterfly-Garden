# Final run: decision plan

Started on 1 November 2026, beside the [execution plan](execution-plan.md). The owner asked for items that carry a decision to be parked rather than guessed. Each item below waits on an answer. The full text of each is its numbered step in [the final-PR plan](../final-pr-plan.md). The recommendation is a suggestion only: nothing here is built until the owner answers.

## Parked items

| Item | The question | Recommendation | What the answer unblocks |
|---|---|---|---|
| 1.3 | What is a seasonal keepsake: a free cosmetic, a garden decoration or a shelf item? How is it given, and is it kept after its season? Are seasonal Pass outfits on offer all year, or only in their season? | Keepsakes are free and given once, on the first visit in each season. They are kept for good, on a small shelf beside the jars. Pass outfits are on offer all year once added. | ART-6 and ART-7: putting the drawn keepsakes and outfits in the app |
| 1.5 | May a jar carry ♥? A garden holding one would be stored at state version 9, so older builds set it aside instead of silently dropping the jar. The owner chose art only for the heart in #69. | Yes, with B7's conditional version rule: version 9 only when a garden holds a symbol. | Jar symbols drawn as shapes; the heart is already drawn in docs/art/seasonal/jar-heart.svg |
| ART-6, ART-7 | As 1.3. Also: the autumn Pass outfit needs a new name, since "Leaf Scarf" is taken; and which life stages does each outfit fit? | Call it "Russet Leaf Scarf", and draw each outfit for the butterfly stage first. | The drawings in docs/art/seasonal/ becoming catalogue items |
| ART-10 | How were Sunlit Meadow, Woodland Brook and Secret Conservatory made (added 5 September 2026)? THIRD-PARTY-NOTICES.md has no provenance for them. | The owner states how they were made, or the notice records that their provenance was not recorded. | A complete notice |
| 2.2 | QR scanning was deferred on 28 October. Revisit it? | Keep it deferred: the 12 typed words work everywhere. | A QR decoder, camera permission and Play Data safety |
| 3.5 | Should new recovery codes carry check bits, so a mistyped word is caught before the slow unlock? | Yes, for new codes only, flagged in the lock record; existing codes open as they do now. | lib/recoveryCode.ts check bits |
| 3.6 | Keep PBKDF2 at 600,000 iterations, or ship Argon2id? Argon2id needs a WebAssembly module, which is a new dependency. | Keep PBKDF2, and record the decision. | Argon2id key derivation |
| 5.1, the move | Which domain and host (one that can send security headers), and when? The code-only part is built in this run (R3 K6). | Cloudflare Pages or Netlify with a domain of the garden's own, moved once 3.9 has settled. | The new origin, real headers, and the old address's final build |
| 5.2, required job | Make the `browsers` job required, once it has been green three runs in a row? | Yes, after three green runs. | Removing `continue-on-error`, and the required check on `main` |
| 5.5, baseline and caps | Give each build its own bundle baseline, set at today's size? That re-baselines and so loosens the growth room. And lower the entry cap to 95 kB and the CSS cap after the CSS work? | A baseline per build, set deliberately when a feature needs the room; keep the caps until 5.6. | scripts/check-budgets.mjs and bundle-baseline.json |
| 5.6 | Finish the CSS consolidation to the plan's 40% cut, or accept the 18% reached? It is the run's riskiest change: A2 measured 1,953 computed-value conflicts when the sheets were put into layers. | Do it as its own run, once the visual regression suite (5.4, R3) is in, holding the 40% target. | CSS layers, no `!important`, per-view sheets |
| 5.7, Playwright bump | Bump Playwright within 1.x? It changes packages, which this run ruled out. | Yes, in a run that allows package changes. | @playwright/test 1.64 |
| 5.12 | Raise the unit coverage floors to about two points under today's figures? | Yes. | vite.config.ts thresholds |
| 6.1 | A day boundary at the gardener's evening hours. Forward-only, with no migration, or re-date what is stored? | Forward-only: stored rows keep their dates. | One day boundary for Sunlight, goals and check-ins |
| 6.12 | Which of journal search, readable exports, the letter and the year should include sightings? | Search and exports: yes. The letter and the year: one descriptive line each. | Sightings beyond the field book |
| 6.13 | Is the reflection-prompt rotation enough, or should there be an optional once-a-day nature prompt? | The rotation is enough. | A daily nature prompt |
| 6.14 | Should the gardener choose who paces the breath: their companion or Marigold? | Yes: a small choice on the breathing page. | The pacer choice |
| 7.1 | The Play Console steps, the Pass price and plans, whether the PWA keeps its free Pass preview, and the audience. | The owner's steps in docs/play-store/README.md. | The Play release |
| 7.3–7.6 | The plan parked these as Android-only (a.9). Unpark them? | Unpark 7.5 (minimum WebView and an error page) and 7.6 (Gradle syntax), which are low-risk. Keep 7.3 and 7.4 for the Play release. | The Android items |
| 8.1 | Close P4 as solved by caching, or store custom backdrop images as Blobs? | Close it. | — |
| 8.2 | Close the garden-context idea as A3 argued, or build a GardenContext with selector hooks? | Close it. | — |
| 8.3 | Retire the reset-to-zero streak for good, or add an opt-in "current run" worded so a gap never reads as a loss? | Retire it on purpose, and correct the zero-loss line. | — |
| 8.4 | Leave old multi-line tomorrow notes as they show, or mark new recaps so the two can be told apart? | Leave them. | — |
| 8.5 | When has the store split been in use long enough to delete the frozen legacy record? | After the Play release has been out for a while. | Deleting the legacy record |
| 8.6 | Add other languages after all, and which first? | Keep skipping, unless the owner wants them. | c.10 |

The art brief's remaining open questions are in [the final-PR plan](../final-pr-plan.md) under "Questions for the owner about the art". #69 settled two of them: one night painting per scene, and precaching the two free scenes' night paintings.

## Questions raised during the run

Questions an agent or the integrator meets during the run are written here, under the round that raised them, for the owner to answer afterwards.

### Round R1

- **3.2: a time limit on the remaining auto-lock holds?** An open sighting form, the garden-image editor and an open file chooser still hold the auto-lock with no limit, as in C3. So a garden left with a sighting form open never locks by itself. After a time limit the garden would lock anyway, and the lock screen already says what a lock lost ("The sighting you were writing was not saved when the garden locked."). Recommendation: yes, at twice the chosen auto-lock time.
- **4.1 and 4.2: a save queued behind "Delete everything".** In the tab that deletes, a save still queued behind one under way when the delete began runs once the delete is done. It then writes its garden into the new, empty database. This is pre-existing: it is the same on b9db1e6. Closing it means refusing writes asked for before the delete, and choosing what the page says when that happens. Recommendation: refuse them, and say nothing more than the delete already says.
- **4.2: a stale tab and a brand-new garden.** A tab whose connection was dropped, and which hears nothing until the deleting tab has started a new garden and saved it at revision 1, passes the revision check, and writes its old garden over the new one. Closing this needs a garden identity in the check, for example the stored profile's `createdAt`. It is recorded as uncovered in ARCHITECTURE invariant 9. Recommendation: add the identity check; it is a small change to the save check, with no new stored field.

### Round R2

- **6.2: one drafts record for every tab.** Tabs of the same garden share one drafts record, and each tab writes all of its drafts over it. 3.8 makes the "Draft kept" note honest: a tab's note goes when another tab writes over its drafts. But the words then live only on that tab's screen until it is typed in again. Keeping each tab's drafts apart would change the stored drafts record. Recommendation: keep it as it is. Two tabs writing at once is rare, and the note now tells the truth.
- **6.3: two counts left on a gentle day.** A plant's panel still says "Care remaining: N eligible Sunlight", which describes the plant's growth. The calendar's day buttons still name their goal counts to screen readers ("N goals, M completed"). Neither is the day's Sunlight, so both were left. Recommendation: leave both.
- **6.7: Shop in the navigation.** Each shop tab now has an address. So pressing Shop in the navigation while on another tab opens Supplies and adds a history entry; before, it did nothing. Recommendation: keep it. The address and the page now agree.

## Notes for the owner's machine

Checks a container cannot make: it has no WebKit or Firefox, no real phone, no Play Console and no hardware authenticator.

- **3.6 acceptance on devices**, from [section-2-follow-ups.md](../section-2-follow-ups.md):
  - real file-picker permission and cancellation;
  - writes to a retained file;
  - storage pressure;
  - locked recovery, reload and Undo;
  - opening a protected copy in an older build;
  - the Windows pinned-Chromium file-handle crash.
- **Passkeys (3.3).** Add, unlock with and remove a passkey on Chrome on Android with Google Password Manager, and in Safari with Touch ID or Face ID.
- **The real-device checklist (7.2).** This run writes its entries; running it on a recent and an older Android phone, and on an iPhone, is the owner's.
- **Art presentation (ART-9).** The refreshed screenshots on devices, and heading contrast over every night painting on a real screen.
- **WebKit and Firefox.** These run only in CI's advisory `browsers` job.
- **The `browsers` job on the R0 PR (#71)** passed 220 tests and failed 6:
  - the photo sighting (`nature.spec.ts:61`), in WebKit;
  - safe mode opening a move file (`move.spec.ts:223`), in WebKit;
  - the comfort-plan link at the largest text (`comfort.spec.ts:132`), in mobile WebKit and in Firefox.

  Step 5.2 in round R3 is widened to all three.
- **Passkeys on an IP address.** The installed Chromium refuses WebAuthn on an IP-address origin and allows it on `localhost`, so 3.3's e2e reaches the preview server as `localhost`. The garden's real address is a domain name, so this matters only to tests.

## Ideas

Finds outside the run's scope are written here, never dropped.

- **R1, the kept-up-to-date backup file after a delete.** With the backup file on (3.6), a dropped tab whose saves are refused after another tab's delete may still write its garden to the chosen file on disk, through `lib/autoBackupFile.ts`. Not verified. Check it with the 4.2 tests' two-tab setup.
- **R1 deploy, other 24-hour steps in tests.** Main's 3.7 deploy failed on a test that made "tomorrow" by adding 24 hours, which on 1 November 2026, when New York's clocks went back, was still today; it is fixed. Two more tests count a few days back the same way (`useGardenState.test.tsx` near lines 692 and 1432). They would only misbehave in the hour either side of a clock change. Consider stepping by calendar days with `addDaysToLocalDate`.
- **R1, undated goal drafts.** Today's new-goal text and an open goal editor (3.2) are kept under draft keys that the 7-day pruning never drops. They are cleared on add, Save, Cancel, Archive and Delete, and when their goal goes away. An editor left open therefore comes back on each visit to Today, though it no longer holds the auto-lock or takes focus. Consider dating them like the other drafts.
- **R2, the browser's Back from the support page.** Open the support page from the comfort plan's "If you need support now", then press the browser's Back: the plan shows at its top. The support page's own Back returns to the plan's place, through the plan's in-page restore. The plan's link could write its way back as the Guide's links do, with navigate's `wayBack` option.
- **R2, an unused branch in `openSupport`.** In App.tsx, `openSupport`'s branch for a comfort plan opened from the support page is no longer reached, since 6.9 returns through the plan's own Back. It can go in a later tidy.
- **R2, night thumbnails offline.** The night thumbnails are kept out of the precache. A gardener who is offline at night, and has never opened the gallery at night, sees the day thumbnails. This is by design, but no real service worker tested it.
- **R2, release dates for 3.4 and 3.5.** What's new shows no date for 3.4 or 3.5, which both went live (#69 merged 3.5 on 27 October). Dating them is a small edit to `src/data/releases.ts`.
