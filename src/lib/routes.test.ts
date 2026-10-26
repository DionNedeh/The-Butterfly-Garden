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
