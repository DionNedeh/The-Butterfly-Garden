import { species } from '../../data/content'
import {
  plantBloomNote,
  plantEggNote,
  plantRemovalBlocker,
  remainingPlantGrowth,
} from '../../lib/plantManagement'
import { MAX_PLANT_GROWTH } from '../../lib/progression'
import type { AppState, PlantDefinition, PlantInstance } from '../../types'
import { JarManager } from './JarManager'

const speciesById = new Map(species.map((item) => [item.id, item]))

/** Built once; constructing an Intl formatter per render is not free. */
const plantedDateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

/**
 * A chosen plant's field guide: how it grows, what it shelters, its jar, and
 * removing it. Loaded once a plant is chosen, with its jars, so the garden's
 * first load carries none of it.
 */
export function PlantPanel({
  state,
  plant,
  definition,
  visible,
  confirmingRemoval,
  onConfirmRemoval,
  onRemove,
  onPlaceJar,
  onRemoveJarPlacement,
}: {
  state: AppState
  plant: PlantInstance
  definition: PlantDefinition
  /** Whether the plant is one of those drawn in the scene, where a jar shows. */
  visible: boolean
  /** Whether "Remove this plant" is asking to be confirmed. */
  confirmingRemoval: boolean
  onConfirmRemoval: (confirming: boolean) => void
  /** Removal confirmed. */
  onRemove: () => void
  onPlaceJar: (jarId: string, plantId: string) => void
  onRemoveJarPlacement: (plantId: string) => void
}) {
  const removalBlocker = plantRemovalBlocker(state, plant.id)
  const eggNote = plantEggNote(state, plant, MAX_PLANT_GROWTH)
  const bloomNote = plantBloomNote(state, plant, MAX_PLANT_GROWTH)
  const remaining = remainingPlantGrowth(plant, MAX_PLANT_GROWTH)
  return (
    <article className="plant-detail">
      <div>
        <p className="eyebrow">{definition.kind === 'host' ? 'Host plant' : 'Nectar plant'}</p>
        <h3>{definition.name}</h3>
        <em>{definition.scientificName}</em>
        <p>{definition.description}</p>
      </div>
      <dl>
        <div>
          <dt>Growth stage</dt>
          <dd>
            {plant.growth === 0
              ? 'Seed waiting'
              : plant.growth === 1
                ? 'Small sprout'
                : plant.growth === 2
                  ? 'Growing with buds'
                  : 'Mature and blooming'}
          </dd>
        </div>
        <div>
          <dt>Care remaining</dt>
          <dd>{remaining === 0 ? 'Fully grown' : `${remaining} eligible Sunlight`}</dd>
        </div>
        <div>
          <dt>Supports</dt>
          <dd>
            {definition.speciesIds.length
              ? definition.speciesIds
                  .map((id) => speciesById.get(id)?.commonName)
                  .filter(Boolean)
                  .join(' and ')
              : 'Adult butterflies visiting for nectar'}
          </dd>
        </div>
        {eggNote && (
          <div>
            <dt>Eggs</dt>
            <dd>{eggNote}</dd>
          </div>
        )}
        {bloomNote && (
          <div>
            <dt>Next bloom</dt>
            <dd>{bloomNote}</dd>
          </div>
        )}
        <div>
          <dt>Planted</dt>
          <dd>{plantedDateFormat.format(new Date(plant.plantedAt))}</dd>
        </div>
      </dl>
      <JarManager
        state={state}
        plantId={plant.id}
        plantName={definition.name}
        visible={visible}
        onPlaceJar={onPlaceJar}
        onRemoveJarPlacement={onRemoveJarPlacement}
      />
      <div className="plant-removal">
        {removalBlocker && (
          <p className="protected-plant-note">{removalBlocker} It cannot be removed yet.</p>
        )}
        {!confirmingRemoval ? (
          <button
            className="text-button danger-text"
            disabled={Boolean(removalBlocker)}
            onClick={() => onConfirmRemoval(true)}
          >
            Remove this plant
          </button>
        ) : (
          <div className="delete-confirmation" role="alert">
            <strong>Remove this plant without a seed refund?</strong>
            <div className="form-actions">
              <button className="danger-button" onClick={onRemove}>
                Yes, remove plant
              </button>
              <button className="secondary-button" onClick={() => onConfirmRemoval(false)}>
                Keep plant
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
