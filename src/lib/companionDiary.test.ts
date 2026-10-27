import { describe, expect, it } from 'vitest'
import { createInitialState } from './progression'
import {
  countCare,
  diaryBegun,
  MAX_OUTFITS_WORN,
  noteWorn,
  PRESET_NAME_LENGTH,
  presetName,
} from './companionDiary'

describe('a companion’s diary', () => {
  it('counts each kind of care, starting from nothing', () => {
    expect(countCare(undefined, 'cat-play')).toEqual({ 'cat-play': 1 })
    const counts = { 'cat-play': 2, 'cat-tuck': 1 }
    expect(countCare(counts, 'cat-play')).toEqual({ 'cat-play': 3, 'cat-tuck': 1 })
    // A new record, never the one it was given.
    expect(counts).toEqual({ 'cat-play': 2, 'cat-tuck': 1 })
  })

  it('notes each outfit once, in the order first worn', () => {
    expect(noteWorn(undefined, ['silk-bow'])).toEqual(['silk-bow'])
    expect(noteWorn(['silk-bow'], ['sprout-cap', 'silk-bow', 'sprout-cap'])).toEqual([
      'silk-bow',
      'sprout-cap',
    ])
  })

  it('hands back the very same list when nothing is new', () => {
    const worn = ['silk-bow', 'sprout-cap']
    expect(noteWorn(worn, ['sprout-cap'])).toBe(worn)
    expect(noteWorn(undefined, [])).toBeUndefined()
  })

  it('stops noting outfits once the diary is full', () => {
    const full = Array.from({ length: MAX_OUTFITS_WORN }, (_, index) => `piece-${index}`)
    expect(noteWorn(full, ['one-more'])).toHaveLength(MAX_OUTFITS_WORN)
    expect(noteWorn(full, ['one-more'])).not.toContain('one-more')
  })

  it('begins once, and keeps the day it began', () => {
    const garden = createInitialState('Tester', 'Test Garden', new Date('2026-03-01T09:00:00Z'))
    const older = { ...garden.profile!, diarySince: undefined }
    const now = new Date('2026-10-27T12:00:00Z')

    const begun = diaryBegun(older, now)
    expect(begun?.diarySince).toBe('2026-10-27T12:00:00.000Z')
    expect(diaryBegun(begun, new Date('2026-11-01T12:00:00Z'))).toBe(begun)
    expect(diaryBegun(undefined, now)).toBeUndefined()
  })

  it('begins with a new garden', () => {
    const made = new Date('2026-03-01T09:00:00Z')
    expect(createInitialState('Tester', 'Test Garden', made).profile?.diarySince).toBe(
      made.toISOString(),
    )
  })
})

describe('a saved look’s name', () => {
  it('is trimmed and no longer than a companion’s', () => {
    expect(presetName('  Sunday best  ')).toBe('Sunday best')
    expect(presetName('x'.repeat(PRESET_NAME_LENGTH + 10))).toHaveLength(PRESET_NAME_LENGTH)
    // A cut that ends in a space leaves no space at the end.
    expect(presetName(`${'a'.repeat(PRESET_NAME_LENGTH - 1)} b`)).toBe(
      'a'.repeat(PRESET_NAME_LENGTH - 1),
    )
    expect(presetName('   ')).toBe('')
  })
})
