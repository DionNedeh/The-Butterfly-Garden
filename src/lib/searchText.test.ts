import { describe, expect, it } from 'vitest'
import { hasEveryWord, normaliseForSearch, searchWords } from './searchText'

describe('searchText', () => {
  it('splits a query into normalised words, and a blank one into none', () => {
    expect(searchWords('  Spangled  FRITILLARY ')).toEqual(['spangled', 'fritillary'])
    expect(searchWords('Pōhuehue')).toEqual(['pohuehue'])
    expect(searchWords('   ')).toEqual([])
  })

  it('finds text holding every word, in any order', () => {
    const text = normaliseForSearch('Nectar and Stardust: two currencies')
    expect(hasEveryWord(text, searchWords('stardust nectar'))).toBe(true)
    expect(hasEveryWord(text, searchWords('stardust sunlight'))).toBe(false)
    expect(hasEveryWord(text, [])).toBe(true)
  })
})
