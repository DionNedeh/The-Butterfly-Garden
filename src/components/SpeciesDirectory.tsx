import { useState } from 'react'
import {
  speciesAcquisitionRecords,
  nextSpeciesForPlant,
  distinctSpeciesRaised,
} from '../lib/speciesAcquisition'
import { species } from '../data/content'
import type { AppState } from '../types'
import { ButterflySprite } from './sprites/ButterflySprite'

export function SpeciesDirectory({
  state,
  onShowSeed,
}: {
  state: AppState
  onShowSeed: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const records = speciesAcquisitionRecords(state).filter(
    (item) =>
      `${item.speciesName} ${item.hostPlantNames.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === 'all' || item.progress === filter),
  )
  return (
    <section className="species-directory" aria-labelledby="species-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Every butterfly begins somewhere</p>
          <h2 id="species-title">Find your next companion</h2>
        </div>
        <span className="count-badge">
          {distinctSpeciesRaised(state)} / {species.length} raised
        </span>
      </div>
      <p className="section-explainer">
        One seed plants any host below. Three Sunlight growth steps bring a new
        plant to maturity and give it one chance to reveal an egg. Each life
        stage then takes three care days, at your pace.
      </p>
      <div className="shop-filters">
        <label className="shop-search">
          Find a butterfly or seed
          <input
            type="search"
            value={query}
            placeholder="Try Monarch or Milkweed…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Your collection
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">Every species</option>
            <option value="undiscovered">Not yet discovered</option>
            <option value="developing">Growing nearby</option>
            <option value="raised">Raised to butterfly</option>
          </select>
        </label>
      </div>
      <p className="subtle-copy" role="status">
        {records.length} species shown
      </p>
      <div className="species-grid">
        {records.map((item) => (
          <article className="species-card" key={item.speciesId}>
            <div className="species-portrait">
              <ButterflySprite
                speciesId={item.speciesId}
                size={92}
                flapping={false}
              />
              <span className={`species-status ${item.progress}`}>
                {item.progress === 'raised'
                  ? 'Raised'
                  : item.progress === 'developing'
                    ? 'Growing'
                    : 'To discover'}
              </span>
            </div>
            <div>
              <h3>{item.speciesName}</h3>
              <p className="seed-recipe">
                Plant <strong>{item.hostPlantNames.join(' or ')}</strong>
              </p>
              {item.hostPlantIds.map((id, index) => {
                const next = nextSpeciesForPlant(state, id)
                return (
                  <div key={id}>
                    <p className="subtle-copy">
                      {next
                        ? `Next with your current garden: ${species.find((entry) => entry.id === next)?.commonName}.`
                        : 'Its supported species are already developing. A future planting can welcome another once one has emerged.'}
                    </p>
                    <button
                      className="secondary-button compact"
                      onClick={() => onShowSeed(id)}
                    >
                      Show {item.hostPlantNames[index]} seed
                    </button>
                  </div>
                )
              })}
            </div>
          </article>
        ))}
      </div>
      {!records.length && (
        <p>No matching species. Try another butterfly or plant name.</p>
      )}
      <details className="directory-help">
        <summary>Shared hosts, full gardens, and what happens next</summary>
        <p>
          Milkweed hosts Monarch and Queen; Passionflower hosts Gulf Fritillary
          and Zebra Longwing; Willow hosts Viceroy and Mourning Cloak. A species
          you have never welcomed comes first. Otherwise, the first supported
          species with no developing companion is next. Another discovery before
          maturity can change this prediction.
        </p>
        <p>
          Your starter Monarch, Sol, already counts as discovered, so Milkweed
          can next welcome Queen. A mature plant does not retry or keep
          producing eggs: plant another host for a new opportunity. With all
          eight spaces full, wait until a host's companion emerges before
          removing that plant. Nectar plants add flowers, but do not reveal
          eggs.
        </p>
      </details>
    </section>
  )
}
