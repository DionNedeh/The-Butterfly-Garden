/**
 * Which release this build is, apart from what its notes say.
 *
 * The garden needs this much on every launch: whether its gardener has read
 * this release's notes, and what to call the release. The notes themselves
 * (data/releases) are read on the What's new page alone, so they stay out of
 * the first load however long they grow. data/releases.test.ts checks that
 * the newest entry there is this one.
 */
export const currentRelease = { id: 'release-3-3', version: '3.3.0' } as const

/** "3.3" from "3.3.0": how the app speaks of a release. */
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
