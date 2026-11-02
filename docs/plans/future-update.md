# The future update: decisions and later work

Written on 2 November 2026, when the final run ended with 3.9.0 live. On that day the owner split what the run left into two plans:

- **[The 4.0 plan](4.0-android-packaging.md)** holds the work toward 4.0, the first release of the Android app on Google Play. That is the packaging and release, and the remaining part of each item the run left partial.
- **This plan** holds every decision that waits on the owner, numbered D-1 onwards, and the future work that is not about packaging.

Part 1 lists the decisions. Its first group is the one the 4.0 plan waits on. Part 2 is the later work: all of it but W-14 needs no decision. Part 3 is the checks only the owner's own computer can make. A recommendation is a suggestion only: nothing here is built until the owner answers. "None was recorded" means the question was asked without one.

The full text of each numbered item is its step in [the final-PR plan](../final-pr-plan.md). The art questions are in that plan's "Questions for the owner about the art". Of its sixteen, #69 settled two: one night painting per scene, and precaching the two free scenes' night paintings. Four more were answered by what shipped rather than by the owner, so they are here to confirm (D-42 to D-45). The other ten are in D-12 to D-14 (D-14 holds three of them) and D-16 to D-20. The run's own record is [its execution plan](../final-run/execution-plan.md). [The run's decision plan](../final-run/decision-plan.md), which first held these questions, is kept as that record.

## Part 1: decisions

### Decisions the 4.0 plan waits on

| Id | Item | The question | Recommendation | What the answer unblocks |
|---|---|---|---|---|
| D-1 | 7.1 | The Garden Pass's price, its plans and any free trial. | Monthly and yearly base plans on the `garden_pass` subscription, as P-3 sets them up. The price and any trial are the owner's; none was recorded. | P-3, the subscription in Play Console |
| D-2 | 7.1 | Does the web PWA keep its free Pass preview once the app is on Google Play? | Turn it off ([android-play-plan.md](../android-play-plan.md), section 7). | P-6, the preview flag |
| D-3 | 7.1 | The app's target audience. | 13 and over, to stay outside Play's Families policy. | P-4, Play's declarations |
| D-4 | 7.3–7.6 | The Voyager plan parked these as Android-only (a.9), and the final-PR plan kept them parked. Which go into 4.0? | All four. 7.5 (the minimum WebView and an error page) and 7.6 (the Gradle syntax) are low-risk and can go first. 7.3 (a suspended Pass) and 7.4 (the Pass at launch) go with the Play release. | P-7 to P-10 |
| D-5 | 3.2 | A time limit on the remaining auto-lock holds? An open sighting form, the garden-image editor and an open file chooser hold the auto-lock with no limit, so a garden left with a sighting form open never locks by itself. After a limit it would lock anyway, and the lock screen already says what a lock lost. | Yes, at twice the chosen auto-lock time. | P-13 |
| D-6 | 5.9 | Approve the privacy policy's wording before any Play submission. Four passages in particular: (1) the web same-address limit (other pages at that address could read what the garden stores, and the lock cannot protect against them); (2) the summary sentence about files, calendar visits and links; (3) the policy keeping its own address until the move; (4) the no-way-back sentence allowing for a passkey. | Approve as written. | Submitting 4.0 (P-22) |
| D-7 | 5.1 | Which domain and host for the PWA's own origin (one that can send security headers), and when to move? And at the new address: the PWA's id and scope, so installed copies are not silently re-pointed to an empty origin, and whether to set an explicit `rp.id` in `src/lib/passkey.ts`. Passkeys are bound to the address they were made at, so they must be added again after the move. | Cloudflare Pages or Netlify, with a domain of the garden's own, moved once 3.9 has settled. For the id, the scope and the `rp.id`, none was recorded. | P-15 |
| D-8 | 5.2 | Make the Safari and Firefox `browsers` job required, once it has been green three runs in a row? | Yes, after three green runs. | P-16 (c): removing `continue-on-error`, and the required check on `main` |
| D-9 | 5.2 | Keeping a sighting photo where the browser stores no Blobs (Safari's Private Browsing, WebKit's ephemeral storage). Today the photo is let go with an honest "not kept" note and the garden keeps saving. Keeping it would need a stored shape without a Blob, a new persisted format. Bytes plus a type would make builds 3.3 to 3.6 refuse the whole garden. The backup file's shape (a type and base64 data) is read by 3.3 to 3.6, but is about a third larger. | Keep the honest note, and add no new format. | P-16 (d) |
| D-10 | 5.5 | A bundle baseline for each build, set at today's size? That re-baselines and so loosens the growth room. And lower the entry cap to 95 kB, and set the CSS cap after the CSS work? And add the budgets and knip to CLAUDE.md's list of checks? | A baseline per build, set on purpose when a feature needs the room. Keep the caps until 5.6. For CLAUDE.md's list, none was recorded. (After the run, at the owner's word, React 19.3 moved the baseline from 146,103 to 153,859 B and the entry cap from 100 to 108.5 kB, by its own growth.) | P-18: `scripts/check-budgets.mjs` and `scripts/bundle-baseline.json` |
| D-11 | 5.7 | Bump Playwright to 1.64? It brings a newer browser build. | **The owner, 1 November 2026: hold.** Dependabot ignores 1.64 and later until the hold is lifted; it is next reviewed in January 2027. | P-19 |
| D-12 | Art | Should a night screenshot join the PWA's install screenshots (`src/pwaManifest.ts`) now that the night art exists? | None was recorded. | P-5, when it regenerates the screenshots |

