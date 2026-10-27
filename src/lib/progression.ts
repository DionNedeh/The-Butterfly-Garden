import {
  butterflyNames,
  plants as plantCatalog,
  species,
} from '../data/content'
import type {
  AppState,
  CreatureInstance,
  MoonlightAward,
  PlantInstance,
  RecapEntry,
  SunlightAward,
} from '../types'
import { toLocalDate } from './date'
import { progressAppearance } from './appearance'
import { DEFAULT_FLIGHT_PATTERN_ID } from './flightPatterns'
import { EMERGENCE_SEED_REWARD } from './lifecycle'
import { PLANT_CAPACITY } from './plantManagement'
import { selectDiscoveryCandidate } from './speciesAcquisition'
import { createId } from './id'
import { currentRelease } from '../data/releases'

export { EMERGENCE_SEED_REWARD }

export const DAILY_SUNLIGHT_CAP = 5
export const NECTAR_PER_SUNLIGHT = 3
export const MAX_PLANT_GROWTH = 3
export const STARTER_SEEDS = 2
/** The monarch caterpillar every garden starts with, until it is renamed. */
export const STARTER_COMPANION_NAME = 'Sol'
export const STARTER_NECTAR = 10
export const DAILY_SEED_REWARD = 1
export const PLANT_SEED_COST = 1
export const MOONLIGHT_STARDUST_REWARD = 1

