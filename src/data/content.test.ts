import { describe, expect, it } from 'vitest'
import { observations, plants, species } from './content'

describe('butterfly collection content', () => {
  it('offers twenty-five butterflies including blue morpho and glasswing', () => {
    expect(species).toHaveLength(25)
    expect(species).toContainEqual(
      expect.objectContaining({
        id: 'blue-morpho',
        commonName: 'Blue Morpho',
        scientificName: 'Morpho peleides',
      }),
    )
    expect(species).toContainEqual(
      expect.objectContaining({
        id: 'glasswing',
        commonName: 'Glasswing',
        scientificName: 'Greta oto',
      }),
    )
    expect(species.some((butterfly) => butterfly.id === 'question-mark')).toBe(
      false,
    )
  })

  it('gives every butterfly a distinct visual signature', () => {
    const signatures = species.map((butterfly) =>
      JSON.stringify({
        wingColors: butterfly.wingColors,
        visualPattern: butterfly.visualPattern,
        wingShape: butterfly.wingShape,
      }),
    )

    expect(new Set(signatures).size).toBe(species.length)
    expect(new Set(species.map((butterfly) => butterfly.visualPattern)).size).toBe(
      species.length,
    )
  })

  it('gives every butterfly a matching host plant and authored observations', () => {
    species.forEach((butterfly) => {
      butterfly.hostPlantIds.forEach((plantId) => {
        expect(plants).toContainEqual(
          expect.objectContaining({
            id: plantId,
            kind: 'host',
            speciesIds: expect.arrayContaining([butterfly.id]),
          }),
        )
      })
      expect(
        observations.filter((item) => item.speciesId === butterfly.id).length,
      ).toBeGreaterThanOrEqual(3)
    })
  })
})
