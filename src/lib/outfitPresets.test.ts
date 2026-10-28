import { describe, expect, it } from 'vitest'
import type { AppState, CreatureInstance, OutfitPreset } from '../types'
import { MAX_OUTFIT_PRESETS, PRESET_NAME_LENGTH } from './companionDiary'
import {
  deleteOutfitPreset,
  presetFor,
  presetSaveProblem,
  renameOutfitPreset,
  restoreOutfitPreset,
  saveOutfitPreset,
  suggestPresetName,
} from './outfitPresets'
import { createEmptyState, createInitialState } from './progression'

function creature(overrides: Partial<CreatureInstance> = {}): CreatureInstance {
  return {
    id: 'sol',
    speciesId: 'monarch',
    name: 'Sol',
    stage: 'butterfly',
    careDates: {},
    actionLog: {},
    bond: 0,
    outfit: { headwear: 'sprout-cap', accessory: 'silk-bow' },
    carePoints: 0,
    discoveredAt: '2026-06-01T09:00:00.000Z',
    ...overrides,
  }
}

function look(id: string, name = id, outfit: OutfitPreset['outfit'] = { aura: 'sparkle-aura' }) {
  return { id, name, outfit }
}

/** A garden with Sol in it, and these looks kept in its profile, where they are stored. */
function garden({ looks, ...overrides }: Partial<AppState> & { looks?: OutfitPreset[] } = {}): AppState {
  const { profile } = createInitialState('Tester', 'Test Garden')
  return {
    ...createEmptyState(),
    profile: looks ? { ...profile!, outfitPresets: looks } : profile,
    creatures: [creature()],
    ...overrides,
  }
}

/** The looks a garden keeps, read where they are stored. */
function looksOf(state: AppState): OutfitPreset[] | undefined {
  return state.profile?.outfitPresets
}

describe('saving a look', () => {
  it('keeps the companion’s outfit under the name given, trimmed', () => {
    const saved = saveOutfitPreset(garden(), 'sol', '  Sunday best  ')
    expect(looksOf(saved)).toEqual([
      {
        id: expect.any(String),
        name: 'Sunday best',
        outfit: { headwear: 'sprout-cap', accessory: 'silk-bow' },
      },
    ])
  })

  it('takes the suggested name when none is given', () => {
    const saved = saveOutfitPreset(garden(), 'sol', '   ')
    expect(looksOf(saved)?.[0].name).toBe('Sol’s look')
  })

  it('keeps only the pieces, not the empty slots', () => {
    const state = garden({ creatures: [creature({ outfit: { headwear: 'sprout-cap', aura: '' } })] })
    expect(looksOf(saveOutfitPreset(state, 'sol', 'Cap'))?.[0].outfit).toEqual({
      headwear: 'sprout-cap',
    })
  })

  it('changes nothing when there is nothing to save, or no room', () => {
    const bare = garden({ creatures: [creature({ outfit: {} })] })
    expect(saveOutfitPreset(bare, 'sol', 'Nothing')).toBe(bare)
    const unknown = garden()
    expect(saveOutfitPreset(unknown, 'nobody', 'Look')).toBe(unknown)
    const full = garden({
      looks: Array.from({ length: MAX_OUTFIT_PRESETS }, (_, index) => look(`look-${index}`)),
    })
    expect(saveOutfitPreset(full, 'sol', 'One more')).toBe(full)
    const saved = saveOutfitPreset(garden(), 'sol', 'Sunday best')
    expect(saveOutfitPreset(saved, 'sol', 'Again')).toBe(saved)
  })

  it('says why a look cannot be saved', () => {
    const outfit = { headwear: 'sprout-cap' }
    expect(presetSaveProblem([], {})).toBe('empty')
    expect(presetSaveProblem([look('a', 'A', { headwear: 'sprout-cap' })], outfit)).toBe('saved')
    const full = Array.from({ length: MAX_OUTFIT_PRESETS }, (_, index) => look(`look-${index}`))
    expect(presetSaveProblem(full, outfit)).toBe('full')
    expect(presetSaveProblem([], outfit)).toBeUndefined()
  })

  it('finds the look that holds exactly an outfit', () => {
    const cap = look('cap', 'Cap', { headwear: 'sprout-cap' })
    expect(presetFor([cap], { headwear: 'sprout-cap' })).toBe(cap)
    expect(presetFor([cap], { headwear: 'sprout-cap', accessory: 'silk-bow' })).toBeUndefined()
    expect(presetFor([cap], { headwear: 'sprout-cap', aura: undefined })).toBe(cap)
  })

  it('suggests a name no other look has', () => {
    expect(suggestPresetName([], 'Sol')).toBe('Sol’s look')
    expect(suggestPresetName([look('a', 'sol’s look')], 'Sol')).toBe('Sol’s look 2')
    expect(
      suggestPresetName([look('a', 'Sol’s look'), look('b', 'Sol’s look 2')], 'Sol'),
    ).toBe('Sol’s look 3')
    const long = 'L'.repeat(PRESET_NAME_LENGTH)
    expect(suggestPresetName([], long)).toHaveLength(PRESET_NAME_LENGTH)
    const taken = suggestPresetName([], long)
    expect(suggestPresetName([look('a', taken)], long).length).toBeLessThanOrEqual(PRESET_NAME_LENGTH)
    expect(suggestPresetName([look('a', taken)], long)).toMatch(/ 2$/)
  })
})

