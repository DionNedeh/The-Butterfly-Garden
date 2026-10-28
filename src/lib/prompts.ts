import { freeWritingPrompt } from '../data/content'
import { reflectionPrompts, seasonalPrompts } from '../data/prompts'
import type { ReflectionPrompt } from '../types'
import { getDailyPromptIndex } from './date'
import type { Season } from './seasons'

const byId = new Map(
  [...reflectionPrompts, ...seasonalPrompts, freeWritingPrompt].map((prompt) => [prompt.id, prompt]),
)

/**
 * A prompt by the id stored with a reflection, free writing and every
 * season's prompts included, so a spring reflection still shows its question
 * in autumn.
 */
export function promptById(id: string): ReflectionPrompt | undefined {
  return byId.get(id)
}

/**
 * The prompts offered in a season: every season's, and that season's own
 * after them, where the gardener's season is known (lib/seasons).
 */
function rotation(season: Season | undefined): readonly ReflectionPrompt[] {
  return season
    ? [...reflectionPrompts, ...seasonalPrompts.filter((prompt) => prompt.season === season)]
    : reflectionPrompts
}

/**
 * The day's prompt, or a later one when the gardener asked for another.
 * The day decides where the rotation starts, so everyone's Tuesday prompt is
 * the same Tuesday prompt, and a reload does not reshuffle it.
 */
export function promptForDay(localDate: string, skipped = 0, season?: Season): ReflectionPrompt {
  const prompts = rotation(season)
  const start = getDailyPromptIndex(localDate, prompts.length)
  return prompts[(start + skipped) % prompts.length]
}

/**
 * The prompt after this one in the rotation, for "Another prompt". From free
 * writing, or a prompt not offered now (no longer, or not this season), it is
 * the day's own prompt.
 */
export function promptAfter(
  prompt: ReflectionPrompt,
  localDate: string,
  season?: Season,
): ReflectionPrompt {
  const prompts = rotation(season)
  const index = prompts.findIndex((item) => item.id === prompt.id)
  return index === -1 ? promptForDay(localDate, 0, season) : prompts[(index + 1) % prompts.length]
}
