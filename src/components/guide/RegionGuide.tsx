import { regionTips } from '../../data/regions'
import { namesMarked } from '../../lib/regionGuide'
import { regionName } from '../../lib/regionMarks'
import { listed } from '../../lib/plural'
import type { RegionId } from '../../types'

/**
 * "Butterflies where you live": the Guide's section for the region chosen in
 * Settings. Which of the garden's butterflies and plants are native there,
 * which are only seen there, and what to plant for the butterflies that
 * really live there (data/regions). "Elsewhere" has no marks, only the
 * advice that holds anywhere.
 */
export function RegionGuide({ region }: { region: RegionId }) {
  const tips = regionTips[region]
  const marked = region !== 'elsewhere'
  const nativeButterflies = marked ? namesMarked('butterflies', region, 'native') : []
  const seenButterflies = marked ? namesMarked('butterflies', region, 'seen') : []
  const nativePlants = marked ? namesMarked('plants', region, 'native') : []
  return (
    <section className="card guide-region" aria-labelledby="guide-region">
      <p className="eyebrow">Your region · {regionName(region)}</p>
      <h2 id="guide-region" tabIndex={-1}>
        Butterflies where you live
      </h2>
      <p>{tips.intro}</p>
      {marked ? (
        <dl className="region-summary">
          <dt>The garden’s butterflies native here</dt>
          <dd>
            {nativeButterflies.length
              ? listed(nativeButterflies)
              : 'None of them, though the plants below feed butterflies that are.'}
          </dd>
          {seenButterflies.length > 0 && (
            <>
              <dt>Seen here, but not native</dt>
              <dd>{listed(seenButterflies)}</dd>
            </>
          )}
          {nativePlants.length > 0 && (
            <>
              <dt>The garden’s plants native here</dt>
              <dd>{listed(nativePlants)}</dd>
            </>
          )}
        </dl>
      ) : (
        <p>
          The Guide marks native butterflies and plants for North America, the
          UK and Europe, and Australia and New Zealand.
        </p>
      )}
      {tips.groups.map((group) => (
        <div className="region-tips" key={group.heading}>
          <h3>{group.heading}</h3>
          <ul>
            {group.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {tips.note && <p className="region-note">{tips.note}</p>}
      {marked && (
        <p className="subtle-copy">
          Native to a region is not the same as near you: a local field guide
          or butterfly group knows which live close by.
        </p>
      )}
      <p className="checked-with">{tips.credit}</p>
    </section>
  )
}
