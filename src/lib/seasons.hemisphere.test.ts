import { describe, expect, it } from 'vitest'
import { hemisphereOf, knownSeason } from './seasons'

/*
 * 1.4: a gardener whose region is Elsewhere, or not chosen, can say which
 * half of the world they garden in (Profile.hemisphere), and the seasons
 * follow it. A named region still says it on its own.
 */
describe('1.4 the half of the world a gardener chose', () => {
  it('is the one the seasons follow where the region does not say', () => {
    expect(hemisphereOf('elsewhere', 'south')).toBe('south')
    expect(hemisphereOf(undefined, 'south')).toBe('south')
    expect(hemisphereOf('elsewhere', 'north')).toBe('north')
    expect(hemisphereOf(undefined, 'north')).toBe('north')
  })

  it('gives way to a named region, which says it already', () => {
    expect(hemisphereOf('europe', 'south')).toBe('north')
    expect(hemisphereOf('north-america', 'south')).toBe('north')
    expect(hemisphereOf('australasia', 'north')).toBe('south')
  })

  it('is the north’s, as before, when none was chosen', () => {
    expect(hemisphereOf('elsewhere', undefined)).toBe('north')
    expect(hemisphereOf(undefined, undefined)).toBe('north')
  })

  it('makes the gardener’s own season known, so its words can speak of it', () => {
    expect(knownSeason('elsewhere', '2026-07-15', 'south')).toBe('winter')
    expect(knownSeason(undefined, '2026-07-15', 'south')).toBe('winter')
    expect(knownSeason('elsewhere', '2026-07-15', 'north')).toBe('summer')
    expect(knownSeason(undefined, '2026-01-15', 'north')).toBe('winter')
    // A named region's own season, whatever was chosen before it.
    expect(knownSeason('europe', '2026-07-15', 'south')).toBe('summer')
    // Not chosen: still unknown, as before.
    expect(knownSeason('elsewhere', '2026-07-15', undefined)).toBeUndefined()
    expect(knownSeason(undefined, '2026-07-15')).toBeUndefined()
  })
})
