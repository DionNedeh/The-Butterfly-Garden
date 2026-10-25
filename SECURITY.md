# Security

## What this app stores, and where

The Butterfly Garden keeps everything on the device it runs on. Goals, mood
check-ins, reflections, and garden progress are written to the browser's
IndexedDB (on the web) or to the Android app's private storage, and never
leave it. There is no account, no server, no analytics, and no tracking. The
app's own code makes no third-party request of any kind — the fonts and images
are part of the app, so opening it does not reveal a visit to anyone.

The one exception is the Android app's optional Garden Pass. It is sold through
Google Play, which requires Google's Play Billing Library inside the app, and
that library can send Google diagnostics about purchases and its own operation.
The app only starts it when the gardener opens the Garden Pass, subscribes, or
already has a Pass, and never gives it anything the gardener has written.
Android's cloud backup is switched off for the app, and its WebView is opted
out of Android's usage diagnostics.

The only copy of your garden is the one on your device. Settings → Backup and
restore writes a JSON file to a place you choose; that file contains everything
you have written, so store it as carefully as you would a diary.

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

## Scope

The web version is a static, client-only progressive web app deployed to
GitHub Pages. The Android app is the same code bundled with Capacitor, served
from inside the APK, with two small native plugins (saving a backup file, and
Google Play Billing). There is no backend, no authentication, and no
user-to-user interaction, so there is no server-side attack surface to report
against.

Garden Pass purchases are checked on the device: Google Play's signature on
each purchase is verified against the app's Play licence key before anything
opens. With no server, someone who modifies the app on their own phone can get
around that check. That is a known and accepted limit, not a vulnerability; a
way to unlock the Pass on an unmodified app is one.
