import type {
  AppState,
  AppearanceTheme,
  GardenBackdropId,
  Profile,
} from '../types'

const DAY_MS = 86_400_000

export const gardenBackdrops: Array<{
  id: GardenBackdropId
  name: string
  description: string
  unlockDays: number
}> = [
  {
    id: 'sunlit-meadow',
    name: 'Sunlit Meadow',
    description: 'The bright wildflower garden where your sanctuary began.',
    unlockDays: 0,
  },
  {
    id: 'woodland-brook',
    name: 'Woodland Brook',
    description: 'A fern-lined clearing beside a cool, winding stream.',
    unlockDays: 30,
  },
  {
    id: 'secret-conservatory',
    name: 'Secret Conservatory',
    description: 'Flowering stone arches surrounding a quiet lily pond.',
    unlockDays: 60,
  },
]

export function elapsedGardenDays(profile: Profile, now = new Date()) {
  const createdAt = new Date(profile.createdAt).getTime()
  if (!Number.isFinite(createdAt)) return 0
  return Math.max(0, Math.floor((now.getTime() - createdAt) / DAY_MS))
}

export function unlockedBackdropIds(profile: Profile, now = new Date()) {
  const elapsedDays = elapsedGardenDays(profile, now)
  const unlocked = new Set<GardenBackdropId>([
    'sunlit-meadow',
    ...(profile.unlockedBackdropIds ?? []),
  ])
  gardenBackdrops.forEach((backdrop) => {
    if (elapsedDays >= backdrop.unlockDays) unlocked.add(backdrop.id)
  })
  return gardenBackdrops
    .map((backdrop) => backdrop.id)
    .filter((id) => unlocked.has(id))
}

export function daysUntilBackdrop(
  profile: Profile,
  backdropId: GardenBackdropId,
  now = new Date(),
) {
  if (unlockedBackdropIds(profile, now).includes(backdropId)) return 0
  const backdrop = gardenBackdrops.find((item) => item.id === backdropId)
  return Math.max(0, (backdrop?.unlockDays ?? 0) - elapsedGardenDays(profile, now))
}

export function progressAppearance(state: AppState, now = new Date()): AppState {
  const profile = state.profile
  if (!profile) return state

  const unlocked = unlockedBackdropIds(profile, now)
  const selectedBackdropId =
    profile.selectedBackdropId &&
    unlocked.includes(profile.selectedBackdropId)
      ? profile.selectedBackdropId
      : 'sunlit-meadow'
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
