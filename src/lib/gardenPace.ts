import { plants as plantCatalog } from '../data/content'
import type { PlantInstance, Profile } from '../types'

/**
 * How the garden gives (Settings → Garden pace).
 *
 * Classic is the pace every garden has always had, and it stores nothing: a
 * host plant reveals one egg, when it first blooms, and after that the only
 * way to discover more is to make room and plant again. Keep giving
 * (`Profile.gardenPace`) is chosen by the gardener: a host plant in full
 * bloom blooms again after REBLOOM_CARE_DAYS more days of care, and each
 * bloom can bring another egg, by the same rule as the first
 * (selectDiscoveryCandidate).
 *
 * A day of care is a cared-for day, the journal's own measure: a local day
 * that earned at least one Sunlight (lib/rhythm). Sunlight is what grows a
 * plant, so it is what tends one in bloom; counting each Sunlight instead
 * would open a bloom in a day and a half, far faster than the first one
 * comes, and counting days keeps it in step with a companion's care days.
 * A plant in bloom counts the day's first Sunlight, whichever plant that
 * Sunlight grew, so growing a new plant never holds an older one back.
 */

/** Days of care a host plant spends in full bloom before it blooms again. */
export const REBLOOM_CARE_DAYS = 7

const hostPlantIds = new Set(
  plantCatalog.filter((plant) => plant.speciesIds.length > 0).map((plant) => plant.id),
)

/** Whether the garden keeps giving, rather than keeping its Classic pace. */
export function keepsGiving(profile: Pick<Profile, 'gardenPace'> | undefined): boolean {
  return profile?.gardenPace === 'keep-giving'
}

/** Whether this plant can bloom again: a host plant, in full bloom. */
export function canBloomAgain(plant: PlantInstance, maxGrowth: number): boolean {
  return plant.growth >= maxGrowth && hostPlantIds.has(plant.plantId)
}

/** Days of care counted toward the next bloom so far. */
export function careDaysCounted(plant: Pick<PlantInstance, 'careDaysSinceBloom'>): number {
  return Math.min(REBLOOM_CARE_DAYS, Math.max(0, plant.careDaysSinceBloom ?? 0))
}

/** The plant with its count started again, after a bloom, as it began. */
export function withCountStartedAgain(plant: PlantInstance): PlantInstance {
  const next = { ...plant }
  delete next.careDaysSinceBloom
  return next
}
