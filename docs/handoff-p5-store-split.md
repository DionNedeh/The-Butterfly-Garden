# Handoff: split the garden across IndexedDB stores (audit finding P5)

**Status:** done. Implemented across six commits, each with its own green gate.
This was the last outstanding item from the security and performance audit.

**Audience:** anyone picking this code up cold. The reasoning that constrained
the design is kept below, because most of it still constrains anyone changing
the storage layer again.

---

## 1. What changed

Every change to the garden used to rewrite the whole thing as one IndexedDB
document: ticking one goal re-serialised every mood, reflection, completion and
sunlight award ever recorded. The garden is now stored as one record per
collection, so a write touches only what actually changed.

Measured on synthetic gardens, for a single mood check-in — the most common
action:

| Garden age | Whole garden | Before (whole-record write) | After (changed parts only) |
| --- | --- | --- | --- |
| 1 year | 527 KiB | 527 KiB, 4.3 ms | **251 KiB, 2.6 ms** |
| 3 years | 1,579 KiB | 1,579 KiB, 25.2 ms | **751 KiB, 6.9 ms** |

52% fewer bytes at both sizes; 40% faster at one year and 73% faster at three.
Timings are `fake-indexeddb` under Node, so they are only useful relative to
each other — real IndexedDB with structured clone and disk I/O is slower, and
Android WebView storage on the Play target slower again.

A mood check-in touches `meta`, `moods` and `sunlight`, and nothing else.

### The estimate in the original handoff was wrong

The pre-work version of this document predicted "roughly 60–90 KiB at one year"
and said that missing that range meant the dirty check was broken. The measured
figure is 251 KiB, and the dirty check is fine. The estimate simply did not add
up: at one year the collections a check-in touches are

| Collection | Size | Rows |
| --- | --- | --- |
| `moods` | 69.8 KiB | 365 |
| `sunlight` | 179.5 KiB | 1,825 |
| `meta` | <1 KiB | — |

`sunlight` carries five rows per day by the same document's own definition of
the synthetic garden, so it alone exceeds the predicted range. The 60–90 KiB
figure counted `moods` only, while the sentence above it correctly named
`meta + moods + sunlight`. Anyone re-measuring should expect ~250 KiB at one
year, not 60–90 KiB.

The evidence that the section-5 trap below is genuinely handled is not the byte
count but the parts list: `plants` does not appear in it. (`plants` is 0.2 KiB
in any case, so it could never have explained the gap.)

**`sunlight` is now the dominant cost of a check-in.** If this needs to get
cheaper again, that is the collection to chunk by year — see §6.1.

---

## 2. Why the obvious fix stayed rejected

The audit's first recommendation was "split the store, **or at minimum**
debounce". A debounce was implemented and then deliberately reverted: it saved a
few milliseconds but opened a window where closing a tab loses the reflection
someone just wrote. For a private journal that is the wrong trade. The comment
above the save effect in `src/hooks/useGardenState.ts` still records this.

The split is strictly better than debouncing: it reduces write cost *without*
delaying durability. **Do not reintroduce a debounce.**

---

## 3. Non-negotiable invariants

The audit's three most serious findings were data-loss bugs. Their fixes are
load-bearing, and each is still pinned by a test. **If a refactor makes any of
these awkward, the refactor is wrong — not the test.**

| Invariant | Why it exists | Pinned by |
| --- | --- | --- |
| A stored garden this build cannot read is **never overwritten**. It is copied to a quarantine store, saving is disabled, and the UI explains why. | A `version: 5` record written by a newer client used to be discarded and replaced with a blank garden — permanent, silent data loss. | `gardenRepository.test.ts` → "withholds a garden written by a newer client instead of discarding it" and "withholds a split garden written by a newer client"; `useGardenState.test.tsx` → "stops writing, and says why, when the stored garden cannot be read" |
| Deleting all local data **fails loudly** when another tab holds the database open. | `deleteDatabase` fires `onblocked`; the old code resolved anyway, so the UI claimed a journal was deleted when it was still on disk. | `gardenRepository.test.ts` → "refuses to report success while another tab holds the data" |
| A failed write is **surfaced once** and does not retry in a loop. | Write failures (quota, private mode, WebView eviction) used to be swallowed entirely. | `useGardenState.test.tsx` → "reports a failed write once, without retrying in a loop" |
| A garden just loaded is **not immediately written back**. | Guards against a read-then-clobber cycle and avoids a pointless write on every launch. | `useGardenState.test.tsx` → "does not re-save a garden it just loaded unchanged" |

