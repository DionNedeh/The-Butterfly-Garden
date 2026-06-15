import { useState, type CSSProperties } from 'react'
import { observations, plants, species } from '../data/content'
import { flightPatterns } from '../data/flightPatterns'
import { getDailyPromptIndex, toLocalDate } from '../lib/date'
import {
  DAILY_SEED_REWARD,
  EMERGENCE_SEED_REWARD,
  MAX_PLANT_GROWTH,
  PLANT_SEED_COST,
} from '../lib/progression'
import type { AppState } from '../types'
import {
  PLANT_CAPACITY,
  plantRemovalBlocker,
  remainingPlantGrowth,
} from '../lib/plantManagement'
import { Butterfly } from './Butterfly'
import { ChrysalisCountdown } from './ChrysalisCountdown'
import { Icon } from './Icons'

export function GardenView({
  state,
  onPlant,
  onRemovePlant,
  onSelectCompanion,
}: {
  state: AppState
  onPlant: (plantId: string) => void
  onRemovePlant: (plantId: string) => void
  onSelectCompanion: (creatureId: string) => void
}) {
  const [showSeedTray, setShowSeedTray] = useState(false)
  const [selectedPlantId, setSelectedPlantId] = useState<string>()
  const [confirmPlantRemoval, setConfirmPlantRemoval] = useState(false)
  const emerged = state.creatures.filter((creature) => creature.stage === 'emerged')
  const developing = state.creatures.filter(
    (creature) => creature.stage !== 'emerged',
  )
  const active = emerged.find(
    (creature) => creature.id === state.profile?.activeCompanionId,
  )
  const gardenButterflies = [
    {
      id: 'marigold-guide',
      speciesId: 'monarch',
      label: 'Marigold, your monarch garden guide',
    },
    ...emerged.map((creature) => ({
      id: creature.id,
      speciesId: creature.speciesId,
      label: `${creature.name}, ${species.find((item) => item.id === creature.speciesId)?.commonName ?? 'butterfly'}`,
    })),
  ]
  const observationChoices = observations.filter(
    (item) => item.speciesId === 'all' || item.speciesId === active?.speciesId,
  )
  const observation =
    observationChoices[
      getDailyPromptIndex(toLocalDate(), observationChoices.length)
    ]
  const selectedPlant = state.plants.find((plant) => plant.id === selectedPlantId)
  const selectedPlantDefinition = plants.find(
    (plant) => plant.id === selectedPlant?.plantId,
  )
  const removalBlocker = selectedPlant
    ? plantRemovalBlocker(state, selectedPlant.id)
    : undefined
  const selectedPattern =
    flightPatterns.find(
      (pattern) => pattern.id === state.selectedFlightPatternId,
    ) ?? flightPatterns[0]
  const gardenFull = state.plants.length >= PLANT_CAPACITY

  return (
    <div className="view garden-view">
      <section
        className={`garden-hero backdrop-${state.profile?.selectedBackdropId ?? 'sunlit-meadow'}`}
        aria-labelledby="garden-title"
      >
        <div className="garden-heading">
          <p className="eyebrow">Your living sanctuary</p>
          <h1 id="garden-title">{state.profile?.gardenName}</h1>
          <p className="garden-observation">
            {observation?.text ?? 'The garden is finding its rhythm.'}
          </p>
        </div>

        <div className="garden-flight-space" aria-label="Butterflies flying in the garden">
          {gardenButterflies.map((butterfly, index) => (
            <div
              className={`flying-butterfly flight-${index % 4} ${selectedPattern.animationClass}`}
              style={
                {
                  '--flight-delay': `${index * -4.3}s`,
                  '--flight-duration': `${18 + (index % 3) * 3}s`,
                  '--flight-size': `${0.82 + (index % 4) * 0.08}`,
                } as CSSProperties
              }
              key={butterfly.id}
            >
              <Butterfly
                speciesId={butterfly.speciesId}
                label={butterfly.label}
                pettable
              />
            </div>
          ))}
        </div>

        <div className="garden-plants" aria-label="Plants in your garden">
          {state.plants.slice(0, 8).map((plant, index) => {
            const definition = plants.find((item) => item.id === plant.plantId)
            return (
              <button
                type="button"
                className={`garden-plant growth-${plant.growth}`}
                style={{
                  '--plant-color': definition?.color,
                  '--plant-delay': `${index * -0.7}s`,
                } as CSSProperties}
                key={plant.id}
                title={`${definition?.name}: growth ${plant.growth} of ${MAX_PLANT_GROWTH}`}
                aria-label={`View ${definition?.name ?? 'plant'}, growth ${plant.growth} of ${MAX_PLANT_GROWTH}`}
                aria-pressed={selectedPlantId === plant.id}
                onClick={() => {
                  setSelectedPlantId(plant.id)
                  setConfirmPlantRemoval(false)
                }}
              >
                <span className="stem" />
                <span className="leaf leaf-one" />
                <span className="leaf leaf-two" />
                <span className="flower" />
              </button>
            )
          })}
        </div>
      </section>

      <section className="garden-stats" aria-label="Garden resources">
        <div>
          <Icon name="seed" />
          <strong>{state.seeds}</strong>
          <span>seeds ready</span>
        </div>
        <div>
          <Icon name="leaf" />
          <strong>{emerged.length} / {species.length}</strong>
          <span>species welcomed</span>
        </div>
        <button
          className="secondary-button compact"
          onClick={() => setShowSeedTray((value) => !value)}
          disabled={state.seeds < 1 || gardenFull}
          aria-expanded={showSeedTray}
        >
          Plant a seed
        </button>
      </section>
      {gardenFull && (
        <p className="capacity-note" role="status">
          Your garden has all {PLANT_CAPACITY} plant spaces filled. Select an
          eligible plant below and remove it before planting another seed.
        </p>
      )}
      <p className="seed-economy-note">
        Earn {DAILY_SEED_REWARD} seed with your first Sunlight each day and{' '}
        {EMERGENCE_SEED_REWARD} when a butterfly emerges. Each new plant costs{' '}
        {PLANT_SEED_COST} seed.
      </p>

      <section className="card plant-inspector" aria-labelledby="plant-inspector-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Plant care</p>
            <h2 id="plant-inspector-title">Garden plants</h2>
          </div>
          <span className="count-badge">{state.plants.length} / {PLANT_CAPACITY}</span>
        </div>
        <p className="section-explainer">
          Select a plant in the scene or from this list to see its field guide
          and manage its space.
        </p>
        <div className="plant-management-list" aria-label="All garden plants">
          {state.plants.map((plant, index) => {
            const definition = plants.find((item) => item.id === plant.plantId)
            return (
              <button
                key={plant.id}
                className={selectedPlantId === plant.id ? 'selected' : ''}
                onClick={() => {
                  setSelectedPlantId(plant.id)
                  setConfirmPlantRemoval(false)
                }}
                aria-pressed={selectedPlantId === plant.id}
              >
                <span
                  className="plant-dot"
                  style={{ backgroundColor: definition?.color }}
                  aria-hidden="true"
                />
                {definition?.name ?? 'Plant'} {index + 1}
              </button>
            )
          })}
        </div>
        {selectedPlant && selectedPlantDefinition ? (
          <article className="plant-detail">
            <div>
              <p className="eyebrow">
                {selectedPlantDefinition.kind === 'host' ? 'Host plant' : 'Nectar plant'}
              </p>
              <h3>{selectedPlantDefinition.name}</h3>
              <em>{selectedPlantDefinition.scientificName}</em>
              <p>{selectedPlantDefinition.description}</p>
            </div>
            <dl>
              <div>
                <dt>Growth stage</dt>
                <dd>
                  {selectedPlant.growth === 0
                    ? 'Seed waiting'
                    : selectedPlant.growth === 1
                      ? 'Small sprout'
                      : selectedPlant.growth === 2
                        ? 'Growing with buds'
                        : 'Mature and blooming'}
                </dd>
              </div>
              <div>
                <dt>Care remaining</dt>
                <dd>
                  {remainingPlantGrowth(selectedPlant, MAX_PLANT_GROWTH) === 0
                    ? 'Fully grown'
                    : `${remainingPlantGrowth(selectedPlant, MAX_PLANT_GROWTH)} eligible Sunlight`}
                </dd>
              </div>
              <div>
                <dt>Supports</dt>
                <dd>
                  {selectedPlantDefinition.speciesIds.length
                    ? selectedPlantDefinition.speciesIds
                        .map((id) => species.find((item) => item.id === id)?.commonName)
                        .filter(Boolean)
                        .join(' and ')
                    : 'Adult butterflies visiting for nectar'}
                </dd>
              </div>
              <div>
                <dt>Planted</dt>
                <dd>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(selectedPlant.plantedAt))}</dd>
              </div>
            </dl>
            <div className="plant-removal">
              {removalBlocker && <p className="protected-plant-note">{removalBlocker} It cannot be removed yet.</p>}
              {!confirmPlantRemoval ? (
                <button
                  className="text-button danger-text"
                  disabled={Boolean(removalBlocker)}
                  onClick={() => setConfirmPlantRemoval(true)}
                >
                  Remove this plant
                </button>
              ) : (
                <div className="delete-confirmation" role="alert">
                  <strong>Remove this plant without a seed refund?</strong>
                  <div className="form-actions">
                    <button
                      className="danger-button"
                      onClick={() => {
                        onRemovePlant(selectedPlant.id)
                        setSelectedPlantId(undefined)
                        setConfirmPlantRemoval(false)
                      }}
                    >
                      Yes, remove plant
                    </button>
                    <button className="secondary-button" onClick={() => setConfirmPlantRemoval(false)}>
                      Keep plant
                    </button>
                  </div>
                </div>
              )}
            </div>
          </article>
        ) : (
          <p className="empty-copy">Choose a plant to open its field guide.</p>
        )}
      </section>

      {showSeedTray && (
        <section className="card seed-tray" aria-labelledby="seed-tray-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Choose a new beginning</p>
              <h2 id="seed-tray-title">Seed tray</h2>
            </div>
            <button className="text-button" onClick={() => setShowSeedTray(false)}>
              Close
            </button>
          </div>
          <p className="section-explainer">
            Spend {PLANT_SEED_COST} seed to add a plant. Host plants can welcome
            the listed caterpillars after growing; nectar plants add flowers for
            the butterflies already visiting.
            {' '}The garden has {PLANT_CAPACITY} spaces.
          </p>
          <div className="catalog-grid">
            {plants.map((plant) => (
              <button
                className="plant-choice"
                key={plant.id}
                onClick={() => {
                  onPlant(plant.id)
                  if (state.seeds <= 1) setShowSeedTray(false)
                }}
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
                        .map(
                          (speciesId) =>
                            species.find((item) => item.id === speciesId)
                              ?.commonName,
                        )
                        .filter(Boolean)
                        .join(' and ')}`
                    : 'Nectar plant for visiting butterflies'}
                </small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Metamorphosis</p>
              <h2>Growing nearby</h2>
            </div>
            <span className="count-badge">{developing.length}</span>
          </div>
          <p className="section-explainer">
            Caterpillars become chrysalises after care. A chrysalis never loses
            progress and opens after about three real days.
          </p>
          {developing.length === 0 ? (
            <p className="empty-copy">
              Mature a host plant to welcome a new caterpillar.
            </p>
          ) : (
            <div className="creature-list">
              {developing.map((creature) => {
                const definition = species.find(
                  (item) => item.id === creature.speciesId,
                )
                return (
                  <article className="creature-row" key={creature.id}>
                    <span
                      className={
                        creature.stage === 'chrysalis'
                          ? 'chrysalis'
                          : 'caterpillar'
                      }
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{creature.name}</strong>
                      <span>{definition?.commonName}</span>
                      <small>
                        {creature.stage === 'chrysalis'
                          ? <ChrysalisCountdown emergeAt={creature.emergeAt} />
                          : `${creature.carePoints} of 2 care moments`}
                      </small>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Butterfly journal</p>
              <h2>Your companions</h2>
            </div>
            <span className="count-badge">{emerged.length}</span>
          </div>
          {emerged.length === 0 ? (
            <p className="empty-copy">
              Sol is still changing. The garden will be ready when they emerge.
            </p>
          ) : (
            <div className="companion-grid">
              {emerged.map((creature) => {
                const definition = species.find(
                  (item) => item.id === creature.speciesId,
                )
                const selected = creature.id === state.profile?.activeCompanionId
                return (
                  <button
                    className={`companion-card ${selected ? 'selected' : ''}`}
                    onClick={() => onSelectCompanion(creature.id)}
                    key={creature.id}
                    aria-pressed={selected}
                  >
                    <Butterfly
                      speciesId={creature.speciesId}
                      label={definition?.commonName ?? 'Butterfly'}
                    />
                    <strong>{creature.name}</strong>
                    <small>{definition?.commonName}</small>
                    <span>{selected ? 'Exploring with you' : 'Choose companion'}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
