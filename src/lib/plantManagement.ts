import { plants as plantCatalog, species as speciesCatalog } from '../data/content'
import type { AppState, PlantInstance } from '../types'
import { canBloomAgain, careDaysCounted, keepsGiving, REBLOOM_CARE_DAYS } from './gardenPace'
import { nextSpeciesForPlant } from './speciesAcquisition'

export const PLANT_CAPACITY = 8

/**
 * Why "Plant a seed" cannot be used right now, in words, or undefined when
 * it can. A silently disabled button leaves a gardener guessing. The seed
 * cost is passed in because progression, which defines it, imports this.
 */
export function plantingBlocker(
  state: Pick<AppState, 'plants' | 'seeds'>,
  seedCost: number,
): string | undefined {
  if (state.plants.length >= PLANT_CAPACITY)
    return `All ${PLANT_CAPACITY} spaces are growing. Make room from a plant's panel below.`
  if (state.seeds < seedCost)
    return 'No seeds in your tray yet. Your first Sunlight each day brings one.'
  return undefined
}

/**
 * What a host plant's bloom means for eggs, said plainly. Undefined for a
 * nectar plant, and wherever the garden cannot know for sure.
 *
 * A host plant reveals an egg when it first blooms, and only for a
 * butterfly not already growing up in the garden (selectDiscoveryCandidate).
 * Under Keep giving it blooms again, and it is the latest bloom that is
 * spoken of; plantBloomNote says when the next one comes. A bloom that
 * brought nothing used to say nothing at all.
 */
export function plantEggNote(
  state: Pick<AppState, 'creatures' | 'profile'>,
  plant: PlantInstance,
  maxGrowth: number,
): string | undefined {
  const definition = plantCatalog.find((entry) => entry.id === plant.plantId)
  if (!definition || definition.speciesIds.length === 0) return undefined
  const brought = state.creatures.filter((creature) => creature.sourcePlantId === plant.id)
  const latest = brought.at(-1)
  if (latest) {
    return brought.length > 1
      ? `Its latest bloom brought ${latest.name}'s egg.`
      : `This bloom brought ${latest.name}'s egg.`
  }
  if (plant.growth < maxGrowth) {
    const next = nextSpeciesForPlant(state, plant.plantId)
    const name = speciesCatalog.find((entry) => entry.id === next)?.commonName
    return name
      ? `When it blooms, it can bring a ${name} egg.`
      : 'Every butterfly it hosts is growing up here now, so if it blooms before one emerges, it brings no egg.'
  }
  // A companion from before plants were remembered (all but the starter, who
  // came with the garden) could have come from this plant, so say nothing.
  if (state.creatures.slice(1).some((creature) => !creature.sourcePlantId)) return undefined
  const noEgg = 'It bloomed while every butterfly it hosts was growing up here, so it brought no egg.'
  // Under Keep giving it blooms again by itself: no need to plant another.
  return keepsGiving(state.profile)
    ? noEgg
    : `${noEgg} Plant another ${definition.name} once one of them emerges.`
}

/**
 * Under Keep giving, how close a host plant in full bloom is to blooming
 * again: "Blooms again in 3 more days of care." Undefined under Classic,
 * where a plant blooms once, and for any plant not in bloom or not a host.
 */
export function plantBloomNote(
  state: Pick<AppState, 'creatures' | 'profile'>,
  plant: PlantInstance,
  maxGrowth: number,
): string | undefined {
  if (!keepsGiving(state.profile) || !canBloomAgain(plant, maxGrowth)) return undefined
  const left = REBLOOM_CARE_DAYS - careDaysCounted(plant)
  // Spelt out here rather than through lib/plural, which this file would
  // otherwise bring into the first load for one sentence.
  if (left > 0) return `Blooms again in ${left} more ${left === 1 ? 'day' : 'days'} of care.`
  // Ready, and waiting only for an egg it can bring.
  return nextSpeciesForPlant(state, plant.plantId)
    ? 'Ready to bloom again with your next Sunlight.'
    : 'Ready to bloom again once a butterfly it hosts has emerged.'
}

export function plantRemovalBlocker(
  state: AppState,
  plantId: string,
): string | undefined {
  const developing = state.creatures.find(
    (creature) =>
      creature.sourcePlantId === plantId && creature.stage !== 'butterfly',
  )
  if (!developing) return undefined
  if (developing.stage === 'egg') {
    return `${developing.name}'s egg is resting on this host plant.`
  }
  return developing.stage === 'caterpillar'
    ? `${developing.name} is still growing on this host plant.`
    : `${developing.name}'s chrysalis is still connected to this host plant.`
}

export function removePlant(state: AppState, plantId: string): AppState {
  if (
    !state.plants.some((plant) => plant.id === plantId) ||
    plantRemovalBlocker(state, plantId)
  ) {
    return state
  }
  return {
    ...state,
    plants: state.plants.filter((plant) => plant.id !== plantId),
    jarPlacements: state.jarPlacements.filter(
      (placement) => placement.plantId !== plantId,
    ),
  }
}

export function remainingPlantGrowth(plant: PlantInstance, maxGrowth: number) {
  return Math.max(0, maxGrowth - plant.growth)
}