The split added a fifth, in the same spirit:

| A garden with a missing collection is **withheld, not half-read**. | An absent collection is not an empty one. Guessing is how someone silently loses every reflection they ever wrote. | `gardenRepository.test.ts` → "withholds a split garden with a missing collection rather than half-reading it" |

```bash
npx vitest run src/repository src/hooks
```

---

## 4. How storage is laid out now

```
butterfly-garden (DATABASE_VERSION = 3)
├── meta        key 'current' → version, profile, seeds, nectar, stardust,
│                               inventory, ownedItemIds,
│                               ownedFlightPatternIds, selectedFlightPatternId
├── goals       key 'current' → Goal[]
├── completions key 'current' → DailyCompletion[]
├── moods       key 'current' → MoodEntry[]
├── reflections key 'current' → ReflectionEntry[]
├── plants      key 'current' → PlantInstance[]
├── creatures   key 'current' → CreatureInstance[]
├── sunlight    key 'current' → SunlightAward[]
├── jars        key 'current' → JarInstance[]
├── placements  key 'current' → JarPlacement[]
├── state       key 'current' → the pre-split whole garden (frozen; see §6)
└── quarantine  key `${reason}-${iso}` → { id, reason, storedAt, raw }
```

One array per store, not one record per entity. Storing 5,475 completions as
5,475 records would make reads slower and the migration far riskier, and buys
nothing: a completion is only ever read as part of the whole set.

### Two different version numbers — do not confuse them

```ts
export const CURRENT_STATE_VERSION = 4   // the shape of AppState itself
const DATABASE_VERSION = 3               // which object stores exist
```

`AppState.version` describes the **document shape**, which the split did not
change, so it stayed 4. Raising it would make every existing client read its own
garden as the work of a newer build and refuse to write — exactly the disaster
the quarantine logic exists to prevent. `DATABASE_VERSION` describes **which
object stores exist**, which is what the split changed.

### The load contract is unchanged

```ts
export type LoadStatus = 'loaded' | 'empty' | 'withheld'
```

`withheld` still means something is stored that this build cannot read; the
returned state is a blank garden **for display only** and the caller must stay
read-only. A partial read resolves to `withheld` for the whole garden, never a
half-loaded one.

---

## 5. The gotcha that decides whether this pays off

**Read this before touching the dirty check.**

The natural dirty check is reference equality per collection: every update in
`src/lib` is immutable, so an untouched array should keep its identity. Verified
again during this work — no in-place `push`/`splice`/`sort` on state anywhere,
and no assignment into a state field. The two `.sort()` calls in `JournalView`
and `CareView` both sort freshly built copies.

It fails in one important case. `awardSunlight` in `src/lib/progression.ts` does:

```ts
const plants = state.plants.map((plant) => { ... })
```

`.map()` **always allocates a new array**, even when no element changed. So
`plants` gets a fresh identity on every Sunlight award — including when every
plant is already fully grown and nothing could possibly have changed. A plain
reference check would mark `plants` dirty on every check-in, forever.

The fix is `sameCollection` in `gardenRepository.ts`: same length, and every
element identical by reference. O(n) pointer comparisons, zero allocation,
orders of magnitude cheaper than serialising to find out.

The direction of error matters. This comparison can report a clean collection as
dirty (one needless write); it cannot report a dirty collection as clean, so
long as updates keep replacing rather than mutating. **If in-place mutation of
state is ever introduced, this becomes a data-loss bug.**

