import { describe, expect, it } from 'vitest'
import { observations, plants, species } from './content'

describe('butterfly collection content', () => {
  it('offers seventeen butterflies including blue morpho and glasswing', () => {
    expect(species).toHaveLength(17)
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
