import { describe, expect, it } from 'vitest'
import { fontDraws, listFiles, readText } from '../test/woff2'
import { jarCharacters } from './jars'

// Through a variable: Vite turns `new URL('…', import.meta.url)` written out
// in full into a served asset's address, and the files are wanted on disk.
const here = import.meta.url
const fontsFolder = new URL('../assets/fonts/', here)
const fontFile = (pattern: RegExp) => {
  const name = listFiles(fontsFolder).find((file) => pattern.test(file))
  if (!name) throw new Error(`No font file matches ${pattern}`)
  return new URL(name, fontsFolder)
}

/**
 * The faces a jar's character is drawn in: Fraunces on the jar itself
 * (JarSprite), Nunito Sans on the shop's buttons. Only the latin subsets:
 * the PWA keeps those offline, and fetches the latin-ext ones only when a
 * page needs them, which a garden opened offline could not.
 */
const faces = [
  ['Fraunces', fontFile(/^fraunces-normal-latin-[0-9a-f]+\.woff2$/)],
  ['Nunito Sans', fontFile(/^nunito-sans-normal-latin-[0-9a-f]+\.woff2$/)],
] as const

/** The code points src/fonts.css sends to a family's latin face. */
function latinRange(family: string): [number, number][] {
  const css = readText(new URL('../fonts.css', here))
  const face = css
    .split('@font-face')
    .find(
      (block) =>
        block.includes(`font-family: '${family}'`) &&
        block.includes('font-style: normal') &&
        /-latin-[0-9a-f]+\.woff2/.test(block),
    )
  const range = face?.match(/unicode-range:([^;]+);/)?.[1]
  if (!range) throw new Error(`No latin unicode-range for ${family}`)
  return range.split(',').map((part) => {
    const [first, last = first] = part.trim().replace('U+', '').split('-')
    return [Number.parseInt(first, 16), Number.parseInt(last, 16)]
  })
}

describe('jar characters in the app’s own fonts', () => {
  it.each(faces)('every one is drawn by %s', (_family, file) => {
    const draws = fontDraws(file)
    expect(jarCharacters.filter((character) => !draws(character))).toEqual([])
  })

  it.each(faces)('every one is sent to the %s face the PWA keeps offline', (family) => {
    const ranges = latinRange(family)
    const outside = jarCharacters.filter((character) => {
      const code = character.codePointAt(0) ?? 0
      return !ranges.some(([first, last]) => code >= first && code <= last)
    })
    expect(outside).toEqual([])
  })

  it('leaves out the symbols the fonts do not carry', () => {
    // Asked for, but drawn by neither face: a phone would reach for a font of
    // its own, a different heart on every device. They wait for a font.
    for (const [, file] of faces) {
      const draws = fontDraws(file)
      for (const symbol of ['♥', '★', '☀', '☾', '✿']) {
        expect(draws(symbol)).toBe(false)
        expect(jarCharacters).not.toContain(symbol)
      }
    }
  })

  it('reads a font’s map rightly, by what it does and does not draw', () => {
    const draws = fontDraws(faces[0][1])
    expect(draws('A')).toBe(true)
    expect(draws('é')).toBe(true)
    // Polish Ł lives in the latin-ext face, not this one.
    expect(draws('Ł')).toBe(false)
  })
})
