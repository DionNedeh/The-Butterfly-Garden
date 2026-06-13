import { describe, expect, it } from 'vitest'
import { observations, plants, species } from './content'

describe('butterfly collection content', () => {
  it('offers at least seven butterflies including a blue morpho', () => {
    expect(species.length).toBeGreaterThanOrEqual(7)
    expect(species).toContainEqual(
      expect.objectContaining({
        id: 'blue-morpho',
        commonName: 'Blue Morpho',
        scientificName: 'Morpho peleides',
      }),
    )
  })

  it('gives the blue morpho a host plant and authored observations', () => {
    expect(
      plants.some(
        (plant) =>
          plant.kind === 'host' && plant.speciesIds.includes('blue-morpho'),
      ),
    ).toBe(true)
    expect(
      observations.filter((item) => item.speciesId === 'blue-morpho').length,
    ).toBeGreaterThanOrEqual(5)
  })
})
