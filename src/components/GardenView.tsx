import { useState, type CSSProperties } from 'react'
import { observations, plants, species } from '../data/content'
import { getDailyPromptIndex, toLocalDate } from '../lib/date'
import { MAX_PLANT_GROWTH } from '../lib/progression'
import type { AppState } from '../types'
import { Butterfly } from './Butterfly'
import { Icon } from './Icons'

function remainingTime(emergeAt?: string) {
  if (!emergeAt) return 'Time unknown'
  const milliseconds = Math.max(0, new Date(emergeAt).getTime() - Date.now())
  const hours = Math.ceil(milliseconds / 3_600_000)
  if (hours <= 24) return `${hours} hour${hours === 1 ? '' : 's'} remaining`
  const days = Math.floor(hours / 24)
  const leftover = hours % 24
  return `${days}d ${leftover}h remaining`
}

export function GardenView({
  state,
  onPlant,
  onSelectCompanion,
}: {
  state: AppState
  onPlant: (plantId: string) => void
  onSelectCompanion: (creatureId: string) => void
}) {
  const [showSeedTray, setShowSeedTray] = useState(false)
  const emerged = state.creatures.filter((creature) => creature.stage === 'emerged')
  const developing = state.creatures.filter(
    (creature) => creature.stage !== 'emerged',
  )
  const active = emerged.find(
    (creature) => creature.id === state.profile?.activeCompanionId,
  )
  const observationChoices = observations.filter(
    (item) => item.speciesId === 'all' || item.speciesId === active?.speciesId,
  )
  const observation =
    observationChoices[
      getDailyPromptIndex(toLocalDate(), observationChoices.length)
    ]

  return (
    <div className="view garden-view">
      <section className="garden-hero" aria-labelledby="garden-title">
        <div className="garden-heading">
          <p className="eyebrow">Your living sanctuary</p>
          <h1 id="garden-title">{state.profile?.gardenName}</h1>
          <p className="garden-observation">
            {observation?.text ?? 'The garden is finding its rhythm.'}
          </p>
        </div>

        <Butterfly
          speciesId={active?.speciesId ?? 'monarch'}
          label={
            active
              ? `${active.name}, your active ${species.find((item) => item.id === active.speciesId)?.commonName}`
              : 'Marigold, your monarch garden guide'
          }
          className="garden-butterfly"
        />

        <div className="garden-plants" aria-label="Plants in your garden">
          {state.plants.slice(0, 8).map((plant, index) => {
            const definition = plants.find((item) => item.id === plant.plantId)
            return (
              <div
                className={`garden-plant growth-${plant.growth}`}
                style={{
                  '--plant-color': definition?.color,
                  '--plant-delay': `${index * -0.7}s`,
                } as CSSProperties}
                key={plant.id}
                title={`${definition?.name}: growth ${plant.growth} of ${MAX_PLANT_GROWTH}`}
              >
                <span className="stem" />
                <span className="leaf leaf-one" />
                <span className="leaf leaf-two" />
                <span className="flower" />
              </div>
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
          disabled={state.seeds < 1}
          aria-expanded={showSeedTray}
        >
          Plant a seed
        </button>
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
                <small>{plant.kind === 'host' ? 'Host plant' : 'Nectar plant'}</small>
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
                          ? remainingTime(creature.emergeAt)
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