describe('where the looks are kept', () => {
  it('keeps them in the profile, beside everything else it holds', () => {
    const before = garden()
    const saved = saveOutfitPreset(before, 'sol', 'Sunday best')
    // In the profile, which every older build carries through whole, and
    // never beside it, where an older build's save would leave it behind.
    expect(saved).not.toHaveProperty('outfitPresets')
    expect(looksOf(saved)).toHaveLength(1)
    expect(saved.profile).toEqual({ ...before.profile, outfitPresets: looksOf(saved) })
    // Updates replace, never mutate: the garden saved from is as it was.
    expect(before.profile).not.toHaveProperty('outfitPresets')
  })

  it('leaves no list behind when the last look is deleted', () => {
    const state = garden({ looks: [look('a')] })
    const emptied = deleteOutfitPreset(state, 'a')
    expect(emptied.profile).not.toHaveProperty('outfitPresets')
    expect(emptied.profile?.gardenName).toBe('Test Garden')
    expect(looksOf(restoreOutfitPreset(emptied, look('a'), 0))).toEqual([look('a')])
  })

  it('keeps nothing in a garden with no profile yet to keep it in', () => {
    const unmade = garden({ profile: undefined })
    expect(saveOutfitPreset(unmade, 'sol', 'Sunday best')).toBe(unmade)
    expect(restoreOutfitPreset(unmade, look('a'), 0)).toBe(unmade)
  })
})

describe('renaming, deleting and putting back a look', () => {
  const looks = [look('a', 'Sunday best'), look('b', 'Rainy day')]

  it('renames a look, trimmed', () => {
    const state = garden({ looks })
    const renamed = renameOutfitPreset(state, 'b', '  Puddles  ')
    expect(looksOf(renamed)?.map((preset) => preset.name)).toEqual(['Sunday best', 'Puddles'])
    expect(looksOf(renamed)?.[0]).toBe(looks[0])
  })

  it('changes nothing for an empty, unchanged or unknown name', () => {
    const state = garden({ looks })
    expect(renameOutfitPreset(state, 'a', '   ')).toBe(state)
    expect(renameOutfitPreset(state, 'a', 'Sunday best ')).toBe(state)
    expect(renameOutfitPreset(state, 'nope', 'New')).toBe(state)
    expect(looksOf(renameOutfitPreset(garden(), 'a', 'New'))).toBeUndefined()
  })

  it('deletes a look, and puts it back where it was', () => {
    const state = garden({ looks: [...looks, look('c', 'Party')] })
    const deleted = deleteOutfitPreset(state, 'b')
    expect(looksOf(deleted)?.map((preset) => preset.id)).toEqual(['a', 'c'])
    expect(deleteOutfitPreset(deleted, 'b')).toBe(deleted)

    const back = restoreOutfitPreset(deleted, looks[1], 1)
    expect(looksOf(back)?.map((preset) => preset.id)).toEqual(['a', 'b', 'c'])
    // Once back, it is not doubled.
    expect(restoreOutfitPreset(back, looks[1], 1)).toBe(back)
  })

  it('puts a look back at the end when the list has shrunk, and not into a full closet', () => {
    const state = garden({ looks: [looks[0]] })
    expect(looksOf(restoreOutfitPreset(state, looks[1], 5))?.map((preset) => preset.id)).toEqual([
      'a',
      'b',
    ])
    expect(looksOf(restoreOutfitPreset(garden(), looks[1], 3))).toEqual([looks[1]])
    const full = garden({
      looks: Array.from({ length: MAX_OUTFIT_PRESETS }, (_, index) => look(`look-${index}`)),
    })
    expect(restoreOutfitPreset(full, looks[1], 0)).toBe(full)
  })
})
