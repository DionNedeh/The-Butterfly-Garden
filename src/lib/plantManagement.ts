import type { AppState, PlantInstance } from '../types'

export const PLANT_CAPACITY = 8

export function plantRemovalBlocker(
  state: AppState,
  plantId: string,
): string | undefined {
  const developing = state.creatures.find(
    (creature) =>
      creature.sourcePlantId === plantId && creature.stage !== 'emerged',
  )
  if (!developing) return undefined
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
  }
}

export function remainingPlantGrowth(plant: PlantInstance, maxGrowth: number) {
  return Math.max(0, maxGrowth - plant.growth)
}
