import { afterEach, describe, expect, it } from 'vitest'
import {
  effectiveTheme,
  EVENING_THEME_ENDS_HOUR,
  eveningNightHours,
  nextThemeChange,
  paintBrowserBars,
  themeChoiceOf,
} from './theme'

/** A local moment on 27 October 2026 (or a day after), at hour:minute. */
const at = (hour: number, minute = 0, day = 27) => new Date(2026, 9, day, hour, minute)

describe('the theme on screen', () => {
  it('is the one chosen by hand when nothing is followed, whatever the hour or device', () => {
    for (const prefersDark of [false, true]) {
      for (const hour of [0, 6, 12, 18, 23]) {
        expect(effectiveTheme({ theme: 'night' }, at(hour), prefersDark)).toBe('night')
        expect(effectiveTheme({ theme: 'sunlight' }, at(hour), prefersDark)).toBe('sunlight')
        // An older garden that never chose is a sunlight garden.
        expect(effectiveTheme({}, at(hour), prefersDark)).toBe('sunlight')
        expect(effectiveTheme(undefined, at(hour), prefersDark)).toBe('sunlight')
      }
    }
  })

  it('follows the device’s dark setting, and changes when the device does', () => {
    const profile = { theme: 'sunlight', themeFollows: 'device' } as const
    expect(effectiveTheme(profile, at(12), true)).toBe('night')
    expect(effectiveTheme(profile, at(12), false)).toBe('sunlight')
    // The hand-chosen theme waits underneath and does not decide.
    expect(effectiveTheme({ ...profile, theme: 'night' }, at(23), false)).toBe('sunlight')
  })

  it('follows the evening from the hour it starts until six in the morning', () => {
    const profile = { theme: 'sunlight', themeFollows: 'evening' } as const
    expect(EVENING_THEME_ENDS_HOUR).toBe(6)
    // The evening boundary: 6pm by default.
    expect(effectiveTheme(profile, at(17, 59), false)).toBe('sunlight')
    expect(effectiveTheme(profile, at(18, 0), false)).toBe('night')
    expect(effectiveTheme(profile, at(23, 59), false)).toBe('night')
    expect(effectiveTheme(profile, at(0, 0), false)).toBe('night')
    // The morning boundary, two hours after the recap's late night ends.
    expect(effectiveTheme(profile, at(4, 30), false)).toBe('night')
    expect(effectiveTheme(profile, at(5, 59), false)).toBe('night')
    expect(effectiveTheme(profile, at(6, 0), false)).toBe('sunlight')
    expect(effectiveTheme(profile, at(12), true)).toBe('sunlight')
  })

  it('starts the night at the gardener’s own evening, and keeps a late night to its end', () => {
    const owl = { themeFollows: 'evening', recapOpensHour: 22, recapGraceEndsHour: 9 } as const
    expect(eveningNightHours(owl)).toEqual({ from: 22, until: 9 })
    expect(effectiveTheme(owl, at(21, 59), false)).toBe('sunlight')
    expect(effectiveTheme(owl, at(22), false)).toBe('night')
    expect(effectiveTheme(owl, at(8, 59), false)).toBe('night')
    expect(effectiveTheme(owl, at(9), false)).toBe('sunlight')
    // A late night that ends early still leaves the dark hours to the night.
    const early = { recapOpensHour: 20, recapGraceEndsHour: 1 }
    expect(eveningNightHours(early)).toEqual({ from: 20, until: 6 })
    // Hours outside the offered ones fall back to the defaults.
    expect(eveningNightHours({ recapOpensHour: 3, recapGraceEndsHour: 40 })).toEqual({
      from: 18,
      until: 6,
    })
  })

  it('says which choice Settings should show', () => {
    expect(themeChoiceOf(undefined)).toBe('sunlight')
    expect(themeChoiceOf({})).toBe('sunlight')
    expect(themeChoiceOf({ theme: 'night' })).toBe('night')
    expect(themeChoiceOf({ theme: 'night', themeFollows: 'device' })).toBe('device')
    expect(themeChoiceOf({ theme: 'sunlight', themeFollows: 'evening' })).toBe('evening')
  })
})

describe('the next time a followed evening turns the theme', () => {
  const evening = { themeFollows: 'evening' } as const

  it('is the next of the evening and morning hours still to come', () => {
    expect(nextThemeChange(evening, at(12))).toEqual(at(18))
    expect(nextThemeChange(evening, at(17, 59))).toEqual(at(18))
    // Exactly on a boundary, the next one is the other.
    expect(nextThemeChange(evening, at(18))).toEqual(at(6, 0, 28))
    expect(nextThemeChange(evening, at(23, 30))).toEqual(at(6, 0, 28))
    expect(nextThemeChange(evening, at(3))).toEqual(at(6))
    expect(nextThemeChange(evening, at(6))).toEqual(at(18))
  })

  it('moves with the gardener’s hours', () => {
    const owl = { ...evening, recapOpensHour: 22, recapGraceEndsHour: 9 }
    expect(nextThemeChange(owl, at(7))).toEqual(at(9))
    expect(nextThemeChange(owl, at(10))).toEqual(at(22))
  })

  it('lands on the hour across a change of the clocks', () => {
    // New York's clocks go back at 2am on 1 November 2026: the morning after
    // is 25 hours from the evening before, and still turns at six.
    const change = nextThemeChange(evening, new Date(2026, 9, 31, 20))
    expect(change).toEqual(new Date(2026, 10, 1, 6))
    expect(change?.getHours()).toBe(6)
  })

  it('is nothing at all while the theme is chosen by hand or follows the device', () => {
    expect(nextThemeChange(undefined, at(12))).toBeUndefined()
    expect(nextThemeChange({ theme: 'night' }, at(12))).toBeUndefined()
    expect(nextThemeChange({ themeFollows: 'device' }, at(12))).toBeUndefined()
  })
})

describe('the browser’s own bars', () => {
  afterEach(() => {
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove())
  })

  it('take the garden’s colour, and get index.html’s back afterwards', () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="#f7f3e8" media="(prefers-color-scheme: light)">' +
        '<meta name="theme-color" content="#07131f" media="(prefers-color-scheme: dark)">',
    )
    const contents = () =>
      [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
        (meta) => meta.content,
      )
    const restore = paintBrowserBars('night')
    expect(contents()).toEqual(['#07131f', '#07131f'])
    restore()
    expect(contents()).toEqual(['#f7f3e8', '#07131f'])
    paintBrowserBars('sunlight')
    expect(contents()).toEqual(['#f7f3e8', '#f7f3e8'])
  })

  it('leave a page that has none alone', () => {
    expect(() => paintBrowserBars('night')()).not.toThrow()
  })
})
