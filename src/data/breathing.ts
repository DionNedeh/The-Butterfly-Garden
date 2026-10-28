/**
 * Breathing with a butterfly (plan c.1): the patterns, as data.
 *
 * Every pattern is slow and breathes out for at least as long as it breathes
 * in. There are no holds and nothing fast: this is a calming exercise, and
 * the gentlest pattern is the one it starts on. lib/breathPacer turns a
 * pattern into a session's timings; nothing here is stored.
 */

export type BreathPatternId = 'slow' | 'sigh'

export interface BreathStep {
  kind: 'in' | 'out'
  /** What the count says while the step lasts: "In… 3". */
  cue: string
  /** How long it lasts, in whole seconds, unless the gardener has chosen. */
  seconds: number
  /** Which of the gardener's two timings sets its length, if either does. */
  adjust?: 'in' | 'out'
  /** How open the wings are as the step ends: 0 folded, 1 spread. */
  open: number
}

export interface BreathPattern {
  id: BreathPatternId
  name: string
  description: string
  /** One breath, in order. The last step always ends with the wings folded. */
  steps: readonly BreathStep[]
}

export const breathPatterns: readonly BreathPattern[] = [
  {
    id: 'slow',
    name: 'Slow breathing',
    description: 'Breathe out a little longer than you breathe in.',
    steps: [
      { kind: 'in', cue: 'In', seconds: 4, adjust: 'in', open: 1 },
      { kind: 'out', cue: 'Out', seconds: 6, adjust: 'out', open: 0 },
    ],
  },
  {
    // The second breath in is a short top-up; the long breath out follows the
    // gardener's own "Breathe out".
    id: 'sigh',
    name: 'Cyclic sigh',
    description: 'Two breaths in through the nose, the second a short top-up, then a long breath out.',
    steps: [
      { kind: 'in', cue: 'In', seconds: 2, open: 0.75 },
      { kind: 'in', cue: 'In again', seconds: 1, open: 1 },
      { kind: 'out', cue: 'Out', seconds: 6, adjust: 'out', open: 0 },
    ],
  },
]

/** The gentle bounds for a breath in and a breath out, in whole seconds. */
export const BREATH_IN_SECONDS = { min: 3, max: 6 } as const
export const BREATH_OUT_SECONDS = { min: 4, max: 8 } as const

/** How long a session lasts, in minutes. */
export const SESSION_MINUTES = [1, 3, 5] as const
export type SessionMinutes = (typeof SESSION_MINUTES)[number]
