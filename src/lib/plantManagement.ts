import { plants as plantCatalog, species as speciesCatalog } from '../data/content'
import type { AppState, PlantInstance } from '../types'
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
 * A host plant reveals an egg once, when it first blooms, and only for a
 * butterfly not already growing up in the garden (selectDiscoveryCandidate).
 * A bloom that brought nothing used to say nothing at all.
 */
export function plantEggNote(
  state: Pick<AppState, 'creatures'>,
  plant: PlantInstance,
  maxGrowth: number,
): string | undefined {
  const definition = plantCatalog.find((entry) => entry.id === plant.plantId)
  if (!definition || definition.speciesIds.length === 0) return undefined
  const brought = state.creatures.find((creature) => creature.sourcePlantId === plant.id)
  if (brought) return `This bloom brought ${brought.name}'s egg.`
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
  return `It bloomed while every butterfly it hosts was growing up here, so it brought no egg. Plant another ${definition.name} once one of them emerges.`
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