export function createEmptyState(): AppState {
  return {
    version: 6,
    goals: [],
    completions: [],
    moods: [],
    reflections: [],
    recaps: [],
    moonlight: [],
    customBackdrops: [],
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
  let count = 0
  for (const award of state.sunlight) {
    if (award.localDate === localDate) count += 1
  }
  return count
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
      ambientTrack: 'garden-chimes',
      theme: 'sunlight',
      selectedBackdropId: 'sunlit-meadow',
      unlockedBackdropIds: ['sunlit-meadow', 'cottage-bloom'],
      lastSeenReleaseId: currentRelease.id,
    },
    plants: [
      {
        id: createId(),
        plantId: 'milkweed',
        growth: 2,
        plantedAt: nowIso,
      },
      {
        id: createId(),
        plantId: 'aster',
        growth: 1,
        plantedAt: nowIso,
      },
    ],
    creatures: [
      {
        id: createId(),
        speciesId: 'monarch',
        name: STARTER_COMPANION_NAME,
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

/** Names match ignoring case and the spaces around them: "  sol " is Sol. */
function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * A name no companion in the garden has yet. Names are offered in order,
 * starting where the garden's size points; the list used to be taken purely
 * by count, so the third creature was always a second "Sol". Once every name
 * is taken, the next one gains a number: "Juniper 2".
 */
export function nextCompanionName(
  creatures: ReadonlyArray<Pick<CreatureInstance, 'name'>>,
): string {
  const taken = new Set(creatures.map((creature) => nameKey(creature.name)))
  const start = creatures.length % butterflyNames.length
  for (let offset = 0; offset < butterflyNames.length; offset += 1) {
    const name = butterflyNames[(start + offset) % butterflyNames.length]
    if (!taken.has(nameKey(name))) return name
  }
  const base = butterflyNames[start]
  for (let number = 2; ; number += 1) {
    const name = `${base} ${number}`
    if (!taken.has(nameKey(name))) return name
  }
}

type NamedCreature = Pick<CreatureInstance, 'id' | 'name'>

/** Whether a companion other than this one already goes by the name. */
export function nameInUse(
  creatures: readonly NamedCreature[],
  name: string,
  exceptId: string,
): boolean {
  const key = nameKey(name)
  return creatures.some(
    (creature) => creature.id !== exceptId && nameKey(creature.name) === key,
  )
}

/**
 * The name a new arrival is offered: its own while no other companion shares
 * it, so the offer matches what the garden already calls it, and otherwise
 * the first name nobody has. The second case is rare (another companion was
 * renamed to match before the offer was answered), but an offer should never
 * suggest a name that is already taken.
 */
export function nameToOffer(
  creatures: readonly NamedCreature[],
  creatureId: string,
): string {
  const own = creatures.find((creature) => creature.id === creatureId)
  if (own && !nameInUse(creatures, own.name, creatureId)) return own.name
  return nextCompanionName(creatures.filter((creature) => creature.id !== creatureId))
}

function discoverEgg(
  state: AppState,
  maturePlant: PlantInstance,
  now: Date,
): CreatureInstance | undefined {
  const definition = plantCatalog.find(
    (plant) => plant.id === maturePlant.plantId,
  )
  if (!definition) return undefined
  // Shared with the species directory, so what the guide predicts and what the
  // garden actually reveals can never drift apart.
  const speciesId = selectDiscoveryCandidate(
    state.creatures,
    definition.speciesIds,
  )
  if (!speciesId) return undefined
  return {
    id: createId(),
    speciesId,
    name: nextCompanionName(state.creatures),
    stage: 'egg',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: now.toISOString(),
    sourcePlantId: maturePlant.id,
    // The name above is only a default. Care offers the gardener a chance to
    // choose another, and doing nothing keeps this one.
    awaitingName: true,
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
 * The index of the plant the next Sunlight will grow, or -1 when every plant
 * is grown: the one the gardener chose while it still grows, otherwise the
 * first plant still growing. Today names it, so which plant reveals the next
 * egg is never a guess.
 */
export function nextPlantToTend(state: Pick<AppState, 'plants' | 'profile'>): number {
  const chosen = state.profile?.tendFirstPlantId
  if (chosen) {
    const index = state.plants.findIndex(
      (plant) => plant.id === chosen && plant.growth < MAX_PLANT_GROWTH,
    )
    if (index !== -1) return index
  }
  return state.plants.findIndex((plant) => plant.growth < MAX_PLANT_GROWTH)
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
    id: createId(),
    localDate,
    source,
    awardedAt: now.toISOString(),
  }

  let creatures = state.creatures
  // The first plant still growing grows a step. When every plant is grown the
  // collection is handed back as it was, so the save that follows finds
  // nothing to write there.
  let plants = state.plants
  let grownPlant: PlantInstance | undefined
  const growing = nextPlantToTend(state)
  if (growing !== -1) {
    grownPlant = { ...state.plants[growing], growth: state.plants[growing].growth + 1 }
    plants = [...state.plants]
    plants[growing] = grownPlant
  }
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

/** What the recap flow collected. Every answer is optional. */
export interface RecapDraft {
  level?: RecapEntry['level']
  wentWell?: string
  settingDown?: string
  forTomorrow?: string
  plannedGoalId?: string
  plannedGoalIds?: string[]
}

/** The Moonlight already collected for a day, if any. */
export function moonlightForDate(
  state: AppState,
  localDate: string,
): MoonlightAward | undefined {
  return state.moonlight.find((award) => award.localDate === localDate)
}

/** The recap written for a day, if any. */
export function recapForDate(
  state: AppState,
  localDate: string,
): RecapEntry | undefined {
  return state.recaps.find((recap) => recap.localDate === localDate)
}

/**
 * Closing Moonlight: one per local day, collected by rounding out the day.
 *
 * Deliberately not routed through `awardSunlight`. Moonlight pays in Stardust
 * and touches nothing else -- no plant growth, because that is the engine of
 * egg discovery and is paced by the Sunlight cap, and no Sunlight award,
 * because a day in the journal's rhythm of care means an act of care.
 *
 * The `moonlight` ledger is the dedupe key, not the recap. A gardener who
 * deletes a recap and writes it again is not paid twice.
 */
export function awardMoonlight(
  inputState: AppState,
  localDate: string,
  draft: RecapDraft = {},
  now = new Date(),
): AppState {
  const state = progressGarden(inputState, now)
  if (moonlightForDate(state, localDate)) return state

  const nowIso = now.toISOString()
  const recap: RecapEntry = {
    id: createId(),
    localDate,
    ...(draft.level === undefined ? {} : { level: draft.level }),
    wentWell: draft.wentWell?.trim() ?? '',
    settingDown: draft.settingDown?.trim() ?? '',
    forTomorrow: draft.forTomorrow?.trim() ?? '',
    ...(draft.plannedGoalId ? { plannedGoalId: draft.plannedGoalId } : {}),
    ...(draft.plannedGoalIds?.length ? { plannedGoalIds: draft.plannedGoalIds } : {}),
    createdAt: nowIso,
    updatedAt: nowIso,
  }
  const award: MoonlightAward = {
    id: createId(),
    localDate,
    awardedAt: nowIso,
  }

  return {
    ...state,
    // A recap already written for this day without a payout cannot happen
    // through the UI, but replacing rather than appending keeps the
    // one-per-day shape true whatever the stored garden held.
    recaps: [
      ...state.recaps.filter((entry) => entry.localDate !== localDate),
      recap,
    ],
    moonlight: [...state.moonlight, award],
    stardust: state.stardust + MOONLIGHT_STARDUST_REWARD,
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
        id: createId(),
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
