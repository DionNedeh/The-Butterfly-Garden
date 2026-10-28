import { describe, expect, it } from 'vitest'
import { REGION_IDS } from '../lib/region'
import { plants, species } from './content'
import { plantChecklist, plantRegions, regionTips, speciesRegions } from './regions'

const MARKED = ['north-america', 'europe', 'australasia']

describe('region data', () => {
  it('covers every species and every plant, and nothing else', () => {
    expect(Object.keys(speciesRegions).sort()).toEqual(species.map((item) => item.id).sort())
    expect(Object.keys(plantRegions).sort()).toEqual(plants.map((item) => item.id).sort())
    expect(Object.keys(plantChecklist).sort()).toEqual(plants.map((item) => item.id).sort())
  })

  it('marks only the three regions that have marks, each in a known way', () => {
    for (const marks of [...Object.values(speciesRegions), ...Object.values(plantRegions)]) {
      for (const [region, mark] of Object.entries(marks)) {
        expect(MARKED).toContain(region)
        expect(['native', 'seen']).toContain(mark.presence)
        if (mark.note) expect(mark.note).toMatch(/^[A-Z].*\.$/)
      }
    }
  })

  it('marks a plant only where it is native: a crop grown everywhere says nothing', () => {
    for (const marks of Object.values(plantRegions)) {
      for (const mark of Object.values(marks)) expect(mark.presence).toBe('native')
    }
  })

  it('is honest about the butterflies that are hard to meet', () => {
    // Rare in Western Australia only, and not the Australian painted lady.
    expect(speciesRegions['painted-lady'].australasia).toEqual(
      expect.objectContaining({ presence: 'seen', where: 'Australia' }),
    )
    expect(speciesRegions['painted-lady'].australasia?.note).toMatch(/different species/)
    // Brought by people, so never "native" outside Europe.
    expect(speciesRegions['cabbage-white']['north-america']?.presence).toBe('seen')
    expect(speciesRegions['cabbage-white'].europe?.presence).toBe('native')
    expect(speciesRegions.monarch.europe?.presence).toBe('seen')
    // No good source places the glasswing anywhere a region covers.
    expect(speciesRegions.glasswing).toEqual({})
    // Wild only from Mexico south: never suggested farther north.
    expect(speciesRegions['blue-morpho']['north-america']?.note).toMatch(/Mexico/)
  })

  it('gives every region, Elsewhere too, tips with their sources', () => {
    for (const region of REGION_IDS) {
      const tips = regionTips[region]
      expect(tips.intro).not.toBe('')
      expect(tips.groups.length).toBeGreaterThan(0)
      for (const group of tips.groups) expect(group.items.length).toBeGreaterThan(0)
      expect(tips.credit).toMatch(/^From /)
      expect(tips.sources.length).toBeGreaterThan(0)
      for (const source of tips.sources) expect(new URL(source).protocol).toBe('https:')
    }
  })
})
