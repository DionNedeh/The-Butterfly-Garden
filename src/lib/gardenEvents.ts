import { plants as plantCatalog } from '../data/content'
import type { AppState, CreatureStage } from '../types'
import { bondLevel } from './lifecycle'
import { getSpecies, MAX_PLANT_GROWTH } from './progression'

/**
 * Moments worth marking: what changed in the garden because of something the
 * gardener just did. Found by comparing the garden before and after, so every
 * action reports them alike, including ones added later.
 */
export type GardenEvent =
  /** `again` when a plant already in bloom blooms once more (lib/gardenPace). */
  | { kind: 'plant-bloomed'; plantName: string; again?: true }
  | { kind: 'egg-found'; creatureName: string; speciesName: string; plantName?: string }
  | { kind: 'stage-advanced'; creatureName: string; stage: CreatureStage }
  | { kind: 'bond-level'; creatureName: string; level: number }

function plantName(plantId: string): string {
  return plantCatalog.find((plant) => plant.id === plantId)?.name ?? 'plant'
}

export function gardenEvents(before: AppState, after: AppState): GardenEvent[] {
  const events: GardenEvent[] = []

  if (before.plants !== after.plants) {
    const earlier = new Map(before.plants.map((plant) => [plant.id, plant]))
    for (const plant of after.plants) {
      const previous = earlier.get(plant.id)
      if (previous && previous.growth < MAX_PLANT_GROWTH && plant.growth >= MAX_PLANT_GROWTH) {
        events.push({ kind: 'plant-bloomed', plantName: plantName(plant.plantId) })
      } else if (
        previous?.careDaysSinceBloom !== undefined &&
        plant.careDaysSinceBloom === undefined &&
        plant.growth >= MAX_PLANT_GROWTH
      ) {
        // Only a new bloom starts a plant's count again.
        events.push({ kind: 'plant-bloomed', plantName: plantName(plant.plantId), again: true })
      }
    }
  }

  if (before.creatures !== after.creatures) {
    const earlier = new Map(before.creatures.map((creature) => [creature.id, creature]))
    for (const creature of after.creatures) {
      const previous = earlier.get(creature.id)
      if (!previous) {
        if (creature.stage === 'egg') {
          const source = creature.sourcePlantId
            ? after.plants.find((plant) => plant.id === creature.sourcePlantId)
            : undefined
          events.push({
            kind: 'egg-found',
            creatureName: creature.name,
            speciesName: getSpecies(creature.speciesId)?.commonName ?? 'butterfly',
            plantName: source ? plantName(source.plantId) : undefined,
          })
        }
        continue
      }
      if (previous.stage !== creature.stage) {
        events.push({ kind: 'stage-advanced', creatureName: creature.name, stage: creature.stage })
      }
      const level = bondLevel(creature.bond)
      if (level > bondLevel(previous.bond)) {
        events.push({ kind: 'bond-level', creatureName: creature.name, level })
      }
    }
  }

  return events
}

/** One sentence for the event, for the screen and for a screen reader. */
export function describeEvent(event: GardenEvent): string {
  switch (event.kind) {
    case 'plant-bloomed':
      return event.again
        ? `Your ${event.plantName.toLowerCase()} bloomed again.`
        : `Your ${event.plantName.toLowerCase()} is in full bloom.`
    case 'egg-found':
      return event.plantName
        ? `A tiny egg appeared on your ${event.plantName.toLowerCase()}: a ${event.speciesName.toLowerCase()}, named ${event.creatureName}.`
        : `A tiny ${event.speciesName.toLowerCase()} egg appeared, named ${event.creatureName}.`
    case 'stage-advanced':
      return event.stage === 'caterpillar'
        ? `${event.creatureName} hatched into a caterpillar!`
        : event.stage === 'chrysalis'
          ? `${event.creatureName} wrapped up into a chrysalis.`
          : event.stage === 'butterfly'
            ? `${event.creatureName} emerged as a butterfly!`
            : `${event.creatureName} is an egg again.`
    case 'bond-level':
      return `Your bond with ${event.creatureName} grew to level ${event.level}.`
  }
}
