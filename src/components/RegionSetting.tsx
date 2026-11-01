import { REGION_CHOICES } from '../lib/regionMarks'
import { isRegionId } from '../lib/region'
import type { Hemisphere } from '../lib/seasons'
import type { RegionId } from '../types'
import { GuideLink } from './GuideLink'

/** What Settings offers for a half of the world, in the order it offers them. */
const HEMISPHERE_CHOICES: ReadonlyArray<{ value: Hemisphere | undefined; label: string }> = [
  { value: 'north', label: 'North' },
  { value: 'south', label: 'South' },
  { value: undefined, label: 'Rather not say' },
]

/**
 * Settings' "My region": where the gardener gardens, chosen by hand. The
 * Guide then marks which of the garden's butterflies and plants are native
 * there and suggests plants for real butterflies. Nothing chosen is the
 * default and marks nothing, exactly as before there was a choice.
 *
 * Where the region does not say which half of the world that is (Elsewhere,
 * or none chosen), it asks, so the garden's seasons can follow the
 * gardener's (lib/seasons). Not saying is the default, and the north's
 * seasons show, as they always have.
 */
export function RegionSetting({
  region,
  hemisphere,
  onChoose,
  onOpenGuide,
}: {
  region: RegionId | undefined
  /** The half of the world chosen for a region that does not say it. */
  hemisphere?: Hemisphere
  /** The region, and the half of the world beside it when one is chosen. */
  onChoose: (region: RegionId | undefined, hemisphere?: Hemisphere) => void
  onOpenGuide?: (section: string) => void
}) {
  const asked = region === undefined || region === 'elsewhere'
  // Said only when there is a half to say, so a region alone is one argument.
  const choose = (next: RegionId | undefined, half: Hemisphere | undefined) => {
    if (half) onChoose(next, half)
    else onChoose(next)
  }
  return (
    <section className="card" aria-labelledby="region-settings-title">
      <p className="eyebrow">Real butterflies</p>
      <h2 id="region-settings-title">Where you garden</h2>
      <label className="region-select">
        My region
        <select
          value={region ?? ''}
          onChange={(event) => {
            const value = event.target.value
            const next = isRegionId(value) ? value : undefined
            // A half chosen for Elsewhere stays with no region, and goes
            // with a region that says it.
            choose(next, next === undefined || next === 'elsewhere' ? hemisphere : undefined)
          }}
        >
          <option value="">Not chosen</option>
          {REGION_CHOICES.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <p className="subtle-copy">
        The Guide then marks which butterflies and plants are native there, and
        suggests what to plant for the butterflies that are. You choose: the
        garden never asks where you are.
        {region && onOpenGuide && (
          <>
            {' '}
            <GuideLink section="region" topic="Where you live" onOpen={onOpenGuide} />
          </>
        )}
      </p>
      {asked && (
        <fieldset className="motion-options">
          <legend>Which half of the world are you in?</legend>
          <p className="subtle-copy">
            The garden’s seasons follow your choice. Without one, they follow
            the north’s.
          </p>
          {HEMISPHERE_CHOICES.map((choice) => (
            <label className="toggle-row" key={choice.label}>
              <span>
                <strong>{choice.label}</strong>
              </span>
              <input
                type="radio"
                name="hemisphere"
                value={choice.value ?? ''}
                checked={hemisphere === choice.value}
                onChange={() => choose(region, choice.value)}
              />
            </label>
          ))}
        </fieldset>
      )}
    </section>
  )
}