Pinned by `gardenRepository.test.ts` → "treats a mood check-in as touching only
moods, sunlight and meta", which asserts the fresh `plants` identity explicitly
so the trap stays visible.

A tempting follow-up is to make `awardSunlight` return the original array when
nothing grew. That is a genuine improvement, and still a **separate change**
with its own test.

---

## 6. Migration, and the record left behind

A pre-split garden moves across lazily, on the first load that finds no split
parts:

1. Open at version 3. The upgrade handler **only creates stores** — no data
   moves there. A version-change transaction is a poor place for async work, and
   a partial migration inside one is the failure this repository exists to avoid.
2. If no split part is present, read the legacy `state` record, validate it
   through the same `migrateState` as before, and write the split form in one
   transaction.
3. The legacy record is **not deleted**.

Because the write is atomic and the source is untouched, a process that dies
mid-migration leaves the split stores empty and the next launch runs the
migration again, losing nothing. The legacy record is read *only* when no split
garden is found, so an ordinary launch never pays to deserialise it.

### Why the legacy record stays, and what that costs

Keeping it is what makes this work revertible (§8), and it means a build without
the split finds a garden rather than an empty database it would onboard over the
top of. That downgrade-into-onboarding path was the worst outcome available and
is now closed.

The cost is that the record **goes stale** from the moment of migration, since
writes no longer touch it. Two consequences worth knowing:

- A downgrade after migration shows the garden as it was at migration time, not
  as it is now. Stale is a far better failure than blank, which is why it is the
  chosen trade.
- If someone then *uses* the old build, the two layouts diverge, and the newer
  build will keep reading the split stores and ignore the old build's writes.
  Reconciling divergent copies is a real sync problem and deliberately out of
  scope. **This is the strongest argument for not shipping a build that reads
  only the legacy record after this one.**

Removing the record later is a separate change, and should wait until the split
has shipped and soaked — Play's update adoption is slow.

---

## 7. Pitfalls specific to this codebase

### 7.1 `progressGarden` returns the *same object* when nothing changed
`src/lib/progression.ts` deliberately returns the identical reference if nothing
advanced, so React bails out of re-rendering. Do not "clean this up" into always
returning a new object — it would cause a render and a write every 60 seconds.

### 7.2 The persisted baseline updates only after a *successful* write
`gardenRepository` tracks what it believes is on disk, and updates that belief
only after a load or a write that actually committed. A failed write leaves it
pointing at the last known-good garden, so the next attempt recomputes the same
work rather than trusting a write that never landed. This works because the
transaction is all-or-nothing. **If per-store transactions are ever introduced,
that belief has to become per-collection too** — which is a good reason to keep
one transaction.

### 7.3 Migration reallocates some collections
`migrateState` passes `goals`, `completions`, `moods`, `reflections`, `plants`,
`sunlight` and `seeds` through by spread, so they keep the array identity read
from disk. It rebuilds `creatures`, `jars`, `jarPlacements` and the meta objects
every time. Those therefore look dirty on the first write after a load. They are
small, and the alternative — re-deriving less in the validator — would weaken
the thing that makes an unreadable garden detectable. Left as is on purpose.

Where migration normalises a value (a dropped invalid jar, a renamed creature
stage), the stored copy keeps the un-normalised form until something writes that
collection. That is harmless: migration is idempotent and runs on every load.

### 7.4 The e2e suite reads and writes IndexedDB directly
`e2e/app.spec.ts` has `editGardenRecord`, which now reads the three parts the
tests reach into (`meta`, `plants`, `creatures`), presents them as one object so
the five call sites are unchanged, and writes the parts back. Two deliberate
properties, both kept:
- It opens **without a version**, so it follows schema bumps.
- It does **not** use `new Function`/eval — the app ships a CSP without
  `unsafe-eval`, so the mutation is applied in Node.

`reloadAfterSave(page)` waits 250 ms before reloading. A reload can still
interrupt an in-flight transaction; no app can promise durability against that.
Keep it.

This helper is the one intended exception to §7.6.

