import { describe, expect, it } from 'vitest'
import { isRegionId, REGION_IDS } from './region'
import { REGION_CHOICES, regionMark, regionName } from './regionMarks'

describe('regions', () => {
  it('knows its four regions, and nothing else', () => {
    expect(REGION_IDS).toEqual(['north-america', 'europe', 'australasia', 'elsewhere'])
    for (const region of REGION_IDS) expect(isRegionId(region)).toBe(true)
    for (const value of ['', 'uk', 'North America', undefined, null, 3, {}]) {
      expect(isRegionId(value)).toBe(false)
    }
  })

  it('offers every region in Settings, by a plain name', () => {
    expect(REGION_CHOICES.map((choice) => choice.value)).toEqual(REGION_IDS)
    expect(regionName('europe')).toBe('UK and Europe')
    expect(regionName('australasia')).toBe('Australia and New Zealand')
  })
})

describe('regionMark', () => {
  const marks = {
    'north-america': { presence: 'native' as const },
    europe: { presence: 'seen' as const, note: 'A rare visitor.' },
    australasia: { presence: 'seen' as const, where: 'Australia' },
  }

  it('says native or seen, with the region in the sentence', () => {
    expect(regionMark(marks, 'north-america')).toEqual({
      presence: 'native',
      label: 'Native to North America',
      note: undefined,
    })
    expect(regionMark(marks, 'europe')).toEqual({
      presence: 'seen',
      label: 'Seen in the UK and Europe',
      note: 'A rare visitor.',
    })
  })

  it('names a narrower place where the region would overstate it', () => {
    expect(regionMark(marks, 'australasia')?.label).toBe('Seen in Australia')
  })

  it('says nothing without a region, for Elsewhere, or where it does not live', () => {
    expect(regionMark(marks, undefined)).toBeUndefined()
    expect(regionMark(marks, 'elsewhere')).toBeUndefined()
    expect(regionMark({}, 'europe')).toBeUndefined()
    expect(regionMark(undefined, 'europe')).toBeUndefined()
  })
})
