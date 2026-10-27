import { describe, expect, it } from 'vitest'
import type { AppView } from '../types'
import { hashForRoute, routeFromHash, urlForRoute } from './routes'

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
