import type { AppState, OutfitPreset, OutfitSlot } from '../types'
import { MAX_OUTFIT_PRESETS, PRESET_NAME_LENGTH, presetName } from './companionDiary'
import { createId } from './id'
import { sameOutfit } from './wardrobe'

/**
 * Saved looks: a companion's outfit kept under a name, to put on any
 * companion later in one go rather than slot by slot. The closet is shared,
 * so a look holds item ids only; whoever wears it next is checked then,
 * piece by piece, for what the gardener owns and what fits
 * (wearOutfitPreset, in lib/wardrobe beside the wardrobe's other rules).
 *
 * The looks' limits live with the companions' diary (lib/companionDiary),
 * which storage loads to check a stored look (validateGarden), so storage
 * loads neither these rules nor the shop.
 */

type Outfit = Partial<Record<OutfitSlot, string>>

/** The pieces of an outfit, leaving out empty slots. */
function piecesOf(outfit: Outfit): Outfit {
  const pieces: Outfit = {}
  for (const [slot, itemId] of Object.entries(outfit) as [OutfitSlot, string | undefined][]) {
    if (itemId) pieces[slot] = itemId
  }
  return pieces
}

/** The saved look that holds exactly this outfit, if there is one. */
export function presetFor(
  presets: readonly OutfitPreset[],
  outfit: Outfit,
): OutfitPreset | undefined {
  return presets.find((preset) => sameOutfit(preset.outfit, outfit))
}

/** A name for a new look that no other look has: "Sol’s look", then "Sol’s look 2". */
export function suggestPresetName(presets: readonly OutfitPreset[], creatureName: string): string {
  const base = presetName(`${creatureName}’s look`)
  const taken = new Set(presets.map((preset) => preset.name.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let count = 2; ; count += 1) {
    const name = presetName(`${base.slice(0, PRESET_NAME_LENGTH - 3)} ${count}`)
    if (!taken.has(name.toLowerCase())) return name
  }
}

/**
 * Why this outfit cannot be saved as a look: there is nothing on, the closet
 * already keeps as many looks as it can, or this very look is saved already.
 */
export type PresetSaveProblem = 'empty' | 'full' | 'saved'

export function presetSaveProblem(
  presets: readonly OutfitPreset[],
  outfit: Outfit,
): PresetSaveProblem | undefined {
  if (Object.keys(piecesOf(outfit)).length === 0) return 'empty'
  if (presetFor(presets, outfit)) return 'saved'
  if (presets.length >= MAX_OUTFIT_PRESETS) return 'full'
  return undefined
}

/**
 * Save a companion's outfit as a look. A name left empty takes the one
 * suggested. The very same garden comes back when there is nothing to save
 * (see presetSaveProblem).
 */
export function saveOutfitPreset(state: AppState, creatureId: string, name: string): AppState {
  const creature = state.creatures.find((entry) => entry.id === creatureId)
  const presets = state.outfitPresets ?? []
  if (!creature || presetSaveProblem(presets, creature.outfit)) return state
  const preset: OutfitPreset = {
    id: createId(),
    name: presetName(name) || suggestPresetName(presets, creature.name),
    outfit: piecesOf(creature.outfit),
  }
  return { ...state, outfitPresets: [...presets, preset] }
}

export function renameOutfitPreset(state: AppState, presetId: string, name: string): AppState {
  const presets = state.outfitPresets ?? []
  const index = presets.findIndex((preset) => preset.id === presetId)
  const named = presetName(name)
  if (index === -1 || !named || presets[index].name === named) return state
  const outfitPresets = [...presets]
  outfitPresets[index] = { ...presets[index], name: named }
  return { ...state, outfitPresets }
}

export function deleteOutfitPreset(state: AppState, presetId: string): AppState {
  const presets = state.outfitPresets ?? []
  if (!presets.some((preset) => preset.id === presetId)) return state
  return { ...state, outfitPresets: presets.filter((preset) => preset.id !== presetId) }
}

/**
 * Put back a look that was just deleted, where it was: what makes Delete
 * undoable. One already back is left alone, and a closet filled again in
 * the meantime is not overfilled.
 */
export function restoreOutfitPreset(state: AppState, preset: OutfitPreset, index: number): AppState {
  const presets = state.outfitPresets ?? []
  if (presets.some((entry) => entry.id === preset.id) || presets.length >= MAX_OUTFIT_PRESETS) {
    return state
  }
  const outfitPresets = [...presets]
  outfitPresets.splice(Math.max(0, Math.min(index, presets.length)), 0, preset)
  return { ...state, outfitPresets }
}
