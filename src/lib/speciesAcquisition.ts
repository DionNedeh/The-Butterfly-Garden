import { plants as plantCatalog, species as speciesCatalog } from '../data/content'
import type { AppState, CreatureInstance } from '../types'

/** What the gardener has managed with a species so far. */
export type SpeciesProgress = 'undiscovered' | 'developing' | 'raised'

export interface SpeciesAcquisition {
  speciesId: string
  speciesName: string
  /** Host plants whose maturity can reveal this species. */
  hostPlantIds: string[]
  hostPlantNames: string[]
  progress: SpeciesProgress
  /**
   * Every species that shares this one's hosts, in the order the garden would
   * choose between them. Empty when nothing else uses the same plant.
   */
  sharedWith: string[]
}

/** Only what choosing a species actually depends on. */
type CreatureFacts = Pick<CreatureInstance, 'speciesId' | 'stage'>

/**
 * Which species a maturing plant would reveal, given what is already here.
 *
 * Lifted out of `discoverEgg` unchanged so the guide and the garden cannot
 * disagree. A directory that predicts from its own copy of these rules starts
 * telling gardeners to plant the wrong seed the moment either side is edited.
 *
 * Never-seen species come first, so a shared host introduces its second
 * species rather than repeating the first. Failing that, a species with no
 * egg, caterpillar or chrysalis already growing can appear again -- which is
 * what stops one plant from producing endless duplicates of a companion still
 * being raised.
 */
export function selectDiscoveryCandidate(
  creatures: readonly CreatureFacts[],
  speciesIds: readonly string[],
): string | undefined {
  return (
    speciesIds.find(
      (candidateId) =>
        !creatures.some((creature) => creature.speciesId === candidateId),
    ) ??
    speciesIds.find(
      (candidateId) =>
        !creatures.some(
          (creature) =>
            creature.speciesId === candidateId && creature.stage !== 'butterfly',
        ),
    )
  )
}

/** The species a given plant would reveal right now, if it matured. */
export function nextSpeciesForPlant(
  state: Pick<AppState, 'creatures'>,
  plantId: string,
): string | undefined {
  const definition = plantCatalog.find((plant) => plant.id === plantId)
  if (!definition) return undefined
  return selectDiscoveryCandidate(state.creatures, definition.speciesIds)
}

/** Host plants that can reveal a species, in catalog order. */
export function hostPlantsForSpecies(speciesId: string) {
  return plantCatalog.filter((plant) => plant.speciesIds.includes(speciesId))
}

function progressFor(
  creatures: readonly CreatureFacts[],
  speciesId: string,
): SpeciesProgress {
  const owned = creatures.filter((creature) => creature.speciesId === speciesId)
  if (owned.length === 0) return 'undiscovered'
  return owned.some((creature) => creature.stage === 'butterfly')
    ? 'raised'
    : 'developing'
}

/**
 * A directory row for every species, derived from the catalogs.
 *
 * Generated rather than written down a second time: the plan's species table
 * describes game rules, and a copy of it in the interface would drift away
 * from the catalog the garden actually reads.
 */
export function speciesAcquisitionRecords(
  state: Pick<AppState, 'creatures'>,
): SpeciesAcquisition[] {
  return speciesCatalog.map((entry) => {
    const hosts = hostPlantsForSpecies(entry.id)
    const sharedWith = hosts
      .flatMap((plant) => plant.speciesIds)
      .filter((id, index, ids) => id !== entry.id && ids.indexOf(id) === index)
    return {
      speciesId: entry.id,
      speciesName: entry.commonName,
      hostPlantIds: hosts.map((plant) => plant.id),
      hostPlantNames: hosts.map((plant) => plant.name),
      progress: progressFor(state.creatures, entry.id),
      sharedWith,
    }
  })
}

/**
 * Distinct species raised to butterflies.
 *
 * Counting creatures instead would report two Monarchs as two species, which
 * is what the Garden's "species welcomed" figure used to do.
 */
export function distinctSpeciesRaised(
  state: Pick<AppState, 'creatures'>,
): number {
  const raised = new Set<string>()
  for (const creature of state.creatures) {
    if (creature.stage === 'butterfly') raised.add(creature.speciesId)
  }
  return raised.size
}

/** Distinct species present at any stage, including those still growing. */
export function distinctSpeciesDiscovered(
  state: Pick<AppState, 'creatures'>,
): number {
  return new Set(state.creatures.map((creature) => creature.speciesId)).size
}

/** Plants that produce eggs, as opposed to the nectar plants that only feed. */
export function hostPlantIds(): string[] {
  return plantCatalog
    .filter((plant) => plant.kind === 'host')
    .map((plant) => plant.id)
}
