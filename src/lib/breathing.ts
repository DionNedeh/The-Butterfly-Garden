import type { AppState, Goal } from '../types'
import { breathSource } from './gardenActions'
import { DAILY_SUNLIGHT_CAP, sunlightForDate } from './progression'

/**
 * Who breathes with the gardener, where breathing is offered, and what
 * finishing a session earned (plan c.1). Loaded with the pages that offer
 * it, never with the garden.
 */

/** The butterfly whose wings pace the breath. */
export interface Pacer {
  name: string
  speciesId: string
}

/** Marigold is in every garden, so there is always someone to breathe with. */
const MARIGOLD: Pacer = { name: 'Marigold', speciesId: 'monarch' }

/**
 * The active companion once it has wings to open, otherwise Marigold: an
 * egg, caterpillar or chrysalis has nothing to pace a breath with.
 */
export function pacerFor(state: Pick<AppState, 'creatures' | 'profile'>): Pacer {
  const companion = state.creatures.find(
    (creature) =>
      creature.id === state.profile?.activeCompanionId && creature.stage === 'butterfly',
  )
  return companion ? { name: companion.name, speciesId: companion.speciesId } : MARIGOLD
}

/** The suggested goal that a breathing session does exactly. */
const BREATHING_GOAL = 'take three slow breaths'

/**
 * Whether a goal is "Take three slow breaths", however it was typed, so its
 * row can offer to breathe now.
 */
export function isBreathingGoal(goal: Pick<Goal, 'title'>): boolean {
  return (
    goal.title
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[\s.!]+$/, '')
      .trim() === BREATHING_GOAL
  )
}

/**
 * What finishing a session today earns, asked just before it is counted:
 * its Sunlight, nothing because a session already counted today, or
 * nothing because today's Sunlight is already full.
 */
export type BreathOutcome = 'counts' | 'counted' | 'full'

export function breathOutcome(state: AppState, localDate: string): BreathOutcome {
  if (state.sunlight.some((award) => award.source === breathSource(localDate))) return 'counted'
  return sunlightForDate(state, localDate) >= DAILY_SUNLIGHT_CAP ? 'full' : 'counts'
}
