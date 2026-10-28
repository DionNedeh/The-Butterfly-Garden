import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { JAR_ACCENTED, JAR_LABEL, jarColors } from '../../data/jars'
import { contrastRatio } from '../../lib/contrast'
import { JarSprite } from './JarSprite'

function drawn(character: string, colorId: string) {
  const { container } = render(<JarSprite character={character} colorId={colorId} />)
  const glyph = container.querySelector('text')!
  // The label is the one rectangle in the jar's cream.
  const label = Array.from(container.querySelectorAll('rect')).find(
    (rect) => rect.getAttribute('fill') === JAR_LABEL,
  )
  return { glyph, label }
}

describe('a jar’s glyph', () => {
  it.each(jarColors.map((color) => [color.label, color] as const))(
    'is printed on a %s jar in its own ink, on the cream label, at AA contrast',
    (_label, color) => {
      const { glyph, label } = drawn('A', color.id)
      expect(label).toBeDefined()
      expect(glyph.getAttribute('fill')).toBe(color.text)
      expect(contrastRatio(glyph.getAttribute('fill')!, JAR_LABEL)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('keeps an accent on the label: a capital with a mark above is set smaller and lower', () => {
    const plain = drawn('E', 'blue').glyph
    for (const character of JAR_ACCENTED) {
      const { glyph } = drawn(character, 'blue')
      // Ç's cedilla is below, and Æ, Ø and Œ have no mark: those stand as tall as E.
      const markAbove = !'ÇÆØŒ'.includes(character)
      expect(Number(glyph.getAttribute('font-size')) < Number(plain.getAttribute('font-size'))).toBe(
        markAbove,
      )
      expect(Number(glyph.getAttribute('y')) > Number(plain.getAttribute('y'))).toBe(markAbove)
    }
  })

  it('draws an unknown colour as the first one, rather than nothing', () => {
    expect(drawn('A', 'tartan').glyph.getAttribute('fill')).toBe(jarColors[0].text)
  })
})