### The garden and its art

| Id | Item | The question | Recommendation | What the answer unblocks |
|---|---|---|---|---|
| D-13 | 1.3, ART-6 | What is a seasonal keepsake: a free cosmetic, a garden decoration or a shelf item? Where does it live (a shelf beside the jars, a plant spot like a jar, or a Journal or Year page)? How is it given, and is it kept after its season? Does it need a new `ShopItemKind`? The answer decides whether the drawing must fit the jar's 80×88 box. | Free, and given once, on the first visit in each season. Kept for good, on a small shelf beside the jars. | Putting the drawn keepsakes in `docs/art/seasonal/` into the app (W-14) |
| D-14 | 1.3, ART-7 | Seasonal Pass outfits: (a) on offer all year once added, or only in their season? (b) The autumn outfit needs a new name, since "Leaf Scarf" is already a Nectar item. (c) Which life stages does each outfit fit? (d) Builds 3.1 to 3.4 drop cosmetic ids they do not know from saved looks and the companion story, so a seasonal outfit in a saved look is lost if an older build rewrites the profile. Is that acceptable? | (a) All year once added. (b) "Russet Leaf Scarf". (c) Draw each for the butterfly stage first. (d) None was recorded. | Putting the drawn outfits into the app (W-14) |
| D-15 | 1.5 | May a jar carry ♥? A garden holding one would be stored at state version 9, so older builds set it aside instead of silently dropping the jar. And should ★ ☀ ☾ ✿ follow, or ♥ alone? The step adds them only if the owner wants them. | Yes to ♥, with B7's conditional version rule: version 9 only when a garden holds a symbol. For the other four symbols, none was recorded. | Jar symbols drawn as shapes. The heart is drawn in `docs/art/seasonal/jar-heart.svg`. |
| D-16 | ART-10 | How were Sunlit Meadow, Woodland Brook and Secret Conservatory made (added 5 September 2026)? THIRD-PARTY-NOTICES.md has no provenance for them. | The owner says how they were made, or the notice records that their provenance was not recorded. | A complete notice |
| D-17 | Art | Butterflies keep flying in the night scene, while the night lines say butterflies rest at night. Should they settle at night, as in Calm's settled state? That is a code change, not art. | None was recorded. | Butterflies at rest by night |
| D-18 | Art | Should the season overlays show over a gardener's own backdrop image? Until this is answered, `season-art.css` keeps the still frost off a personal photo. | None was recorded. | Seasonal art over personal photos |
| D-19 | Art | Marigold's travels are words only, by design, and she wears nothing. Is a visual cue wanted, or none? | None was recorded. | A cue for Marigold's travels |
| D-20 | Art | Should onboarding's background, the day meadow, use the night meadow on a dark device? The postcard draws the day scene only: is that still right? | None was recorded. | Night art in onboarding and the postcard |

