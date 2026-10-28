import { describe, expect, it } from 'vitest'
import { namesMarked, regionGuideWords } from './regionGuide'

describe('the region section in words', () => {
  it('names the butterflies native to a region, and those only seen there', () => {
    expect(namesMarked('butterflies', 'europe', 'native')).toEqual([
      'Red Admiral',
      'Painted Lady',
      'Mourning Cloak',
      'Cabbage White',
    ])
    expect(namesMarked('butterflies', 'europe', 'seen')).toEqual(['Monarch', 'American Lady'])
  })

  it('names the narrower place where the region would overstate it', () => {
    expect(namesMarked('butterflies', 'australasia', 'seen')).toContain(
      'Painted Lady (in Australia)',
    )
    expect(namesMarked('plants', 'europe', 'native')).toContain('Parsley (in Greece)')
    expect(namesMarked('butterflies', 'australasia', 'native')).toEqual([])
  })

  it('gives the search everything the section says', () => {
    const words = regionGuideWords('europe')
    expect(words).toMatch(/Butterflies where you live/)
    expect(words).toMatch(/UK and Europe/)
    expect(words).toMatch(/holly blues/)
    expect(words).toMatch(/Mourning Cloak/)
    // Elsewhere names no butterflies, only the advice that holds anywhere.
    expect(regionGuideWords('elsewhere')).not.toMatch(/Monarch/)
    expect(regionGuideWords('elsewhere')).toMatch(/insecticides/)
  })
})
