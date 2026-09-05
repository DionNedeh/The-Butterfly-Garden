# Security

## What this app stores, and where

The Butterfly Garden runs entirely in the browser. Goals, mood check-ins,
reflections, and garden progress are written to this device's IndexedDB and
never leave it. There is no account, no server, no analytics, and no
third-party request of any kind — the fonts are served from the app's own
origin so that opening the app does not reveal a visit to anyone.

The only copy of your garden is the one in your browser. Settings → Backup and
restore writes a JSON file straight to your device; that file contains
everything you have written, so store it as carefully as you would a diary.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's
[security advisories](https://github.com/DionNedeh/The-Butterfly-Garden/security/advisories/new)
rather than opening a public issue. A response can be expected within a week.

Findings that are especially welcome:

- anything that causes stored journal entries to be lost or overwritten
- anything that causes data to leave the device
- anything that makes deletion report success without deleting

## Scope

This is a static, client-only progressive web app deployed to GitHub Pages.
There is no backend, no authentication, and no user-to-user interaction, so
there is no server-side attack surface to report against.