### Features

| Id | Item | The question | Recommendation | What the answer unblocks |
|---|---|---|---|---|
| D-21 | 2.2 | QR scanning was deferred on 28 October. Revisit it? | Keep it deferred: the 12 typed words work everywhere. | A QR decoder, camera permission, and Play's Data safety answers |
| D-22 | 3.5 | Should new recovery codes carry check bits, so a mistyped word is caught before the slow unlock? | Yes, for new codes only, flagged in the lock record. Existing codes open as they do now. | Check bits in `lib/recoveryCode.ts` |
| D-23 | 3.6 | Keep PBKDF2 at 600,000 iterations, or ship Argon2id? Argon2id needs a WebAssembly module, a new dependency. | Keep PBKDF2, and record the decision. | Argon2id key derivation |
| D-24 | 6.1 | A day boundary at the gardener's evening hours: forward-only, with no migration, or re-date what is stored? | Forward-only: stored rows keep their dates. | One day boundary for Sunlight, goals and check-ins |
| D-25 | 6.12 | Which of journal search, readable exports, the weekly letter and the year should include sightings? And should a logged nectar plant get a Guide card that carries the "Seen in the wild" stamp, as host plants do? | Search and exports: yes. The letter and the year: one descriptive line each. For the nectar-plant card, none was recorded. | Sightings beyond the field book, and a nectar-plant card |
| D-26 | 6.13 | Is the reflection-prompt rotation enough, or should there be an optional once-a-day nature prompt? | The rotation is enough. | A daily nature prompt |
| D-27 | 6.14 | Should the gardener choose who paces the breath: their companion or Marigold? | Yes: a small choice on the breathing page. | The pacer choice |
| D-28 | 8.6 | Add other languages after all, and which first? | Keep skipping, unless the owner wants them. | c.10 |

### How the app is built and kept

| Id | Item | The question | Recommendation | What the answer unblocks |
|---|---|---|---|---|
| D-29 | 5.6 | Finish the CSS consolidation to the plan's 40% cut, or accept the 18% reached? It is the riskiest change left: putting the sheets into layers measured 1,953 computed-value conflicts. | Do it as its own run, now that the visual regression suite (5.4) is in, holding the 40% target. | CSS layers, no `!important`, and a sheet per view |
| D-30 | 5.12 | Raise the unit coverage floors to about two points under today's figures? | Yes. | The thresholds in `vite.config.ts` |
| D-31 | 5.3 | While a lazy page opens, the app shows "Opening…" with no level-one heading, a moderate accessibility issue every gardener meets for a moment. The e2e helper waits for the placeholder to go before a sweep. Keep that wait, or give the placeholder a visually hidden heading once the first load has about 30 B to spare, and drop the wait? | The heading, when there is room. Android's first load has 220 B spare today, which 4.0 may need first (P-18). | An accessible loading placeholder |
| D-32 | 4.1, 4.2 | In the tab that deletes everything, a save still queued behind one under way when the delete began runs once the delete is done, and writes its garden into the new, empty database. This predates the run. Closing it means refusing writes asked for before the delete, and choosing what the page says then. | Refuse them, and say nothing more than the delete already says. | Closing the queued-save gap |
| D-33 | 4.2 | A tab whose connection was dropped, and which hears nothing until the deleting tab has started a new garden and saved it at revision 1, passes the revision check and writes its old garden over the new one. It is recorded as uncovered in ARCHITECTURE's invariant 9. | Add a garden identity to the save check, for example the stored profile's `createdAt`. It is a small change, with no new stored field. | Closing the stale-tab gap |
| D-34 | 6.2 | Tabs of the same garden share one drafts record, and each writes all its drafts over it. Since 3.8 the "Draft kept" note is honest: it goes when another tab writes over the drafts, but the words then live only on that tab's screen. Keeping each tab's drafts apart would change the stored drafts record. | Keep it as it is. Two tabs writing at once is rare, and the note tells the truth. | Drafts kept per tab |
| D-35 | 6.3 | Two counts are left on a gentle day: a plant's "Care remaining: N eligible Sunlight", and the calendar's day buttons naming their goal counts to screen readers. Neither is the day's Sunlight. | Leave both. | — |
| D-36 | 6.7 | Each Shop tab now has an address, so pressing Shop in the navigation while on another tab opens Supplies and adds a history entry. Before, it did nothing. | Keep it: the address and the page now agree. | — |
| D-37 | 8.1 | Close P4 as solved by caching, or store custom backdrop images as Blobs? | Close it. | — |
| D-38 | 8.2 | Close the garden-context idea as A3 argued, or build a GardenContext with selector hooks? | Close it. | — |
| D-39 | 8.3 | Retire the reset-to-zero streak for good, or add an opt-in "current run" worded so a gap never reads as a loss? | Retire it on purpose, and correct the zero-loss line. | — |
| D-40 | 8.4 | Leave old multi-line tomorrow notes as they show, or mark new recaps so the two can be told apart? | Leave them. | — |
| D-41 | 8.5 | When has the store split been in use long enough to delete the frozen legacy record? | After the Play release has been out for a while. | Deleting the legacy record |

