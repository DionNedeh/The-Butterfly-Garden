import { hasGardenPassFeature, type GardenPassProvider } from './gardenPass'
import type {
  AppState,
  AppearanceTheme,
  GardenBackdropId,
  Profile,
} from '../types'

const DAY_MS = 86_400_000

/** The scene every garden starts with, and the fallback for everything else. */
export const DEFAULT_BACKDROP_ID: GardenBackdropId = 'sunlit-meadow'

/**
 * How a backdrop becomes available.
 *
 * Discriminated so the two kinds cannot be confused: `garden-age` is earned
 * once and kept forever, while `pass` depends on access that can come and go.
 * Collapsing them into one "unlocked" list is what would turn a temporary
 * grant into a permanent unlock the moment it was saved.
 */
export type BackdropUnlock =
  | { kind: 'free' }
  | { kind: 'garden-age'; days: number }
  | { kind: 'pass' }

export interface GardenBackdropDefinition {
  id: GardenBackdropId
  name: string
  description: string
  unlock: BackdropUnlock
}

export const gardenBackdrops: GardenBackdropDefinition[] = [
  {
    id: 'sunlit-meadow',
    name: 'Sunlit Meadow',
    description: 'The bright wildflower garden where your sanctuary began.',
    unlock: { kind: 'free' },
  },
  {
    id: 'woodland-brook',
    name: 'Woodland Brook',
    description: 'A fern-lined clearing beside a cool, winding stream.',
    unlock: { kind: 'garden-age', days: 30 },
  },
  {
    id: 'secret-conservatory',
    name: 'Secret Conservatory',
    description: 'Flowering stone arches surrounding a quiet lily pond.',
    unlock: { kind: 'garden-age', days: 60 },
  },
  {
    id: 'cottage-bloom',
    name: 'Cottage Bloom',
    description: 'A sunlit path through roses, daisies and lavender.',
    unlock: { kind: 'free' },
  },
  {
    id: 'rain-kissed-pond',
    name: 'Rain-kissed Pond',
    description: 'Silver water, soft rain and a little room to breathe.',
    unlock: { kind: 'garden-age', days: 14 },
  },
  {
    id: 'twilight-orchard',
    name: 'Twilight Orchard',
    description: 'Lanterns and fireflies among the apple blossoms.',
    unlock: { kind: 'pass' },
  },
  {
    id: 'cloud-garden',
    name: 'Cloud Garden',
    description: 'A quiet terrace above a sea of morning clouds.',
    unlock: { kind: 'pass' },
  },
]

/** Days a backdrop has to be waited for, or 0 when it is not time-gated. */
export function backdropUnlockDays(
  backdrop: Pick<GardenBackdropDefinition, 'unlock'>,
): number {
  return backdrop.unlock.kind === 'garden-age' ? backdrop.unlock.days : 0
}

export function elapsedGardenDays(profile: Profile, now = new Date()) {
  const createdAt = new Date(profile.createdAt).getTime()
  if (!Number.isFinite(createdAt)) return 0
  return Math.max(0, Math.floor((now.getTime() - createdAt) / DAY_MS))
}

/**
 * Backdrops this garden has earned permanently.
 *
 * Only free and age-earned scenes, never pass ones -- including when a stored
 * profile already lists a pass id, which a hand-edited backup could. This list
 * gets written back into the profile, so anything that reaches it is kept for
 * good; a scene that depends on current access must not be able to get in.
 */
export function unlockedBackdropIds(profile: Profile, now = new Date()) {
  const elapsedDays = elapsedGardenDays(profile, now)
  const stored = new Set<GardenBackdropId>([
    DEFAULT_BACKDROP_ID,
    ...(profile.unlockedBackdropIds ?? []),
  ])
  return gardenBackdrops
    .filter((backdrop) => {
      if (backdrop.unlock.kind === 'pass') return false
      if (backdrop.unlock.kind === 'free') return true
      return elapsedDays >= backdrop.unlock.days || stored.has(backdrop.id)
    })
    .map((backdrop) => backdrop.id)
}

/**
 * Backdrops that can be chosen right now.
 *
 * Permanent unlocks plus pass scenes while pass access holds. This is the list
 * selection screens should offer; `unlockedBackdropIds` is the narrower set
 * that gets persisted.
 */
export function availableBackdropIds(
  profile: Profile,
  now = new Date(),
  provider?: GardenPassProvider | null,
): GardenBackdropId[] {
  const permanent = new Set(unlockedBackdropIds(profile, now))
  const passAllowed = hasGardenPassFeature('pass-backdrops', provider)
  return gardenBackdrops
    .filter(
      (backdrop) =>
        permanent.has(backdrop.id) ||
        (backdrop.unlock.kind === 'pass' && passAllowed),
    )
    .map((backdrop) => backdrop.id)
}

/**
 * The scene to actually draw.
 *
 * A pass scene stays selected when access lapses -- the choice is the
 * gardener's and is not thrown away -- but the free default is what renders
 * until access returns.
 */
export function effectiveBackdropId(
  profile: Profile,
  now = new Date(),
  provider?: GardenPassProvider | null,
): GardenBackdropId {
  const selected = profile.selectedBackdropId
  if (!selected) return DEFAULT_BACKDROP_ID
  return availableBackdropIds(profile, now, provider).includes(selected)
    ? selected
    : DEFAULT_BACKDROP_ID
}

export function daysUntilBackdrop(
  profile: Profile,
  backdropId: GardenBackdropId,
  now = new Date(),
) {
  if (unlockedBackdropIds(profile, now).includes(backdropId)) return 0
  const backdrop = gardenBackdrops.find((item) => item.id === backdropId)
  return Math.max(
    0,
    (backdrop ? backdropUnlockDays(backdrop) : 0) -
      elapsedGardenDays(profile, now),
  )
}

export function progressAppearance(
  state: AppState,
  now = new Date(),
): AppState {
  const profile = state.profile
  if (!profile) return state

  const unlocked = unlockedBackdropIds(profile, now)
  const definition = gardenBackdrops.find(
    (backdrop) => backdrop.id === profile.selectedBackdropId,
  )
  // A pass scene keeps its place in the profile even when access is gone.
  // Clearing it here would silently discard the gardener's choice, and they
  // would have to find and pick it again every time access came back.
  const selectedBackdropId =
    definition &&
    (unlocked.includes(definition.id) || definition.unlock.kind === 'pass')
      ? definition.id
      : DEFAULT_BACKDROP_ID
  const theme: AppearanceTheme = profile.theme ?? 'sunlight'

  if (
    profile.theme === theme &&
    profile.selectedBackdropId === selectedBackdropId &&
    unlocked.length === profile.unlockedBackdropIds?.length &&
    unlocked.every((id) => profile.unlockedBackdropIds?.includes(id))
  ) {
    return state
  }

  return {
    ...state,
    profile: {
      ...profile,
      theme,
      selectedBackdropId,
      unlockedBackdropIds: unlocked,
    },
  }
}
