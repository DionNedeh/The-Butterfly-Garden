import { butterflyNames, plants as plantCatalog, species } from '../data/content'
import type {
  AppState,
  CreatureInstance,
  PlantInstance,
  SunlightAward,
} from '../types'
import { toLocalDate } from './date'
import { progressAppearance } from './appearance'
import { DEFAULT_FLIGHT_PATTERN_ID } from './flightPatterns'
import { EMERGENCE_SEED_REWARD } from './lifecycle'
import { PLANT_CAPACITY } from './plantManagement'

export { EMERGENCE_SEED_REWARD }

export const DAILY_SUNLIGHT_CAP = 5
export const NECTAR_PER_SUNLIGHT = 3
export const MAX_PLANT_GROWTH = 3
export const STARTER_SEEDS = 2
export const STARTER_NECTAR = 10
export const DAILY_SEED_REWARD = 1
export const PLANT_SEED_COST = 1

export function createEmptyState(): AppState {
  return {
    version: 4,
    goals: [],
    completions: [],
    moods: [],
    reflections: [],
    plants: [],
    creatures: [],
    sunlight: [],
    seeds: 0,
    nectar: 0,
    stardust: 0,
    inventory: {},
    ownedItemIds: [],
    ownedFlightPatternIds: [DEFAULT_FLIGHT_PATTERN_ID],
    selectedFlightPatternId: DEFAULT_FLIGHT_PATTERN_ID,
    jars: [],
    jarPlacements: [],
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
        stage: 'caterpillar',
        careDates: {},
        actionLog: {},
        bond: 0,
        outfit: {},
        carePoints: 0,
        discoveredAt: nowIso,
      },
    ],
    seeds: STARTER_SEEDS,
    nectar: STARTER_NECTAR,
    inventory: {
      'leaf-bundle': 2,
      'spring-water': 1,
      'nectar-drop': 1,
    },
  }
}

function discoverEgg(
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
            creature.speciesId === candidateId && creature.stage !== 'butterfly',
        ),
    )
  if (!speciesId) return undefined
  const count = state.creatures.length
  return {
    id: crypto.randomUUID(),
    speciesId,
    name: butterflyNames[count % butterflyNames.length],
    stage: 'egg',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: now.toISOString(),
    sourcePlantId: maturePlant.id,
  }
}

/**
 * Time-based housekeeping. Stage advancement is care-driven in 2.0, but
 * chrysalises from 1.x saves still carry an emergeAt timer we honor.
 */
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
        stage: 'butterfly' as const,
        emergedAt: creature.emergedAt ?? now.toISOString(),
        emergeAt: undefined,
      }
    }
    return creature
  })
  if (!changed) return state
  const newlyEmerged = creatures.filter(
    (creature, index) =>
      creature.stage === 'butterfly' &&
      appearanceState.creatures[index]?.stage !== 'butterfly',
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
              (creature) => creature.stage === 'butterfly',
            )?.id,
          }
        : appearanceState.profile,
  }
}

/**
 * Self-care Sunlight: capped daily, converts to Nectar, grows one plant per
 * award. When a host plant reaches full bloom it may reveal a butterfly egg.
 */
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

  let creatures = state.creatures
  let grownPlant: PlantInstance | undefined
  const plants = state.plants.map((plant) => {
    if (grownPlant || plant.growth >= MAX_PLANT_GROWTH) return plant
    grownPlant = { ...plant, growth: plant.growth + 1 }
    return grownPlant
  })
  if (grownPlant?.growth === MAX_PLANT_GROWTH) {
    const discovered = discoverEgg(state, grownPlant, now)
    if (discovered) creatures = [...creatures, discovered]
  }

  return {
    ...state,
    plants,
    creatures,
    sunlight: [...state.sunlight, award],
    nectar: state.nectar + NECTAR_PER_SUNLIGHT,
    seeds: state.seeds + (firstSunlightToday ? DAILY_SEED_REWARD : 0),
  }
}

export function plantSeed(
  state: AppState,
  plantId: string,
  now = new Date(),
): AppState {
  if (
    state.seeds < PLANT_SEED_COST ||
    state.plants.length >= PLANT_CAPACITY ||
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
