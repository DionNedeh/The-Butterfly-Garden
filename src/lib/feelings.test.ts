import { describe, expect, it } from 'vitest'
import { energyLevels, feelings } from '../data/feelings'
import {
  checkInDetails,
  cleanFeelings,
  describeCheckInDetails,
  energyNameOf,
  feelingNamesOf,
  feelingsFromDraft,
  feelingsToDraft,
  isEnergyLevel,
  MAX_FEELINGS,
  toggleFeeling,
} from './feelings'

describe('the feeling words', () => {
  it('is a short, fixed list of distinct words', () => {
    expect(feelings.length).toBeGreaterThanOrEqual(16)
    expect(feelings.length).toBeLessThanOrEqual(20)
    const ids = feelings.map((feeling) => feeling.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const feeling of feelings) expect(feeling.name.trim()).not.toBe('')
  })

  it('is in alphabetical order, so neither comfortable nor difficult words come first', () => {
    const names = feelings.map((feeling) => feeling.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('offers the energy question in three steps, lowest first', () => {
    expect(energyLevels.map((level) => level.id)).toEqual(['low', 'steady', 'bright'])
  })
})

describe('a clean list of feelings', () => {
  it('keeps known ids once each, in the list’s order', () => {
    expect(cleanFeelings(['tired', 'hopeful', 'tired', 'calm'])).toEqual(['calm', 'hopeful', 'tired'])
  })

  it('drops unknown ids and anything that is not an id', () => {
    expect(cleanFeelings(['hopeful', 'ecstatic', 7, null, { id: 'calm' }])).toEqual(['hopeful'])
  })

  it('stores no list at all rather than an empty one', () => {
    expect(cleanFeelings([])).toBeUndefined()
    expect(cleanFeelings(['ecstatic'])).toBeUndefined()
    expect(cleanFeelings('tired')).toBeUndefined()
    expect(cleanFeelings(undefined)).toBeUndefined()
  })

  it(`holds at most ${MAX_FEELINGS}`, () => {
    const all = feelings.map((feeling) => feeling.id)
    expect(cleanFeelings(all)).toEqual(all.slice(0, MAX_FEELINGS))
  })
})

describe('energy', () => {
  it('is one of its three steps or nothing', () => {
    expect(isEnergyLevel('low')).toBe(true)
    expect(isEnergyLevel('bright')).toBe(true)
    expect(isEnergyLevel('high')).toBe(false)
    expect(isEnergyLevel(2)).toBe(false)
    expect(isEnergyLevel(undefined)).toBe(false)
  })

  it('is named in a word', () => {
    expect(energyNameOf('steady')).toBe('steady')
    expect(energyNameOf(undefined)).toBeUndefined()
  })
})

describe('the extras a check-in stores', () => {
  it('keeps only what was answered', () => {
    expect(checkInDetails({})).toEqual({})
    expect(checkInDetails({ feelings: [] })).toEqual({})
    expect(checkInDetails({ feelings: ['tired', 'calm'], energy: 'low' })).toEqual({
      feelings: ['calm', 'tired'],
      energy: 'low',
    })
    expect(checkInDetails({ energy: 'loud' as never })).toEqual({})
  })
})

describe('choosing feelings', () => {
  it('chooses and unchooses a word', () => {
    const chosen = toggleFeeling([], 'tired')
    expect(chosen).toEqual(['tired'])
    expect(toggleFeeling(chosen, 'calm')).toEqual(['calm', 'tired'])
    expect(toggleFeeling(['calm', 'tired'], 'calm')).toEqual(['tired'])
  })

  it('changes nothing at the limit, or for a word it does not know', () => {
    const full = feelings.slice(0, MAX_FEELINGS).map((feeling) => feeling.id)
    expect(toggleFeeling(full, 'tired')).toBe(full)
    expect(toggleFeeling(['calm'], 'ecstatic')).toEqual(['calm'])
    // Unchoosing still works at the limit.
    expect(toggleFeeling(full, full[0])).toEqual(full.slice(1))
  })
})

describe('a check-in’s extras in words', () => {
  it('names the feelings and the energy', () => {
    expect(describeCheckInDetails({ feelings: ['hopeful', 'tired'], energy: 'low' })).toBe(
      'Feeling hopeful, tired · Energy low',
    )
  })

  it('names either one alone', () => {
    expect(describeCheckInDetails({ feelings: ['calm'] })).toBe('Feeling calm')
    expect(describeCheckInDetails({ energy: 'bright' })).toBe('Energy bright')
  })

  it('says nothing when neither was answered', () => {
    expect(describeCheckInDetails({})).toBe('')
    expect(describeCheckInDetails({ feelings: [] })).toBe('')
  })

  it('skips a word this build does not know', () => {
    expect(feelingNamesOf(['calm', 'ecstatic'])).toEqual(['calm'])
    expect(feelingNamesOf(undefined)).toEqual([])
  })
})

describe('feelings kept as a draft', () => {
  it('survive the round trip, cleaned like anything stored', () => {
    expect(feelingsFromDraft(feelingsToDraft(['calm', 'tired']))).toEqual(['calm', 'tired'])
    expect(feelingsFromDraft('')).toEqual([])
    expect(feelingsFromDraft('tired,ecstatic,tired')).toEqual(['tired'])
  })
})