### 7.5 Export/import is unchanged
`exportGarden` still serialises `{ format, exportedAt, garden: AppState }` and
`readImportedState` still accepts that envelope or a bare `AppState`. Backups
already in the wild are in that shape and **the format must not change** — it is
the user's only recovery path and their route to a new device. Import assembles
and writes the split form; export reassembles the whole `AppState`.

### 7.6 Storage details do not leak upward
`useGardenState`, the components and the tests outside `src/repository` do not
know storage is split. `save(state)` kept its signature precisely so this stayed
true: the repository tracks the previous state itself rather than having the
caller pass it in. If anything above the repository has to learn about stores,
the abstraction has failed.

---

## 8. Rollback

Each step is a separate commit, so `git revert` of the range restores the
single-record layout. Two caveats:

- A user who has already migrated has data in the new stores, and the legacy
  record is stale. A revert therefore restores the garden as of migration time
  and loses everything written since. **Verify this path before relying on it.**
- Past the read-path commit, a real rollback wants either a reverse migration or
  a build that reads the split stores and writes both.

---

## 9. How to re-measure

The benchmarks were throwaway files under `src/__perf/`, deleted after use.
Recreate one the same way (and delete it again — it is a measurement, not a
test). Build synthetic gardens of 1 and 3 years: 12 daily goals, 365/1,095 moods
and reflections, 5 completions and 5 sunlight awards per day. Measure, for a
single mood check-in: bytes serialised, wall-clock write under `fake-indexeddb`,
and which stores were touched. Numbers to beat are in §1.

Sanity-check the *worst* case too: `awardSunlight` legitimately touches `plants`,
`creatures` and `sunlight`, so a check-in that grows a plant and discovers an egg
writes more. That is correct and expected.

---

## 10. Environment notes

- Node v22, Vitest 4.1.8, TypeScript 6.0 (`strict` set explicitly in every
  tsconfig).
- Lint is **type-aware** (`recommendedTypeChecked`) with `no-floating-promises`
  on for `src/**`. Every promise must be awaited or explicitly `void`-ed.
- `tsconfig.e2e.json` typechecks `e2e/` and `playwright.config.ts`; `npm run
  typecheck` covers all three projects.
- **Playwright browser mismatch in the cloud sandbox:** the pinned Playwright
  expects a browser build that is not present. Symptom:
  `Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-…`.
  Work around it with a temporary config pointing at the installed binary, and
  **delete it before committing**:

  ```ts
  // pw-local.config.ts  (temporary, do not commit)
  import { defineConfig, devices } from '@playwright/test'
  export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    use: {
      baseURL: 'http://127.0.0.1:4173',
      launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
    },
    webServer: {
      command: 'npm run build && npm run preview -- --host 127.0.0.1',
      url: 'http://127.0.0.1:4173/The-Butterfly-Garden/',
      reuseExistingServer: true,
    },
    projects: [
      { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    ],
  })
  ```
  ```bash
  npx playwright test -c pw-local.config.ts
  ```
  CI installs the correct browser itself, so `playwright.config.ts` stays as is.

- The project is **proprietary, all rights reserved**, heading for a Google Play
  release. `THIRD-PARTY-NOTICES.md` must stay accurate if a dependency is added —
  this work needed none.

---

## 11. Questions the original handoff left open

1. **Is the split wanted at all?** Yes — it was asked for, and the measurement
   in §1 supports it: half the bytes and a 73% shorter write on a three-year
   garden, with no change to durability.
2. **How long must the legacy record be kept?** Not decided here, and nothing
   forces the decision yet: the record is kept indefinitely, and removing it is
   a separate change. §6 argues for waiting until the split has shipped and
   soaked given Play's update adoption.
3. **Should cross-tab sync become granular?** Not done, deliberately. After a
   successful write the repository still posts a plain `garden-saved` on the
   `butterfly-garden-sync` channel and other tabs reload everything. That is
   correct, and it is the safer first version. Naming the changed collections in
   the message is a reasonable follow-up on its own.
