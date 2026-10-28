# Follow-ups after the 3.6 source integration

Recorded 28 October 2026 against PR #68's implementation plan and merged PR #69.
The authoritative requirements and detailed acceptance criteria remain in
[final-pr-plan.md](final-pr-plan.md). This index preserves unfinished work;
it does not replace that plan or certify release readiness.

## Merge and build boundary

The owner requested source integration while retaining the deployed app and
saving the complete 3.6 web build. This merge uses `[skip ci]` on the branch and
merge commits; no workflow, test, budget or protection is weakened. The existing
live 3.5 deployment stays in place. A later ordinary push or manual deployment
can run the normal workflows, so deliberately schedule that after verification.
Compiled web and Android-web archives are saved locally with SHA-256 hashes.
They include all generated assets. The latter is not an APK/AAB. The source
branch is retained and the complete tracked source is archived separately.

For a local web preview, serve the web archive over localhost at its included
`/The-Butterfly-Garden/` path using a fresh browser profile. Do not open index.html
directly. A different origin has separate garden storage; move a protected copy
explicitly if needed. Keep an ordinary backup before changing builds. Do not
assume older source understands every retained record just because state and
database version numbers stayed unchanged.

## Section 2 and prerequisite 3.1

- [ ] Complete final-source browser acceptance. The interrupted run logged 86
  passes, two failures and one skip out of 173 scheduled cases. Investigate
  `e2e/comfort.spec.ts:132` (link outside viewport) and `e2e/app.spec.ts:1379`
  (offline reload disconnected). Their relationship to this change is unknown.
- [ ] Re-run the final static unused-code check when testing resumes. Its last
  complaint was the temporary Playwright config, removed afterward without rerun.
- [ ] Complete Firefox/WebKit, native sync/Gradle, APK/AAB and physical-device
  acceptance. Exercise real file-picker permission/cancellation, retained-file
  writes, storage pressure, locked recovery, reload and Undo, and old-build
  protected-copy compatibility. The unit and Chrome evidence is bounded in
  [section-2-verification.md](section-2-verification.md).
- [ ] Resolve the Windows pinned-Chromium 1243 file-handle round-trip crash or
  establish a supported test environment. Local checks used installed Google
  Chrome; no permanent CI browser change was made.
- [ ] Obtain release-level visual, accessibility and offline acceptance. Limited
  phone-width day/night captures are not exhaustive device or contrast review.
- [ ] Section 2.2 is deferred by owner choice: no QR scanning, QR encoding/display
  or camera permission ships. Typed twelve-word arrival is the supported flow.
  Revisit only if the owner requests it; do not treat it as missing release code.
- [ ] Section 3.1's damaged-snapshot download/discard/retry path is implemented
  here, with focused tests; include it in later native and full acceptance.

No additional heavy testing was authorized for this wrap-up. Completed evidence
includes 3,004 unit tests, 21 final focused tests, 14 focused Chrome browser cases,
typecheck/lint and final web/Android-web builds with unchanged passing budgets.
See the verification record for timing and limitations.

## Work still open from PR #68 after PR #69

- [ ] 1.1–1.2: retain the implemented seasons/night/moths foundation; finish
  remaining release/device/performance/contrast acceptance rather than rebuild it.
- [ ] 1.3: seasonal keepsake/outfit rules, enablement, fitting and owner decisions.
  Standalone drawings do not establish product integration.
- [ ] 1.4: explicit hemisphere selection outside the named regions.
- [ ] 1.5: integrate shape-based jar symbols/heart with compatibility checks.
- [ ] ART-1–5: preserve landed artwork and complete outstanding acceptance.
- [ ] ART-6–7: integrate the prepared keepsakes/outfits after owner decisions.
- [ ] ART-8: wire the prepared night thumbnails into the gallery.
- [ ] ART-9: screenshot files were refreshed in #69; verify final release/device
  presentation and perform any later store upload separately.
- [ ] ART-10: preserve recorded provenance; finish associated notices and older
  provenance gaps from the plan. See [art validation](art/validation.md) for
  exactly what was inspected locally in #69. Later CI evidence is separate.
- [ ] 3.2–3.6: lock-time draft retention; real passkey acceptance; photo-picker
  cancellation; recovery-word early checks; Argon2id/PBKDF2 decision.
- [ ] 4.1–4.5: closed-connection save retry; deletion locking/revision proof;
  plain-backup revision/hash; per-view error boundaries; single photo decode.
- [ ] 5.1–5.12: dedicated hosting/security headers; Firefox/Safari CI; moderate
  axe enforcement; visual regression suite; per-build/performance budgets; CSS;
  toolchain; support-line checks; privacy/security docs; drifted docs; guide;
  optional coverage-floor increase. Existing advisory WebKit failures from #69
  remain separate from the two unresolved local failures above.
- [ ] 6.1–6.14: shared day boundary; draft hint; gentle-day counters; currency
  help; empty guide search; browser Back; deeper addresses; longest annual run;
  comfort phone/focus improvements; sighting dates/conflicts; Android calendar;
  sightings in search/exports/letter/year; nature prompt; breath pacing.
- [ ] 7.1–7.6: Play release; real Android/iPhone checks; suspended Pass wording;
  startup entitlements; minimum WebView/error page; Gradle syntax. Refreshed
  listing images are partial work, not packaging, billing or submission acceptance.
- [ ] 8.1–8.6: owner decisions on backdrop Blobs, selector context, old streak,
  multiline recap notes, frozen legacy records and languages (currently skipped).

Record future decisions and verification against each original numbered step.
Do not mark the whole roadmap complete because this source integration merged.
