import type { MoodEntry } from '../types'

/** What the quiet offer under a saved check-in can suggest. */
export type NextStep = 'gentle-day' | 'write-one-line' | 'visit-companion' | 'reflection'

/**
 * Whether a check-in asks for the softer suggestions: Stormy or Rainy
 * weather, or low energy whatever the weather. "Not sure" is stored at the
 * middle level, so on its own it is never read as heavy.
 */
export function isHeavyCheckIn(entry: Pick<MoodEntry, 'level' | 'unsure' | 'energy'>): boolean {
  return (entry.unsure !== true && entry.level <= 2) || entry.energy === 'low'
}

/** What can still be done from Today, so nothing already done is suggested. */
export interface NextStepContext {
  /** Today is not a gentle day yet, and can be made one. */
  canMakeGentle: boolean
  /** Today's reflection is still to be written. */
  canReflect: boolean
  /** The Care page, where caring for a companion costs nothing, is reachable. */
  canVisitCompanion: boolean
}

/**
 * The steps to offer after a check-in, in the order they are shown.
 *
 * After heavy weather or a low-energy day: a gentle day, one line of writing,
 * a visit to a companion. After anything else, "not sure" included: today's
 * reflection. Empty when everything it would suggest is done or out of
 * reach, and then nothing is offered at all.
 */
export function nextStepsAfter(
  entry: Pick<MoodEntry, 'level' | 'unsure' | 'energy'>,
  context: NextStepContext,
): NextStep[] {
  if (!isHeavyCheckIn(entry)) return context.canReflect ? ['reflection'] : []
  const steps: NextStep[] = []
  if (context.canMakeGentle) steps.push('gentle-day')
  if (context.canReflect) steps.push('write-one-line')
  if (context.canVisitCompanion) steps.push('visit-companion')
  return steps
}
