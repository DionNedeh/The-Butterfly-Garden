import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../lib/contrast'
import { JAR_LABEL, jarColors } from './jars'

describe('jar letters', () => {
  it.each(jarColors.map((color) => [color.label, color.text] as const))(
    'reads clearly on a %s jar (WCAG AA, 4.5:1)',
    (_label, ink) => {
      expect(contrastRatio(ink, JAR_LABEL)).toBeGreaterThanOrEqual(4.5)
    },
  )
})

describe('contrast', () => {
  it('matches the WCAG reference points', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#777777', '#777777')).toBe(1)
    // The old white-jar letter, the finding this test guards against.
    expect(contrastRatio('#b9ad95', JAR_LABEL)).toBeLessThan(2.2)
  })

  it('refuses a colour it cannot read', () => {
    expect(() => contrastRatio('teal', '#ffffff')).toThrow()
  })
})
