import { freeWritingPrompt } from '../data/content'
import { reflectionPrompts } from '../data/prompts'
import type { ReflectionPrompt } from '../types'
import { getDailyPromptIndex } from './date'

const byId = new Map(
  [...reflectionPrompts, freeWritingPrompt].map((prompt) => [prompt.id, prompt]),
)

/** A prompt by the id stored with a reflection, free writing included. */
export function promptById(id: string): ReflectionPrompt | undefined {
  return byId.get(id)
}

/**
 * The day's prompt, or a later one when the gardener asked for another.
 * The day decides where the rotation starts, so everyone's Tuesday prompt is
 * the same Tuesday prompt, and a reload does not reshuffle it.
 */
export function promptForDay(localDate: string, skipped = 0): ReflectionPrompt {
  const start = getDailyPromptIndex(localDate, reflectionPrompts.length)
  return reflectionPrompts[(start + skipped) % reflectionPrompts.length]
}

/**
 * The prompt after this one in the rotation, for "Another prompt". From free
 * writing, or a prompt no longer in the set, it is the day's own prompt.
 */
export function promptAfter(prompt: ReflectionPrompt, localDate: string): ReflectionPrompt {
  const index = reflectionPrompts.findIndex((item) => item.id === prompt.id)
  return index === -1
    ? promptForDay(localDate)
    : reflectionPrompts[(index + 1) % reflectionPrompts.length]
}
