# Security

## What this app stores, and where

The Butterfly Garden keeps everything on the device it runs on. Goals, mood
check-ins, reflections, the field book and its photos, the comfort plan, and
garden progress are written to the browser's IndexedDB (on the web) or to the
Android app's private storage, and never leave it. There is no account, no
server, no analytics, and no tracking. The app's own code makes no
third-party request of any kind — the fonts and images are part of the app,
so opening it does not reveal a visit to anyone. Links on the support page,
the comfort plan's numbers and the nature counts hand off to the dialler, the
messages app or the browser, and carry nothing from the garden; a daily
calendar visit hands the calendar a fixed event with nothing from the journal.

The one exception is the Android app's optional Garden Pass. It is sold through
Google Play, which requires Google's Play Billing Library inside the app, and
that library can send Google diagnostics about purchases and its own operation.
The app only starts it when the gardener opens the Garden Pass, subscribes,
manages it in Google Play, or already has a Pass, and never gives it anything
the gardener has written.
Android's cloud backup is switched off for the app, and its WebView is opted
out of Android's usage diagnostics.

The only copy of your garden is the one on your device. Settings → Backup and
restore writes a JSON file to a place you choose; that file contains everything
you have written, so store it as carefully as you would a diary. A protected
backup is the same file locked with a passphrase, described below.

## Garden lock and protected backups

Settings → Lock my garden seals the garden at rest, on the device, with the
browser's own WebCrypto and no dependency (`src/lib/gardenLock.ts`,
`src/lib/sealing.ts`, `src/repository/sealedStores.ts`). One random 256-bit
data key seals every stored value that can hold the gardener's words — the
garden's parts, the legacy whole-garden record, earlier copies, set-aside
copies and drafts — each with AES-GCM, a fresh 96-bit IV, and the name of its
place as additional data, so a value moved to another place does not open.
Each way in has a P-256 key pair: its private half is sealed under a key made
from the secret, and the data key is sealed to its public half (ECDH, then
HKDF). For the passcode and the recovery code that key comes from
PBKDF2-HMAC-SHA-256 (600,000 iterations, a fresh salt); for a passkey, from
HKDF-SHA-256 over the passkey's PRF answer, under a label of its own. The ways
in are the passcode, a 24-word recovery code the gardener keeps, and, in
browsers whose passkeys offer WebAuthn's PRF extension, a passkey; never in
the Android app, whose WebView has no WebAuthn. The passcode and the recovery
code are never stored. A new passcode or recovery code, or a passkey taken
away, replaces the data key and seals the garden again, so an old secret, and
any old copy of the lock it opened, opens nothing written since. A wrong
secret fails on AES-GCM's own check and says only "no"; every guess costs the
full key derivation.

What the lock leaves readable: the lock's own record (salts, public keys and
sealed keys, useless without a secret), the backup file kept up to date
(`src/lib/autoBackupFile.ts`: which file and when it was written, never its
contents; it is not written while the lock is on), the dates, sizes and write
counts kept beside the sealed values, how many photos the field book holds and
each one's size (each photo is sealed into a Blob of its own beside its part),
the approximate size of every sealed part (AES-GCM keeps the length), and the
version a sealed `meta` record shows in the clear (`SEALED_META_VERSION`,
above any version an older build reads, so such a build calls the garden a
newer version's work rather than damaged). While the garden is open its data
key is in memory, as the garden is. If the passcode and the recovery code are
both lost, and no passkey the lock still holds is at hand, the garden cannot
be opened by anyone.

A protected backup (`src/lib/sealedBackup.ts`) is the plain backup's text,
locked with a passphrase: PBKDF2-HMAC-SHA-256 at 600,000 iterations with a
fresh salt, then AES-GCM 256, with the format and its version as additional
data. It does not hide that it is a garden backup, when it was made, by which
version, or roughly how large the garden is. A move file, for a new device,
is the same envelope locked with a one-time code of 12 words (128 random bits
and a 4-bit check, `src/lib/moveCode.ts`). Safe mode's copy of a locked garden
stays sealed, and opens only with the lock's passcode or recovery code. A
plain backup carries a revision and a SHA-256 of its garden, which a restore's
preview checks; that is a check against change, not against reading.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's
[security advisories](https://github.com/DionNedeh/The-Butterfly-Garden/security/advisories/new)
rather than opening a public issue. A response can be expected within a week.

Findings that are especially welcome:

- anything that causes stored journal entries to be lost or overwritten
- anything that causes data to leave the device
- anything that makes deletion report success without deleting
- anything that lets another app on the phone, a web page, or a file read the
  garden or act through the Android app's native plugins
- anything that opens a locked garden, a protected backup or a move file
  without its secret, or leaves the gardener's words unsealed while the lock
  is on

## Scope

The web version is a static, client-only progressive web app deployed to
GitHub Pages. The Android app is the same code bundled with Capacitor, served
from inside the APK, with two small native plugins: GardenFiles, which saves
a file where the gardener chooses (a backup, the year's postcard, a calendar
file) and opens the calendar's own new-event screen for a daily visit, and
Google Play Billing. There is no backend, no account, and no user-to-user
interaction, so there is no server-side attack surface to report against.

On the web, every protection here stops at the browser's same-origin
boundary. The garden is served from
`dionnedeh.github.io/The-Butterfly-Garden/`, and an origin is scheme plus
host, so every page under `dionnedeh.github.io` shares the garden's origin:
its IndexedDB and its BroadcastChannels. Code served from that origin can read
what the garden stores and can script a garden page it opens, so the garden
lock does not protect against it: it could read a passcode as it is typed.
That is a known limit, which lasts until the garden moves to an address of its
own (`docs/moving-the-garden.md`), not a vulnerability; a way for code on any
other origin to reach the garden is one. The Android app's storage belongs to
the app, not to an address, and has no such limit.

Garden Pass purchases are checked on the device: Google Play's signature on
each purchase is verified against the app's Play licence key before anything
opens. With no server, someone who modifies the app on their own phone can get
around that check. That is a known and accepted limit, not a vulnerability; a
way to unlock the Pass on an unmodified app is one.
