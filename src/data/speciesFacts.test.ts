import { describe, expect, it } from 'vitest'
import { species } from './content'
import { publishersOf, speciesFacts } from './speciesFacts'

/** Short enough to read at a glance on a phone. */
const FACT_LENGTH = 110

describe('species facts', () => {
  it('gives every species exactly three facts, and no species that does not exist', () => {
    expect(Object.keys(speciesFacts).sort()).toEqual(species.map((item) => item.id).sort())
    for (const item of species) {
      expect(speciesFacts[item.id].facts).toHaveLength(3)
    }
  })

  it('keeps every fact short, plain and a sentence of its own', () => {
    const all = Object.values(speciesFacts).flatMap((entry) => entry.facts)
    for (const fact of all) {
      expect(fact.length, fact).toBeLessThanOrEqual(FACT_LENGTH)
      expect(fact, fact).toMatch(/^[A-Z].*\.$/)
      expect(fact, fact).not.toMatch(/\s{2}/)
    }
    // No fact is said twice, by one species or by two.
    expect(new Set(all).size).toBe(all.length)
  })

  it('names where every species was checked, from a source it can name', () => {
    for (const [id, entry] of Object.entries(speciesFacts)) {
      expect(entry.sources.length, id).toBeGreaterThan(0)
      for (const source of entry.sources) {
        expect(new URL(source).protocol, source).toBe('https:')
      }
      expect(publishersOf(entry.sources), id).toHaveLength(
        new Set(publishersOf(entry.sources)).size,
      )
      expect(publishersOf(entry.sources).length, id).toBeGreaterThan(0)
    }
  })

  it('no longer says the painted lady is absent from Australia', () => {
    const [first] = speciesFacts['painted-lady'].facts
    expect(first).toMatch(/every continent but Antarctica/)
    expect(first).toMatch(/Australia they are rare/)
  })

  it('says migrating cloudless sulphurs fly low, as the flight traps found', () => {
    expect(speciesFacts['cloudless-sulphur'].facts[0]).toMatch(/within a few meters of the ground/)
  })

  it('names each publisher once, in the order its sources are listed', () => {
    expect(
      publishersOf([
        'https://edis.ifas.ufl.edu/publication/IN780',
        'https://www.butterfliesandmoths.org/species/Danaus-plexippus',
        'https://edis.ifas.ufl.edu/publication/IN906',
        'https://example.org/unknown',
      ]),
    ).toEqual(['University of Florida Extension', 'Butterflies and Moths of North America'])
  })
})
