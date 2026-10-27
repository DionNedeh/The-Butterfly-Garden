import { describe, expect, it } from 'vitest'
import type { AppView } from '../types'
import { hashForRoute, returnFrom, routeFromHash, urlForRoute } from './routes'

const EVERY_VIEW: AppView[] = [
  'garden',
  'care',
  'today',
  'journal',
  'shop',
  'flight-patterns',
  'guide',
  'settings',
  'whats-new',
  'privacy',
  'notices',
  'support',
  'breathe',
  'year',
]

describe('pages in the address bar', () => {
  it('reads back every page it writes', () => {
    for (const view of EVERY_VIEW) {
      expect(routeFromHash(hashForRoute({ view }))).toEqual({ view })
    }
    expect(routeFromHash(hashForRoute({ view: 'shop', onPass: true }))).toEqual({
      view: 'shop',
      onPass: true,
    })
    expect(routeFromHash(hashForRoute({ view: 'today', checkIn: true }))).toEqual({
      view: 'today',
      checkIn: true,
    })
  })

  it('opens Today at its check-in for the home-screen shortcut', () => {
    expect(hashForRoute({ view: 'today', checkIn: true })).toBe('#/today/check-in')
    expect(routeFromHash('#/today/check-in/')).toEqual({ view: 'today', checkIn: true })
    // Only Today has a check-in to open at.
    expect(hashForRoute({ view: 'journal', checkIn: true })).toBe('#/journal')
  })

  it('keeps the garden at the plain address', () => {
    expect(hashForRoute({ view: 'garden' })).toBe('')
    expect(routeFromHash('')).toEqual({ view: 'garden' })
    expect(routeFromHash('#/')).toEqual({ view: 'garden' })
  })

  it('uses short, readable paths', () => {
    expect(hashForRoute({ view: 'flight-patterns' })).toBe('#/flight')
    expect(hashForRoute({ view: 'journal' })).toBe('#/journal')
    expect(routeFromHash('#/journal/')).toEqual({ view: 'journal' })
  })

  it('gives breathing with a butterfly an address of its own, without where it came from', () => {
    expect(hashForRoute({ view: 'breathe', from: 'today' })).toBe('#/breathe')
    expect(routeFromHash('#/breathe')).toEqual({ view: 'breathe' })
  })

  it('gives the year looked back on an address, this year’s plain and another’s by number', () => {
    expect(hashForRoute({ view: 'year' })).toBe('#/year')
    expect(hashForRoute({ view: 'year', year: 2025, from: 'journal' })).toBe('#/year/2025')
    expect(routeFromHash('#/year/2025')).toEqual({ view: 'year', year: 2025 })
    expect(routeFromHash('#/year/2025/')).toEqual({ view: 'year', year: 2025 })
    // Only four digits name a year; anything else names no page.
    expect(routeFromHash('#/year/25')).toBeUndefined()
    expect(routeFromHash('#/year/twenty')).toBeUndefined()
    // Only the year's page has a year in its address.
    expect(hashForRoute({ view: 'journal', year: 2025 })).toBe('#/journal')
  })

  it('sends a reloaded recap to Today, where tonight’s is offered', () => {
    expect(hashForRoute({ view: 'recap' })).toBe('#/recap')
    expect(routeFromHash('#/recap')).toEqual({ view: 'today' })
  })

  it('opens the Guide at a section, and reads it back', () => {
    expect(hashForRoute({ view: 'guide', section: 'stardust' })).toBe('#/guide/stardust')
    expect(routeFromHash('#/guide/nectar-and-stardust')).toEqual({
      view: 'guide',
      section: 'nectar-and-stardust',
    })
    expect(routeFromHash('#/guide/bond/')).toEqual({ view: 'guide', section: 'bond' })
    // Only the Guide has sections, and the page it came from is not in the address.
    expect(hashForRoute({ view: 'journal', section: 'bond' })).toBe('#/journal')
    expect(hashForRoute({ view: 'guide', section: 'bond', from: 'care' })).toBe('#/guide/bond')
  })

  it('keeps where a "What does this do?" link was pressed out of the address', () => {
    const fromPlace = { section: 'bond', scrollY: 480, companionId: 'zed' }
    expect(hashForRoute({ view: 'guide', section: 'bond', from: 'care', fromPlace })).toBe(
      '#/guide/bond',
    )
    expect(hashForRoute({ view: 'care', companionId: 'zed', restore: fromPlace })).toBe('#/care')
  })

  it('names no section that is not plain words', () => {
    expect(routeFromHash('#/guide/Bond')).toBeUndefined()
    expect(routeFromHash('#/guide/a/b')).toBeUndefined()
    expect(routeFromHash('#/guide/<x>')).toBeUndefined()
    expect(routeFromHash(`#/guide/${'a'.repeat(41)}`)).toBeUndefined()
  })

  it('names no page for an unknown hash, including the move’s arrival', () => {
    expect(routeFromHash('#/nowhere')).toBeUndefined()
    expect(routeFromHash('#/arrive')).toBeUndefined()
    expect(routeFromHash('#section')).toBeUndefined()
  })

  it('keeps the path and query when building an address', () => {
    expect(
      urlForRoute({ view: 'today' }, { pathname: '/The-Butterfly-Garden/', search: '?a=1' }),
    ).toBe('/The-Butterfly-Garden/?a=1#/today')
  })
})

