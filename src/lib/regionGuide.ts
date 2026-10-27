import { plants, species } from '../data/content'
import { plantRegions, regionTips, speciesRegions } from '../data/regions'
import type { RegionId } from '../types'
import { regionName, type MarkedRegion, type RegionMarks } from './regionMarks'

const BUTTERFLIES = species.map(({ id, commonName }) => ({ id, name: commonName }))
const PLANTS = plants.map(({ id, name }) => ({ id, name }))

/**
 * The garden's butterflies or plants with this mark in a region, by name:
 * "Monarch", or "Painted Lady (in Australia)" where the region as a whole
 * would overstate it. In catalogue order.
 */
export function namesMarked(
  kind: 'butterflies' | 'plants',
  region: MarkedRegion,
  presence: 'native' | 'seen',
): string[] {
  const [entries, marks]: [typeof BUTTERFLIES, Readonly<Record<string, RegionMarks>>] =
    kind === 'butterflies' ? [BUTTERFLIES, speciesRegions] : [PLANTS, plantRegions]
  return entries.flatMap(({ id, name }) => {
    const mark = marks[id]?.[region]
    if (mark?.presence !== presence) return []
    return [mark.where ? `${name} (in ${mark.where})` : name]
  })
}

/** Everything the Guide's region section says, for its search to find. */
export function regionGuideWords(region: RegionId): string {
  const tips = regionTips[region]
  const named =
    region === 'elsewhere'
      ? []
      : [
          ...namesMarked('butterflies', region, 'native'),
          ...namesMarked('butterflies', region, 'seen'),
          ...namesMarked('plants', region, 'native'),
        ]
  return [
    'Butterflies where you live',
    regionName(region),
    tips.intro,
    ...tips.groups.flatMap((group) => [group.heading, ...group.items]),
    tips.note ?? '',
    ...named,
  ].join(' ')
}
