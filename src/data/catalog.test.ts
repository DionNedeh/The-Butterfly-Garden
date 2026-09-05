import { describe, expect, it } from 'vitest'
import { careActions } from './careActions'
import { getShopItem, shopItems } from './shopItems'
import { observations, plants, species } from './content'
import { flightPatterns } from './flightPatterns'
import { jarCharacters, jarColors } from './jars'
import { ambientTracks } from './ambientTracks'

/**
 * The catalogs are plain data that several screens cross-reference by id. A
 * typo here does not fail the build — it quietly renders an empty icon, an
 * unreachable species, or a care action that can never be performed. These
 * invariants keep that from happening as the content grows.
 */
describe('content catalogs', () => {
  it('gives every catalog unique ids', () => {
    const catalogs = {
      species,
      plants,
      shopItems,
      careActions,
      flightPatterns,
      jarColors,
      ambientTracks,
      observations,
    }
    for (const [name, list] of Object.entries(catalogs)) {
      const ids = (list as ReadonlyArray<{ id: string }>).map((item) => item.id)
      expect(`${name}: ${ids.length}`).toBe(`${name}: ${new Set(ids).size}`)
    }
    expect(jarCharacters.length).toBe(new Set(jarCharacters).size)
  })

  it('points every plant at a real species, and every species at a host', () => {
    const speciesIds = new Set(species.map((item) => item.id))
    const unknown = plants.flatMap((plant) =>
      plant.speciesIds.filter((id) => !speciesIds.has(id)),
    )
    expect(unknown).toEqual([])

    const hosted = new Set(plants.flatMap((plant) => plant.speciesIds))
    const strays = species.filter((item) => !hosted.has(item.id))
    expect(strays.map((item) => item.id)).toEqual([])
  })

  it('writes observations about species that exist', () => {
    const speciesIds = new Set(species.map((item) => item.id))
    const orphans = observations.filter(
      (item) => item.speciesId !== 'all' && !speciesIds.has(item.speciesId),
    )
    expect(orphans.map((item) => item.id)).toEqual([])
  })

  it('backs every care action supply with a real shop supply', () => {
    const broken = careActions.filter(
      (action) =>
        action.requiresItemId &&
        getShopItem(action.requiresItemId)?.kind !== 'supply',
    )
    expect(broken.map((action) => action.id)).toEqual([])
  })

  it('leaves no supply in the shop that nothing consumes', () => {
    const consumed = new Set(
      careActions.map((action) => action.requiresItemId).filter(Boolean),
    )
    const unused = shopItems.filter(
      (item) => item.kind === 'supply' && !consumed.has(item.id),
    )
    expect(unused.map((item) => item.id)).toEqual([])
  })

  it('gives every life stage a free care action', () => {
    for (const stage of ['egg', 'caterpillar', 'chrysalis', 'butterfly'] as const) {
      const free = careActions.filter(
        (action) => action.stage === stage && !action.requiresItemId,
      )
      expect(`${stage}: ${free.length > 0}`).toBe(`${stage}: true`)
    }
  })

  it('gives every cosmetic a slot and at least one stage it fits', () => {
    const broken = shopItems.filter(
      (item) => item.kind === 'cosmetic' && (!item.slot || !item.stages?.length),
    )
    expect(broken.map((item) => item.id)).toEqual([])
  })

  it('keeps Garden Pass exclusives out of reach and everything else buyable', () => {
    for (const item of shopItems) {
      if (item.premium) {
        expect(`${item.id}: ${item.cost}`).toBe(`${item.id}: 0`)
      } else {
        expect(item.cost).toBeGreaterThan(0)
      }
    }
  })

  it('offers exactly one free flight pattern to start with', () => {
    const free = flightPatterns.filter((pattern) => pattern.cost === 0)
    expect(free.map((pattern) => pattern.id)).toEqual(['gentle-drift'])
  })
})
