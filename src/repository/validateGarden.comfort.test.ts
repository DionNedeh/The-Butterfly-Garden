import { describe, expect, it } from 'vitest'
import { COMFORT_ITEMS, COMFORT_TEXT_LENGTH, PHONE_LENGTH } from '../lib/comfortPlan'
import { createInitialState } from '../lib/progression'
import { validateGarden } from './validateGarden'

const seed = createInitialState('Tester', 'Test Garden')

/** A garden whose profile holds this comfort plan, where the page keeps it. */
function withPlan(comfortPlan: unknown) {
  return { ...seed, profile: { ...seed.profile!, comfortPlan } }
}

const planOf = (comfortPlan: unknown) => validateGarden(withPlan(comfortPlan)).state?.profile?.comfortPlan

const tea = { id: 'tea', text: 'A cup of tea' }
const sam = { id: 'sam', text: 'Sam', phone: '+44 7700 900123' }

describe('a comfort plan in storage', () => {
  it('keeps a well-formed plan in the profile as the very same object', () => {
    const plan = {
      helps: [tea],
      people: [sam, { id: 'jo', text: 'Jo' }],
      places: [{ id: 'bench', text: 'The bench by the river' }],
      kindWords: [{ id: 'kind', text: 'I am doing my best.' }],
      matters: [{ id: 'cat', text: 'My cat' }],
    }
    const stored = withPlan(plan)
    const result = validateGarden(stored)
    expect(result.refused).toBeUndefined()
    expect(result.repaired).toBe(0)
    expect(result.state?.profile?.comfortPlan).toBe(plan)
    // And the same through a backup's JSON.
    expect(planOf(JSON.parse(JSON.stringify(plan)))).toEqual(plan)
  })

  it('leaves a profile from 3.1, which has no plan, exactly as it was', () => {
    const profile = {
      ...seed.profile!,
      region: 'europe',
      letterQuotes: 'never',
      outfitPresets: [{ id: 'look', name: 'Sunday best', outfit: { headwear: 'sprout-cap' } }],
    }
    const result = validateGarden({ ...seed, profile })
    expect(result.repaired).toBe(0)
    expect(result.state?.profile).not.toHaveProperty('comfortPlan')
    expect(result.state?.profile).toEqual(profile)
  })

  it('trims each line and keeps no more of it than the page does', () => {
    expect(
      planOf({
        helps: [
          { id: 'a', text: '  A warm drink  ' },
          { id: 'b', text: 'b'.repeat(COMFORT_TEXT_LENGTH + 40) },
        ],
      }),
    ).toEqual({
      helps: [
        { id: 'a', text: 'A warm drink' },
        { id: 'b', text: 'b'.repeat(COMFORT_TEXT_LENGTH) },
      ],
    })
  })

  it('keeps a person’s number in the characters a number has, and drops one with no digits', () => {
    expect(
      planOf({
        people: [
          { id: 'a', text: 'Ana', phone: '(555) 123.4567' },
          { id: 'b', text: 'Bo', phone: 'call me' },
          { id: 'c', text: 'Cy', phone: 5551234 },
          { id: 'd', text: 'Di', phone: '' },
          { id: 'e', text: 'Ed', phone: '1'.repeat(PHONE_LENGTH + 8) },
        ],
      }),
    ).toEqual({
      people: [
        { id: 'a', text: 'Ana', phone: '555 123 4567' },
        { id: 'b', text: 'Bo' },
        { id: 'c', text: 'Cy' },
        { id: 'd', text: 'Di' },
        { id: 'e', text: 'Ed', phone: '1'.repeat(PHONE_LENGTH) },
      ],
    })
  })

  it('keeps a number for a person only', () => {
    expect(planOf({ places: [{ id: 'p', text: 'The park', phone: '999' }] })).toEqual({
      places: [{ id: 'p', text: 'The park' }],
    })
  })

  it('drops what is not a line with words, and anything else a line carries', () => {
    expect(
      planOf({
        helps: [
          tea,
          { id: 'blank', text: '   ' },
          { id: 'number', text: 7 },
          { id: 'none' },
          'A walk',
          null,
          { ...tea, id: 'extra', note: 'not kept', starred: true },
        ],
      }),
    ).toEqual({ helps: [tea, { id: 'extra', text: 'A cup of tea' }] })
  })

  it('gives a line with no id of its own, or a twin’s, an id rather than losing its words', () => {
    const plan = planOf({
      helps: [tea, { id: 'tea', text: 'Twin' }, { text: 'No id' }, { id: '', text: 'Empty id' }, { id: 4, text: 'Odd id' }],
      places: [{ id: 'tea', text: 'Twin across lists' }],
    })
    const ids = [...plan!.helps!, ...plan!.places!].map((line) => line.id)
    expect(plan?.helps?.map((line) => line.text)).toEqual(['A cup of tea', 'Twin', 'No id', 'Empty id', 'Odd id'])
    expect(plan?.places?.map((line) => line.text)).toEqual(['Twin across lists'])
    expect(ids[0]).toBe('tea')
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toEqual(expect.any(String))
  })

  it('keeps no more lines than a list holds, the first ones', () => {
    const many = Array.from({ length: COMFORT_ITEMS + 4 }, (_, index) => ({ id: `m${index}`, text: `Line ${index}` }))
    const lines = planOf({ matters: many })?.matters
    expect(lines).toHaveLength(COMFORT_ITEMS)
    expect(lines?.[0].id).toBe('m0')
    expect(lines?.at(-1)?.id).toBe(`m${COMFORT_ITEMS - 1}`)
  })

  it('drops unknown lists, and lists that are not lists', () => {
    expect(planOf({ helps: [tea], warnings: [tea], people: 'Sam', places: { tea } })).toEqual({ helps: [tea] })
  })

  it('keeps an emptied plan, or an odd value, as no plan at all', () => {
    for (const odd of ['plan', 4, null, [], [tea], {}, { helps: [] }, { helps: [null] }, { other: [tea] }]) {
      const profile = validateGarden(withPlan(odd)).state?.profile
      expect(profile).not.toHaveProperty('comfortPlan')
      expect(profile?.gardenName).toBe('Test Garden')
    }
  })

  it('leaves what it was given as it was', () => {
    const plan = { helps: [{ id: 'a', text: '  padded  ' }], warnings: [tea] }
    const copy = structuredClone(plan)
    expect(planOf(plan)).not.toBe(plan)
    expect(plan).toEqual(copy)
  })
})
