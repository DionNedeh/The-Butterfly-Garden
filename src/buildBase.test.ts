import { describe, expect, it } from 'vitest'
import { buildBase, WEB_BASE } from './buildBase'

/*
 * The path a build is served from. The web build has always been served at
 * /The-Butterfly-Garden/ on GitHub Pages, and still is unless VITE_BASE says
 * otherwise, so the old address's final build and a build for a host of the
 * garden's own (served at '/') come from one vite.config.ts. The Android app
 * is always served from the root of its own local origin.
 */
describe('5.1 the base path a build is served from', () => {
  it('is GitHub Pages’ path when VITE_BASE is unset or blank', () => {
    expect(WEB_BASE).toBe('/The-Butterfly-Garden/')
    expect(buildBase({}, false)).toBe('/The-Butterfly-Garden/')
    expect(buildBase({ VITE_BASE: '' }, false)).toBe('/The-Butterfly-Garden/')
    expect(buildBase({ VITE_BASE: '   ' }, false)).toBe('/The-Butterfly-Garden/')
  })

  it('is the path VITE_BASE gives, for a host of the garden’s own', () => {
    expect(buildBase({ VITE_BASE: '/' }, false)).toBe('/')
    expect(buildBase({ VITE_BASE: ' /garden/ ' }, false)).toBe('/garden/')
  })

  it('refuses a path that is not a whole directory from the root, rather than building a broken app', () => {
    for (const wrong of ['garden/', '/garden', 'https://garden.example.org/', './', '//garden/']) {
      expect(() => buildBase({ VITE_BASE: wrong }, false)).toThrow(/VITE_BASE/)
    }
  })

  it('is always the root in the Android app, whatever VITE_BASE says', () => {
    expect(buildBase({}, true)).toBe('/')
    expect(buildBase({ VITE_BASE: '/garden/' }, true)).toBe('/')
  })
})
