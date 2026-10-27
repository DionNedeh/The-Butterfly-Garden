import { REGION_CHOICES } from '../lib/regionMarks'
import { isRegionId } from '../lib/region'
import type { RegionId } from '../types'
import { GuideLink } from './GuideLink'

/**
 * Settings' "My region": where the gardener gardens, chosen by hand. The
 * Guide then marks which of the garden's butterflies and plants are native
 * there and suggests plants for real butterflies. Nothing chosen is the
 * default and marks nothing, exactly as before there was a choice.
 */
export function RegionSetting({
  region,
  onChoose,
  onOpenGuide,
}: {
  region: RegionId | undefined
  onChoose: (region: RegionId | undefined) => void
  onOpenGuide?: (section: string) => void
}) {
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
            onChoose(isRegionId(value) ? value : undefined)
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
    </section>
  )
}
