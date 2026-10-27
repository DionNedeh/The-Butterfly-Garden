import { useEffect, useRef } from 'react'
import { plants, species } from '../../data/content'
import { PLANT_CAPACITY } from '../../lib/plantManagement'
import { PLANT_SEED_COST } from '../../lib/progression'

const speciesById = new Map(species.map((item) => [item.id, item]))

/**
 * The garden's seed tray: every plant that can be sown, and what each is for.
 * Opened by "Plant a seed", or by the Guide's "Find a butterfly & its seed"
 * with that seed picked out. Loaded when first opened, so the garden's first
 * load carries none of it.
 */
export function SeedTray({
  seeds,
  gardenFull,
  seedFocus,
  onPlant,
  onClose,
}: {
  seeds: number
  gardenFull: boolean
  /** The seed the Guide asked for: highlighted, with the tray brought into view. */
  seedFocus?: string
  onPlant: (plantId: string) => void
  onClose: () => void
}) {
  const tray = useRef<HTMLElement>(null)
  useEffect(() => {
    if (seedFocus) tray.current?.scrollIntoView({ block: 'start' })
  }, [seedFocus])
  return (
    <section ref={tray} className="card seed-tray" aria-labelledby="seed-tray-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Choose a new beginning</p>
          <h2 id="seed-tray-title">Seed tray</h2>
        </div>
        <button className="text-button" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="section-explainer">
        Spend {PLANT_SEED_COST} seed to add a plant. Host plants can welcome
        the listed caterpillars after growing; nectar plants add flowers for
        the butterflies already visiting. The garden has {PLANT_CAPACITY}{' '}
        spaces.
      </p>
      <div className="catalog-grid">
        {plants.map((plant) => (
          <button
            className={`plant-choice ${seedFocus === plant.id ? 'seed-highlight' : ''}`}
            disabled={seeds < PLANT_SEED_COST || gardenFull}
            key={plant.id}
            onClick={() => onPlant(plant.id)}
          >
            <span
              className="plant-dot"
              style={{ backgroundColor: plant.color }}
              aria-hidden="true"
            />
            <strong>{plant.name}</strong>
            <small>
              {plant.kind === 'host'
                ? `Host for ${plant.speciesIds
                    .map((speciesId) => speciesById.get(speciesId)?.commonName)
                    .filter(Boolean)
                    .join(' and ')}`
                : 'Nectar plant for visiting butterflies'}
            </small>
          </button>
        ))}
      </div>
    </section>
  )
}
