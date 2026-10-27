import { describe, expect, it } from 'vitest'
import type { AppView } from '../types'
import { hashForRoute, returnFromGuide, routeFromHash, urlForRoute } from './routes'

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
    expect(returnFromGuide({ view: 'guide', section: 'bond', from: 'care', fromPlace })).toEqual({
      view: 'care',
      companionId: 'zed',
      restore: fromPlace,
    })
    // Another section chosen in the Guide since does not move the way back.
    expect(
      returnFromGuide({
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
    expect(returnFromGuide({ view: 'guide' })).toBeUndefined()
    expect(returnFromGuide({ view: 'guide', section: 'bond' })).toBeUndefined()
    expect(returnFromGuide({ view: 'guide', from: 'guide' })).toBeUndefined()
    expect(returnFromGuide({ view: 'care', from: 'today' })).toBeUndefined()
  })

  it('still returns to the page when no place was kept', () => {
    expect(returnFromGuide({ view: 'guide', section: 'sunlight', from: 'today' })).toEqual({
      view: 'today',
      companionId: undefined,
      restore: undefined,
    })
  })
})
