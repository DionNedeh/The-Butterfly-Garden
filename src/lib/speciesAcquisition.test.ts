import { describe, expect, it } from 'vitest'
import { plants, species } from '../data/content'
import { createEmptyState, createInitialState } from './progression'
import {
  distinctSpeciesDiscovered,
  distinctSpeciesRaised,
  hostPlantsForSpecies,
  nextSpeciesForPlant,
  selectDiscoveryCandidate,
  speciesAcquisitionRecords,
} from './speciesAcquisition'
import type { AppState, CreatureInstance, CreatureStage } from '../types'

function creature(
  speciesId: string,
  stage: CreatureStage = 'butterfly',
): CreatureInstance {
  return {
    id: `creature-${speciesId}-${stage}`,
    speciesId,
    name: 'Test',
    stage,
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: {},
    carePoints: 0,
    discoveredAt: '2026-09-01T00:00:00.000Z',
  }
}

function gardenWith(creatures: CreatureInstance[]): AppState {
  return { ...createEmptyState(), creatures }
}

describe('choosing which species a plant reveals', () => {
  it('prefers a species never seen before', () => {
    // Milkweed hosts Monarch then Queen. A garden that already has a Monarch
    // should meet a Queen next rather than a second Monarch.
    const garden = gardenWith([creature('monarch', 'caterpillar')])
    expect(nextSpeciesForPlant(garden, 'milkweed')).toBe('queen')
  })

  it('starts a shared host with the first species in catalog order', () => {
    expect(nextSpeciesForPlant(createEmptyState(), 'milkweed')).toBe('monarch')
    expect(nextSpeciesForPlant(createEmptyState(), 'passionflower')).toBe(
      'gulf-fritillary',
    )
    expect(nextSpeciesForPlant(createEmptyState(), 'willow')).toBe('viceroy')
  })

  it('repeats a species only once its companion has emerged', () => {
    const growing = gardenWith([
      creature('monarch', 'chrysalis'),
      creature('queen', 'caterpillar'),
    ])
    // Both are mid-development, so nothing is eligible yet.
    expect(nextSpeciesForPlant(growing, 'milkweed')).toBeUndefined()

    const grown = gardenWith([
      creature('monarch', 'butterfly'),
      creature('queen', 'caterpillar'),
    ])
    expect(nextSpeciesForPlant(grown, 'milkweed')).toBe('monarch')
  })

  it('matches the starter garden the app actually creates', () => {
    // createInitialState seeds Sol as a Monarch caterpillar on milkweed.
    const starter = createInitialState('Tester', 'Test Garden')
    expect(nextSpeciesForPlant(starter, 'milkweed')).toBe('queen')
  })

  it('returns nothing for a nectar plant or an unknown id', () => {
    expect(nextSpeciesForPlant(createEmptyState(), 'aster')).toBeUndefined()
    expect(nextSpeciesForPlant(createEmptyState(), 'not-a-plant')).toBeUndefined()
  })

  it('reproduces the original selection rule exactly', () => {
    // The rule this replaced, kept here verbatim. Extracting a selector that
    // subtly reorders discovery would rewrite which butterflies gardeners meet.
    const original = (creatures: CreatureInstance[], ids: string[]) =>
      ids.find((id) => !creatures.some((c) => c.speciesId === id)) ??
      ids.find(
        (id) => !creatures.some((c) => c.speciesId === id && c.stage !== 'butterfly'),
      )

    const stages: CreatureStage[] = ['egg', 'caterpillar', 'chrysalis', 'butterfly']
    for (const plant of plants) {
      for (const stage of stages) {
        for (const seeded of plant.speciesIds) {
          const creatures = [creature(seeded, stage)]
          expect(selectDiscoveryCandidate(creatures, plant.speciesIds)).toBe(
            original(creatures, plant.speciesIds),
          )
        }
      }
      expect(selectDiscoveryCandidate([], plant.speciesIds)).toBe(
        original([], plant.speciesIds),
      )
    }
  })
})

describe('the species directory', () => {
  it('covers every species in the catalog', () => {
    const records = speciesAcquisitionRecords(createEmptyState())
    expect(records).toHaveLength(species.length)
    expect(new Set(records.map((row) => row.speciesId)).size).toBe(species.length)
  })

  it('gives every species at least one host plant to sow', () => {
    // A species with no route into the garden is unreachable content.
    for (const row of speciesAcquisitionRecords(createEmptyState())) {
      expect(row.hostPlantIds.length).toBeGreaterThan(0)
      expect(row.hostPlantNames.length).toBe(row.hostPlantIds.length)
    }
  })

  it('keeps host relationships reciprocal', () => {
    for (const entry of species) {
      const hosts = hostPlantsForSpecies(entry.id).map((plant) => plant.id)
      for (const hostId of entry.hostPlantIds) {
        expect(hosts).toContain(hostId)
      }
    }
  })

  it('names the other species that share a host', () => {
    const records = speciesAcquisitionRecords(createEmptyState())
    const monarch = records.find((row) => row.speciesId === 'monarch')
    expect(monarch?.sharedWith).toEqual(['queen'])
    const buckeye = records.find((row) => row.speciesId === 'common-buckeye')
    expect(buckeye?.sharedWith).toEqual([])
  })

  it('reports progress separately for developing and raised species', () => {
    const garden = gardenWith([
      creature('monarch', 'butterfly'),
      creature('queen', 'egg'),
    ])
    const records = speciesAcquisitionRecords(garden)
    const by = (id: string) => records.find((row) => row.speciesId === id)?.progress
    expect(by('monarch')).toBe('raised')
    expect(by('queen')).toBe('developing')
    expect(by('atala')).toBe('undiscovered')
  })
})

describe('counting species rather than creatures', () => {
  it('counts two of the same butterfly as one species', () => {
    // The Garden's "species welcomed" figure used the creature count, so a
    // second Monarch read as a second species.
    const garden = gardenWith([
      creature('monarch', 'butterfly'),
      creature('monarch', 'butterfly'),
      creature('queen', 'butterfly'),
    ])
    expect(garden.creatures).toHaveLength(3)
    expect(distinctSpeciesRaised(garden)).toBe(2)
  })

  it('counts only emerged butterflies as raised', () => {
    const garden = gardenWith([
      creature('monarch', 'butterfly'),
      creature('queen', 'chrysalis'),
    ])
    expect(distinctSpeciesRaised(garden)).toBe(1)
    expect(distinctSpeciesDiscovered(garden)).toBe(2)
  })

  it('counts nothing in an empty garden', () => {
    expect(distinctSpeciesRaised(createEmptyState())).toBe(0)
    expect(distinctSpeciesDiscovered(createEmptyState())).toBe(0)
  })
})
