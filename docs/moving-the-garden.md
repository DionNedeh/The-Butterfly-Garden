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
  - shows a newcomer at the old address a link to the new one.
- **"I have a backup" on onboarding**, at every address. Opened via `#/arrive`,
  it starts with the restore choice showing.
- **A test** that a backup made at one address restores whole at another (the
  last test in `src/repository/twoTabs.test.ts`).

## The move, in order

1. **Choose the new host.** It should send headers. Cloudflare Pages and
   Netlify both can, through a `_headers` file. Serve at least:
   - `Content-Security-Policy` with `frame-ancestors 'none'`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: no-referrer`
   - `Permissions-Policy` that turns off what the garden never uses

   Then build with `base: '/'` in `vite.config.ts` for that host.
2. **Deploy the new address and check it.** Make a backup at the old address.
   Restore it at the new one with "I have a backup". Check that the security
   headers show on the live response.
3. **Make the old address's final build.** Build with
   `VITE_MOVED_TO=https://<new address>/ npm run build` and deploy it to
   GitHub Pages. Nothing is deleted at the old address: each garden stays
   there too until its gardener is happy with the new one.
4. **Keep that build up** until visits to the old address are near zero.
   Then leave it in place: it costs nothing, and someone may come back after
   a year away.

Do not change the PWA's `id` or `scope` in a way that makes installed copies
point at the new address before step 3. An installed app that silently opened
the new, empty origin would look like a lost garden.
