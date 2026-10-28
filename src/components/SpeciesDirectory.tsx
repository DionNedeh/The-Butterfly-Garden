import { useMemo, useState } from 'react'
import {
  speciesAcquisitionRecords,
  nextSpeciesForPlant,
  distinctSpeciesRaised,
} from '../lib/speciesAcquisition'
import { species } from '../data/content'
import { plantRegions, speciesRegions } from '../data/regions'
import { publishersOf, speciesFacts } from '../data/speciesFacts'
import { regionMark, type RegionMarks } from '../lib/regionMarks'
import { hasEveryWord, normaliseForSearch } from '../lib/searchText'
import { listed } from '../lib/plural'
import { subjectKey, type WildRecord } from '../lib/sightings'
import type { AppState, RegionId, SightingSubject } from '../types'
import { ButterflySprite } from './sprites/ButterflySprite'
import { SeenInTheWild } from './sightings/SeenInTheWild'
import { PLANT_CAPACITY } from '../lib/plantManagement'
import { STARTER_COMPANION_NAME } from '../lib/progression'
import { keepsGiving, REBLOOM_CARE_DAYS } from '../lib/gardenPace'

/**
 * Every species, what to plant for it, and what the garden would bring next.
 *
 * The Guide's search finds species here too: `words` are its words, already
 * normalised (lib/searchText). With a `region` chosen in Settings, each
 * species and host plant says whether it is native there (data/regions);
 * without one, nothing is marked. Each butterfly and plant seen in the wild
 * carries the field book's stamp, and can be logged from its card.
 */
export function SpeciesDirectory({
  state,
  onShowSeed,
  words = [],
  region,
  seen,
  onLogSighting,
}: {
  state: AppState
  onShowSeed: (id: string) => void
  words?: readonly string[]
  region?: RegionId
  /** When each butterfly and plant was last seen in the wild, by subjectKey. */
  seen?: ReadonlyMap<string, WildRecord>
  /** Open the sighting form on this butterfly or plant; without it, none is offered. */
  onLogSighting?: (subject: SightingSubject, opener: HTMLElement) => void
}) {
  const [filter, setFilter] = useState('all')
  const all = useMemo(() => speciesAcquisitionRecords(state), [state])
  // What a search can find in each species, normalised once per change of
  // garden or region rather than on every keystroke.
  const searchable = useMemo(
    () =>
      new Map(
        all.map((item) => {
          const regionWords = regionMark(speciesRegions[item.speciesId], region)?.label ?? ''
          const scientific = species.find((entry) => entry.id === item.speciesId)?.scientificName
          return [
            item.speciesId,
            normaliseForSearch(
              `${item.speciesName} ${scientific ?? ''} ${item.hostPlantNames.join(' ')} ${regionWords}`,
            ),
          ]
        }),
      ),
    [all, region],
  )
  const records = all.filter(
    (item) =>
      hasEveryWord(searchable.get(item.speciesId) ?? '', words) &&
      (filter === 'all' || item.progress === filter),
  )
  return (
    <section className="species-directory" aria-labelledby="species-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Every butterfly begins somewhere</p>
          <h2 id="species-title" tabIndex={-1}>
            Find your next companion
          </h2>
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
              <RegionMarkLine marks={speciesRegions[item.speciesId]} region={region} />
              <SeenInTheWild
                seen={seen?.get(subjectKey({ kind: 'butterfly', speciesId: item.speciesId }))}
              />
              <p className="seed-recipe">
                Plant <strong>{item.hostPlantNames.join(' or ')}</strong>
              </p>
              {item.hostPlantIds.map((id, index) => {
                const next = nextSpeciesForPlant(state, id)
                return (
                  <div key={id}>
                    <RegionMarkLine
                      marks={plantRegions[id]}
                      region={region}
                      subject={item.hostPlantNames[index]}
                    />
                    <SeenInTheWild
                      seen={seen?.get(subjectKey({ kind: 'plant', plantId: id }))}
                      subject={item.hostPlantNames[index]}
                    />
                    <p className="subtle-copy">
                      {next
                        ? `Next with your current garden: ${species.find((entry) => entry.id === next)?.commonName}.`
                        : 'Its supported species are already developing. A future planting can welcome another once one has emerged.'}
                    </p>
                    <div className="species-plant-actions">
                      <button
                        className="secondary-button compact"
                        onClick={() => onShowSeed(id)}
                      >
                        Show {item.hostPlantNames[index]} seed
                      </button>
                      {onLogSighting && (
                        <button
                          className="secondary-button compact sighting-log"
                          aria-label={`Log a sighting of ${item.hostPlantNames[index]}`}
                          onClick={(event) =>
                            onLogSighting({ kind: 'plant', plantId: id }, event.currentTarget)
                          }
                        >
                          Log a sighting
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              <CheckedWith speciesId={item.speciesId} />
              {onLogSighting && (
                <button
                  className="secondary-button sighting-log"
                  aria-label={`Log a sighting of ${item.speciesName}`}
                  onClick={(event) =>
                    onLogSighting(
                      { kind: 'butterfly', speciesId: item.speciesId },
                      event.currentTarget,
                    )
                  }
                >
                  Log a sighting
                </button>
              )}
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
          Your starter Monarch, {STARTER_COMPANION_NAME}, already counts as
          discovered, so Milkweed can next welcome Queen.{' '}
          {keepsGiving(state.profile)
            ? `With Keep giving, a mature host blooms again after ${REBLOOM_CARE_DAYS} more days of care and can reveal another egg, chosen the same way.`
            : 'A mature plant does not retry or keep producing eggs: plant another host for a new opportunity.'}{' '}
          With all {PLANT_CAPACITY} spaces full, wait until a host's companion emerges before
          removing that plant. Nectar plants add flowers, but do not reveal
          eggs.
        </p>
      </details>
    </section>
  )
}

/**
 * A species' or plant's mark for the gardener's region: "Native to North
 * America", with a note when the region would overstate it. Nothing at all
 * for one that does not live there, or for "Elsewhere".
 */
function RegionMarkLine({
  marks,
  region,
  subject,
}: {
  marks: RegionMarks | undefined
  region: RegionId | undefined
  /** A plant's name, so its mark is not read as the butterfly's. */
  subject?: string
}) {
  const mark = regionMark(marks, region)
  if (!mark) return null
  return (
    <p className={`region-mark ${mark.presence}`}>
      {subject && <strong>{subject}: </strong>}
      {mark.label}
      {mark.note && (
        <>
          . <small>{mark.note}</small>
        </>
      )}
    </p>
  )
}

/** Who the species' facts, name and host plant were checked with. */
function CheckedWith({ speciesId }: { speciesId: string }) {
  const sources = speciesFacts[speciesId]?.sources
  if (!sources) return null
  return <p className="checked-with">Checked with {listed(publishersOf(sources))}.</p>
}
