import { butterflyNames, plants as plantCatalog, species } from '../data/content'
import type {
  AppState,
  CreatureInstance,
  PlantInstance,
  SunlightAward,
} from '../types'
import { toLocalDate } from './date'
import { progressAppearance } from './appearance'

export const DAILY_SUNLIGHT_CAP = 5
export const CHRYSALIS_DURATION_MS = 72 * 60 * 60 * 1000
export const MAX_PLANT_GROWTH = 3
export const STARTER_SEEDS = 2
export const DAILY_SEED_REWARD = 1
export const EMERGENCE_SEED_REWARD = 2
export const PLANT_SEED_COST = 1
const CATERPILLAR_CARE_TO_CHRYSALIS = 2

export function createEmptyState(): AppState {
  return {
    version: 1,
    goals: [],
    completions: [],
    moods: [],
    reflections: [],
    plants: [],
    creatures: [],
    sunlight: [],
    seeds: 0,
  }
}

export function sunlightForDate(state: AppState, localDate: string): number {
  return state.sunlight.filter((award) => award.localDate === localDate).length
}

export function createInitialState(
  name: string,
  gardenName: string,
  now = new Date(),
): AppState {
  const nowIso = now.toISOString()
  return {
    ...createEmptyState(),
    profile: {
      id: 'profile',
      name: name.trim() || 'Gardener',
      gardenName: gardenName.trim() || 'My Butterfly Garden',
      createdAt: nowIso,
      reducedMotion: false,
      theme: 'sunlight',
      selectedBackdropId: 'sunlit-meadow',
      unlockedBackdropIds: ['sunlit-meadow'],
    },
    plants: [
      {
        id: crypto.randomUUID(),
        plantId: 'milkweed',
        growth: 2,
        plantedAt: nowIso,
      },
      {
        id: crypto.randomUUID(),
        plantId: 'aster',
        growth: 1,
        plantedAt: nowIso,
      },
    ],
    creatures: [
      {
        id: crypto.randomUUID(),
        speciesId: 'monarch',
        name: 'Sol',
        stage: 'chrysalis',
        carePoints: 0,
        discoveredAt: nowIso,
        chrysalisStartedAt: nowIso,
        emergeAt: new Date(now.getTime() + CHRYSALIS_DURATION_MS).toISOString(),
      },
    ],
    seeds: STARTER_SEEDS,
  }
}

function discoverCaterpillar(
  state: AppState,
  maturePlant: PlantInstance,
  now: Date,
): CreatureInstance | undefined {
  const definition = plantCatalog.find((plant) => plant.id === maturePlant.plantId)
  const speciesId =
    definition?.speciesIds.find(
      (candidateId) =>
        !state.creatures.some((creature) => creature.speciesId === candidateId),
    ) ??
    definition?.speciesIds.find(
      (candidateId) =>
        !state.creatures.some(
          (creature) =>
            creature.speciesId === candidateId && creature.stage !== 'emerged',
        ),
    )
  if (!speciesId) return undefined
  const count = state.creatures.length
  return {
    id: crypto.randomUUID(),
    speciesId,
    name: butterflyNames[count % butterflyNames.length],
    stage: 'caterpillar',
    carePoints: 0,
    discoveredAt: now.toISOString(),
    sourcePlantId: maturePlant.id,
  }
}

export function progressGarden(state: AppState, now = new Date()): AppState {
  const appearanceState = progressAppearance(state, now)
  let changed = appearanceState !== state
  const creatures = appearanceState.creatures.map((creature) => {
    if (
      creature.stage === 'chrysalis' &&
      creature.emergeAt &&
      now.getTime() >= new Date(creature.emergeAt).getTime()
    ) {
      changed = true
      return {
        ...creature,
        stage: 'emerged' as const,
        emergedAt: creature.emergedAt ?? now.toISOString(),
      }
    }
    return creature
  })
  if (!changed) return state
  const newlyEmerged = creatures.filter(
    (creature, index) =>
      creature.stage === 'emerged' &&
      appearanceState.creatures[index]?.stage !== 'emerged',
  ).length
  return {
    ...appearanceState,
    creatures,
    seeds: appearanceState.seeds + newlyEmerged * EMERGENCE_SEED_REWARD,
    profile:
      appearanceState.profile && !appearanceState.profile.activeCompanionId
        ? {
            ...appearanceState.profile,
            activeCompanionId: creatures.find(
              (creature) => creature.stage === 'emerged',
            )?.id,
          }
        : appearanceState.profile,
  }
}

export function awardSunlight(
  inputState: AppState,
  source: string,
  now = new Date(),
): AppState {
  const state = progressGarden(inputState, now)
  const localDate = toLocalDate(now)
  if (state.sunlight.some((award) => award.source === source)) return state
  if (sunlightForDate(state, localDate) >= DAILY_SUNLIGHT_CAP) return state
  const firstSunlightToday = sunlightForDate(state, localDate) === 0

  const award: SunlightAward = {
    id: crypto.randomUUID(),
    localDate,
    source,
    awardedAt: now.toISOString(),
  }

  let usedCare = false
  let creatures = state.creatures.map((creature) => {
    if (usedCare || creature.stage !== 'caterpillar') return creature
    usedCare = true
    const carePoints = creature.carePoints + 1
    if (carePoints < CATERPILLAR_CARE_TO_CHRYSALIS) {
      return { ...creature, carePoints }
    }
    return {
      ...creature,
      carePoints,
      stage: 'chrysalis' as const,
      chrysalisStartedAt: now.toISOString(),
      emergeAt: new Date(now.getTime() + CHRYSALIS_DURATION_MS).toISOString(),
    }
  })

  let plants = state.plants
  if (!usedCare) {
    let grownPlant: PlantInstance | undefined
    plants = state.plants.map((plant) => {
      if (grownPlant || plant.growth >= MAX_PLANT_GROWTH) return plant
      grownPlant = { ...plant, growth: plant.growth + 1 }
      return grownPlant
    })
    if (grownPlant?.growth === MAX_PLANT_GROWTH) {
      const discovered = discoverCaterpillar(
        { ...state, creatures },
        grownPlant,
        now,
      )
      if (discovered) creatures = [...creatures, discovered]
    }
  }

  return {
    ...state,
    plants,
    creatures,
    sunlight: [...state.sunlight, award],
    seeds:
      state.seeds + (firstSunlightToday ? DAILY_SEED_REWARD : 0),
  }
}

export function plantSeed(
  state: AppState,
  plantId: string,
  now = new Date(),
): AppState {
  if (
    state.seeds < PLANT_SEED_COST ||
    !plantCatalog.some((plant) => plant.id === plantId)
  ) {
    return state
  }
  return {
    ...state,
    seeds: state.seeds - PLANT_SEED_COST,
    plants: [
      ...state.plants,
      {
        id: crypto.randomUUID(),
        plantId,
        growth: 0,
        plantedAt: now.toISOString(),
      },
    ],
  }
}

export function getSpecies(id: string) {
  return species.find((item) => item.id === id)
}
