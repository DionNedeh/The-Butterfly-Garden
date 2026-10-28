import { getShopItem } from '../../data/shopItems'
import type { LookSkip, LookSkipReason, WearLookResult } from '../../lib/wardrobe'
import { countedInWords, listed } from '../../lib/plural'
import type { CreatureInstance, CreatureStage, OutfitPreset } from '../../types'

function aStage(stage: CreatureStage): string {
  return stage === 'egg' ? 'an egg' : `a ${stage}`
}

function pieceNames(skips: readonly LookSkip[]): string {
  return listed(skips.map((skip) => getShopItem(skip.itemId)?.name ?? skip.itemId))
}

/**
 * What wearing a look came to, in words: "Sol is wearing Sunday best,
 * leaving out one piece. Star Diadem doesn’t fit an egg." Pieces left off
 * are named with their reason, so a look that only partly fits never looks
 * like a mistake. Kept beside the Care page rather than in lib/wardrobe,
 * which the app shell loads: only Care ever says these.
 */
export function describeLookWorn(
  creature: Pick<CreatureInstance, 'name' | 'stage'>,
  look: Pick<OutfitPreset, 'name'>,
  { worn, skipped }: Pick<WearLookResult, 'worn' | 'skipped'>,
): string {
  if (skipped.length === 0) return `${creature.name} is wearing ${look.name}.`
  const reasons: string[] = []
  const of = (reason: LookSkipReason) => skipped.filter((skip) => skip.reason === reason)
  const stage = of('stage')
  const pass = of('pass')
  const closet = of('closet')
  if (stage.length > 0) {
    reasons.push(
      `${pieceNames(stage)} ${stage.length === 1 ? 'doesn’t' : 'don’t'} fit ${aStage(creature.stage)}.`,
    )
  }
  if (pass.length > 0) {
    reasons.push(`${pieceNames(pass)} ${pass.length === 1 ? 'comes' : 'come'} with the Garden Pass.`)
  }
  if (closet.length > 0) {
    reasons.push(`${pieceNames(closet)} ${closet.length === 1 ? 'isn’t' : 'aren’t'} in your closet.`)
  }
  const opening =
    worn.length === 0
      ? `${creature.name}’s outfit is as it was: nothing in ${look.name} can be worn now.`
      : `${creature.name} is wearing ${look.name}, leaving out ${countedInWords(skipped.length, 'piece', 'pieces')}.`
  return [opening, ...reasons].join(' ')
}
