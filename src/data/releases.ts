/**
 * What changed, release by release.
 *
 * Local data so release notes are readable offline, and immutable so a running
 * build can only ever describe itself. Nothing here is fetched, and nothing is
 * rendered as HTML: entries are plain strings that React escapes like any
 * other text.
 *
 * Only shipped and verified work belongs here. An entry describing something
 * planned would tell gardeners a feature is in the version they are running
 * when it is not.
 */
export interface ReleaseSection {
  title: string
  items: string[]
}

export interface ReleaseNote {
  /** Stable; `lastSeenReleaseId` in the profile refers to it. */
  id: string
  version: string
  /** ISO date. Left undefined until a release actually goes out. */
  releasedOn?: string
  title: string
  sections: ReleaseSection[]
}

/**
 * Newest first.
 *
 * The 3.0 entry deliberately lists only what has landed. Sections are added as
 * each area is finished rather than written ahead of the work, so this file is
 * never a promise.
 */
export const releases: ReleaseNote[] = [
  {
    id: 'release-3-0',
    version: '3.0.0',
    title: 'A livelier garden',
    sections: [
      {
        title: 'Flight',
        items: [
          'Six more flight patterns to choose between: Clover Meander, Breeze Glide, Blossom Bounce, Ribbon Loop, Moonbeam Float and Canopy Dance.',
        ],
      },
      {
        title: 'Garden Pass preview',
        items: [
          'Garden Pass outfits are included free in this release so you can try them. No subscription or payment is active.',
        ],
      },
      {
        title: 'Smaller things',
        items: [
          'The garden counts species welcomed rather than butterflies, so two of the same species read as one.',
        ],
      },
    ],
  },
]

/** The release this build is describing. */
export const currentRelease = releases[0]

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

export function getRelease(id: string): ReleaseNote | undefined {
  return releases.find((release) => release.id === id)
}
