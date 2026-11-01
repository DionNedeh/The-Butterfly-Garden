# Moving the garden to its own address

The PWA is served from `https://dionnedeh.github.io/The-Butterfly-Garden/`.
An origin is scheme plus host, so every GitHub Pages project of this account
shares that origin with the garden. Any of them could read the garden's
IndexedDB, and Pages cannot send security headers (finding S1 and S2 in
`docs/Voyager-2026-10-26_18-48-37-UTC.md`). The fix is an address of the
garden's own. This page is the checklist for making that move without losing
anyone's garden.

None of this affects the Android app, whose storage belongs to the app, not
to an address.

## What is already in the code

- **Frame guard.** Inside another page's frame, the app shows only a link to
  open it in its own tab, and never opens its storage (`src/lib/hosting.ts`,
  `src/components/FramedNotice.tsx`).
- **Carry-over flow, dormant.** It wakes only in a build made with
  `VITE_MOVED_TO` set to the new https address. That build:
  - shows every gardener a banner, "The garden has a new home". The banner
    saves the garden to a file first, then links to the new address with
    `#/arrive` (`src/components/MovedBanner.tsx`);
  - with the garden lock on, saves the garden sealed with the lock (in the
    form of safe mode's "Download what's stored", `src/lib/storedCopy.ts`,
    holding the garden's own stores and the lock's record, without the
    earlier copies and drafts beside them), never a plain backup, and says
    so: the file opens at the new address with the passcode or the recovery
    code, the lock does not move with it, and a passkey has to be added again
    there. While the latest change is not stored yet, it saves nothing and
    says why, as that file is made from what is stored;
  - shows a newcomer at the old address a link to the new one.
- **"I have a backup" on onboarding**, at every address. Opened via `#/arrive`,
  it starts with the restore choice showing. A locked garden's copy asks for
  its passcode or recovery code first (`src/lib/lockedCopy.ts`).
- **A test** that a backup made at one address restores whole at another (the
  last test in `src/repository/twoTabs.test.ts`), and one that the banner's
  file for a locked garden is sealed and opens with either secret
  (`src/components/MovedBanner.lock.test.tsx`).
- **One address in the code.** `src/pwaAddress.json` holds where the PWA is
  served. `src/lib/calendarReminder.ts` reads it for the links back from the
  calendar files, and `scripts/reminder-files.mjs`, which writes those files
  into `public/reminders/`, reads it too.
- **The base path behind `VITE_BASE`** (`src/buildBase.ts`, read by
  `vite.config.ts`). Unset, the web build is served at
  `/The-Butterfly-Garden/`, as on GitHub Pages; `VITE_BASE=/` builds it for
  the root of a host of its own. The Android build is always at `/`.
- **No Referer.** `index.html` asks for `no-referrer` before it fetches
  anything, so neither the garden's own files nor a site it links to learn
  which page asked. It ships in the Android app too.

## Passkeys and the garden lock

A passkey belongs to the address it was made at. The garden creates passkeys
with no `rp.id` (`src/lib/passkey.ts`), so each is bound to
`dionnedeh.github.io`, and no browser offers it at the new address. A locked
garden's copy carries the lock's passcode and recovery code ways in with it,
but not the lock itself: what opens at the new address is the garden alone,
kept with no lock until the gardener turns one on there. So, for a gardener
with the lock on:

1. At the old address, "Save my garden to a file" saves the sealed copy.
2. At the new address, "I have a backup" takes that file, then asks for the
   passcode or the recovery code, and restores the garden it holds.
3. In Settings at the new address, they turn the lock on again, with a
   passcode and a new recovery code, and add a passkey again if they used
   one.

Whether to set an explicit `rp.id` for passkeys made at the new address
belongs to choosing that address, and is not in the code yet.

## The move, in order

1. **Choose the new host.** It should send headers. Cloudflare Pages and
   Netlify both can, through a `_headers` file. Serve at least:
   - `Content-Security-Policy` with `frame-ancestors 'none'`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: no-referrer`
   - `Permissions-Policy` that turns off what the garden never uses
2. **Point the address at the new one.** Change `src/pwaAddress.json`, run
   `node scripts/reminder-files.mjs` and commit the calendar files it
   rewrites. Change the address in `public/privacy.html`, in
   `docs/play-store/README.md`, and the privacy policy URL in the Play
   Console.
3. **Build for the new host, deploy it and check it.** Build with
   `VITE_BASE=/ npm run build` only now, after step 2, so the calendar files
   and their links name the new address. Make a backup at the old address.
   Restore it at the new one with "I have a backup". Do the same with a
   garden that has the lock on: its file must open at the new address with
   the passcode, and again with the recovery code. Check that the security
   headers show on the live response.
4. **Make the old address's final build.** Build with
   `VITE_MOVED_TO=https://<new address>/ npm run build`, with `VITE_BASE`
   unset, and deploy it to GitHub Pages. Nothing is deleted at the old
   address: each garden stays there too until its gardener is happy with the
   new one.
5. **Keep that build up** until visits to the old address are near zero.
   Then leave it in place: it costs nothing, and someone may come back after
   a year away.

Do not change the PWA's `id` or `scope` in a way that makes installed copies
point at the new address before step 4. An installed app that silently opened
the new, empty origin would look like a lost garden.
