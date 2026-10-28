import { moodNames } from '../data/content'
import type { MoodChoice, MoodEntry } from '../types'

/** What the "Not sure today" answer is called wherever a weather is named. */
export const UNSURE_MOOD_NAME = 'Not sure'

/** The answer a stored check-in records. */
export function moodChoiceOf(entry: Pick<MoodEntry, 'level' | 'unsure'>): MoodChoice {
  return entry.unsure === true ? 'unsure' : entry.level
}

/** The name of an answer, as the check-in shows it. */
export function moodName(choice: MoodChoice): string {
  return choice === 'unsure' ? UNSURE_MOOD_NAME : moodNames[choice - 1]
}

/**
 * The stored fields for an answer.
 *
 * "Not sure" keeps the middle level alongside its flag (see MoodEntry), and a
 * level never carries a stale flag, so rewriting an entry either way is clean.
 */
export function moodFields(choice: MoodChoice): Pick<MoodEntry, 'level' | 'unsure'> {
  return choice === 'unsure' ? { level: 3, unsure: true } : { level: choice }
}

/** An entry rewritten with a new answer, keeping everything else. */
export function withMoodChoice(entry: MoodEntry, choice: MoodChoice): MoodEntry {
  const next: MoodEntry = { ...entry, ...moodFields(choice) }
  if (choice !== 'unsure') delete next.unsure
  return next
}
