import { describe, expect, it } from 'vitest'
import { whatToLookFor } from '../data/whatToLookFor'
import { hemisphereOf, seasonOf } from './seasons'
import { lookForThisMonth } from './whatToLookFor'

const REGIONS = ['north-america', 'europe', 'australasia'] as const

describe('what to look for this month', () => {
  it('says something for every month of every region, once', () => {
    for (const region of REGIONS) {
      const months = whatToLookFor[region].flatMap((line) => line.months)
      expect(months.sort((a, b) => a - b), region).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    }
  })

  it('follows each region’s own seasons: the south’s are the north’s reversed', () => {
    expect(seasonOf(6, 'north')).toBe('summer')
    expect(seasonOf(6, 'south')).toBe('winter')
    expect(seasonOf(1, 'south')).toBe('summer')
    expect(seasonOf(10, 'north')).toBe('autumn')
    expect(seasonOf(10, 'south')).toBe('spring')
    for (const region of REGIONS) {
      for (const line of whatToLookFor[region]) {
        for (const month of line.months) {
          expect(seasonOf(month, hemisphereOf(region)), `${region} ${month}: ${line.text}`).toBe(line.season)
        }
      }
    }
  })

  it('gives June’s summer line in North America and a winter one in New Zealand', () => {
    expect(lookForThisMonth('north-america', '2026-06-15')?.text).toMatch(/Summer brings new generations of monarchs/)
    expect(lookForThisMonth('australasia', '2026-06-15')?.text).toMatch(/monarchs spend the winter/)
    expect(lookForThisMonth('north-america', '2026-10-27')?.text).toMatch(/on the move south this month/)
    expect(lookForThisMonth('australasia', '2026-10-27')?.text).toMatch(/spring/)
    expect(lookForThisMonth('europe', '2026-12-01')?.text).toMatch(/Commas spend the winter/)
  })

  it('says nothing without a region, or for Elsewhere, whose seasons are unknown', () => {
    expect(lookForThisMonth(undefined, '2026-06-15')).toBeUndefined()
    expect(lookForThisMonth('elsewhere', '2026-06-15')).toBeUndefined()
  })

  it('cites a source for every line, says it plainly, and never suggests catching anything', () => {
    for (const region of REGIONS) {
      for (const line of whatToLookFor[region]) {
        expect(line.sources.length).toBeGreaterThan(0)
        for (const source of line.sources) expect(new URL(source).protocol).toBe('https:')
        expect(line.text).toMatch(/^[A-Z].*\.$/)
        expect(line.text.length).toBeLessThanOrEqual(130)
        expect(line.text).not.toMatch(/\b(catch|net|nets|handle|hold|pick up|collect)\b/i)
      }
    }
  })
})
