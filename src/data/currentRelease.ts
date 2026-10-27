/**
 * Which release this build is, apart from what each release says.
 *
 * The shell needs only the newest release's id and version (to know whether
 * the notes are unread, and to name the version); the notes' text belongs to
 * What's new, which loads with that page. data/releases.ts lists the notes,
 * newest first, and its test checks that the first one is this one.
 */
export const currentRelease = { id: 'release-3-0', version: '3.0.0' } as const

/** "3.0" from "3.0.0": how the app speaks of a release. */
export function releaseName(release: { version: string } = currentRelease): string {
  return release.version.split('.').slice(0, 2).join('.')
}

/**
 * Whether a gardener has release notes waiting.
 *
 * An unrecognised id counts as unseen. It usually means a backup from a newer
 * build, and hiding the current notes because of a value this build cannot
 * place would leave someone with no way to read them.
 */
export function hasUnseenRelease(lastSeenReleaseId: string | undefined): boolean {
  if (!lastSeenReleaseId) return true
  return lastSeenReleaseId !== currentRelease.id
}
