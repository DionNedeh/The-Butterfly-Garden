import type { AppState, CreatureInstance } from '../types'

/**
 * What the garden writes down about each companion as it happens: how often
 * each kind of care was given, and the outfits worn. Kept from the day the
 * diary began (`Profile.diarySince`); what came before was never recorded, so
 * the story told from it (lib/companionStory) says so rather than guessing.
 *
 * Nothing here earns anything. Rewards are worked out by the rules that give
 * them (lib/lifecycle), and none of them reads the diary.
 */

/**
 * The most outfits one companion's diary lists. More than the closet holds,
 * so only a hand-edited garden ever reaches it; it keeps such a garden's
 * record from growing without end.
 */
export const MAX_OUTFITS_WORN = 100

/** The care counts with one more of this action. */
export function countCare(
  counts: CreatureInstance['careCounts'],
  actionId: string,
): Record<string, number> {
  return { ...counts, [actionId]: (counts?.[actionId] ?? 0) + 1 }
}

/**
 * The outfits worn, with these items added where they are new, in the order
 * given. The very same list when there is nothing new, so a companion that
 * puts on something it has worn before is not changed by it.
 */
export function noteWorn(
  worn: CreatureInstance['outfitsWorn'],
  itemIds: readonly string[],
): string[] | undefined {
  const known = worn ?? []
  const fresh = itemIds.filter(
    (itemId, index) => !known.includes(itemId) && itemIds.indexOf(itemId) === index,
  )
  if (fresh.length === 0) return worn
  return [...known, ...fresh].slice(0, MAX_OUTFITS_WORN)
}

/**
 * The garden's profile with the diary begun, if it had not begun already. A
 * new garden begins it when it is made; an older one with the first thing
 * written down, so the date is when the diary really started.
 */
export function diaryBegun(
  profile: AppState['profile'],
  now: Date,
): AppState['profile'] {
  if (!profile || profile.diarySince) return profile
  return { ...profile, diarySince: now.toISOString() }
}

/**
 * Saved looks (lib/outfitPresets) are kept within limits set here, beside
 * the diary, because storage checks both (validateGarden) and loads this
 * module, not the looks' rules.
 */

/** As many looks as the closet keeps. */
export const MAX_OUTFIT_PRESETS = 12

/** The longest a look's name is, the same as a companion's. */
export const PRESET_NAME_LENGTH = 40

/** A look's name as it is kept: trimmed, and no longer than PRESET_NAME_LENGTH. */
export function presetName(name: string): string {
  return name.trim().slice(0, PRESET_NAME_LENGTH).trim()
}
