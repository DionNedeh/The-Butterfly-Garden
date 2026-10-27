import { describe, expect, it } from 'vitest'
import { plants, species } from '../data/content'
import { matchingChoices, subjectChoices } from './sightingChoices'
import { searchWords } from './searchText'

describe('what the sighting form offers', () => {
  it('lists the field guide in its own order without a region', () => {
    expect(subjectChoices('butterfly', undefined).map((item) => item.name)).toEqual(
      species.map((item) => item.commonName),
    )
    expect(subjectChoices('plant', undefined).map((item) => item.name)).toEqual(
      plants.map((item) => item.name),
    )
    expect(subjectChoices('butterfly', 'elsewhere').every((item) => item.mark === undefined)).toBe(true)
  })

  it('puts the region’s native butterflies first, then those seen there, then the rest', () => {
    const europe = subjectChoices('butterfly', 'europe')
    const ranks = europe.map((item) => (item.mark ? (item.mark.presence === 'native' ? 0 : 1) : 2))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(europe[0].name).toBe('Red Admiral')
    expect(europe[0].mark?.label).toBe('Native to the UK and Europe')
    const seen = europe.filter((item) => item.mark?.presence === 'seen').map((item) => item.name)
    expect(seen).toContain('Monarch')
    // Within each group, the guide's order holds.
    const native = europe.filter((item) => item.mark?.presence === 'native').map((item) => item.name)
    expect(native).toEqual(['Red Admiral', 'Painted Lady', 'Mourning Cloak', 'Cabbage White'])
  })

  it('puts a region’s native plants first in Australia and New Zealand', () => {
    const choices = subjectChoices('plant', 'australasia')
    const native = choices.filter((item) => item.mark).map((item) => item.name)
    expect(choices.slice(0, native.length).map((item) => item.name)).toEqual(native)
    expect(native).toContain('Violet')
    expect(choices[0].subject).toEqual({ kind: 'plant', plantId: choices[0].key.slice('plant:'.length) })
  })

  it('finds a choice by any of its words, its scientific name or its mark, forgiving case', () => {
    const choices = subjectChoices('butterfly', 'north-america')
    const find = (query: string) => matchingChoices(choices, searchWords(query)).map((item) => item.name)
    expect(find('lady')).toEqual(['Painted Lady', 'American Lady'])
    expect(find('DANAUS')).toEqual(['Monarch', 'Queen'])
    expect(find('swallowtail black')).toEqual(['Black Swallowtail'])
    expect(find('dragonfly')).toEqual([])
    expect(find('')).toHaveLength(species.length)
  })
})
