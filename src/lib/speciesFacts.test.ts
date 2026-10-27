import { describe, expect, it } from 'vitest'
import { FACT_BOND_LEVELS, factsShared, nextFactLevel } from './speciesFacts'

describe('facts shared as a bond grows', () => {
  it('shares the first fact from the start, the second at level 3 and the third at 5', () => {
    expect(FACT_BOND_LEVELS).toEqual([1, 3, 5])
    expect(factsShared(1)).toBe(1)
    expect(factsShared(2)).toBe(1)
    expect(factsShared(3)).toBe(2)
    expect(factsShared(4)).toBe(2)
    expect(factsShared(5)).toBe(3)
    expect(factsShared(40)).toBe(3)
  })

  it('names the level that shares the next one, until all three are shared', () => {
    expect(nextFactLevel(1)).toBe(3)
    expect(nextFactLevel(2)).toBe(3)
    expect(nextFactLevel(3)).toBe(5)
    expect(nextFactLevel(4)).toBe(5)
    expect(nextFactLevel(5)).toBeUndefined()
  })
})
