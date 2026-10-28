import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { contrastRatio } from './lib/contrast'
import { applyStylesheets, paintOf } from './test/stylesheets'

/**
 * The buttons that delete or unseal something (.danger-button), in every
 * place they are drawn, by day and by night: their words must read at WCAG
 * AA, 4.5:1 for their 16px, 800-weight text. Night's --danger is a light
 * red, for words on a dark page; white words on it would not read.
 */
const BUTTON = '<button class="danger-button" type="button">Delete</button>'

const shell = (night: boolean, inside: string) =>
  `<div class="app-shell theme-${night ? 'night' : 'sunlight'}">${inside}</div>`

const PLACES: ReadonlyArray<[place: string, markup: (night: boolean) => string, nights: boolean[]]> = [
  [
    'Settings’ Begin deletion',
    (night) => shell(night, `<section class="card danger-card">${BUTTON}</section>`),
    [false, true],
  ],
  [
    'Settings’ Yes, delete everything, and a plant’s Yes, remove plant, in their confirmations',
    (night) =>
      shell(night, `<section class="card danger-card"><div class="delete-confirmation"><div class="form-actions">${BUTTON}</div></div></section>`),
    [false, true],
  ],
  [
    'Turn the lock off, in a lock dialog',
    (night) =>
      shell(night, `<dialog open class="garden-dialog lock-dialog"><form><div class="form-actions">${BUTTON}</div></form></dialog>`),
    [false, true],
  ],
  [
    'the lock screen’s Delete it and start again, by the device’s light or dark',
    (night) =>
      `<main class="safe-mode lock-screen${night ? ' theme-night' : ''}"><section class="card safe-mode-card lock-card"><details open class="lock-help"><div class="delete-confirmation"><div class="form-actions">${BUTTON}</div></div></details></section></main>`,
    [false, true],
  ],
  [
    // Safe mode is drawn by day only: nothing of the garden's theme is read there.
    'safe mode’s Delete and start again',
    () => `<main class="safe-mode"><section class="card safe-mode-card"><div class="safe-mode-fresh">${BUTTON}</div></section></main>`,
    [false],
  ],
]

let removeStylesheets: () => void

beforeAll(() => {
  removeStylesheets = applyStylesheets('components/lock/lock.css')
})

afterAll(() => {
  removeStylesheets()
})

describe('a danger button', () => {
  it.each(PLACES)('reads clearly: %s', (_, markup, nights) => {
    for (const night of nights) {
      const place = document.createElement('div')
      place.innerHTML = markup(night)
      document.body.append(place)
      try {
        const { text, fill } = paintOf(place.querySelector('.danger-button')!)
        expect(contrastRatio(text, fill), `${night ? 'night' : 'day'}: ${text} on ${fill}`).toBeGreaterThanOrEqual(4.5)
      } finally {
        place.remove()
      }
    }
  })
})
