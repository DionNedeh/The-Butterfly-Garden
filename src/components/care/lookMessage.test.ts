import { describe, expect, it } from 'vitest'
import { describeLookWorn } from './lookMessage'

const sol = { name: 'Sol', stage: 'egg' as const }
const look = { name: 'Sunday best' }

describe('what wearing a look came to', () => {
  it('says plainly when every piece went on', () => {
    expect(describeLookWorn(sol, look, { worn: ['silk-bow'], skipped: [] })).toBe(
      'Sol is wearing Sunday best.',
    )
  })

  it('names each piece left off, and why', () => {
    expect(
      describeLookWorn(sol, look, {
        worn: ['silk-bow'],
        skipped: [{ itemId: 'star-diadem', reason: 'stage' }],
      }),
    ).toBe('Sol is wearing Sunday best, leaving out one piece. Star Diadem doesn’t fit an egg.')

    expect(
      describeLookWorn({ name: 'Fern', stage: 'chrysalis' }, look, {
        worn: ['silk-bow'],
        skipped: [
          { itemId: 'sprout-cap', reason: 'stage' },
          { itemId: 'leaf-scarf', reason: 'stage' },
          { itemId: 'royal-crown', reason: 'pass' },
          { itemId: 'petal-swirl', reason: 'closet' },
        ],
      }),
    ).toBe(
      'Fern is wearing Sunday best, leaving out four pieces. Sprout Cap and Leaf Scarf ' +
        'don’t fit a chrysalis. Royal Monarch Crown comes with the Garden Pass. ' +
        'Petal Swirl isn’t in your closet.',
    )
  })

  it('agrees with more than one piece left off for the same reason', () => {
    expect(
      describeLookWorn(sol, look, {
        worn: [],
        skipped: [
          { itemId: 'royal-crown', reason: 'pass' },
          { itemId: 'aurora-aura', reason: 'pass' },
          { itemId: 'sprout-cap', reason: 'closet' },
          { itemId: 'silk-bow', reason: 'closet' },
        ],
      }),
    ).toBe(
      'Sol’s outfit is as it was: nothing in Sunday best can be worn now. ' +
        'Royal Monarch Crown and Aurora Veil come with the Garden Pass. ' +
        'Sprout Cap and Silk Bow aren’t in your closet.',
    )
  })
})