### Art answered by what shipped, for the owner to confirm

The art brief asked these of the owner, and #69 and 3.8's ART-8 answered them in code. No record shows the owner choosing, so each is here to confirm or change.

| Id | Item | The question | What shipped | Recommendation |
|---|---|---|---|---|
| D-42 | Art | Keep the navy wash and dot stars over the night paintings, keep only the stars, or drop both? | Over a built-in night painting, a lighter wash replaces both, with no dot stars. A personal photo, or a scene whose night painting has not loaded, keeps the navy wash and the stars. | Keep what shipped. |
| D-43 | Art | With Calm or reduced motion, do the seasonal petals still fall, and does the still winter frost show? | No petal falls with Calm or reduced motion, the device setting included: the three that Calm used to keep are hidden too. The still frost stays, except on a personal photo. | Keep what shipped. |
| D-44 | Art | Moths: none in winter, as with the fireflies? With Calm motion, none or a still resting moth? | At most three, on fully grown nectar plants, at night, with full motion only, and none in winter. | Keep what shipped. |
| D-45 | Art | Are night thumbnails in the gallery worth about 160 kB of extra precache? | They are left out of the precache and cached once seen. One that cannot load, for example offline before it was first seen, shows the day thumbnail instead. | Keep what shipped. |

## Part 2: later work

Most of these were found during the run, outside its scope. W-1 and W-2 were found just after it, while clearing Dependabot's pull requests, and W-3 is the review 5.7 recorded. W-14 comes from #69's art record and waits on D-13 and D-14; the rest need no decision. None blocks 4.0. The comfort plan's way back to Settings at the largest text is not here: it is the 4.0 plan's P-16 (a).