describe('the way back from the Guide', () => {
  it('returns to the page its link left, for the same companion, at the same place', () => {
    const fromPlace = { section: 'bond', scrollY: 480, companionId: 'zed' }
    expect(returnFrom({ view: 'guide', section: 'bond', from: 'care', fromPlace })).toEqual({
      view: 'care',
      companionId: 'zed',
      restore: fromPlace,
    })
    // Another section chosen in the Guide since does not move the way back.
    expect(
      returnFrom({
        view: 'guide',
        section: 'stardust',
        from: 'settings',
        fromPlace: { section: 'seeds', scrollY: 1200 },
      }),
    ).toEqual({
      view: 'settings',
      companionId: undefined,
      restore: { section: 'seeds', scrollY: 1200 },
    })
  })

  it('offers none from a Guide opened any other way, or from another page', () => {
    expect(returnFrom({ view: 'guide' })).toBeUndefined()
    expect(returnFrom({ view: 'guide', section: 'bond' })).toBeUndefined()
    expect(returnFrom({ view: 'guide', from: 'guide' })).toBeUndefined()
    expect(returnFrom({ view: 'care', from: 'today' })).toBeUndefined()
  })

  it('still returns to the page when no place was kept', () => {
    expect(returnFrom({ view: 'guide', section: 'sunlight', from: 'today' })).toEqual({
      view: 'today',
      companionId: undefined,
      restore: undefined,
    })
  })
})

describe('the way back from breathing', () => {
  it('returns to the page that offered it, at the way in that was taken', () => {
    const fromPlace = { breathe: 'goal' as const, goalId: 'breaths', scrollY: 2315 }
    expect(returnFrom({ view: 'breathe', from: 'today', fromPlace })).toEqual({
      view: 'today',
      companionId: undefined,
      restore: fromPlace,
    })
    const support = { breathe: 'support' as const, scrollY: 900 }
    expect(returnFrom({ view: 'breathe', from: 'support', fromPlace: support })).toEqual({
      view: 'support',
      companionId: undefined,
      restore: support,
    })
    // Where it was pressed stays out of the address, both ways.
    expect(hashForRoute({ view: 'breathe', from: 'today', fromPlace })).toBe('#/breathe')
    expect(hashForRoute({ view: 'today', restore: fromPlace })).toBe('#/today')
  })

  it('offers none for breathing opened from its address, or from another page', () => {
    expect(returnFrom({ view: 'breathe' })).toBeUndefined()
    expect(returnFrom({ view: 'breathe', from: 'breathe' })).toBeUndefined()
    // A page left for another is not a way back, whatever it remembers.
    expect(
      returnFrom({ view: 'today', from: 'support', fromPlace: { breathe: 'support', scrollY: 0 } }),
    ).toBeUndefined()
  })
})