| Id | Work | What to do |
|---|---|---|
| W-1 | `@axe-core/playwright` 4.14, held | It enforces `label-content-name-mismatch` (WCAG 2.5.3, label in name), and 55 e2e sweeps then fail: controls such as the header's Sunlight, Nectar and Stardust pills are named apart from the words they show. Fix the labels across the app, the first-load header included, then lift the hold in `.github/dependabot.yml`. |
| W-2 | jsdom 30.1, held | Nine unit tests fail on it. `NoticesView` opens `<details>` and dispatches its own `toggle`, which 30.1 now fires too, so the fetch runs twice. The danger-button colour reads see a transparent background. A field-book photo's `src` is not a `blob:` address. Adapt the tests, then lift the hold. In a real browser the notices fetch once per opening. |
| W-3 | The toolchain holds | Review TypeScript 7, Vitest 5 (with `@vitest/*`) and vite-plugin-pwa 2 in January 2027, then every quarter, as `.github/dependabot.yml` says. `@types/node` moves with `node-version` in the workflows, not on its own. Playwright's hold is the owner's (D-11). |
| W-4 | The kept-up-to-date backup file after a delete | With the backup file on (3.6), a dropped tab whose saves are refused after another tab's delete may still write its garden to the chosen file through `lib/autoBackupFile.ts`. Not verified: check it with the 4.2 tests' two-tab setup. |
| W-5 | Other 24-hour steps in tests | Two tests count a few days back by adding 24 hours (`useGardenState.test.tsx` near lines 692 and 1432). They would only misbehave in the hour either side of a clock change. Step by calendar days with `addDaysToLocalDate`. |
| W-6 | Undated goal drafts | Today's new-goal text and an open goal editor (3.2) are kept under draft keys the 7-day pruning never drops, so an editor left open comes back on each visit to Today. Date them like the other drafts. |
| W-7 | The browser's Back from the support page | From the comfort plan's "If you need support now", the browser's Back shows the plan at its top. The support page's own Back keeps the plan's place. The plan's link could write its way back as the Guide's links do, with navigate's `wayBack` option. |
| W-8 | An unused branch in `openSupport` | In `App.tsx`, `openSupport`'s branch for a comfort plan opened from the support page is no longer reached, since 6.9. It can go in a later tidy. |
| W-9 | Night thumbnails offline | Night thumbnails are kept out of the precache, by design. A gardener offline at night who has never opened the gallery at night sees the day thumbnails. No real service worker has tested this yet. |
| W-10 | Release dates for 3.4 and 3.5 | What's new shows no date for 3.4 or 3.5, though both went live. Dating them is a small edit to `src/data/releases.ts`, and could go with 4.0's notes (P-12). |
| W-11 | A restore with photos where Blobs are refused | Restoring a backup that holds sighting photos still writes them as Blobs. In a browser that refuses Blobs, that may hold up later saves the way a chosen photo did. Check the photos with `lib/photoCheck` before a restore, or leave them out with a note. |
| W-12 | The lock's no-way-back sentence | `NO_WAY_BACK` in `src/lib/gardenLock.ts` says nobody can open the garden once the passcode and recovery code are lost, but a passkey still in the lock also opens it. The policy and SECURITY.md say so; the app's own sentence does not. D-6's fourth passage is the policy's side of this. |
| W-13 | The moved-address banner's chunk | In ordinary builds the banner no longer reaches the first load, but its chunk is still built and may be precached. A build-time switch could leave it out. |
| W-14 | The keepsakes and outfits in the app | Once D-13 and D-14 are answered, the drawings in `docs/art/seasonal/` become catalogue items. Transplant each outfit's inner group into `OutfitOverlay`, and check its fit at the existing head and body anchors for each life stage. |
| W-15 | The breathing test across midnight | `e2e/breathe.spec.ts:47` installs Playwright's clock at the real time, then moves it on about two minutes across two sessions. Run in the two minutes before midnight, the second session falls on the next day, so "Already counted today." never shows. Install the clock at a fixed time of day. |

## Part 3: checks for the owner's computer

These are checks a container cannot make. Those for the Android app, the iPhone and passkeys are in the 4.0 plan (P-14, P-16 (e), P-20, P-21), including section 2's acceptance on the phones.

- **3.6's acceptance in a desktop browser**, from [section-2-follow-ups.md](../section-2-follow-ups.md):
  - real file-picker permission and cancellation;
  - writes to a retained file;
  - storage pressure;
  - locked recovery, reload and Undo;
  - opening a protected copy in an older build;
  - the Windows pinned-Chromium file-handle crash;
  - 3.1's damaged-snapshot download, discard and retry before a lock change.
- **Passkeys on an IP address.** The installed Chromium refuses WebAuthn on an IP-address origin and allows it on `localhost`, so 3.3's e2e reaches the preview server as `localhost`. The garden's real address is a domain name, so this matters only to tests.
- **Safari and Firefox** run in CI's `browsers` job, paused until the 4.0 plan's P-17 brings it back.
